Let me read the frontend design skill before giving you anything concrete. Good. Now let me also check the arc-modes and consumer-glass references since this app has a specific mood — dark, serious, security-focused. Good. Now I have everything I need. Here is the complete frontend design brief for SilentProof.

---

## SilentProof — Frontend Design

### Mode and personality

**Arc Dark.** This is not a consumer wallet app — it is a security tool used by people in genuinely sensitive situations. The visual language needs to feel serious, trustworthy, and low-noise. Deep navy canvas, glass surfaces on dark, pale blue accents. No spectral gradients, no playful typography weights, no bright colors except semantic green (payout confirmed) and red (report rejected).

The one deliberate tension: the submitter form needs to feel calm and safe, not intimidating. Dark mode with generous whitespace and clear progress steps achieves that without softening the security-first aesthetic.

---

### Typography

- **Display (Space Grotesk):** Bounty amounts, section headers, severity tier labels
- **Body (DM Sans):** All form labels, descriptions, queue cards, status copy
- **Mono (JetBrains Mono):** IPFS hashes, NEAR account IDs, payout addresses, TEE signing key fingerprint

---

### Two distinct surfaces sharing one codebase

The app has two completely different user types with different needs. They should feel like they belong to the same product but never be confused with each other.

**Surface A — Public (submitter)**
URL: `/` and `/submit/:bountyId`
No wallet required. Minimal chrome. The less it looks like "crypto" the better — a whistleblower under stress should not be puzzling over wallet connection states.

**Surface B — Org dashboard**
URL: `/org`
Requires NEAR wallet. Data-dense. Shows pool balance, report queue, payout history.

A subtle mode indicator in the top-right corner (a pill: "Submitter" / "Organization") lets the user switch. The org mode wallet connect button only appears when in org mode.

---

### Page-by-page breakdown

---

**1. Bounty Marketplace — `/`**

The dominant object is the list of live bounties. Each card shows:
- Org name (or "Anonymous Org" if they chose not to display)
- Bounty title
- Category tag chip: `Fraud` / `Security` / `Policy` / `Legal` — each with a distinct muted color
- Payout tiers: three small badges — `Critical $5,000` / `High $1,000` / `Medium $250`
- Pool remaining (live from contract): `$12,400 USDC remaining`
- Expiry countdown: `Closes in 8 days`

Layout: two-column grid on desktop, single column on mobile. Sticky top bar with the SilentProof wordmark and the mode toggle pill.

What we do not show: any report counts, any submitter activity, anything that could be used to fingerprint submission timing.

Primary CTA on each card: `Submit a Report` — dark navy button, full card width on mobile.

Empty state: `No active bounties. Check back soon.`

---

**2. Submit Report — `/submit/:bountyId`**

This is the most important screen. It needs to be step-by-step, never overwhelming.

Three steps rendered as a vertical stepper (not tabs — tabs feel reversible; steps feel committed):

**Step 1 — Your report**
- Large textarea: `Describe what you observed. Be specific: who, what, when, where.`
- File attachment: drag-and-drop zone, max 10MB, accepts PDF/image/text
- Below the textarea, a small status chip: `Your report is encrypted in your browser before leaving this page. We never see the plaintext.` — this is not marketing copy, it is a factual statement that builds trust

**Step 2 — Your payout address**
- Input field: `Where should your USDC go if confirmed?`
- Accepts any EVM address or NEAR account ID
- Below: `This address is stored on-chain as a hash, not plaintext. Provide a one-time wallet you control.`
- Optional toggle: `Connect a NEAR account for on-chain authorship proof` — when toggled, a compact wallet selector appears inline (does not replace the step, just adds a row)

**Step 3 — Review and submit**
- Summary card: bounty title, payout tier range, your payout address (truncated), encryption status (green chip: `Encrypted`)
- One primary CTA: `Submit Anonymously`
- Below the button, one line of copy: `This action cannot be undone. Your report will be scored by a TEE-attested AI and reviewed by the organization.`

