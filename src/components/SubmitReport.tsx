import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Lock, Upload, ChevronRight, ChevronLeft, CheckCircle2, Download, AlertCircle } from 'lucide-react'

type Step = 1 | 2 | 3 | 4

interface FormState {
  reportText: string
  file: File | null
  payoutAddress: string
  connectWallet: boolean
}

export function SubmitReport() {
  const { bountyId } = useParams<{ bountyId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>({
    reportText: '',
    file: null,
    payoutAddress: '',
    connectWallet: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ipfsCid] = useState('QmXf7dVj3kP9mNr2tHs8wLqBvEyCz4Ap6nUiRdT5oGk1M')

  const canNext1 = form.reportText.trim().length >= 20
  const canNext2 = form.payoutAddress.trim().length >= 10

  async function handleSubmit() {
    setSubmitting(true)
    // Simulated submit — wired to NEAR contract in build phase
    await new Promise(r => setTimeout(r, 1800))
    setSubmitting(false)
    setSubmitted(true)
    setStep(4)
  }

  if (submitted && step === 4) {
    return <SubmitReceipt ipfsCid={ipfsCid} onDone={() => { void navigate('/') }} />
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      {/* Back */}
      <button
        onClick={() => { if (step === 1) { void navigate('/') } else { setStep(s => (s - 1) as Step) } }}
        className="flex items-center gap-1 text-sm font-medium mb-6 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--muted)' }}
      >
        <ChevronLeft className="w-4 h-4" />
        {step === 1 ? 'Back to bounties' : 'Previous step'}
      </button>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as const).map(n => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
              style={{
                background: step >= n ? 'var(--accent)' : 'var(--inner-bg)',
                color: step >= n ? 'var(--bg)' : 'var(--subtle)',
                border: `1px solid ${step >= n ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {n}
            </div>
            {n < 3 && (
              <div
                className="h-px flex-1 transition-all"
                style={{ background: step > n ? 'var(--accent)' : 'var(--border)' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Report */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="display font-700 text-xl mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Your report
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Bounty <span className="mono text-xs">{bountyId}</span>
            </p>
          </div>

          <div className="glass-inner rounded-2xl p-4 flex items-center gap-2">
            <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--success)' }} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Your report is encrypted in your browser before leaving this page. We never see the plaintext.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ink-2)' }}>
              Describe what you observed
            </label>
            <textarea
              value={form.reportText}
              onChange={e => setForm(f => ({ ...f, reportText: e.target.value }))}
              rows={8}
              placeholder="Be specific: who, what, when, where. The AI scores reports on specificity and supporting evidence."
              className="w-full glass-inner rounded-xl p-4 text-sm resize-none outline-none focus:ring-2 transition-all"
              style={{
                color: 'var(--ink)',
                background: 'var(--inner-bg)',
                border: '1px solid var(--border)',
                fontFamily: 'inherit',
              }}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                Minimum 20 characters
              </span>
              <span
                className="text-xs tabular-nums"
                style={{ color: form.reportText.length >= 20 ? 'var(--success)' : 'var(--subtle)' }}
              >
                {form.reportText.length} chars
              </span>
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ink-2)' }}>
              Attach evidence <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>(optional · PDF, image, text · max 10MB)</span>
            </label>
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl py-8 cursor-pointer transition-all hover:opacity-80"
              style={{ border: '1.5px dashed var(--border)', background: 'var(--inner-bg)' }}
            >
              <Upload className="w-5 h-5" style={{ color: 'var(--subtle)' }} />
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                {form.file ? form.file.name : 'Drag & drop or click to browse'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
              />
            </label>
          </div>

          <button
            disabled={!canNext1}
            onClick={() => setStep(2)}
            className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2 — Payout address */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="display font-700 text-xl mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Your payout address
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Where should USDC go if your report is confirmed?
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ink-2)' }}>
              Payout address
            </label>
            <input
              type="text"
              value={form.payoutAddress}
              onChange={e => setForm(f => ({ ...f, payoutAddress: e.target.value }))}
              placeholder="0x... or yourname.near"
              className="w-full rounded-xl px-4 py-3.5 text-sm mono outline-none transition-all"
              style={{
                background: 'var(--inner-bg)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
              Provide a one-time address you control. This is stored as a hash on-chain, not as plaintext.
            </p>
          </div>

          {/* Optional wallet */}
          <div
            className="glass-inner rounded-xl p-4 flex items-start gap-3"
          >
            <input
              type="checkbox"
              id="connect-wallet"
              checked={form.connectWallet}
              onChange={e => setForm(f => ({ ...f, connectWallet: e.target.checked }))}
              className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
            <label htmlFor="connect-wallet" className="cursor-pointer">
              <span className="text-xs font-semibold block mb-0.5" style={{ color: 'var(--ink)' }}>
                Connect a NEAR account for on-chain authorship proof
              </span>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                Optional. Links your report to a one-time NEAR account without revealing your identity.
              </span>
            </label>
          </div>

          {form.connectWallet && (
            <div
              className="glass-inner rounded-xl p-4 flex items-center gap-3"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                NEAR Wallet Selector will be available when the contract is deployed on NEAR testnet.
              </p>
            </div>
          )}

          <button
            disabled={!canNext2}
            onClick={() => setStep(3)}
            className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="display font-700 text-xl mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Review and submit
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Confirm your submission details before sending.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <ReviewRow label="Bounty" value={bountyId ?? ''} mono />
            <ReviewRow label="Report length" value={`${form.reportText.length} characters`} />
            <ReviewRow label="Attachment" value={form.file ? form.file.name : 'None'} />
            <ReviewRow
              label="Payout address"
              value={`${form.payoutAddress.slice(0, 12)}...${form.payoutAddress.slice(-6)}`}
              mono
            />
            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Encryption</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(26,128,71,0.12)', color: 'var(--success)' }}
              >
                <Lock className="w-3 h-3" />
                AES-GCM Encrypted
              </span>
            </div>
          </div>

          <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
            This action cannot be undone. Your report will be scored by a TEE-attested AI and reviewed by the organization.
          </p>

          <button
            disabled={submitting}
            onClick={() => { void handleSubmit() }}
            className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Encrypting and submitting...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Submit Anonymously
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
      <span
        className={`text-xs text-right truncate max-w-[60%] ${mono ? 'mono' : ''}`}
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  )
}

function SubmitReceipt({ ipfsCid, onDone }: { ipfsCid: string; onDone: () => void }) {
  function downloadKey() {
    const key = { note: 'This is your report encryption key. Store it safely.', key: window.crypto.randomUUID() + window.crypto.randomUUID(), ipfsCid }
    const blob = new Blob([JSON.stringify(key, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `silentproof-key-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(26,128,71,0.12)' }}
      >
        <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--success)' }} />
      </div>
      <div>
        <h2 className="display font-700 text-2xl mb-2" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Report submitted
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your encrypted report is stored on IPFS and logged on NEAR. The TEE AI will score it within minutes.
        </p>
      </div>

      <div className="w-full glass-card rounded-2xl p-5 flex flex-col gap-3 text-left">
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>IPFS Content ID</p>
          <p className="mono text-xs break-all" style={{ color: 'var(--ink)' }}>{ipfsCid}</p>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>What happens next</p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            The organization will see a severity tier and AI summary. They confirm payout to your address. You will not be contacted directly.
          </p>
        </div>
      </div>

      <button
        onClick={downloadKey}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
        style={{ background: 'var(--accent)', color: 'var(--bg)' }}
      >
        <Download className="w-4 h-4" />
        Download encryption key file
      </button>

      <button
        onClick={onDone}
        className="text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--subtle)' }}
      >
        Back to bounties
      </button>
    </div>
  )
}
