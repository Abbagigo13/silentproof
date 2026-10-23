# SilentProof — Security Model

**Version:** 0.1
**Last updated:** 2026-10-23

---

## 1. Threat model

SilentProof protects submitters against adversaries who may include:

| Adversary | Capability | Mitigated by |
|---|---|---|
| The organization being reported on | Sees report content, identifies reporter | Client-side encryption; no plaintext server path |
| The SilentProof operator | Has access to servers, logs, and IPFS nodes | Client-side encryption; operator cannot decrypt |
| A court order against SilentProof | Compels production of user data | No PII stored; encrypted blobs are unintelligible without the key |
| A network attacker (ISP, exit node) | Sees traffic metadata, IP | HTTPS everywhere; meta-transactions hide submitter's on-chain activity |
| A compromised IPFS gateway | Can read stored blobs | Blobs are AES-GCM encrypted — gateway sees ciphertext only |
| A compromised NEAR RPC node | Can read contract state | Contract stores CID and payout address hash, not report content |
| A malicious TEE operator | Tries to read report inside TEE | Intel TDX hardware isolation prevents host access; Intel Trust Authority attests integrity |

### Out of scope
- Physical access to the submitter's device
- Browser extensions with full page access (a malicious extension could intercept before encryption)
- Social engineering of the submitter
- Timing correlation attacks (a determined adversary who knows when a report was submitted and can correlate IPFS upload times)

---

## 2. Anonymity guarantees

### What we guarantee
- Report plaintext is never sent to any server
- The NEAR contract stores only: IPFS CID (hash of encrypted blob), hashed payout address, optional NEAR account ID
- The frontend server (if any) never sees the encryption key
- The TEE decrypts the report in a hardware-isolated enclave; the host OS, hypervisor, and NEAR AI staff cannot read it
- The TEE wipes decrypted content from memory after scoring

### What we do not guarantee
- IP address anonymity — submitters who need this should use Tor or a VPN before accessing SilentProof
- Timing anonymity — a report submitted 5 minutes after an incident can still be correlated by a sophisticated adversary
- Browser fingerprint anonymity — submitters in high-risk situations should use a private browsing window or a fresh device

### What the submitter controls
- The encryption key never leaves their browser unless they download it
- They provide their own payout address — SilentProof has no record of which address belongs to whom
- The optional NEAR authorship proof is their choice — omitting it reduces the on-chain linkage

---

## 3. Smart contract security

### Access control
All privileged functions have explicit account-based access control:

| Function | Guard |
|---|---|
| `record_tee_score` | ECDSA signature verification against registered TEE public key |
| `confirm_payout` | `assert_eq!(env::predecessor_account_id(), bounty.org_account)` |
| `reject_report` | Same as confirm_payout |
| `withdraw_bounty` | Same, plus `assert!(env::block_timestamp() >= bounty.expiry)` |
| `register_tee_key` | `assert_eq!(env::predecessor_account_id(), self.owner)` |

### Fund custody
- USDC is transferred to the contract via `ft_transfer_call` (NEP-141 standard atomic transfer)
- The contract never takes custody of native NEAR — only USDC
- Pool funds cannot be withdrawn by the org until expiry
- The contract emits a `payout_released` event on every `confirm_payout` call — independently auditable

### Reentrancy
- NEAR's async execution model (promises) means classic EVM reentrancy does not apply
- All state updates precede cross-contract calls (USDC `ft_transfer`)
- The contract uses NEAR SDK's `#[near_bindgen]` — panics in callbacks cannot drain the pool

### Integer overflow
- All USDC amounts use `u128` — no overflow on any realistic pool size
- Tier amounts are set by the org at creation and cannot be changed after reports are submitted

### TEE key registration
- The TEE public key is registered once by the contract owner at deployment
- There is no key rotation mechanism in v1 — rotation requires a new deployment

---

## 4. Encryption implementation

### Algorithm
AES-256-GCM via WebCrypto (`crypto.subtle`).

| Parameter | Value | Rationale |
|---|---|---|
| Algorithm | AES-GCM | Authenticated encryption — detects tampering |
| Key length | 256 bits | Maximum WebCrypto AES key size |
| IV length | 96 bits (12 bytes) | NIST recommended for GCM |
| IV generation | `crypto.getRandomValues` | Cryptographically secure random |
| IV storage | Prepended to ciphertext in IPFS blob | Required for decryption |

### Why client-side
The encryption key is generated in the browser and never sent to any server in plaintext. This means:
- A server-side attacker who gains access to the IPFS node, the NEAR RPC, or the SilentProof backend cannot decrypt any report
- A subpoena against SilentProof cannot produce report contents — the company does not have the key

### Key wrapping for TEE
The symmetric key is wrapped with the TEE's RSA-OAEP public key (obtained from its Intel Trust Authority attestation report) before being sent to the TEE endpoint. This ensures:
- The key travels encrypted over TLS to the TEE
- Inside the TEE, the private key unwraps it in hardware
- The host OS cannot observe the unwrapped key

---

## 5. TEE attestation

The NEAR AI Cloud TEE uses Intel TDX (Trust Domain Extensions). The attestation flow:

```
1. TEE generates a fresh Intel TDX quote containing:
   - RTMR3 (measured runtime hash of the scorer code and config)
   - Report data field bound to the TEE signing key and request nonce

2. Quote is sent to Intel Trust Authority (independent verifier)
   - ITA checks the quote against Intel's TDX reference values
   - ITA issues a signed JWT attestation token

3. Client (or anyone) can verify:
   a. Fetch the attestation report from the TEE endpoint
   b. Submit to Intel Trust Authority for independent verification
   c. Check that the signing_address in the report matches the key registered on NEAR
   d. Check that MRCONFIGID matches the expected scorer code hash

4. Every record_tee_score call carries an ECDSA signature over the payload
   - The NEAR contract verifies the signature against the registered TEE key
   - A score written without a valid TEE signature is rejected at the contract level
```

This means: even if someone compromises the SilentProof server, they cannot forge a TEE score without a valid Intel TDX attestation.

---

## 6. Meta-transactions

Submitters who want to avoid any on-chain footprint can have their `submit_report` transaction relayed by the SilentProof frontend server. The relayer signs and pays gas; the submitter's account ID does not appear in the transaction.

This is optional. The NEAR contract does not require a specific account to call `submit_report` — any account (or a relayed meta-tx) is accepted. The relayer cannot modify the payload (the CID and payout address hash are provided by the client).

---

## 7. Known limitations and accepted risks

| Limitation | Accepted risk | Mitigation (future) |
|---|---|---|
| Browser extension could intercept pre-encryption | Low — targeted attack on a specific user | Out of scope for v1 |
| IP address visible to IPFS gateway | Medium — correlatable for sophisticated adversary | Tor gateway option (future) |
| TEE key rotation not implemented in v1 | Low — TEE compromise would require physical Intel TDX exploit | Key rotation via governance proposal |
| Org can see AI summary (but not plaintext) | Low — summary is generated to exclude PII | TEE summary generation reviewed carefully |
| IPFS content addressing is permanent | Low — encrypted blob removal not possible once pinned | Encrypted = unintelligible even if pinned forever |
