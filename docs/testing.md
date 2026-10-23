# SilentProof — Testing Strategy

**Version:** 0.1
**Last updated:** 2026-10-23

---

## 1. Testing philosophy

SilentProof has three layers where bugs have qualitatively different consequences:

| Layer | Bug consequence | Testing priority |
|---|---|---|
| Smart contract | Loss of funds, locked USDC, unauthorized payouts | Highest |
| Client-side encryption | Report content exposed, key lost | High |
| Frontend UI | Bad UX, broken flow | Medium |

We test in this order. A visual regression in a button color is annoying. A contract bug that drains the pool is catastrophic.

---

## 2. Smart contract tests

**Framework:** NEAR Sandbox (`near-workspaces-rs`) + Rust unit tests
**Location:** `contracts/near/silentproof/tests/`

### Unit tests (in-file, `#[cfg(test)]`)

Test individual contract functions in isolation using NEAR SDK's mock VMContext.

Priority test cases:

| Function | Test case |
|---|---|
| `create_bounty` | Creates bounty with correct tier amounts |
| `create_bounty` | Fails if caller is not org account |
| `fund_bounty` | Pool balance increases by transfer amount |
| `submit_report` | Creates report with Pending status |
| `submit_report` | Fails if bounty is expired |
| `record_tee_score` | Writes tier + score when signature is valid |
| `record_tee_score` | Reverts when signature is invalid |
| `record_tee_score` | Reverts when called by non-TEE account without valid sig |
| `confirm_payout` | Releases correct USDC amount for tier |
| `confirm_payout` | Fails if caller is not bounty org |
| `confirm_payout` | Fails if report status is not Pending |
| `reject_report` | Returns USDC to pool |
| `withdraw_bounty` | Succeeds after expiry |
| `withdraw_bounty` | Fails before expiry |

### Integration tests (NEAR Sandbox)

Spin up a local NEAR sandbox, deploy the contract, and run full user flows.

Priority flows:

```
Flow 1: Happy path — org creates, submitter reports, TEE scores, org confirms
  1. Deploy contract
  2. Create USDC mock token
  3. Org calls create_bounty
  4. Org calls fund_bounty (transfers 10,000 USDC)
  5. Submitter calls submit_report (no wallet — meta-tx via relayer)
  6. TEE key calls record_tee_score with valid signature
  7. Org calls confirm_payout
  8. Assert submitter USDC balance = tier_high amount
  9. Assert pool balance decreased by tier_high amount

Flow 2: Rejection path
  1–6. Same as above
  7. Org calls reject_report
  8. Assert pool balance unchanged
  9. Assert report status = Rejected

Flow 3: Expiry and withdrawal
  1–4. Same as above
  5. Fast-forward timestamp past expiry
  6. Org calls withdraw_bounty
  7. Assert org USDC balance restored
  8. Assert contract pool = 0

Flow 4: Invalid TEE score rejected
  1–5. Same as above
  6. Attacker calls record_tee_score with fake signature
  7. Assert transaction reverts
  8. Assert report status unchanged (Pending)
```

---

## 3. Encryption tests

**Framework:** Vitest
**Location:** `src/crypto/encrypt.test.ts`

### Test cases

```ts
describe('encrypt/decrypt round trip', () => {
  it('encrypts and decrypts report text correctly', async () => { ... })
  it('produces different ciphertext on each call (IV randomness)', async () => { ... })
  it('fails decryption with wrong key', async () => { ... })
  it('fails decryption with tampered ciphertext (GCM auth tag)', async () => { ... })
  it('fails decryption with wrong IV', async () => { ... })
})

describe('key export', () => {
  it('exports raw key as base64', async () => { ... })
  it('can re-import exported key and decrypt', async () => { ... })
})

describe('key wrapping for TEE', () => {
  it('wraps symmetric key with TEE public key', async () => { ... })
  it('wrapped key can be unwrapped with TEE private key', async () => { ... })
})
```

Run with: `bun run test:crypto`

---

## 4. Frontend component tests

**Framework:** Vitest + React Testing Library
**Location:** `src/components/*.test.tsx`

### Priority test cases

```ts
// BountyCard
it('renders bounty title, org name, and all three tier badges')
it('shows correct expiry countdown')
it('marks expiry red when <= 3 days')
it('submit link navigates to /submit/:bountyId')

// SubmitReport
it('next button disabled until report text >= 20 chars')
it('next button enabled after 20+ chars entered')
it('step 2: next disabled until payout address entered')
it('step 3: shows review summary with truncated payout address')
it('receipt screen shown after successful submit')
it('key download triggered on receipt')

// OrgDashboard
it('renders pending/confirmed/rejected tab counts')
it('ReportCard shows confirm + reject buttons for pending reports')
it('confirm click moves report to confirmed tab')
it('reject click moves report to rejected tab')

// PostBountySheet
it('create button disabled when title is empty')
it('create button disabled when pool amount is empty')
it('close button dismisses the sheet')

// ThemeContext
it('defaults to system preference')
it('toggleTheme switches between light and dark')
it('theme persists across remount (localStorage)')
```

---

## 5. End-to-end tests

**Framework:** Playwright
**Location:** `e2e/`

Run against the running dev server (`bun run dev`).

### Priority flows

```ts
test('submitter: browse → submit → receipt', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Submit a Report')).toBeVisible()
  await page.getByText('Submit a Report').first().click()
  await page.fill('textarea', 'This is a test report with enough characters to pass validation.')
  await page.getByText('Continue').click()
  await page.fill('input[placeholder*="0x"]', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
  await page.getByText('Continue').click()
  await page.getByText('Submit Anonymously').click()
  await expect(page.getByText('Report submitted')).toBeVisible()
  await expect(page.getByText('IPFS Content ID')).toBeVisible()
})

test('org: switch mode → view dashboard → confirm report', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Organization').click()
  await page.goto('/org')
  await expect(page.getByText('Organization Dashboard')).toBeVisible()
  await expect(page.getByText('Pending')).toBeVisible()
  await page.getByText('Confirm').first().click()
  await expect(page.getByText('Payout')).toBeVisible()
})

test('theme: toggle light/dark', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', /light|dark/)
  await page.getByLabel('Toggle theme').click()
  // assert data-theme changed
})
```

---

## 6. Running tests

```bash
# Lint + typecheck
bun run check

# Unit + component tests (when added)
bun run test

# E2E tests (requires dev server running)
bun run dev &
bunx playwright test

# Contract tests (requires Rust + cargo-near)
cd contracts/near/silentproof
cargo test
```

---

## 7. CI checklist (before submission)

- [ ] `bun run check` passes with zero errors
- [ ] All contract unit tests pass
- [ ] Encryption round-trip test passes
- [ ] Submit report flow works end-to-end on NEAR testnet
- [ ] Org confirm/reject wired to live testnet transactions
- [ ] TEE scorer signs and writes score on testnet
- [ ] Light/dark toggle works and persists
- [ ] Mobile viewport renders correctly (Chrome DevTools 390px)
