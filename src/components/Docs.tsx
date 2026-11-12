import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpen, CheckCircle2, ChevronDown, ExternalLink, TriangleAlert } from 'lucide-react'
import { CONTRACT_ADDRESS, USDC_CONTRACT, USDC_FAUCET_URL, NEAR_CONFIG } from '../near/config'
import { REPO_URL } from '../lib/links'
import {
  ENFORCED,
  FAQ,
  HOW_IT_WORKS,
  LIMITS,
  OVERVIEW,
  TRY_IT,
  type DocStep,
} from '../content/docs'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'try-it', label: 'Try it' },
  { id: 'trust', label: 'Trust and limits' },
  { id: 'reference', label: 'Reference' },
  { id: 'faq', label: 'FAQ' },
]

export function Docs() {
  const { hash } = useLocation()

  // Router links do not scroll to a #section by themselves.
  useEffect(() => {
    const id = hash.replace('#', '')
    const el = id ? document.getElementById(id) : null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [hash])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-10 max-w-2xl">
        <p
          className="mono text-xs font-semibold uppercase mb-3 flex items-center gap-1.5"
          style={{ color: 'var(--accent)', letterSpacing: '0.1em' }}
        >
          <BookOpen className="w-3.5 h-3.5" /> Docs
        </p>
        <h1
          className="display font-700 text-3xl sm:text-4xl text-balance mb-3"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          SilentProof, end to end.
        </h1>
        <p className="text-sm leading-relaxed text-pretty" style={{ color: 'var(--muted)', maxWidth: '60ch' }}>
          What it does, how a report travels from a browser to a payout, what the code guarantees and where it
          still trusts someone. Everything here runs on NEAR testnet.
        </p>
      </header>

      <div className="grid lg:grid-cols-[200px_1fr] gap-10">
        <nav aria-label="On this page" className="lg:sticky lg:top-20 self-start">
          <details className="lg:hidden glass-inner rounded-xl p-3">
            <summary className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--ink)' }}>
              On this page
            </summary>
            <TocList />
          </details>
          <div className="hidden lg:block">
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
              On this page
            </p>
            <TocList />
          </div>
        </nav>

        <div className="flex flex-col gap-12 min-w-0">
          <Section id="overview" title="Overview">
            <p className="text-sm leading-relaxed text-pretty mb-5" style={{ color: 'var(--ink-2)', maxWidth: '65ch' }}>
              {OVERVIEW.lead}
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {OVERVIEW.points.map(p => (
                <div key={p.title} className="glass-card rounded-2xl p-4">
                  <h3 className="display font-700 text-sm mb-1.5" style={{ color: 'var(--ink)' }}>{p.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{p.body}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="how-it-works" title="How it works">
            <Steps steps={HOW_IT_WORKS} />
          </Section>

          <Section id="try-it" title="Try it in about ten minutes">
            <Steps steps={TRY_IT} />
            <p className="text-xs mt-4" style={{ color: 'var(--subtle)' }}>
              The README has the same walkthrough with what you should see at each step.
            </p>
          </Section>

          <Section id="trust" title="Trust and limits">
            <div className="grid md:grid-cols-2 gap-3">
              <Checklist
                title="Enforced by code"
                items={ENFORCED}
                icon={<CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />}
              />
              <Checklist
                title="Not guaranteed (be aware)"
                items={LIMITS}
                icon={<TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />}
              />
            </div>
          </Section>

          <Section id="reference" title="Reference">
            <dl className="glass-card rounded-2xl divide-y" style={{ borderColor: 'var(--border)' }}>
              <RefRow label="Network" value="NEAR testnet" />
              <RefRow label="Contract" value={CONTRACT_ADDRESS} href={`${NEAR_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESS}`} mono />
              <RefRow label="USDC token (Circle)" value={USDC_CONTRACT} href={`${NEAR_CONFIG.explorerUrl}/address/${USDC_CONTRACT}`} mono />
              <RefRow label="Test USDC faucet" value="faucet.circle.com (choose NEAR Testnet)" href={USDC_FAUCET_URL} />
              <RefRow label="Source code" value="github.com/Abbagigo13/silentproof" href={REPO_URL} />
              <RefRow label="Design docs" value="Architecture, security, testing" href={`${REPO_URL}/tree/main/docs`} />
            </dl>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="flex flex-col gap-2">
              {FAQ.map(item => (
                <details key={item.q} className="glass-card rounded-2xl group">
                  <summary
                    className="flex items-center justify-between gap-3 cursor-pointer list-none p-4 min-h-11 text-sm font-semibold"
                    style={{ color: 'var(--ink)' }}
                  >
                    {item.q}
                    <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--subtle)' }} />
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-relaxed text-pretty" style={{ color: 'var(--muted)', maxWidth: '65ch' }}>
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function TocList() {
  return (
    <ul className="flex flex-col gap-0.5 mt-2 lg:mt-0">
      {SECTIONS.map(s => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="block px-2 py-2 -mx-2 rounded-lg text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            {s.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="display font-700 text-xl mb-4" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Steps({ steps }: { steps: DocStep[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <span
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums"
            style={{ background: 'var(--inner-bg)', color: 'var(--ink)', border: '1px solid var(--border)' }}
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{s.title}</h3>
            <p className="text-sm leading-relaxed text-pretty" style={{ color: 'var(--muted)', maxWidth: '65ch' }}>{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Checklist({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <h3 className="display font-700 text-sm mb-3" style={{ color: 'var(--ink)' }}>{title}</h3>
      <ul className="flex flex-col gap-3">
        {items.map(text => (
          <li key={text} className="flex gap-2">
            {icon}
            <span className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RefRow({ label, value, href, mono }: { label: string; value: string; href?: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <dt className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className={`text-xs min-w-0 break-all ${mono ? 'mono' : ''}`} style={{ color: 'var(--ink)' }}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
            {value}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
