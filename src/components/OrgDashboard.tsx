import { useState } from 'react'
import { DollarSign, ShieldCheck, FileText, TrendingUp, Plus } from 'lucide-react'
import { ReportCard } from './ReportCard'
import { PostBountySheet } from './PostBountySheet'
import type { Report, ReportStatus } from '../types'

const MOCK_REPORTS: Report[] = [
  {
    id: 'r1',
    bountyId: 'b1',
    bountyTitle: 'Financial irregularities in Q3',
    ipfsCid: 'QmXf7dVj3kP9mNr2tHs8wLqBvEyCz4Ap6nUiRdT5oGk1M',
    tier: 'critical',
    credibility: 87,
    summary: 'Financial irregularities in Q3 procurement: two supplier invoices with inflated unit prices totaling $240K above market rate, both approved by the same manager.',
    category: 'fraud',
    submittedAt: new Date(Date.now() - 3 * 3_600_000),
    status: 'pending',
    payoutAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  },
  {
    id: 'r2',
    bountyId: 'b2',
    bountyTitle: 'Smart contract vulnerabilities',
    ipfsCid: 'QmYz3kRmLpBe8wMvTr7cHfXqDn5Sw9Nb4oPlCaFs6iRn2K',
    tier: 'high',
    credibility: 72,
    summary: 'Reentrancy vulnerability in the withdraw() function — the balance update occurs after the external call, enabling a malicious contract to drain the pool before the state update.',
    category: 'security',
    submittedAt: new Date(Date.now() - 6 * 3_600_000),
    status: 'pending',
    payoutAddress: 'alice.testnet',
  },
  {
    id: 'r3',
    bountyId: 'b1',
    bountyTitle: 'Financial irregularities in Q3',
    ipfsCid: 'QmAb9pKsVwDe5rFtUy2mXjLnCq7Gz3Oh8iRbTdEsWk4nLP',
    tier: 'medium',
    credibility: 91,
    summary: 'Expense reports for travel to non-existent client meetings, four instances across two quarters, consistent submitter.',
    category: 'fraud',
    submittedAt: new Date(Date.now() - 2 * 86_400_000),
    status: 'confirmed',
    payoutAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  },
  {
    id: 'r4',
    bountyId: 'b3',
    bountyTitle: 'AML policy violations',
    ipfsCid: 'QmDc2qNtWxBf6kHvLm3sPeJrOy4Ru7Tg9iSbVaEwXh5nMQ',
    tier: 'medium',
    credibility: 38,
    summary: 'Allegation of policy violation without supporting transaction data. Report lacks specific dates, amounts, or counterparty information.',
    category: 'policy',
    submittedAt: new Date(Date.now() - 4 * 86_400_000),
    status: 'rejected',
    payoutAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
]

export function OrgDashboard() {
  const [reports, setReports] = useState<Report[]>(MOCK_REPORTS)
  const [activeTab, setActiveTab] = useState<ReportStatus>('pending')
  const [showPostBounty, setShowPostBounty] = useState(false)

  const pending = reports.filter(r => r.status === 'pending')
  const confirmed = reports.filter(r => r.status === 'confirmed')
  const rejected = reports.filter(r => r.status === 'rejected')
  const filtered = reports.filter(r => r.status === activeTab)

  const totalPaid = confirmed.reduce((sum, r) => {
    const amounts: Record<string, number> = { critical: 5000, high: 1000, medium: 250 }
    return sum + (amounts[r.tier] ?? 0)
  }, 0)

  function handleConfirm(id: string) {
    setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'confirmed' } : r))
  }

  function handleReject(id: string) {
    setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'rejected' } : r))
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="display font-700 text-2xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Organization Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Manage your bounty programs and review incoming reports.
            </p>
          </div>
          <button
            onClick={() => setShowPostBounty(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            <Plus className="w-4 h-4" />
            Post New Bounty
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Pool Balance" value="$48,700" sub="USDC" color="var(--success)" />
          <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="Active Bounties" value="4" sub="programs" color="var(--accent)" />
          <StatCard icon={<FileText className="w-4 h-4" />} label="Reports in Queue" value={String(pending.length)} sub="pending review" color="var(--tier-high-ink)" />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Paid Out" value={`$${totalPaid.toLocaleString()}`} sub="USDC" color="var(--accent)" />
        </div>

        {/* Report queue */}
        <div>
          <div className="flex items-center gap-1 mb-5">
            {(['pending', 'confirmed', 'rejected'] as ReportStatus[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                style={{
                  background: activeTab === tab ? 'var(--accent)' : 'var(--inner-bg)',
                  color: activeTab === tab ? 'var(--bg)' : 'var(--muted)',
                }}
              >
                {tab}
                {' '}
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    background: activeTab === tab ? 'rgba(255,255,255,0.2)' : 'var(--border)',
                    color: activeTab === tab ? 'var(--bg)' : 'var(--subtle)',
                  }}
                >
                  {tab === 'pending' ? pending.length : tab === 'confirmed' ? confirmed.length : rejected.length}
                </span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FileText className="w-8 h-8" style={{ color: 'var(--border)' }} />
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>
                No {activeTab} reports.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map(r => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PostBountySheet open={showPostBounty} onClose={() => setShowPostBounty(false)} />
    </>
  )
}

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1a`, color }}
        >
          {icon}
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
      </div>
      <div>
        <span className="display font-700 text-xl tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        <span className="text-xs ml-1" style={{ color: 'var(--subtle)' }}>{sub}</span>
      </div>
    </div>
  )
}
