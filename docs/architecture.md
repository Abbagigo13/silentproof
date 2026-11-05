# SilentProof — Architecture

**Version:** 0.1
**Last updated:** 2026-10-23

---

## 1. System overview

SilentProof has four layers, each with a distinct trust boundary:

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (submitter)                                            │
│  WebCrypto AES-GCM encryption → IPFS upload → NEAR contract    │
└───────────────────────┬─────────────────────────────────────────┘
                        │ encrypted blob (CID only on-chain)
┌───────────────────────▼─────────────────────────────────────────┐
│  IPFS (nft.storage / web3.storage)                              │
│  Stores encrypted bytes. Has no decryption key. Read-only.     │
└───────────────────────┬─────────────────────────────────────────┘
                        │ CID
┌───────────────────────▼─────────────────────────────────────────┐
│  NEAR Smart Contract (silentproof.testnet)                      │
│  Bounty pool (USDC NEP-141), report registry, payout logic     │
└───────────────────────┬─────────────────────────────────────────┘
                        │ attested score write
┌───────────────────────▼─────────────────────────────────────────┐
│  NEAR AI Cloud TEE (Intel TDX)                                  │
│  TEE scorer (TypeScript) — decrypts, runs LLM, signs result     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. NEAR smart contract

**Account:** `silentproof.testnet` (testnet), `silentproof.near` (mainnet future)
**Language:** Rust, NEAR SDK v5
**Location:** `contracts/near/silentproof/src/lib.rs`

### Storage layout

```rust
// Bounty
pub struct Bounty {
    org_account: AccountId,
    title: String,
    description: String,
    category: BountyCategory,      // Fraud | Security | Policy | Legal
    tier_critical: u128,           // USDC amount (6-decimal NEP-141)
    tier_high: u128,
    tier_medium: u128,
    pool_balance: u128,            // remaining USDC
    expiry: u64,                   // Unix timestamp (ns)
    active: bool,
}

// Report
pub struct Report {
    bounty_id: u64,
    ipfs_cid: String,              // encrypted blob CID — no plaintext
    payout_address: String,        // submitter-provided, hashed in storage
    author_account: Option<AccountId>, // optional authorship proof
    tee_tier: Option<SeverityTier>,
    tee_score: Option<u8>,         // 0–100 credibility
    tee_summary_hash: Option<String>, // hash of summary text; plaintext in TEE only
    status: ReportStatus,          // Pending | Confirmed | Rejected
    submitted_at: u64,
}
```

### Functions

| Function | Caller | Description |
|---|---|---|
| `create_bounty(title, desc, category, tiers, expiry)` | Org | Creates bounty entry |
| `fund_bounty(bounty_id)` | Org (with USDC attachment) | Transfers USDC to contract pool |
| `submit_report(bounty_id, ipfs_cid, payout_address, author)` | Anyone | Registers report CID |
| `record_tee_score(report_id, tier, score, summary_hash, sig)` | TEE key only | Writes AI score; verifies signature against registered TEE key |
| `confirm_payout(report_id)` | Org | Releases USDC from pool to payout_address |
| `reject_report(report_id)` | Org | Returns USDC to pool |
| `withdraw_bounty(bounty_id)` | Org | Reclaims unspent pool after expiry |
| `register_tee_key(public_key)` | Owner (once) | Registers the TEE's ECDSA signing key |

### Access control

- `record_tee_score`: verifies ECDSA signature over `(report_id, tier, score, summary_hash)` against the registered TEE public key. A call from any other account without a valid signature reverts.
- `confirm_payout` / `reject_report` / `withdraw_bounty`: gated to the org account that created the bounty.
- `register_tee_key`: gated to the contract owner account.

### USDC handling

USDC on NEAR is a NEP-141 fungible token. The contract uses `ft_on_transfer` to receive USDC for pool funding. Payouts call `ft_transfer` on the USDC contract. The contract never holds native NEAR for payments — only USDC.

---

## 3. Client-side encryption

**Location:** `src/crypto/encrypt.ts`
**API:** WebCrypto (browser-native, no third-party crypto library)

### Encryption flow (submission)

```
1. Generate AES-GCM 256-bit key:
   key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])

2. Encode report:
   plaintext = new TextEncoder().encode(JSON.stringify({ text, filename, fileBytes }))

3. Encrypt:
   iv = crypto.getRandomValues(new Uint8Array(12))
   ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

4. Wrap the AES key for the TEE (P-256 ECDH + HKDF + AES-KW):
   teePublic = VITE_TEE_PUBLIC_KEY   // 65-byte uncompressed P-256 point
   ephemeral = generateKey ECDH P-256
   secret    = deriveBits(ECDH(ephemeral.private, teePublic), 256)
   wrapKey   = HKDF-SHA256(secret, salt = empty, info = "silentproof-key-wrap") -> AES-KW 256
   bundle    = ephemeral.public (65 bytes) || AES-KW(aesKey)  (40 bytes)

5. Upload one JSON blob to IPFS (Pinata): { version, ciphertext, iv, wrappedKey: bundle }
   Only the CID and the SHA-256 of the payout address go onchain.
   The TEE finds the report by watching the contract; nothing is sent to it directly.
```

### Key export (user backup)

```
rawKey = await crypto.subtle.exportKey('raw', key)
keyFile = { version: 1, algo: 'AES-GCM-256', key: base64(rawKey), cid, reportId }
download as silentproof-key-{timestamp}.json
```

