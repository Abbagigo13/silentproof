# SilentProof

> A whistleblower bounty marketplace on NEAR. File an encrypted report, get a signed AI severity score, get paid in USDC.

Built with [Arc Studio](https://studio.arc.io) for [NEAR Hackathon](https://near.army/). Tracks: **AI Security & Defense** and **Real-World Money**.

- Live app: https://silentproof-gules.vercel.app
- Contract (NEAR testnet): [`abbagigo.testnet`](https://testnet.nearblocks.io/address/abbagigo.testnet)
- Payments: Circle USDC on NEAR testnet (`3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af`)

---

## The problem

Whistleblowing exposes fraud, corruption and safety violations, but three things make it fail in practice.

1. **Reporting channels expose the reporter.** Ethics hotlines, HR portals and email need an account or leave metadata that narrows the pool of possible reporters.
2. **Rewards are discretionary.** An organization reads the report, then decides whether to pay. The reporter has already given up the information and has no guarantee of compensation.
3. **There is no credibility signal.** Open bounty programs receive a flood of reports, so real ones get buried and triage takes weeks.

## Who it is for

- **Reporters**: employees, contractors and security researchers who want to report without handing a name to the organization.
- **Organizations**: companies with compliance duties, DAOs and protocols running security or integrity bounties, and anyone who wants a reward program that is provably funded.

## What it does

**For reporters**
- Browse open bounties and pick one.
- Write a report in a web form. It is encrypted in your browser (AES-GCM-256) before anything leaves the page. Only the encrypted file goes to IPFS, and only its content ID and a hash of your payout address go on NEAR.
- An AI scorer decrypts the report, rates severity (Critical, High, Medium) and credibility (0 to 100), and records the result on NEAR with a signature the contract verifies.
- If the organization confirms, USDC is sent to the payout address you gave.

**For organizations**
- Post a bounty with payout tiers and an expiry date, then fund its pool with USDC. The money sits in the contract, so the commitment is visible and cannot be pulled back before the bounty expires.
- Review scored reports and confirm or reject each one. A confirmed payout that fails to transfer is rolled back automatically.

## What is enforced by code

| Property | How |
|---|---|
| Reports are private in transit and at rest | Encrypted in the browser. The decryption key is wrapped to the scorer's public key, so the website, IPFS and the contract never see plaintext. |
| Rewards are funded up front | USDC is deposited into the contract. Withdrawal is only possible after expiry. |
| The score cannot be forged by the organization | `record_tee_score` only accepts a signature that recovers to the registered scorer key. |
| Payouts go to the address the reporter chose | The reporter's payout address is stored as a SHA-256 hash. The contract checks the address the organization enters against it. |

## What is not (be aware)

- **The scorer is not in a real secure enclave on testnet.** The key handling and message formats follow the intended design, but today the scorer is an ordinary process run by the project. Whoever runs it can read reports and sign scores. Hardware attestation (NEAR AI Cloud, Intel TDX) is the planned next step.
- **Submitting needs a NEAR wallet to pay the network fee.** The wallet account is not stored with the report unless the reporter opts in, but it is visible on NEAR. Use a fresh account.
- **The payout address is revealed to the organization** when it confirms, and the payout is a public transfer.
- **IPFS uploads go through Pinata**, so that service sees an encrypted file and the uploader's IP address.
- **Scoring runs in a serverless function** (`api/score.ts`) that holds the scorer's secrets. It is triggered by the app after a submission and by the organization dashboard, so no server has to stay awake. If it is misconfigured, a report stays at "Awaiting TEE scoring".

## Why NEAR

| NEAR feature | Use |
|---|---|
| Rust smart contracts and NEP-141 | Bounty pools, report registry and USDC payouts, including automatic rollback of failed transfers. |
| Onchain signature recovery (`ecrecover`) | The contract accepts a score only from the registered scorer key. |
| Named accounts | Organizations are readable accounts such as `acme.testnet`. |
| Wallet Selector | Organizations and reporters connect with Meteor Wallet. |

Planned, not built yet: a function-call-only access key for the scorer, relayed submissions so reporters need no wallet, and cross-chain payouts with NEAR Intents.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, hosted on Vercel |
| Contract | Rust, NEAR SDK 5, deployed on NEAR testnet |
| Money | Circle USDC (NEP-141) |
| Wallet | NEAR Wallet Selector with Meteor Wallet |
| Encryption | WebCrypto: P-256 ECDH, HKDF, AES-KW and AES-GCM-256 |
| Storage | IPFS through Pinata |
| Scorer | TypeScript (`tee/`), secp256k1 signatures, optional LLM scoring |

---

## Try it (about 10 minutes)

You need a browser, and a NEAR testnet account in [Meteor Wallet](https://wallet.meteorwallet.app) (choose testnet). Get free test USDC and gas for that account first.

1. **Get test USDC.** Open https://faucet.circle.com, choose **NEAR Testnet**, paste your account name and request USDC. You also need a little testnet NEAR for fees; Meteor offers a testnet faucet.
   *You should see:* a USDC balance in your wallet.
2. **Open the app** at https://silentproof-gules.vercel.app, switch to **Organization** and click **Connect NEAR wallet**.
   *You should see:* your account name at the top of the dashboard.
3. **Post a bounty.** Click **Post New Bounty**, keep the defaults (Critical 10, High 5, Medium 2 USDC, 30 days) and create it.
   *You should see:* the bounty under **Your bounties** with a $0 pool and a warning that the pool is below the Critical payout.
4. **Fund it.** Click **Fund pool** on that bounty, send 10 USDC and approve. The first time, also click **Register contract for USDC** if funding fails.
   *You should see:* the pool change to $10 and the warning disappear.
5. **Submit a report.** Switch to **Submitter**, open that bounty and click **Submit a Report**. Write at least 20 characters (the word "fraud" makes the demo scorer rate it Critical), enter a payout address that can hold Circle USDC (your own account works) and submit. Download the key file on the receipt.
   *You should see:* a receipt with an IPFS content ID.
6. **Wait for scoring.** In **Organization**, the report appears under **Pending** with a severity badge and a credibility bar once the scorer has signed it.
   Scoring starts automatically and usually finishes within a minute. If it stays at "Awaiting TEE scoring", the hosted scorer is misconfigured; see the Scorer section under Development.
7. **Confirm the payout.** Click **Confirm**, enter the payout address exactly as you typed it, and approve.
   *You should see:* the report move to **Confirmed**, the pool drop to $0, and the USDC arrive at the payout address.
8. **Reject instead (optional).** On another report click **Reject**; the pool is unchanged.

Light and dark mode: the sun and moon icon in the top bar. The in-app **Docs** page (link in the top bar and footer) has an overview, how it works, the trust model and an FAQ.

---

## Development

### Prerequisites

- [Bun](https://bun.sh) 1.x
- Node 18+ (for NEAR CLI)
- [NEAR CLI](https://docs.near.org/tools/near-cli)
- Rust + `cargo-near` (for contract compilation)

### Install

```bash
bun install
```

### Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `VITE_NEAR_CONTRACT_ADDRESS` | Deployed NEAR contract account (defaults to `abbagigo.testnet`) | No |
| `VITE_TEE_PUBLIC_KEY` | Scorer encryption key (65-byte P-256 hex). Printed by `bun run tee:keygen` | Yes, to submit reports |
| `VITE_USDC_CONTRACT` | USDC token account (defaults to Circle's NEAR testnet USDC) | No |
| `VITE_PINATA_JWT` | Pinata API key with Files: Write only, used to upload encrypted reports to IPFS | Yes, to submit reports |
| `RPC_PROXY_BASE_URL` | Arc Studio RPC proxy base URL | Optional (Arc Studio only) |
| `RPC_PROXY_TOKEN` | Arc Studio RPC proxy token | Optional (Arc Studio only) |
| `RPC_PROXY_CHAINS` | Comma-separated chain keys for RPC proxy | Optional (Arc Studio only) |

### Run

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Lint and typecheck

```bash
bun run check
```

### Scorer

Scoring decrypts a report, rates it, signs the result and records it on NEAR. It runs in two ways that share the same code (`tee/core.ts`):

**Hosted (what the live app uses).** `api/score.ts` runs as a Vercel function. Set these environment variables on the project (not `VITE_` prefixed):

| Variable | Purpose |
|---|---|
| `TEE_KEYS_JSON` | Scorer keys. Print with `bun run tee:env` |
| `TEE_NEAR_PRIVATE_KEY` | Access key that can only call `record_tee_score`. Create with `bun run tee:accesskey` |
| `TEE_NEAR_ACCOUNT_ID` | Account the access key belongs to (the contract account) |
| `NEAR_AI_API_KEY` | Optional. Enables LLM scoring; a keyword scorer is used without it |

**Command line (development).** Needs the `near` CLI logged in as the sending account.

```bash
bun run tee:keygen       # create keys, print VITE_TEE_PUBLIC_KEY and the register_tee_key command
bun run tee:accesskey    # create the restricted key and print the near add-key command
bun run tee:watch        # score new reports as they arrive (add --dry-run to skip sending)
bun run test:tee         # encryption and signature tests
```

---

## Documentation

| Document | Description |
|---|---|
| [`docs/prd.md`](docs/prd.md) | Product requirements — problem, users, flows, functional requirements |
| [`docs/architecture.md`](docs/architecture.md) | System architecture — contract, encryption, TEE scorer, data flow diagrams |
| [`docs/design_system.md`](docs/design_system.md) | Design tokens, typography, component patterns, motion |
| [`docs/security.md`](docs/security.md) | Threat model, anonymity guarantees, contract security, TEE attestation |
| [`docs/code_style.md`](docs/code_style.md) | TypeScript, React, Tailwind, NEAR/crypto conventions |
| [`docs/testing.md`](docs/testing.md) | Testing strategy — contract, encryption, component, E2E |

---

## Roadmap

**Done (hackathon, testnet)**
- [x] Bounty marketplace, encrypted submission flow and organization dashboard
- [x] Rust contract: pools, reports, signature-gated scoring, USDC payouts with automatic rollback
- [x] Browser encryption (P-256 ECDH, HKDF, AES-KW, AES-GCM-256) and IPFS upload
- [x] Scorer: decrypt, score, sign and record onchain, with tests (`bun run test:tee`)
- [x] Circle USDC and Meteor Wallet
- [x] Deployed and exercised end to end on NEAR testnet

**Next**
- [ ] Run the scorer in a real confidential-compute enclave with hardware attestation
- [ ] Always-on hosted scorer with a function-call-only access key
- [ ] Relayed submissions so reporters need no wallet
- [ ] Reporter follow-up using the encryption key file as proof of authorship
- [ ] Multi-signature approval for organization payouts
- [ ] Independent security audit before any mainnet use

**Later**
- [ ] Cross-chain payouts with NEAR Intents
- [ ] Organization reputation (payout rate and response time)
- [ ] Embeddable submission widget for existing compliance portals

---

## Hackathon submission

- Event: NEAR Hackathon, tracks `security` and `realworld`
- Repository: https://github.com/Abbagigo13/silentproof
- Live app: https://silentproof-gules.vercel.app

---

## License

MIT
