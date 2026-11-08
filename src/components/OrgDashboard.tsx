import { useState, useCallback } from 'react'
import { DollarSign, ShieldCheck, FileText, TrendingUp, Plus, Wallet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReportCard } from './ReportCard'
import { PostBountySheet } from './PostBountySheet'
import { useNearWallet } from '../near/useNearWallet'
import { useOrgData, nsToDate } from '../near/useBounties'
import { confirmPayout, rejectReport, fundBounty, registerContractOnUsdc } from '../near/contract'
import { buildExplorerAccountUrl, yoctoToUsdc } from '../near/config'
import type { Report, ReportStatus } from '../types'
import type { Report as NearReport, Bounty as NearBounty } from '../near/contract'

function adaptReport(r: NearReport, bounty: NearBounty | undefined): Report {
  return {
    id: String(r.id),
    bountyId: String(r.bounty_id),
    bountyTitle: bounty?.title ?? `Bounty #${r.bounty_id}`,
    ipfsCid: r.ipfs_cid,
    tier: r.tee_tier ? (r.tee_tier.toLowerCase() as Report['tier']) : 'medium',
    credibility: r.tee_score ?? 0,
    summary: r.tee_summary_hash
      ? `Scored by the TEE. Summary hash ${r.tee_summary_hash.slice(0, 12)}...`
      : 'Awaiting TEE scoring...',
    category: (bounty?.category.toLowerCase() ?? 'fraud') as Report['category'],
    submittedAt: nsToDate(r.submitted_at_ns),
    status: r.status.toLowerCase() as ReportStatus,
    payoutAddress: r.payout_address_hash,
  }
}