The key file allows the submitter to decrypt their own report later, or to share the key with a trusted party (e.g. a lawyer) without going through SilentProof.

---

## 4. TEE scorer

**Location:** `tee/scorer.ts` (crypto in `tee/crypto.ts`, tests in `tee/crypto.test.ts`)
**Runtime (production design):** NEAR AI Cloud, Intel TDX confidential VM
**Testnet demo:** runs as a normal process (`bun run tee:watch`); not inside a real enclave

### Keys

Two separate keys, because no single curve serves both jobs:

| Key | Curve | Purpose |
|---|---|---|
| Encryption | P-256 (ECDH) | Browsers can encrypt to it with WebCrypto. Public half goes in `VITE_TEE_PUBLIC_KEY`. |
| Signing | secp256k1 | NEAR's `ecrecover` verifies it. Public half is registered with `register_tee_key`. |

### Lifecycle

```
1. Setup (once): `bun run tee:keygen`, set VITE_TEE_PUBLIC_KEY, register the signing key.

2. Watch: `bun run tee:watch` polls the contract for Pending reports with no score.

3. Per report:
   a. Fetch the encrypted blob from IPFS by CID
   b. Unwrap the AES key (ECDH + HKDF + AES-KW), decrypt with AES-GCM
   c. Score: severity (Critical | High | Medium), credibility 0-100, one-line anonymized summary
   d. summary_hash = SHA-256(summary). The summary text stays in the scorer.
   e. digest = keccak256(report_id u64 LE || tier u8 || score u8 || summary_hash 32 bytes)
   f. Sign the digest with the secp256k1 key (low-S, recovery id 0 or 1)
   g. Self-check: recover the signer and compare to the registered key
   h. Send record_tee_score (the contract re-verifies with ecrecover)
   i. Drop the decrypted report
```

### What the TEE stores (zero)

The TEE does not persist any report content. Every decrypted report is wiped from memory after step (i). The only persistent state is the two keys and the NEAR RPC endpoint.

### Testnet mock

During the hackathon demo, a simulated attested key is used. The architecture is identical; the Intel TDX hardware guarantee is replaced by a software simulation. The README notes this clearly.

---

## 5. Frontend

**Framework:** React 18 + Vite + TypeScript
**Routing:** react-router-dom v7
**Wallet:** NEAR Wallet Selector (org side only)
**Animation:** framer-motion
**Icons:** lucide-react

### Route map

| Path | Component | Auth |
|---|---|---|
| `/` | `BountyList` | None |
| `/submit/:bountyId` | `SubmitReport` | None |
| `/org` | `OrgDashboard` | NEAR wallet (org) |
| `/org/bounties` | `OrgDashboard` (bounties tab) | NEAR wallet (org) |

### State management

No global state library. State lives in:
- `ThemeContext` — theme preference (light/dark), persisted to `localStorage`
- `App` — `mode` (submitter/org), passed down as props
- Individual components — form state, submission state, report list

NEAR contract state is read via direct RPC calls (view functions) using `near-api-js`. Write calls go through NEAR Wallet Selector transactions.

### NEAR integration points

| Component | NEAR call |
|---|---|
| `BountyList` | `get_active_bounties()` view |
| `SubmitReport` | `submit_report()` change (relayed via meta-tx for anonymity) |
| `OrgDashboard` | `get_reports_for_org()` view |
| `ReportCard` (confirm) | `confirm_payout()` change |
| `ReportCard` (reject) | `reject_report()` change |
| `PostBountySheet` | `create_bounty()` + USDC `ft_transfer_call()` |

---

## 6. Data flow diagram — anonymous submission

```
Browser                    IPFS              NEAR Contract         TEE Scorer
  │                          │                    │                    │
  │ 1. encrypt(report)       │                    │                    │
  │─────────────────────────►│                    │                    │
  │ 2. CID                   │                    │                    │
  │◄─────────────────────────│                    │                    │
  │                          │                    │                    │
  │ 3. submit_report(CID, payoutAddr)             │                    │
  │───────────────────────────────────────────────►                    │
  │ 4. report_id             │                    │                    │
  │◄───────────────────────────────────────────────                    │
  │                          │                    │                    │
  │ 5. (scorer watches the contract for new reports)                   │
  │────────────────────────────────────────────────────────────────────►
  │                          │                    │                    │
  │                          │ 6. GET encrypted blob by CID            │
  │                          │◄───────────────────────────────────────-│
  │                          │ 7. encrypted bytes  │                   │
  │                          │────────────────────────────────────────►│
  │                          │                    │ 8. record_tee_score│
  │                          │                    │◄───────────────────│
  │                          │                    │ 9. on-chain score  │
```

---

## 7. Deployment

### Testnet (hackathon)
- Frontend: Netlify / Vercel / Hugging Face Spaces (static)
- Contract: NEAR testnet (`silentproof.testnet`)
- TEE: NEAR AI Cloud testnet endpoint (mock attestation)
- IPFS: web3.storage (free tier)

### Mainnet (post-hackathon)
- Frontend: same static host
- Contract: NEAR mainnet (`silentproof.near`)
- TEE: NEAR AI Cloud production (real Intel TDX attestation via Intel Trust Authority)
- IPFS: Filecoin via web3.storage (paid)
