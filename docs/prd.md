# SilentProof — Product Requirements Document

**Version:** 0.1 (pre-build)
**Status:** Draft
**Last updated:** 2026-10-23
**Hackathon:** NEAR Hackathon — tracks `security` + `realworld`
**Submission deadline:** 2026-11-14T23:59:00Z

---

## 1. Problem statement

Whistleblowing is the act of reporting fraud, corruption, security vulnerabilities, or policy violations to someone in a position to act. It is one of the most effective mechanisms for detecting wrongdoing inside organizations — but it is systemically broken in three ways:

**1.1 Identity exposure**
Every mainstream reporting channel — HR hotlines, ethics portals, email — requires an account, email address, or login that can be traced back to the reporter. Even "anonymous" corporate hotlines log metadata (IP address, device fingerprint, call timestamp) that can be used to identify a small pool of plausible reporters. The result: most people who observe wrongdoing say nothing.

**1.2 Unenforceable payout promises**
When organizations offer whistleblower rewards, the promise is discretionary. The org sees the report, decides whether it is useful, and then decides whether to pay. There is no binding commitment before the report is submitted. Reporters have no guarantee they will be compensated for the career and personal risk they take.

**1.3 No credibility signal**
Organizations that operate open bounty programs receive large volumes of reports ranging from detailed and actionable to vague and retaliatory. Without a credibility filter, triage is slow, the useful reports are buried, and the program becomes an operational burden rather than an asset.

---

## 2. Target users

### Submitters (whistleblowers)
- Employees, contractors, or third parties who observe wrongdoing inside an organization
- Journalists' sources with sensitive material
- Security researchers who find vulnerabilities but want some protection before disclosure
- Activists in jurisdictions where their identity is at risk

**What they need:** zero-identity submission, a binding payout commitment they can verify before they submit, and a way to receive funds without connecting their identity to the payout.

### Organizations (bounty posters)
- Publicly traded companies with compliance obligations (SOX, GDPR, Dodd-Frank)
- DAOs and DeFi protocols that want community security reporting
- Law firms and NGOs running protected disclosure programs
- Governments and regulatory bodies operating public-interest reporting programs

**What they need:** a credible intake channel, an AI-assisted triage layer that reduces noise, and a clear on-chain audit trail of every payout decision.

---

## 3. Solution

SilentProof is an on-chain whistleblower bounty marketplace. Organizations post USDC bounties with binding on-chain commitments. Submitters file reports anonymously through a web form — no account, no email, no wallet required. An AI model running inside a NEAR Trusted Execution Environment (TEE) scores each report for credibility and severity. The organization reviews the scored report and confirms a USDC payout to a one-time address the submitter provides.

The three core properties are cryptographically enforced, not policy-enforced:
- **Anonymity:** report text is encrypted client-side before upload; only the IPFS hash goes on-chain; no server ever sees plaintext
- **Binding commitment:** USDC is locked in the contract at bounty creation; the org cannot withdraw it while reports are in review
- **Credibility signal:** the TEE scorer writes a severity tier and score on-chain using an attested key; the org cannot see the raw report, only the AI summary

---

## 4. Core user flows

### Flow A — Submitter (no wallet)
1. Browse the public bounty marketplace
2. Select a bounty and click "Submit a Report"
3. Enter report text and optional file attachment
4. Enter a one-time payout address (any EVM or NEAR address)
5. Review summary and click "Submit Anonymously"
6. Browser encrypts report with AES-GCM, uploads encrypted blob to IPFS, calls `submit_report` on NEAR contract with the IPFS CID
7. Receipt screen shows IPFS CID and prompts to download the encryption key file

### Flow B — Submitter (optional NEAR wallet for authorship proof)
Same as Flow A, with an additional optional step: connect a freshly created NEAR wallet to sign a binding statement linking the NEAR account to the report CID on-chain. This gives the submitter proof of authorship if they later need to claim credit (e.g. for a CVE disclosure).

