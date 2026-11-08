import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import type { BountyCategory } from '../types'
import { createBounty } from '../near/contract'
import type { BountyCategory as ContractCategory } from '../near/contract'

// Map UI lowercase categories to contract title-case
const CATEGORY_MAP: Record<BountyCategory, ContractCategory> = {
  fraud: 'Fraud',
  security: 'Security',
  policy: 'Policy',
  legal: 'Legal',
}

interface PostBountySheetProps {
  open: boolean
  onClose: () => void
}

const CATEGORIES: { id: BountyCategory; label: string }[] = [
  { id: 'fraud', label: 'Fraud' },
  { id: 'security', label: 'Security' },
  { id: 'policy', label: 'Policy' },
  { id: 'legal', label: 'Legal' },
]

export function PostBountySheet({ open, onClose }: PostBountySheetProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<BountyCategory>('fraud')
  const [tiers, setTiers] = useState({ critical: 10, high: 5, medium: 2 })
  const [expiry, setExpiry] = useState(() => isoDateFromNow(30))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = title.length >= 5 && expiry.length > 0

  async function handleCreate() {
    setSubmitting(true)
    setError(null)
    try {
      const expiryDate = new Date(expiry)
      const nowMs = Date.now()
      const expiryDays = Math.max(1, Math.round((expiryDate.getTime() - nowMs) / (24 * 60 * 60 * 1000)))
      await createBounty({
        title,
        description,
        category: CATEGORY_MAP[category],
        tierCritical: tiers.critical,
        tierHigh: tiers.high,
        tierMedium: tiers.medium,
        expiryDays,
      })
      setSubmitting(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.section
            className="relative w-full max-w-lg overflow-hidden rounded-t-3xl"
            style={{ background: 'var(--sheet-bg)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full" style={{ background: 'var(--border)' }} />
            </div>

            <div className="px-5 pb-8 pt-3 overflow-y-auto max-h-[85dvh]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="display font-700 text-lg" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  Post New Bounty
                </h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70"
                  style={{ background: 'var(--inner-bg)', color: 'var(--muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-5">
                {/* Title */}
                <Field label="Bounty title">
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Financial irregularities in procurement"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ background: 'var(--inner-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  />
                </Field>

                {/* Description */}
                <Field label="Description">
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    placeholder="What should submitters report? What evidence helps?"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                    style={{ background: 'var(--inner-bg)', border: '1px solid var(--border)', color: 'var(--ink)', fontFamily: 'inherit' }}
                  />
                </Field>

                {/* Category */}
                <Field label="Category">
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: category === c.id ? 'var(--accent)' : 'var(--inner-bg)',
                          color: category === c.id ? 'var(--bg)' : 'var(--muted)',
                          border: `1px solid ${category === c.id ? 'transparent' : 'var(--border)'}`,
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Payout tiers */}
                <Field label="Payout tiers (USDC). The pool must hold at least a tier's amount to pay it.">
                  <div className="grid grid-cols-3 gap-2">
                    {(['critical', 'high', 'medium'] as const).map(tier => (
                      <div key={tier}>
                        <label
                          className="block text-xs mb-1 capitalize"
                          style={{ color: `var(--tier-${tier}-ink)` }}
                        >
                          {tier}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={tiers[tier]}
                          onChange={e => setTiers(t => ({ ...t, [tier]: Number(e.target.value) }))}
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none tabular-nums"
                          style={{ background: 'var(--inner-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                        />
                      </div>
                    ))}
                  </div>
                </Field>

                {/* Expiry */}
                <Field label="Expiry date">
                  <input
                    type="date"
                    value={expiry}
                    min={isoDateFromNow(1)}
                    max={isoDateFromNow(365)}
                    onChange={e => setExpiry(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ background: 'var(--inner-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  />
                  <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
                    {expiry
                      ? `Closes in ${Math.max(1, daysUntil(expiry))} days. The bounty cannot be changed after creation, and unspent funds can only be withdrawn after it closes.`
                      : 'Pick a closing date between 1 and 365 days from now.'}
                  </p>
                </Field>

                {error && (
                  <p className="text-xs text-center" style={{ color: 'var(--error)' }}>
                    {error}
                  </p>
                )}

                <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                  The bounty starts with an empty pool. After it is created, fund it from the
                  "Your bounties" list on this dashboard.
                </p>

                <button
                  disabled={!canSubmit || submitting}
                  onClick={() => { void handleCreate() }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Creating bounty...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Bounty
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function isoDateFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function daysUntil(isoDate: string): number {
  return Math.round((new Date(isoDate).getTime() - Date.now()) / 86_400_000)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ink-2)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
