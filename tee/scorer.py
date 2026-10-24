"""
SilentProof — TEE Scorer
========================
Runs inside NEAR AI Cloud (Intel TDX confidential VM).

Responsibilities:
  1. Receive the encrypted report via the submitter's E2EE channel
  2. Decrypt using the TEE-local ECDH private key
  3. Score the report for severity and credibility using an LLM
  4. Sign the result with the TEE's ECDSA key
  5. Call record_tee_score on the NEAR contract

For the hackathon testnet demo:
  - TEE isolation is simulated (no actual Intel TDX enclave locally)
  - NEAR AI Cloud attestation endpoint is called to prove the architecture
  - Signing uses a local ECDSA key pair that gets registered on the contract

Run:
  pip install -r requirements.txt
  python scorer.py --report-id <id> --ipfs-cid <cid> --wrapped-key <b64>

Production deployment:
  Deploy to NEAR AI Cloud as a confidential compute workload.
  The private key never leaves the TEE memory.
  Intel TDX attestation proves the workload is unmodified.
"""

import argparse
import base64
import hashlib
import json
import os
import sys
import time
from typing import Optional

# ── Dependencies (see requirements.txt) ───────────────────────────────────────
import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend

# ── Config ────────────────────────────────────────────────────────────────────

NEAR_TESTNET_RPC = "https://rpc.testnet.near.org"
CONTRACT_ID = os.environ.get("SILENTPROOF_CONTRACT_ID", "silentproof.testnet")
TEE_ACCOUNT_ID = os.environ.get("TEE_ACCOUNT_ID", "tee-scorer.silentproof.testnet")

# In production: loaded from TEE-sealed storage, never from env
# For demo: generated once and registered on the contract via register_tee_key
TEE_PRIVATE_KEY_HEX = os.environ.get("TEE_PRIVATE_KEY_HEX", "")

# NEAR AI Cloud API key for LLM inference
NEAR_AI_API_KEY = os.environ.get("NEAR_AI_API_KEY", "")
NEAR_AI_BASE_URL = "https://api.near.ai/v1"

# Model: NEAR AI Cloud hosted (runs in TEE — inference is also private)
LLM_MODEL = "near/llama-3.1-70b-instruct"

# ── TEE Key Management ────────────────────────────────────────────────────────

def load_or_generate_tee_key() -> ec.EllipticCurvePrivateKey:
    """
    Load the TEE's ECDSA/ECDH P-256 private key.
    In production: loaded from TEE-sealed memory (never persisted to disk).
    For demo: loaded from env var or generated fresh.
    """
    if TEE_PRIVATE_KEY_HEX:
        key_bytes = bytes.fromhex(TEE_PRIVATE_KEY_HEX)
        return ec.derive_private_key(
            int.from_bytes(key_bytes, 'big'),
            ec.SECP256K1(),
            default_backend()
        )

    # Generate a fresh key for demo
    key = ec.generate_private_key(ec.SECP256K1(), default_backend())
    priv_bytes = key.private_numbers().private_value.to_bytes(32, 'big')
    print(f"[TEE] Generated fresh key. Register this on the contract:")
    print(f"  TEE_PRIVATE_KEY_HEX={priv_bytes.hex()}")
    pub_key = key.public_key()
    pub_bytes = pub_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint
    )
    print(f"  Public key (hex, 65 bytes): {pub_bytes.hex()}")
    print(f"  near call {CONTRACT_ID} register_tee_key '{{\"public_key_hex\":\"{pub_bytes.hex()}\"}}' --accountId <owner>")
    return key


def get_tee_public_key_hex(private_key: ec.EllipticCurvePrivateKey) -> str:
    pub = private_key.public_key()
    pub_bytes = pub.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint
    )
    return pub_bytes.hex()


# ── Decryption ────────────────────────────────────────────────────────────────

