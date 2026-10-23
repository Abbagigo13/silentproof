import { Link } from 'react-router-dom'
import { Clock, DollarSign, ChevronRight } from 'lucide-react'
import type { Bounty, BountyCategory } from '../types'

const CATEGORY_LABELS: Record<BountyCategory, string> = {
  fraud: 'Fraud',
  security: 'Security',
  policy: 'Policy',
  legal: 'Legal',
}

function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000))
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  return `$${n.toLocaleString()}`
}

interface BountyCardProps {
  bounty: Bounty
}

export function BountyCard({ bounty }: BountyCardProps) {
  const days = daysUntil(bounty.expiryDate)
  const urgent = days <= 3

  return (
    <article
      className="glass-card rounded-2xl p-5 flex flex-col gap-4 hover:scale-[1.01] transition-transform"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <CategoryTag category={bounty.category} />
          </div>
          <h3
            className="display font-600 text-base leading-snug text-balance"
            style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
          >
            {bounty.title}
          </h3>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>
            {bounty.description}
          </p>
        </div>
        <div
          className="text-xs font-semibold flex-shrink-0 px-2.5 py-1 rounded-full"
          style={{ background: 'var(--inner-bg)', color: 'var(--subtle)' }}
        >
          {bounty.orgName}
        </div>
      </div>

      {/* Tiers */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <TierBadge tier="critical" amount={bounty.tiers.critical} />
        <TierBadge tier="high" amount={bounty.tiers.high} />
        <TierBadge tier="medium" amount={bounty.tiers.medium} />
      </div>

      {/* Pool + expiry */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>
            {formatUsd(bounty.poolRemaining)} USDC remaining
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" style={{ color: urgent ? 'var(--danger)' : 'var(--subtle)' }} />
          <span
            className="text-xs font-medium"
            style={{ color: urgent ? 'var(--danger)' : 'var(--subtle)' }}
          >
            {days === 0 ? 'Closes today' : `${days}d left`}
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        to={`/submit/${bounty.id}`}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
        style={{ background: 'var(--accent)', color: 'var(--bg)' }}
      >
        Submit a Report
        <ChevronRight className="w-4 h-4" />
      </Link>
    </article>
  )
}

function CategoryTag({ category }: { category: BountyCategory }) {
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{
        background: `var(--tag-${category})`,
        color: `var(--tag-${category}-ink)`,
        letterSpacing: '0.06em',
      }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  )
}

export function TierBadge({ tier, amount }: { tier: 'critical' | 'high' | 'medium'; amount: number }) {
  const labels: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-lg tabular-nums"
      style={{
        background: `var(--tier-${tier})`,
        color: `var(--tier-${tier}-ink)`,
      }}
    >
      {labels[tier]} · {formatUsd(amount)}
    </span>
  )
}
