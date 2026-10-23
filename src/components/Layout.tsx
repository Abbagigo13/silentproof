import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck, Sun, Moon, Building2, User } from 'lucide-react'
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
      <footer className="py-6 text-center" style={{ color: 'var(--subtle)' }}>
        <p className="text-xs">
          Reports are encrypted end-to-end. No identity is stored.
          Built for{' '}
          <a
            href="https://near.army/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            NEAR Hackathon
          </a>
          .
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