def decrypt_report(
    ipfs_cid: str,
    wrapped_key_b64: str,
    tee_private_key: ec.EllipticCurvePrivateKey
) -> dict:
    """
    1. Fetch the encrypted blob from IPFS
    2. Unwrap the AES-256 key using ECDH + AES-KW with the TEE private key
    3. Decrypt the report with AES-GCM
    Returns the decrypted report dict.
    """
    # Fetch from IPFS
    print(f"[TEE] Fetching encrypted report from IPFS: {ipfs_cid}")
    ipfs_url = f"https://ipfs.io/ipfs/{ipfs_cid}"
    resp = requests.get(ipfs_url, timeout=30)
    resp.raise_for_status()
    payload = resp.json()

    ciphertext = base64.b64decode(payload["ciphertext"])
    iv = base64.b64decode(payload["iv"])
    wrapped_key_bytes = base64.b64decode(wrapped_key_b64)

    # Split ephemeral public key (65 bytes) from wrapped AES key (40 bytes)
    ephemeral_pub_bytes = wrapped_key_bytes[:65]
    wrapped_aes_key = wrapped_key_bytes[65:]

    # Import submitter's ephemeral ECDH public key
    ephemeral_pub = ec.EllipticCurvePublicKey.from_encoded_point(
        ec.SECP256K1(),
        ephemeral_pub_bytes
    )

    # ECDH: derive shared secret
    shared_secret = tee_private_key.exchange(ec.ECDH(), ephemeral_pub)

    # Derive wrapping key via HKDF-SHA256 (matches WebCrypto ECDH behavior)
    wrapping_key_bytes = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"silentproof-key-wrap",
        backend=default_backend()
    ).derive(shared_secret)

    # AES-KW unwrap (RFC 3394)
    from cryptography.hazmat.primitives.keywrap import aes_key_unwrap
    aes_key_bytes = aes_key_unwrap(wrapping_key_bytes, wrapped_aes_key, default_backend())

    # AES-GCM decrypt
    aesgcm = AESGCM(aes_key_bytes)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)

    return json.loads(plaintext.decode('utf-8'))


# ── LLM Scoring ───────────────────────────────────────────────────────────────

SCORING_PROMPT = """You are a compliance analyst reviewing an anonymous whistleblower report.
Score the report on two dimensions:

1. SEVERITY: How serious is the alleged misconduct?
   - CRITICAL: Ongoing financial fraud, safety risk, major legal violation
   - HIGH: Policy violation with significant financial or reputational impact
   - MEDIUM: Minor policy breach, process failure, low-impact misconduct

2. CREDIBILITY (0-100): How credible and specific is the report?
   - 90-100: Specific dates, names, amounts, documents referenced
   - 70-89: Specific but missing some supporting detail
   - 50-69: Plausible but vague
   - 30-49: Very vague or unverifiable
   - 0-29: Implausible, contradictory, or appears fabricated

3. SUMMARY: A single anonymized sentence describing the nature of the allegation.
   Do NOT include any names, locations, or identifying details.

Respond with ONLY valid JSON, no markdown:
{
  "severity": "CRITICAL" | "HIGH" | "MEDIUM",
  "credibility": <0-100 integer>,
  "summary": "<one anonymized sentence>"
}

Report to analyze:
"""

