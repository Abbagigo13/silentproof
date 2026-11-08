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

- Shared pipeline: `tee/core.ts`; keys and signing: `tee/crypto.ts`; CLI: `tee/scorer.ts`; hosted: `api/score.ts` (Vercel function)
- The app calls `POST /api/score` after a submission (`src/near/score.ts`) and the org dashboard calls it while any report is unscored
- Hosted env (Vercel, not VITE_): `TEE_KEYS_JSON` (`bun run tee:env`), `TEE_NEAR_PRIVATE_KEY` + `TEE_NEAR_ACCOUNT_ID` (`bun run tee:accesskey`, a function-call key limited to `record_tee_score`), optional `NEAR_AI_API_KEY`
- CLI: `bun run tee:keygen`, `tee:watch`, `tee:score -- --report-id N`, `--dry-run`; sending uses the `near` CLI (custom RPC via `NEAR_TESTNET_RPC`)
- Tests: `bun run test:tee`; `bun run typecheck` also checks `api/` and `tee/` via `tsconfig.server.json`

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

## Deployed contract (NEAR testnet)
- Account: `abbagigo.testnet` (owner `abbagigo.testnet`; USDC token = Circle USDC `3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af`)
- `new(owner, usdc_contract)`; re-running it is allowed only from the contract account and wipes state (the TEE key must then be registered again)
- Judges/users get test USDC free at https://faucet.circle.com (NEAR Testnet), so we never fund anyone
- Deploy tx: GefQcTd3QjExj4zMDbX68KcDckJjYPbNPKdn3eJA2HmU
- Build: `cargo near build non-reproducible-wasm --no-abi` (in Codespaces), 190 KB wasm
- Frontend reads it via `VITE_NEAR_CONTRACT_ADDRESS` (set to `abbagigo.testnet`)
- Prize payout account for the hackathon form (mainnet): `abbagigo.tg`
- None of the contract's change methods are `#[payable]`: attach 0 deposit (only USDC `ft_transfer_call` takes 1 yocto)

## Setup still required before a real end-to-end run
- `bun run tee:keygen`, then set `VITE_TEE_PUBLIC_KEY` and run the printed `register_tee_key` command as the owner
- `VITE_PINATA_JWT` (Pinata key with Files: Write only) for IPFS uploads
- Circle test USDC for the org account (faucet.circle.com); the contract account must be registered on the token once (`storage_deposit`)
