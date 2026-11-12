/**
 * Copy for the Docs page. Keep it in sync with README.md: every claim here
 * must be true of the deployed testnet app, including the limits.
 */

export interface DocStep {
  title: string
  body: string
}

export interface FaqItem {
  q: string
  a: string
}

export const OVERVIEW = {
  lead:
    'SilentProof is a whistleblower bounty marketplace on NEAR. Organizations lock USDC in a contract as a reward for reports. Reporters file an encrypted report, an AI scorer rates it and signs the result onchain, and the organization pays out in Circle USDC.',
  points: [
    {
      title: 'Reporters',
      body: 'Employees, contractors and researchers who want to report wrongdoing without giving the organization a name.',
    },
    {
      title: 'Organizations',
      body: 'Companies, DAOs and protocols that want a reward program that is provably funded and that filters reports by credibility.',
    },
    {
      title: 'Why it exists',
      body: 'Reporting channels expose people, rewards are discretionary, and organizations drown in unrated reports. SilentProof answers each with code instead of policy.',
    },
  ],
}

export const HOW_IT_WORKS: DocStep[] = [
  {
    title: 'The organization posts and funds a bounty',
    body: 'It sets payout tiers (Critical, High, Medium) and a closing date, then sends USDC into the contract. The money cannot be withdrawn before the bounty closes.',
  },
  {
    title: 'The reporter writes a report',
    body: 'The report is encrypted in the browser with AES-GCM-256. The key is wrapped so that only the scorer can unwrap it.',
  },
  {
    title: 'Only fingerprints go onchain',
    body: 'The encrypted file goes to IPFS. NEAR stores its content ID and a SHA-256 hash of the reporter\u2019s payout address. No readable text is stored anywhere.',
  },
  {
    title: 'The scorer rates the report',
    body: 'It decrypts the report, rates severity and credibility, and signs the result with its own key. The hosted scorer starts automatically after a submission.',
  },
  {
    title: 'The contract checks the signature',
    body: 'The score is recorded only if the signature recovers to the registered scorer key, so an organization cannot invent or skip a score.',
  },
  {
    title: 'The organization decides',
    body: 'It sees the severity, the credibility score and a summary hash. Confirming a payout checks the address against the stored hash and sends the tier\u2019s USDC. Rejecting keeps the money in the pool.',
  },
  {
    title: 'Failed payouts undo themselves',
    body: 'If the USDC transfer fails, for example because the address has no USDC account, the report returns to Pending and the money returns to the pool.',
  },
]

export const TRY_IT: DocStep[] = [
  { title: 'Get test USDC', body: 'Request NEAR Testnet USDC for your account at faucet.circle.com. You also need a little testnet NEAR for network fees; your wallet's testnet option or a NEAR testnet faucet can provide it.' },
  { title: 'Connect a wallet', body: 'Switch to Organization and connect Meteor Wallet on testnet.' },
  { title: 'Post a bounty', body: 'Keep the defaults (10, 5 and 2 USDC, 30 days) and create it.' },
  { title: 'Fund the pool', body: 'Click Fund pool and send 10 USDC. The contract is already registered for USDC, so you only need to approve the transfer.' },
  { title: 'Submit a report', body: 'Open the bounty as a reporter. Use the word \u201cfraud\u201d to see a Critical rating. Use an address that can hold Circle USDC.' },
  { title: 'Watch it get scored', body: 'The card moves from \u201cAwaiting score\u201d to a severity badge and a credibility percentage, usually within a minute.' },
  { title: 'Confirm the payout', body: 'Enter the payout address exactly as submitted and approve. The USDC arrives and the pool drops.' },
]

export const ENFORCED: string[] = [
  'Reports are encrypted in the browser. The site, IPFS and the contract never hold plaintext.',
  'Rewards are funded up front and cannot be withdrawn before the bounty closes.',
  'A score is accepted only with a valid signature from the registered scorer key.',
  'A payout goes to the address whose hash the reporter submitted, and a failed transfer is rolled back.',
]

export const LIMITS: string[] = [
  'The scorer is not in a hardware enclave on testnet. Whoever operates it can read reports and sign scores. Enclave attestation is the planned next step.',
  'Submitting needs a NEAR wallet to pay the network fee. The account is not stored with the report unless the reporter opts in, but the fee payer is visible on NEAR. Use a fresh account.',
  'The payout address is revealed to the organization when it confirms, and the payout is a public transfer.',
  'Encrypted files are uploaded through Pinata, which sees an encrypted file and the uploader\u2019s IP address.',
  'The default scorer is a keyword scorer. A language model can be enabled by the operator.',
  'This is testnet software and has not been audited. Do not use it with real funds.',
]

export const FAQ: FaqItem[] = [
  {
    q: 'Do I need an account or an email?',
    a: 'No account and no email with SilentProof. A NEAR wallet is needed only to pay the small network fee when you submit. Your wallet is not recorded with the report unless you tick the authorship option.',
  },
  {
    q: 'Is my report really private?',
    a: 'The text is encrypted in your browser before it leaves the page, and the key is wrapped to the scorer\u2019s public key. IPFS, the website and the contract only ever see encrypted data. The scorer can read it, which is why its operator is the main trust assumption today.',
  },
  {
    q: 'What does the organization see?',
    a: 'The severity tier, the credibility score and a hash of the summary. It does not see your report text. If you want to prove what you wrote later, keep the key file you can download on the receipt screen.',
  },
  {
    q: 'How is a report scored?',
    a: 'By default a keyword scorer rates severity and credibility. A language model can be switched on by the operator. Either way the scorer signs the result and the contract verifies the signature.',
  },
  {
    q: 'Can the organization cheat?',
    a: 'It cannot forge or skip the score, and it cannot pull the reward back before the bounty closes. It can still reject a report, which is its legitimate choice, and the pool stays funded.',
  },
  {
    q: 'What if the payout fails?',
    a: 'The contract undoes it. The report goes back to Pending and the money returns to the pool. The most common cause is a payout address that has never held Circle USDC.',
  },
  {
    q: 'Which address should I use for the payout?',
    a: 'A NEAR account you control that can hold Circle USDC. You can receive test USDC from faucet.circle.com. Only a hash of it is stored until the organization confirms.',
  },
  {
    q: 'Why does a report say \u201cAwaiting score\u201d?',
    a: 'The scorer has not rated it yet. It starts automatically after you submit and the organization page retries every 20 seconds. If it stays that way for several minutes, the hosted scorer is misconfigured.',
  },
  {
    q: 'Is this on mainnet?',
    a: 'No. It runs on NEAR testnet with Circle\u2019s testnet USDC, which has no value. A mainnet launch would need an independent security audit first.',
  },
]
