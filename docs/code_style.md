# SilentProof — Code Style Guide

**Version:** 0.1
**Last updated:** 2026-10-23

---

## 1. General principles

- **Readable over clever.** A new contributor should understand what a function does in 10 seconds.
- **Explicit over implicit.** Name your types. Name your variables. Avoid generic names like `data`, `item`, `value`.
- **Small files.** A file over 300 lines is a signal to split. Components above 200 lines should extract sub-components.
- **No dead code.** Remove it. If it might be needed later, use a comment and a GitHub issue.

---

## 2. TypeScript

### Types and interfaces

Always use `interface` for object shapes. Use `type` for unions, intersections, and aliases.

```ts
// Good
interface Report {
  id: string
  tier: SeverityTier
  credibility: number
}

type SeverityTier = 'critical' | 'high' | 'medium'

// Avoid
const report: { id: string; tier: string } = { ... }
```

Never use `any`. Use `unknown` when the type is genuinely unknown, then narrow.

```ts
// Good
function parsePayload(raw: unknown): Report {
  if (!isReport(raw)) throw new Error('invalid payload')
  return raw
}

// Never
function parsePayload(raw: any): any { ... }
```

Use `satisfies` for config objects where you want to infer the narrowest type:

```ts
const TIER_COLORS = {
  critical: 'var(--tier-critical-ink)',
  high: 'var(--tier-high-ink)',
  medium: 'var(--tier-medium-ink)',
} satisfies Record<SeverityTier, string>
```

### Async

Use `async/await`. Never use `.then().catch()` chains.

```ts
// Good
async function submitReport(cid: string, address: string): Promise<string> {
  const reportId = await nearContract.submitReport(cid, address)
  return reportId
}

// Avoid
function submitReport(cid: string, address: string) {
  return nearContract.submitReport(cid, address).then(id => id).catch(err => { throw err })
}
```

Async event handlers cause lint errors (`no-misused-promises`). Wrap them:

```ts
// Good
onClick={() => { void handleSubmit() }}

// Lint error
onClick={handleSubmit}  // when handleSubmit is async
```

### Null and undefined

Prefer optional chaining and nullish coalescing:

```ts
const name = org?.name ?? 'Unknown'
const tiers = report.tiers?.critical ?? 0
```

Never use `!` non-null assertions unless you are certain and it cannot be avoided — add a comment explaining why.

---

## 3. React

### Component structure

Order inside a component file:
1. Imports (external, then internal, then types)
2. Constants and helpers (outside component)
3. Component function
4. Sub-components (at bottom of same file if small, in their own file if > 50 lines)

```tsx
// External
import { useState } from 'react'
import { Lock } from 'lucide-react'

// Internal
import { useTheme } from '../context/ThemeContext'
import type { Report } from '../types'

// Constants
const MAX_REPORT_LENGTH = 2000

// Component
export function ReportForm({ onSubmit }: Props) {
  const [text, setText] = useState('')
  ...
}
```

### Props

Always define an `interface` for props. Destructure in the function signature.

```tsx
interface BountyCardProps {
  bounty: Bounty
  onSelect?: (id: string) => void
}

export function BountyCard({ bounty, onSelect }: BountyCardProps) { ... }
```

### Hooks

Custom hooks live in `src/hooks/`. Name them `use*`. Return an object, not a tuple, unless there are only two values.

```ts
// Good
function useReports() {
  return { reports, loading, error, refresh }
}

// OK for simple pairs
function useToggle(initial = false): [boolean, () => void]
```

### State

Prefer `useState` for local state. Lift state to the nearest common ancestor. Do not reach for a global state library unless three or more unrelated components need the same value.

Context is for cross-cutting concerns (theme, wallet connection) — not for page-level state.

---

## 4. Styling

### Tailwind classes

Use Tailwind utility classes for all layout and spacing. Do not write new CSS files.

Group classes in this order: layout, spacing, sizing, typography, color, border, effect.

```tsx
// Good
<div className="flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-xl transition-all">

// Avoid mixing concerns
<div style={{ display: 'flex', gap: '12px' }} className="text-sm">
```

### CSS custom properties

Use `var(--token)` for all color and surface values. Never hardcode hex in component files.

```tsx
// Good
<div style={{ background: 'var(--accent)', color: 'var(--bg)' }}>

// Never
<div style={{ background: '#122d45', color: '#ffffff' }}>
```

### Class composition

Use `clsx` when building conditional class strings:

```tsx
import { clsx } from 'clsx'

const cls = clsx(
  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
  isActive ? 'bg-accent text-bg' : 'bg-transparent text-muted',
)
```

---

## 5. File naming

| Type | Convention | Example |
|---|---|---|
| React component | PascalCase.tsx | `BountyCard.tsx` |
| Hook | camelCase.ts | `useNearContract.ts` |
| Utility | camelCase.ts | `formatUsd.ts` |
| Type file | camelCase.ts | `index.ts` in `types/` |
| Context | PascalCase.tsx | `ThemeContext.tsx` |
| Test | `*.test.ts` or `*.spec.ts` | `BountyCard.test.tsx` |

---

## 6. Imports

Use path alias `@/` for `src/`:

```ts
import { useTheme } from '@/context/ThemeContext'
import type { Report } from '@/types'
```

Group imports:
1. React and framework imports
2. Third-party packages
3. Internal `@/` imports
4. Relative imports
5. Type-only imports (using `import type`)

No default re-exports from barrel files (index.ts). Import directly from the file.

---

## 7. NEAR and crypto

### Never hardcode addresses or key material

```ts
// Good — from env
const contractId = import.meta.env.VITE_NEAR_CONTRACT_ID

// Never
const contractId = 'silentproof.testnet'
```

### Crypto operations

All crypto operations use `crypto.subtle` (WebCrypto). Never use a third-party crypto library for core encryption. Never log key material.

```ts
// Never
console.log('key:', rawKey)
```

### Contract calls

Type all contract method arguments and return values. Use `near-api-js` view functions for reads; NEAR Wallet Selector for writes.

```ts
interface SubmitReportArgs {
  bounty_id: string
  ipfs_cid: string
  payout_address_hash: string
}

async function submitReport(args: SubmitReportArgs): Promise<string> { ... }
```

---

## 8. Git

- Commits are atomic: one logical change per commit
- Commit messages: imperative present tense, `add`, `fix`, `refactor`, `remove`, `update`
- No secrets committed — `.env*` and `recovery_file*` are in `.gitignore`
- Branch naming: `feat/bounty-list`, `fix/tier-badge-color`, `docs/architecture`

---

## 9. Linting

`oxlint` runs via `bun run check`. Fix all errors before pushing. Warnings are acceptable; errors block CI.

Rules of note:
- `no-misused-promises`: async functions passed to `onClick` must be wrapped in `() => { void fn() }`
- `no-floating-promises`: all `navigate()` calls (which return `Promise<void> | void`) must be prefixed with `void`
- `no-explicit-any`: use `unknown` and narrow

Never suppress lint rules with `eslint-disable` unless there is genuinely no other option — add a comment explaining why.
