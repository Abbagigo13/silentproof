import { ShieldCheck } from 'lucide-react'
import { BountyCard } from './BountyCard'
import type { Bounty } from '../types'

// Mock data — wired to NEAR contract in the build phase
const MOCK_BOUNTIES: Bounty[] = [
  {
    id: 'b1',
    orgName: 'Acme Corp',
    title: 'Financial irregularities in Q3 procurement contracts',
    description: 'We are seeking reports on any irregularities, kickbacks, or conflicts of interest in our Q3 procurement process involving supplier contracts above $50K.',
    category: 'fraud',
    tiers: { critical: 5000, high: 1000, medium: 250 },
    poolRemaining: 18500,
    expiryDate: new Date(Date.now() + 8 * 86_400_000),
    active: true,
  },
  {
    id: 'b2',
    orgName: 'ProtocolDAO',
    title: 'Smart contract vulnerabilities in lending protocol',
    description: 'Report security vulnerabilities, potential exploits, or access control issues in our deployed lending protocol contracts. All reports reviewed by our security team.',
    category: 'security',
    tiers: { critical: 10000, high: 2500, medium: 500 },
    poolRemaining: 42000,
    expiryDate: new Date(Date.now() + 21 * 86_400_000),
    active: true,
  },
  {
    id: 'b3',
    orgName: 'GlobalPay Inc',
    title: 'AML policy violations in remittance operations',
    description: 'Confidential reports on potential anti-money laundering policy violations, unreported transactions, or compliance failures in our remittance corridors.',
    category: 'policy',
    tiers: { critical: 3000, high: 800, medium: 200 },
    poolRemaining: 6200,
    expiryDate: new Date(Date.now() + 2 * 86_400_000),
    active: true,
  },
  {
    id: 'b4',
    orgName: 'HealthDAO',
    title: 'Data privacy breaches in patient record handling',
    description: 'Reports on unauthorized access, improper disclosure, or retention violations of patient health records. HIPAA-related concerns encouraged.',
    category: 'legal',
    tiers: { critical: 7500, high: 2000, medium: 400 },
    poolRemaining: 29000,
    expiryDate: new Date(Date.now() + 14 * 86_400_000),
    active: true,
  },
]

export function BountyList() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="mb-10 max-w-xl">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--success)' }}
          />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)', letterSpacing: '0.1em' }}>
            Live Bounties
          </span>
        </div>
        <h1
          className="display font-700 text-3xl sm:text-4xl text-balance mb-3"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          Report what you know.
          <br />
          Get paid for it.
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)', maxWidth: '48ch' }}>
          Every report is encrypted in your browser before it leaves your device.
          No account, no email, no identity required.
          Payouts are released in USDC after AI scoring and org review.
        </p>
      </div>

      {/* How it works strip */}
      <div
        className="glass-inner rounded-2xl p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        {[
          { n: '01', label: 'Pick a bounty', desc: 'Browse active programs below' },
          { n: '02', label: 'Submit anonymously', desc: 'Encrypted end-to-end, no wallet needed' },
          { n: '03', label: 'AI scores your report', desc: 'TEE-attested AI assigns a severity tier' },
          { n: '04', label: 'Receive USDC', desc: 'Org confirms, payout goes to your address' },
        ].map((step, i) => (
          <div key={step.n} className="flex items-start gap-3 flex-1">
            {i > 0 && (
              <div className="hidden sm:block w-px h-8 self-center" style={{ background: 'var(--border)' }} />
            )}
            <div
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {step.n}
            </div>
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{step.label}</div>
              <div className="text-xs" style={{ color: 'var(--subtle)' }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {MOCK_BOUNTIES.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <ShieldCheck className="w-10 h-10" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>
            No active bounties. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
          {MOCK_BOUNTIES.map(b => (
            <BountyCard key={b.id} bounty={b} />
          ))}
        </div>
      )}
    </div>
  )
}
