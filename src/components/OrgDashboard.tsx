import { useState, useCallback } from 'react'
import { DollarSign, ShieldCheck, FileText, TrendingUp, Plus, Wallet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReportCard } from './ReportCard'
import { PostBountySheet } from './PostBountySheet'
import { useNearWallet } from '../near/useNearWallet'
import { useAllReports, useBounties } from '../near/useBounties'
import { confirmPayout, rejectReport } from '../near/contract'
import { buildExplorerAccountUrl } from '../near/config'
import type { Report, ReportStatus } from '../types'
import type { Report as NearReport } from '../near/contract'

function adaptReport(r: NearReport): Report {
  return {
    id: r.id,
    bountyId: r.bounty_id,
    bountyTitle: r.bounty_id,
    ipfsCid: r.ipfs_cid,
    tier: r.tier ? (r.tier.toLowerCase() as Report['tier']) : 'medium',
    credibility: r.credibility_score ?? 0,
    summary: r.tee_summary ?? 'Awaiting TEE scoring...',
    category: 'fraud',
    submittedAt: new Date(r.submitted_at_ms),
    status: r.status.toLowerCase() as ReportStatus,
    payoutAddress: r.payout_address_hash,
  }
}

export function OrgDashboard() {
  const { accountId, isConnected, isInitializing, signIn, signOut } = useNearWallet()
  const { reports: nearReports, loading: reportsLoading, refetch } = useAllReports()
  const { bounties, loading: bountiesLoading } = useBounties()
  const [activeTab, setActiveTab] = useState<ReportStatus>('pending')
  const [showPostBounty, setShowPostBounty] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const reports: Report[] = nearReports.map(adaptReport)
  const pending = reports.filter(r => r.status === 'pending')
  const confirmed = reports.filter(r => r.status === 'confirmed')
  const rejected = reports.filter(r => r.status === 'rejected')
  const filtered = reports.filter(r => r.status === activeTab)

  const totalPaid = confirmed.reduce((sum, r) => {
    const amounts: Record<string, number> = { critical: 5000, high: 1000, medium: 250 }
    return sum + (amounts[r.tier ?? 'medium'] ?? 0)
  }, 0)

  const totalPool = bounties.reduce((sum, b) => {
    return sum + Number(b.pool_balance) / 1e6
  }, 0)

  const handleConfirm = useCallback(async (id: string) => {
    const report = nearReports.find(r => r.id === id)
    if (!report) return
    setActioning(id)
    try {
      await confirmPayout(id, report.payout_address_hash)
      toast.success('Payout confirmed — USDC released on NEAR')
      void refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed')
    } finally {
      setActioning(null)
    }
  }, [nearReports, refetch])

  const handleReject = useCallback(async (id: string) => {
    setActioning(id)
    try {
      await rejectReport(id)
      toast.success('Report rejected — USDC stays in pool')
      void refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed')
    } finally {
      setActioning(null)
    }
  }, [refetch])

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 gap-6">
        <div className="glass-card rounded-3xl p-8 max-w-sm w-full text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--accent)1a' }}
          >
            <Wallet className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="display font-700 text-xl mb-2" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Connect your NEAR wallet
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Connect a NEAR account to post bounties and review incoming reports.
          </p>
          <button
            onClick={() => { void signIn() }}
            disabled={isInitializing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {isInitializing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Initializing...</>
              : 'Connect with MyNearWallet'
            }
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="display font-700 text-2xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Organization Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              <a
                href={buildExplorerAccountUrl(accountId!)}
                target="_blank"
                rel="noreferrer"
                className="text-xs mono hover:underline"
                style={{ color: 'var(--muted)' }}
              >
                {accountId}
              </a>
              <button
                onClick={() => { void signOut() }}
                className="text-xs hover:underline"
                style={{ color: 'var(--subtle)' }}
              >
                Disconnect
              </button>
            </div>
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
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Pool Balance" value={bountiesLoading ? '...' : `$${totalPool.toLocaleString()}`} sub="USDC" color="var(--success)" />
          <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="Active Bounties" value={bountiesLoading ? '...' : String(bounties.filter(b => b.active).length)} sub="programs" color="var(--accent)" />
          <StatCard icon={<FileText className="w-4 h-4" />} label="Reports in Queue" value={reportsLoading ? '...' : String(pending.length)} sub="pending review" color="var(--tier-high-ink)" />
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

          {reportsLoading ? (
            <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--subtle)' }}>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading reports from NEAR...</span>
            </div>
          ) : filtered.length === 0 ? (
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
                  onConfirm={id => { void handleConfirm(id) }}
                  onReject={id => { void handleReject(id) }}
                  actioning={actioning === r.id}
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
