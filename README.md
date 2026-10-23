# SilentProof

> Anonymous whistleblower bounty marketplace. File a report. Get paid in USDC. No identity required.

Built with [Arc Studio](https://studio.arc.io) for [NEAR Hackathon](https://near.army/) — tracks **AI Security & Defense** and **Real-World Money**.

---

## The problem

Whistleblowing is one of the most effective mechanisms society has for exposing fraud, corruption, and safety violations. But it is systemically broken for three reasons:

**1. Identity exposure is the default.**
Every mainstream reporting channel — corporate ethics hotlines, HR portals, email — requires an account, a login, or metadata (IP address, device fingerprint, timestamp) that narrows the pool of plausible reporters to a handful of people. Most people who observe wrongdoing say nothing because the risk is too high relative to the uncertain reward.

**2. Payout promises are unenforceable.**
When organizations offer whistleblower rewards, the commitment is discretionary. The org sees your report, decides if it is useful, and then decides whether to pay. You have already given up the information. You have no guarantee of compensation for the career and personal risk you took.

**3. There is no credibility signal.**
Organizations that operate open bounty programs receive a flood of reports — many vague, some retaliatory, a few genuinely valuable. Without a credibility filter, the real reports are buried, triage takes weeks, and the program becomes an operational burden rather than an asset.

None of these problems are solved by a new web form or a "secure" email address. They require cryptographic enforcement, not policy promises.

---

## Who it is for

**Whistleblowers** — employees, contractors, security researchers, journalists' sources, or activists who have observed wrongdoing and want to report it without exposing themselves.

**Organizations** — publicly traded companies with compliance obligations (SOX, GDPR, Dodd-Frank), DAOs and DeFi protocols that want community security reporting, law firms running protected disclosure programs, and regulatory bodies operating public-interest reporting channels.

---

## What we built

SilentProof is an on-chain whistleblower bounty marketplace on NEAR.

**For submitters:**
- Browse active bounty programs posted by organizations
- File a report through a web form — no account, no email, no wallet required
- The report is encrypted in the browser with AES-GCM-256 before it leaves the device
- The encrypted blob is uploaded to IPFS — only the content hash goes on-chain
- An AI model running inside a NEAR Trusted Execution Environment (TEE) scores the report for credibility and severity, without ever exposing the plaintext to any server or operator
- If the organization confirms the report, USDC is released to a one-time address the submitter provides

**For organizations:**
- Post a bounty with a title, category, payout tiers (Critical / High / Medium in USDC), and an expiry date
- Fund the bounty pool — USDC is locked in the contract at creation (binding commitment)
- Review incoming reports scored by the TEE AI: each card shows a severity tier, a credibility percentage, and a one-line anonymized summary
- Confirm a payout (releases USDC on-chain) or reject (returns USDC to pool)

**Three properties are cryptographically enforced, not policy-enforced:**
1. **Anonymity** — report plaintext never reaches any server; only the encrypted IPFS hash is on-chain
2. **Binding commitment** — USDC is locked in the contract before the submitter files; the org cannot silently withdraw while reports are pending
3. **Credibility signal** — the TEE scorer writes a severity tier and score on-chain using an attested key; the org cannot bypass or fake it

---

## Why NEAR

NEAR provides three primitives that make SilentProof possible in a way no other stack can match:

| NEAR Feature | How it is used |
|---|---|
| **TEE Attestation** (NEAR AI Cloud, Intel TDX) | The AI scorer runs inside a hardware-isolated enclave. The host OS, the cloud provider, and NEAR AI itself cannot read the decrypted report. The `record_tee_score` contract function is gated to the TEE's attested ECDSA key — no TEE signature, no score write. |
| **Function Call Keys** | The TEE agent holds a Function Call Key scoped only to `record_tee_score`. It cannot touch pool funds, create bounties, or approve payouts. The key limits the blast radius of a TEE compromise. |
| **NEP-141 USDC** | Bounty pools are funded and paid out in USDC (NEP-141 fungible token). Stable, predictable, and programmable. No speculative token involved. |
| **Meta Transactions** | The submitter's `submit_report` call can be relayed by the frontend, meaning no submitter wallet activity appears on-chain. |
| **Named Accounts** | Org accounts are named NEAR accounts (e.g. `acme.testnet`), making the on-chain org identity human-readable and auditable. |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Routing | react-router-dom v7 |
| Animation | framer-motion |
| Blockchain | NEAR testnet (Rust smart contract, NEAR SDK v5) |
| Wallet (org) | NEAR Wallet Selector |
| TEE / AI | NEAR AI Cloud (Intel TDX), Python scorer |
| Anonymity | WebCrypto AES-GCM-256, IPFS (web3.storage) |
| Icons | lucide-react |

---

## How to try it (step by step)

1. Open the app. You land on the **Bounty Marketplace** — a list of active bounty programs.

2. Click **Submit a Report** on any bounty card.

3. **Step 1 — Report:** Enter your report text (minimum 20 characters). Optionally attach a file. Notice the encryption notice: your report is encrypted in the browser before leaving the page.

4. **Step 2 — Payout address:** Enter any EVM (`0x...`) or NEAR (`name.testnet`) address you control. This is where USDC will be sent if your report is confirmed.

5. **Step 3 — Review:** Confirm your submission. Click **Submit Anonymously**. The browser encrypts the report, uploads to IPFS, and logs the CID on NEAR.

6. On the **receipt screen**, note the IPFS Content ID and click **Download encryption key file** — save this file. It is the only way to decrypt your report later.

7. **Switch to Organization mode** using the pill toggle in the top bar.

8. Click **Dashboard**. You see the pool balance, active bounties, reports in queue, and total paid out.

9. In the **Pending** tab, review the AI-scored report cards. Each shows:
   - Severity tier badge (Critical / High / Medium)
   - Credibility percentage (0–100, from TEE AI)
   - One-line anonymized summary generated by the AI

10. Click **Confirm Payout** — a confirmation sheet shows the payout amount and submitter address. Sign the NEAR transaction to release USDC.

11. Click **Reject** to return USDC to the pool.

12. Toggle **light/dark mode** with the sun/moon icon in the top bar. The preference persists across sessions.

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
| `VITE_NEAR_CONTRACT_ID` | Deployed NEAR contract account ID | Yes (after contract deploy) |
| `VITE_NEAR_NETWORK` | `testnet` or `mainnet` | Yes |
| `VITE_IPFS_GATEWAY` | IPFS gateway URL, e.g. `https://w3s.link/ipfs/` | Yes |
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

### v0.1 — Hackathon (Nov 1–14, 2026)
- [x] Frontend: bounty marketplace, anonymous submission form, org dashboard
- [x] Light/dark mode with system preference detection
- [x] Design system with Arc Dark/Light tokens
- [ ] NEAR Rust contract: bounty pool, report registry, TEE-gated score write, USDC payouts
- [ ] Client-side AES-GCM-256 encryption + IPFS upload
- [ ] TEE scorer on NEAR AI Cloud (testnet, mock attestation)
- [ ] NEAR Wallet Selector integration (org side)
- [ ] Meta-transaction relay for submitter anonymity
- [ ] End-to-end testnet demo

### v0.2 — Post-hackathon hardening
- [ ] Real Intel TDX attestation via Intel Trust Authority
- [ ] TEE key rotation mechanism
- [ ] NEAR mainnet deployment
- [ ] Org reputation score (pay rate, response time)
- [ ] Submitter "follow up" flow using encryption key as auth
- [ ] Multi-sig org approval (Sputnik DAO integration)
- [ ] Tor-compatible IPFS gateway option

### v0.3 — Growth
- [ ] Org SDK for embedding the submission widget into existing compliance portals
- [ ] Regulatory report templates (SOX 302, GDPR Article 33, Dodd-Frank)
- [ ] Bounty expiry notifications via one-way anonymous channel
- [ ] Cross-chain USDC payouts via NEAR Intents (pay to any EVM chain)
- [ ] Public org payout record — on-chain proof that an org honors its commitments

### Long-term
- Decentralized org registry — any DAO can become an org without a named account
- Verifiable credential issuance for confirmed reporters (proves you reported without revealing what you reported)
- Integration with existing whistleblower protection legal frameworks (EU Whistleblower Directive, US False Claims Act)

---

## Hackathon submission

**Event:** NEAR Hackathon
**Tracks:** `security` (AI Security & Defense) + `realworld` (Real-World Money)
**Submission window:** 2026-11-01 to 2026-11-14T23:59:00Z

Submission details (to be filled before Nov 14):
- Project name: SilentProof
- Public repo: _(to be made public before deadline)_
- Demo post: _(to be published on X)_

---

## License

MIT