export function OrgDashboard() {
  const { accountId, isConnected, isInitializing, signIn, signOut } = useNearWallet()
  const { reports: nearReports, bounties, loading: reportsLoading, refetch } = useOrgData(accountId)
  const bountiesLoading = reportsLoading
  const [activeTab, setActiveTab] = useState<ReportStatus>('pending')
  const [showPostBounty, setShowPostBounty] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<string | null>(null)
  const [payoutInput, setPayoutInput] = useState('')
  const [fundId, setFundId] = useState<number | null>(null)
  const [fundAmount, setFundAmount] = useState('')

  const reports: Report[] = nearReports.map(r =>
    adaptReport(r, bounties.find(b => b.id === r.bounty_id)),
  )
  const pending = reports.filter(r => r.status === 'pending')
  const confirmed = reports.filter(r => r.status === 'confirmed')
  const rejected = reports.filter(r => r.status === 'rejected')
  const filtered = reports.filter(r => r.status === activeTab)

  const totalPaid = confirmed.reduce((sum, r) => {
    const raw = nearReports.find(n => String(n.id) === r.id)
    const bounty = raw ? bounties.find(b => b.id === raw.bounty_id) : undefined
    if (!bounty) return sum
    const base = r.tier === 'critical' ? bounty.tier_critical : r.tier === 'high' ? bounty.tier_high : bounty.tier_medium
    return sum + yoctoToUsdc(base)
  }, 0)

  const totalPool = bounties.reduce((sum, b) => sum + yoctoToUsdc(b.pool_balance), 0)

  const handleFund = useCallback(async (bountyId: number, amount: number) => {
    setActioning(`fund-${bountyId}`)
    try {
      await fundBounty(bountyId, amount)
      toast.success('Funding sent. The pool updates once the transfer settles')
      setFundId(null)
      setFundAmount('')
      void refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Funding failed')
    } finally {
      setActioning(null)
    }
  }, [refetch])

  const handleRegister = useCallback(async () => {
    setActioning('register')
    try {
      await registerContractOnUsdc()
      toast.success('Contract registered on the USDC token')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setActioning(null)
    }
  }, [])

  const handleConfirm = useCallback(async (id: string, payoutAddress: string) => {
    setActioning(id)
    try {
      await confirmPayout(Number(id), payoutAddress.trim().toLowerCase())
      toast.success('Payout confirmed. USDC released on NEAR')
      setConfirmFor(null)
      setPayoutInput('')
      void refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed')
    } finally {
      setActioning(null)
    }
  }, [refetch])

  const handleReject = useCallback(async (id: string) => {
    setActioning(id)
    try {
      await rejectReport(Number(id))
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
              : 'Connect NEAR wallet'
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

        {/* Your bounties */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="display font-700 text-base" style={{ color: 'var(--ink)' }}>Your bounties</h2>
            <button
              onClick={() => { void handleRegister() }}
              disabled={actioning === 'register'}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--inner-bg)', color: 'var(--muted)' }}
              title="One-time step so the contract can receive USDC"
            >
              {actioning === 'register' ? 'Registering...' : 'Register contract for USDC (once)'}
            </button>
          </div>
          {bounties.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>
              No bounties yet. Post one to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {bounties.map(b => (
                <div key={b.id} className="glass-inner rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{b.title}</p>
                    <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                      #{b.id} · Pool ${yoctoToUsdc(b.pool_balance).toLocaleString()} USDC · ends {nsToDate(b.expiry_ns).toLocaleDateString()}
                    </p>
                  </div>
                  {b.active && (
                    <button
                      onClick={() => { setFundId(b.id); setFundAmount('') }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                    >
                      Fund pool
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
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
                  onConfirm={id => { setConfirmFor(id); setPayoutInput('') }}
                  onReject={id => { void handleReject(id) }}
                  actioning={actioning === r.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PostBountySheet
        open={showPostBounty}
        onClose={() => { setShowPostBounty(false); void refetch() }}
      />

      {fundId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setFundId(null)}
        >
          <div
            className="glass-card rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
            style={{ background: 'var(--sheet-bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="display font-700 text-lg" style={{ color: 'var(--ink)' }}>Fund bounty #{fundId}</h3>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Transfers Circle USDC from your wallet into the bounty pool. Minimum 10 USDC. Get free test USDC
              at faucet.circle.com (choose NEAR Testnet). The contract must be registered on the token once.
            </p>
            <input
              type="number"
              min="10"
              value={fundAmount}
              onChange={e => setFundAmount(e.target.value)}
              placeholder="e.g. 100"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none tabular-nums"
              style={{ background: 'var(--inner-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
            <div className="flex gap-2">
              <button onClick={() => setFundId(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--inner-bg)', color: 'var(--muted)' }}>
                Cancel
              </button>
              <button
                disabled={Number(fundAmount) < 10 || actioning === `fund-${fundId}`}
                onClick={() => { void handleFund(fundId, Number(fundAmount)) }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                {actioning === `fund-${fundId}` ? 'Sending...' : 'Send USDC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmFor !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmFor(null)}
        >
          <div
            className="glass-card rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
            style={{ background: 'var(--sheet-bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="display font-700 text-lg" style={{ color: 'var(--ink)' }}>
              Confirm payout
            </h3>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              The contract only stores a hash of the submitter's payout address. Enter the address
              exactly as the submitter provided it. The contract checks it against the hash before
              sending any USDC. If the transfer fails (for example the address has no USDC account),
              the payout is rolled back and the report returns to Pending.
            </p>
            <input
              type="text"
              value={payoutInput}
              onChange={e => setPayoutInput(e.target.value)}
              placeholder="submitter-account.testnet"
              className="w-full rounded-xl px-4 py-3 text-sm mono outline-none"
              style={{ background: 'var(--inner-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmFor(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--inner-bg)', color: 'var(--muted)' }}
              >
                Cancel
              </button>
              <button
                disabled={payoutInput.trim().length < 2 || actioning === confirmFor}
                onClick={() => { void handleConfirm(confirmFor, payoutInput) }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                {actioning === confirmFor ? 'Sending...' : 'Send USDC'}
              </button>
            </div>
          </div>
        </div>
      )}
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