### Flow C — Organization (create bounty)
1. Connect NEAR wallet
2. Click "Post New Bounty"
3. Fill in title, description, category, payout tiers (Critical / High / Medium), pool amount, expiry
4. Two on-chain transactions: `create_bounty` + USDC transfer to contract pool
5. Bounty appears live on the public marketplace

### Flow D — Organization (review and pay)
1. Open org dashboard
2. Review scored report queue: each card shows TEE-assigned severity tier, credibility %, AI-generated one-line summary
3. Click "Confirm Payout" — a bottom sheet shows the payout amount and submitter's address
4. Sign NEAR transaction — USDC releases from pool to submitter's address
5. Report moves to "Confirmed" tab with explorer link

---

## 5. Functional requirements

### Bounty contract
| ID | Requirement | Priority |
|---|---|---|
| F-01 | Org can create a bounty with title, category, tier amounts, and expiry | Must |
| F-02 | Org funds the bounty pool with USDC (NEP-141) at creation | Must |
| F-03 | Anyone can submit a report with an IPFS CID and payout address | Must |
| F-04 | Only a TEE-attested key can call `record_tee_score` | Must |
| F-05 | Org can confirm payout — USDC releases to submitter's address | Must |
| F-06 | Org can reject a report — USDC stays in pool | Must |
| F-07 | Org can reclaim unspent pool funds after expiry | Must |
| F-08 | Submitter can optionally bind a NEAR account to a report | Should |
| F-09 | Contract emits events for all state changes | Should |
| F-10 | Multiple open bounties per org | Should |

### TEE scorer
| ID | Requirement | Priority |
|---|---|---|
| T-01 | Scorer runs inside NEAR AI Cloud TEE (Intel TDX) | Must |
| T-02 | Scorer receives encrypted report via E2EE channel | Must |
| T-03 | Scorer decrypts, runs LLM inference, assigns severity tier + credibility % | Must |
| T-04 | Scorer produces a one-line anonymized summary (no PII, no identifying detail) | Must |
| T-05 | Scorer signs result with TEE's attested ECDSA key | Must |
| T-06 | Scorer calls `record_tee_score` on NEAR contract with signed result | Must |
| T-07 | TEE attestation report is verifiable by anyone via Intel Trust Authority | Should |

### Frontend
| ID | Requirement | Priority |
|---|---|---|
| U-01 | Public bounty marketplace with live on-chain data | Must |
| U-02 | 3-step anonymous submission form — no wallet required | Must |
| U-03 | Client-side AES-GCM encryption before IPFS upload | Must |
| U-04 | Encryption key download on receipt screen | Must |
| U-05 | Org dashboard with pool stats and report queue | Must |
| U-06 | Report cards with tier badge, credibility bar, AI summary | Must |
| U-07 | Confirm / reject actions wired to NEAR transactions | Must |
| U-08 | "Post New Bounty" bottom sheet wired to NEAR transactions | Must |
| U-09 | Light and dark mode toggle persisting to localStorage | Must |
| U-10 | Responsive — usable on mobile | Should |

---

## 6. Non-functional requirements

- **Anonymity:** No PII stored anywhere — not in the contract, not on the server, not in IPFS metadata. IPFS only sees encrypted bytes.
- **Availability:** Frontend statically hosted (Netlify / Vercel / HF Spaces). Contract on NEAR testnet during hackathon.
- **Latency:** Bounty list loads in under 2s on a 4G connection. Submission flow completes in under 5s excluding wallet signature.
- **Security:** AES-GCM 256-bit encryption. TEE key never leaves the enclave. No server-side decryption path.
- **Auditability:** Every payout decision has an on-chain record: CID, tier, score, payout address, transaction hash.

---

## 7. Out of scope (v1)

- Mobile native app
- Email or push notifications
- DAO governance for multi-sig org approvals
- Reputation scoring for orgs (do they pay out?)
- "Track my report" authenticated flow
- Mainnet deployment
- KYC / identity verification for orgs