After submit: a receipt screen showing the IPFS CID (monospace), the NEAR transaction ID (monospace), and a single instruction: `Save your encryption key to follow up. Download key file` — a download of the symmetric key as a JSON file, clearly labeled.

---

**3. Org Dashboard — `/org`**

Requires NEAR wallet. If not connected, shows only a centered connect card.

Once connected, two sections side by side on desktop (stacked on mobile):

**Left panel — Pool overview**
- Hero card: `Pool Balance` — big number in USDC
- Below: three stat rows — `Active Bounties`, `Reports in Queue`, `Total Paid Out`
- Primary CTA: `Post New Bounty` — opens a bottom sheet

**Right panel — Report queue**
- Tabs: `Pending Review` / `Confirmed` / `Rejected`
- Each report card shows:
  - Severity tier badge: `CRITICAL` (red) / `HIGH` (amber) / `MEDIUM` (slate) — large, uppercase, Space Grotesk
  - Credibility score: `87% credibility` — a small horizontal bar
  - TEE summary: one line of AI-generated anonymized text, e.g. `Financial irregularities in Q3 procurement, multiple vendors`
  - Category tag
  - Submitted: `3 hours ago`
  - Two action buttons: `Confirm Payout` (primary) / `Reject` (ghost)
- Confirming a payout opens a bottom sheet showing: payout amount for this tier, payout address (truncated + monospace), and a final `Send $1,000 USDC` CTA that triggers the NEAR transaction

**Post New Bounty bottom sheet:**
- Title input
- Category selector (chips: Fraud / Security / Policy / Legal)
- Payout tier amounts: three inline number inputs (Critical / High / Medium)
- Pool funding amount: USDC amount input with live balance
- Expiry: a date picker (simple, not a calendar widget)
- Submit: `Create Bounty` — triggers two transactions (create + fund)

---

### States every screen handles

- **Loading:** Skeleton cards with `animate-pulse` — never fake data
- **Empty:** Honest copy, no placeholder numbers
- **Error:** Inline error below the relevant field or action, not a full-page error
- **Transaction pending:** The CTA shows a spinner and `Confirm in wallet...` — no progress simulation
- **Transaction confirmed:** Green receipt row with NEAR explorer link (opens in new tab)
- **Wallet not connected (org mode):** A single centered card: `Connect your NEAR wallet to manage bounties` with the wallet connect button

---

### What we explicitly do not build in the UI

- Any analytics or submission volume charts (would break submitter privacy)
- Email or notification inputs anywhere
- An admin panel beyond the org dashboard
- Any feature that stores or displays submitter IP, timing, or metadata
- A "track my report" flow that could deanonymize by access pattern

---

### Component inventory

| Component | Route | Notes |
|---|---|---|
| `Layout.tsx` | All | Top bar, mode toggle, wallet connect (org mode only) |
| `BountyList.tsx` | `/` | Grid of bounty cards, live from contract |
| `BountyCard.tsx` | `/` | Individual card with tiers, pool, expiry |
| `SubmitReport.tsx` | `/submit/:bountyId` | 3-step stepper, encryption, IPFS upload |
| `SubmitReceipt.tsx` | `/submit/:bountyId` | Post-submit CID + key download |
| `OrgDashboard.tsx` | `/org` | Two-panel layout |
| `ReportQueue.tsx` | `/org` | Tabbed queue with scored report cards |
| `ReportCard.tsx` | `/org` | Severity badge, credibility bar, actions |
| `PostBountySheet.tsx` | `/org` | Bottom sheet form |
| `PayoutSheet.tsx` | `/org` | Confirm payout bottom sheet |

---

That is the complete design spec. When we move to Build mode the build agent works directly from this. Nothing in the design has been assumed or invented — every component maps to a real contract function and a real user action.

Ready to lock this and start building when Nov 1 hits?
