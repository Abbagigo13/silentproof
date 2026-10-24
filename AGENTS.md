# SilentProof

> Built with Arc Studio - money-powered apps in minutes

Anonymous whistleblower bounty marketplace for NEAR Hackathon.
Tracks: `security` (AI Security & Defense) + `realworld` (Real-World Money)
Deadline: 2026-11-14T23:59:00Z

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, react-router-dom v7
- Blockchain: NEAR testnet — Rust smart contract (NEAR SDK v5)
- Wallet: NEAR Wallet Selector (org side), anonymous form (submitter side)
- Encryption: WebCrypto AES-GCM-256 + ECDH key wrapping (client-side, browser)
- Storage: IPFS (web3.storage) — encrypted blobs only, never plaintext
- TEE: NEAR AI Cloud (Intel TDX) — Python scorer with ECDSA attestation
- Toasts: Sonner

## Contract

- Path: `contracts/near/silentproof/src/lib.rs`
- Language: Rust, NEAR SDK v5.5
- Build: `cd contracts/near/silentproof && cargo build --target wasm32-unknown-unknown --release`
- Deploy: `near deploy --accountId silentproof.testnet --wasmFile target/wasm32-unknown-unknown/release/silentproof.wasm`
- Contract ID (testnet): TBD — deploy on Nov 1 when build window opens
- USDC contract (testnet): `usdc.fakes.testnet`

## Key Functions (contract)

| Function | Caller | Description |
|---|---|---|
| `create_bounty` | Org | Create bounty, funded separately via ft_transfer_call |
| `ft_on_transfer` | USDC contract | NEP-141 callback — funds the bounty pool |
| `submit_report` | Anyone (relayable) | Store IPFS CID + payout address hash |
| `record_tee_score` | TEE Function Call Key | Write severity tier + credibility score |
| `confirm_payout` | Org | Release USDC to submitter's payout address |
| `reject_report` | Org | Keep USDC in pool |
| `withdraw_bounty` | Org | Reclaim unspent pool after expiry |

## TEE Scorer

- Path: `tee/scorer.py`
- Run: `pip install -r tee/requirements.txt && python tee/scorer.py --report-id <id> --ipfs-cid <cid> --wrapped-key <b64>`
- Set env: `TEE_PRIVATE_KEY_HEX`, `NEAR_AI_API_KEY`, `SILENTPROOF_CONTRACT_ID`
- First run generates a key pair and prints the `register_tee_key` command

## Encryption

- Path: `src/crypto/encrypt.ts`
- Main export: `encryptAndUpload(reportText, payoutAddress, fileBytes?)`
- TEE public key: update `TEE_PUBLIC_KEY_HEX` after deploying the TEE scorer

## GitHub

- Repo: https://github.com/Abbagigo13/silentproof
- Branch: main

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
