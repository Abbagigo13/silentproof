# Implementation Plan: SilentProof — Anonymous Whistleblower Bounty Marketplace on NEAR

## Summary
SilentProof is a marketplace where any organization posts a USDC bounty for fraud, bug, or policy-violation reports. Whistleblowers submit anonymously through a web form (no wallet required) or with an optional one-time NEAR wallet for on-chain proof of authorship. An AI model inside a NEAR TEE scores each report for credibility and severity, assigns a payout tier, and queues it for the org to confirm — at which point USDC releases directly to a one-time recipient address the submitter controls. No identity is ever stored on-chain or off.

**Hackathon:** NEAR HACKATHON
**Tracks:** `security` (AI Security & Defense) + `realworld` (Real-World Money)
**Submission deadline:** 2026-11-14T23:59:00Z

---

## Architecture

- **Blockchain:** NEAR testnet. Core contract holds the bounty pool, report registry, and TEE attestation verification. NEAR chosen for TEE Attestation (explicit `security` track hint) and Function Call Keys.
- **Contract:** NEAR Rust smart contract — bounty pool, report registry, TEE score recording, payout logic
- **TEE / AI layer:** NEAR AI Cloud (TEE) — Python scorer runs inside TEE, receives encrypted report, scores severity, signs result with attested key, calls `record_tee_score` on-chain
- **Anonymity mechanism:** Report text encrypted client-side (WebCrypto AES-GCM) before IPFS upload. Only the IPFS hash goes on-chain. TEE decrypts via an encrypted channel; no plaintext ever hits a server.
- **Frontend:** React + Vite — two modes in one codebase: public submitter view and org dashboard
- **Wallet:** NEAR Wallet Selector for orgs. Submitter path requires no wallet (form-only) or a freshly generated keypair (optional).

---

## Contract Functions

| Function | Access | Description |
|---|---|---|
| `create_bounty` | Org | Deposit USDC, set title, category, payout tiers (critical/high/medium) |
| `submit_report` | Anyone | Store IPFS hash + optional one-time NEAR account for authorship proof |
| `record_tee_score` | TEE attested key only | Write severity tier and score to a report entry |
| `confirm_payout` | Org | Release USDC to submitter's provided address |
| `reject_report` | Org | Keep USDC in pool |
| `withdraw_bounty` | Org | Reclaim unspent pool after expiry |

---

## Files to Create/Modify

1. `contracts/near/silentproof/src/lib.rs` — NEAR contract: bounty pool, report registry, TEE score recording, payout logic
2. `contracts/near/silentproof/Cargo.toml` — Rust crate manifest
3. `tee/scorer.py` — AI scoring service for NEAR AI Cloud TEE; receives report, scores severity, signs result
4. `tee/requirements.txt` — Python deps for TEE service
5. `src/near/config.ts` — NEAR testnet RPC, contract address, USDC NEP-141 address
6. `src/near/wallet.ts` — NEAR Wallet Selector + Function Call Key setup for orgs
7. `src/near/contract.ts` — typed wrappers for all contract view/change calls
8. `src/crypto/encrypt.ts` — client-side AES-GCM encryption + IPFS upload helper
9. `src/components/BountyList.tsx` — public marketplace: cards for each live bounty
10. `src/components/SubmitReport.tsx` — anonymous submission form: text, file upload, optional wallet, payout address input
11. `src/components/OrgDashboard.tsx` — post bounty, fund pool, review scored queue
12. `src/components/ReportQueue.tsx` — scored report cards with tier badge, confirm/reject buttons
13. `src/components/Layout.tsx` — navigation shell with submitter / org mode toggle
14. `src/App.tsx` — routing and wallet provider wiring (modify existing file)
15. `README.md` — machine-readable: problem, NEAR features used (TEE attestation, Function Call Keys), judge step-by-step instructions

---

## Build Sequence

1. Write and compile the NEAR Rust contract; deploy to NEAR testnet
2. Scaffold `src/near/config.ts`, `wallet.ts`, `contract.ts` — NEAR Wallet Selector and contract bindings
3. Build client-side encryption module (`encrypt.ts`) and IPFS upload helper
4. Build public BountyList and SubmitReport components
5. Build Org Dashboard — post bounty form, fund pool action
6. Build ReportQueue — TEE score display, confirm/reject flow
7. Write TEE scorer (`tee/scorer.py`) with mock attestation for testnet demo
8. Wire routing and wallet provider into `App.tsx`
9. Write `README.md` with judge instructions
10. End-to-end test: org posts bounty → submitter files report → TEE scores → org confirms → USDC releases

---

## Done When

- [ ] Contract deployed on NEAR testnet; address in `src/near/config.ts`
- [ ] Org can post a bounty and fund it with testnet USDC
- [ ] Submitter can file a report via form with no wallet connected
- [ ] Report content is encrypted client-side; only the IPFS hash is on-chain
- [ ] TEE scorer assigns a severity tier and writes it on-chain with attested key
- [ ] Org dashboard shows scored report queue with tier badges
- [ ] Org confirm triggers USDC release to submitter's one-time address
- [ ] Org reject keeps USDC in pool
- [ ] Optional NEAR wallet path works alongside the anonymous form path
- [ ] README covers problem, NEAR primitives used, and do-X-see-Y judge steps

---

## Hackathon Submission Checklist (complete before Nov 14)

Collect these before submitting — do not guess or fill in placeholders:

- [ ] Project name (2-80 chars, unique)
- [ ] Team lead name + contact email
- [ ] Team size
- [ ] NEAR mainnet account for prize payout
- [ ] Public GitHub repo URL (must be public by Nov 14)
- [ ] Public X demo post URL
- [ ] "What you built" description (20-2000 chars)
- [ ] Consent to organizer contact notice
