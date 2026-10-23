import { Clock, CheckCircle2, XCircle } from 'lucide-react'
import type { Report } from '../types'
import { TierBadge } from './BountyCard'

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${n}`
}

const CATEGORY_COLORS: Record<string, string> = {
  fraud: 'var(--tag-fraud-ink)',
  security: 'var(--tag-security-ink)',
  policy: 'var(--tag-policy-ink)',
  legal: 'var(--tag-legal-ink)',
}

const PAYOUT_AMOUNTS: Record<string, number> = {
  critical: 5000,
  high: 1000,
  medium: 250,
}

interface ReportCardProps {
  report: Report
  onConfirm?: (id: string) => void
  onReject?: (id: string) => void
}

export function ReportCard({ report, onConfirm, onReject }: ReportCardProps) {
  const isPending = report.status === 'pending'
  const isConfirmed = report.status === 'confirmed'

  return (
    <article className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <TierBadge tier={report.tier} amount={PAYOUT_AMOUNTS[report.tier]} />
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
            Bounty: <span style={{ color: CATEGORY_COLORS[report.category] }}>{report.bountyTitle}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock className="w-3 h-3" style={{ color: 'var(--subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>{timeAgo(report.submittedAt)}</span>
        </div>
      </div>

      {/* Credibility bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>AI Credibility Score</span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: report.credibility >= 70 ? 'var(--success)' : 'var(--danger)' }}
          >
            {report.credibility}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${report.credibility}%`,
              background: report.credibility >= 70 ? 'var(--success)' : 'var(--danger)',
            }}
          />
        </div>
      </div>

      {/* AI Summary */}
      <div className="glass-inner rounded-xl p-3">
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>TEE AI Summary</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{report.summary}</p>
      </div>

      {/* IPFS hash */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>IPFS</span>
        <span className="mono text-xs truncate max-w-[70%]" style={{ color: 'var(--muted)' }}>
          {report.ipfsCid}
        </span>
      </div>

      {/* Actions */}
      {isPending && onConfirm && onReject && (
        <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => onConfirm(report.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirm · {formatUsd(PAYOUT_AMOUNTS[report.tier])} USDC
          </button>
          <button
            onClick={() => onReject(report.id)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-70"
            style={{ background: 'var(--inner-bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      )}

      {isConfirmed && (
        <div
          className="flex items-center gap-2 pt-1 text-xs font-semibold"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--success)' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Payout of {formatUsd(PAYOUT_AMOUNTS[report.tier])} USDC confirmed
        </div>
      )}

      {report.status === 'rejected' && (
        <div
          className="flex items-center gap-2 pt-1 text-xs font-semibold"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--danger)' }}
        >
          <XCircle className="w-3.5 h-3.5" />
          Rejected — USDC returned to pool
        </div>
      )}
    </article>
  )
}
