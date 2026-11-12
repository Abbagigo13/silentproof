import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck, Sun, Moon, Building2, User, ExternalLink, BookOpen } from 'lucide-react'
import { NEAR_CONFIG, CONTRACT_ADDRESS, USDC_FAUCET_URL } from '../near/config'
import { REPO_URL, README_URL, NEAR_HACKATHON_URL } from '../lib/links'
import { useTheme } from '../context/ThemeContext'
import type { AppMode } from '../types'

interface LayoutProps {
  children: ReactNode
  mode: AppMode
  onModeChange: (mode: AppMode) => void
}

export function Layout({ children, mode, onModeChange }: LayoutProps) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const isOrg = mode === 'org'

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 glass-card border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Wordmark */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span
              className="display font-700 text-base tracking-tight"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              SilentProof
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <NavLink to="/docs" active={location.pathname === '/docs'}>Docs</NavLink>
            </div>
            <Link
              to="/docs"
              className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
              style={{ background: 'var(--inner-bg)', color: 'var(--muted)' }}
              aria-label="Docs"
            >
              <BookOpen className="w-4 h-4" />
            </Link>

            {/* Mode toggle pill */}
            <div
              className="flex items-center rounded-full p-0.5 gap-0.5"
              style={{ background: 'var(--inner-bg)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={() => onModeChange('submitter')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: !isOrg ? 'var(--accent)' : 'transparent',
                  color: !isOrg ? 'var(--bg)' : 'var(--muted)',
                }}
              >
                <User className="w-3 h-3" />
                Submitter
              </button>
              <button
                onClick={() => onModeChange('org')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: isOrg ? 'var(--accent)' : 'transparent',
                  color: isOrg ? 'var(--bg)' : 'var(--muted)',
                }}
              >
                <Building2 className="w-3 h-3" />
                Organization
              </button>
            </div>

            {/* Org nav links */}
            {isOrg && (
              <nav className="hidden sm:flex items-center gap-1">
                <NavLink to="/org" active={location.pathname === '/org'}>Dashboard</NavLink>
                <NavLink to="/org/bounties" active={location.pathname === '/org/bounties'}>Bounties</NavLink>
              </nav>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
              style={{ background: 'var(--inner-bg)', color: 'var(--muted)' }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-10" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-lg"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="display font-700 text-base" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                SilentProof
              </span>
            </div>
            <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--subtle)', maxWidth: '32ch' }}>
              Encrypted reports, signed AI scores, USDC payouts. Testnet demonstration: tokens have no cash value.
            </p>
          </div>

          <FooterColumn title="Product">
            <FooterLink to="/">Bounties</FooterLink>
            <FooterLink to="/org">Organization</FooterLink>
          </FooterColumn>

          <FooterColumn title="Learn">
            <FooterLink to="/docs#overview">Overview</FooterLink>
            <FooterLink to="/docs#how-it-works">How it works</FooterLink>
            <FooterLink to="/docs#try-it">Try it</FooterLink>
            <FooterLink to="/docs#faq">FAQ</FooterLink>
            <FooterLink to="/docs">Docs</FooterLink>
          </FooterColumn>

          <FooterColumn title="Build">
            <FooterLink href={REPO_URL}>GitHub</FooterLink>
            <FooterLink href={README_URL}>README</FooterLink>
            <FooterLink href={`${NEAR_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESS}`}>Contract</FooterLink>
            <FooterLink href={USDC_FAUCET_URL}>Test USDC faucet</FooterLink>
            <FooterLink href={NEAR_HACKATHON_URL}>NEAR Hackathon</FooterLink>
          </FooterColumn>
        </div>
        <p className="pb-8 text-center text-xs" style={{ color: 'var(--subtle)' }}>
          Reports are encrypted in your browser before upload. MIT licensed.
        </p>
      </footer>
    </div>
  )
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: active ? 'var(--inner-bg)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--muted)',
      }}
    >
      {children}
    </Link>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
        {title}
      </p>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  )
}

function FooterLink({ to, href, children }: { to?: string; href?: string; children: ReactNode }) {
  const className = 'inline-flex items-center gap-1 py-2 min-h-11 text-sm transition-opacity hover:opacity-70'
  const style = { color: 'var(--ink-2)' }
  return (
    <li>
      {to ? (
        <Link to={to} className={className} style={style}>{children}</Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
          {children}
          <ExternalLink className="w-3 h-3" style={{ color: 'var(--subtle)' }} />
        </a>
      )}
    </li>
  )
}