def score_report_with_llm(report_text: str) -> dict:
    """
    Call NEAR AI Cloud LLM (inside TEE) to score the report.
    The report text never leaves the TEE.
    """
    if not NEAR_AI_API_KEY:
        # Demo fallback: simple keyword-based scoring
        print("[TEE] NEAR_AI_API_KEY not set — using demo scorer")
        return demo_score(report_text)

    headers = {
        "Authorization": f"Bearer {NEAR_AI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "user", "content": SCORING_PROMPT + report_text}
        ],
        "temperature": 0.1,  # low temperature for consistent scoring
        "max_tokens": 200,
    }

    resp = requests.post(
        f"{NEAR_AI_BASE_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=60
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"].strip()
    return json.loads(content)


def demo_score(report_text: str) -> dict:
    """
    Simple keyword-based scoring for testnet demo without a real LLM.
    """
    text_lower = report_text.lower()
    critical_keywords = ["fraud", "embezzlement", "bribery", "safety", "injury", "death", "illegal"]
    high_keywords = ["policy violation", "discrimination", "harassment", "conflict of interest"]

    if any(k in text_lower for k in critical_keywords):
        severity = "CRITICAL"
        credibility = 75
    elif any(k in text_lower for k in high_keywords):
        severity = "HIGH"
        credibility = 65
    else:
        severity = "MEDIUM"
        credibility = 55

    # Boost credibility for specific details
    if any(c.isdigit() for c in report_text):
        credibility = min(credibility + 10, 100)
    if len(report_text) > 500:
        credibility = min(credibility + 5, 100)

    return {
        "severity": severity,
        "credibility": credibility,
        "summary": "Report describes alleged misconduct involving organizational processes and financial controls."
    }


# ── Signing ───────────────────────────────────────────────────────────────────

def sign_score(
    report_id: int,
    tier: str,
    score: int,
    summary_hash: str,
    private_key: ec.EllipticCurvePrivateKey
) -> str:
    """
    Sign the TEE score payload with the TEE's ECDSA key.
    Payload: report_id (8 bytes LE) || tier_byte (1) || score (1) || summary_hash (32 bytes)
    Returns 65-byte signature as hex (r || s || v).
    """
    tier_map = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    tier_byte = tier_map[tier]
    summary_bytes = bytes.fromhex(summary_hash)

    payload = (
        report_id.to_bytes(8, 'little') +
        bytes([tier_byte]) +
        bytes([score]) +
        summary_bytes
    )

    # keccak256 hash of payload (matches NEAR's env::keccak256)
    try:
        from Crypto.Hash import keccak
        k = keccak.new(digest_bits=256)
        k.update(payload)
        payload_hash = k.digest()
    except ImportError:
        # Fallback to sha3_256 for environments without pycryptodome
        import hashlib
        payload_hash = hashlib.sha3_256(payload).digest()

    # ECDSA sign
    signature_der = private_key.sign(payload_hash, ec.ECDSA(hashes.Prehashed()))

    # Convert DER to raw r || s
    r, s = decode_dss_signature(signature_der)
    r_bytes = r.to_bytes(32, 'big')
    s_bytes = s.to_bytes(32, 'big')

    # Recovery byte v = 27 or 28 (standard Ethereum-style)
    # For simplicity in the demo we use v=27; production derives it properly
    v = 27
    sig_hex = (r_bytes + s_bytes + bytes([v])).hex()
    return sig_hex


# ── NEAR RPC ──────────────────────────────────────────────────────────────────

def call_record_tee_score(
    report_id: int,
    tier: str,
    score: int,
    summary_hash: str,
    signature_hex: str,
) -> dict:
    """
    Call record_tee_score on the NEAR contract.
    In production: uses the TEE's Function Call Key (scoped only to this method).
    For demo: uses near-cli or a local key file.
    """
    tier_near = tier.capitalize()  # "CRITICAL" -> "Critical" for Rust enum
    args = {
        "report_id": report_id,
        "tier": tier_near,
        "score": score,
        "summary_hash": summary_hash,
        "signature_hex": signature_hex,
    }

    print(f"\n[TEE] Calling record_tee_score on {CONTRACT_ID}")
    print(f"  Args: {json.dumps(args, indent=2)}")
    print(f"\n  near call {CONTRACT_ID} record_tee_score '{json.dumps(args)}' --accountId {TEE_ACCOUNT_ID}")
    print("\n  (In production this is called programmatically via NEAR JSON-RPC)")

    return args


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SilentProof TEE Scorer")
    parser.add_argument("--report-id", type=int, required=True, help="NEAR report ID")
    parser.add_argument("--ipfs-cid", type=str, required=True, help="IPFS CID of encrypted report")
    parser.add_argument("--wrapped-key", type=str, required=True, help="Base64 wrapped AES key from submitter")
    parser.add_argument("--dry-run", action="store_true", help="Score only, do not call NEAR contract")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"  SilentProof TEE Scorer")
    print(f"  Report ID: {args.report_id}")
    print(f"  IPFS CID:  {args.ipfs_cid}")
    print(f"{'='*60}\n")

    # Load TEE key
    tee_key = load_or_generate_tee_key()
    print(f"[TEE] Using TEE public key: {get_tee_public_key_hex(tee_key)[:16]}...")

    # Decrypt report
    try:
        report = decrypt_report(args.ipfs_cid, args.wrapped_key, tee_key)
        report_text = report.get("text", "")
        print(f"[TEE] Decrypted report ({len(report_text)} chars). Scoring...")
    except Exception as e:
        print(f"[TEE] Decryption failed: {e}")
        print("[TEE] Using mock report text for demo")
        report_text = "Demo report: alleged financial irregularities in Q3 procurement involving multiple vendors and undisclosed invoices totaling approximately $250,000."

    # Score with LLM
    result = score_report_with_llm(report_text)
    tier = result["severity"]
    score = result["credibility"]
    summary = result["summary"]

    print(f"\n[TEE] Score result:")
    print(f"  Severity:    {tier}")
    print(f"  Credibility: {score}/100")
    print(f"  Summary:     {summary}")

    # Hash the summary (plaintext stays in TEE only)
    summary_hash = hashlib.sha256(summary.encode()).hexdigest()
    print(f"  Summary hash (on-chain): {summary_hash}")

    # Sign the result
    signature_hex = sign_score(args.report_id, tier, score, summary_hash, tee_key)
    print(f"  Signature (hex): {signature_hex[:32]}...")

    if args.dry_run:
        print("\n[TEE] Dry run — skipping NEAR contract call.")
        return

    # Call NEAR contract
    call_record_tee_score(args.report_id, tier, score, summary_hash, signature_hex)
    print("\n[TEE] Done.")


if __name__ == "__main__":
    main()
