# SilentProof — Design System

**Version:** 0.1
**Last updated:** 2026-10-23

---

## 1. Philosophy

SilentProof is a security tool used by people in genuinely sensitive situations. The visual language must communicate:
- **Trust** — the product does what it says with your data
- **Seriousness** — this is not a game or a consumer wallet
- **Calm** — a person under stress should not be overwhelmed by the UI

We achieve this with Arc Dark as the default mode, generous whitespace, restrained color use, and typography that reads clearly at small sizes.

Light mode is available and uses Arc Light tokens. Both modes share identical component structure and spacing — only color values change.

---

## 2. Color tokens

All colors are defined as CSS custom properties on `:root` (light) and `[data-theme="dark"]`. Components use `var(--token)` exclusively — no hardcoded hex values in component files.

### Arc Light (default light)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | Page background |
| `--bg-gradient` | warm neutral gradient | Body gradient |
| `--surface` | `rgba(255,255,255,0.72)` | Glass card surface |
| `--surface-strong` | `rgba(255,255,255,0.90)` | Elevated surfaces |
| `--surface-muted` | `#f5f5f8` | Non-glass backgrounds |
| `--ink` | `#122d45` | Primary text |
| `--ink-2` | `#334155` | Secondary text |
| `--muted` | `#6b6580` | Label text |
| `--subtle` | `#8a849c` | Hint text |
| `--border` | `rgba(18,45,69,0.12)` | Dividers, outlines |
| `--border-strong` | `rgba(25,53,77,0.50)` | Focus rings |
| `--accent` | `#122d45` | Primary CTA background |
| `--accent-hover` | `#1061a6` | Hover state |
| `--success` | `#1a8047` | Confirmed, paid, encrypted |
| `--danger` | `#ba2b4c` | Rejected, error, critical tier |

### Arc Dark

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0d1b2f` | Page background |
| `--surface` | `rgba(255,255,255,0.07)` | Glass card surface |
| `--ink` | `#f9faf3` | Primary text |
| `--accent` | `#acc6e9` | Primary CTA background |
| `--success` | `#8dd89f` | Semantic green |
| `--danger` | `#e86d7a` | Semantic red |

### Category colors (light + dark variants)

| Category | Background token | Text token |
|---|---|---|
| `fraud` | `--tag-fraud` | `--tag-fraud-ink` |
| `security` | `--tag-security` | `--tag-security-ink` |
| `policy` | `--tag-policy` | `--tag-policy-ink` |
| `legal` | `--tag-legal` | `--tag-legal-ink` |

### Severity tier colors

| Tier | Background token | Text token |
|---|---|---|
| `critical` | `--tier-critical` | `--tier-critical-ink` |
| `high` | `--tier-high` | `--tier-high-ink` |
| `medium` | `--tier-medium` | `--tier-medium-ink` |

---

## 3. Typography

### Font stack

| Role | Font | Fallback |
|---|---|---|
| Display / headings | Space Grotesk | sans-serif |
| Body / UI | DM Sans | sans-serif |
| Mono / hashes / addresses | JetBrains Mono | Menlo, monospace |

Fonts are loaded from Google Fonts in `index.html` via `<link>` tags (not `@import` — browser-honored on first paint). CSS classes `.display` and `.mono` apply the non-body fonts.

### Scale

| Use | Size | Weight | Class |
|---|---|---|---|
| Hero heading | 32–40px | 700 | `.display` + Tailwind `text-3xl`/`text-4xl` |
| Section heading | 20–24px | 700 | `.display` + `text-xl`/`text-2xl` |
| Card title | 16px | 600 | `.display` + `text-base` |
| Body | 14px | 400–500 | default |
| Label / hint | 12px | 400–600 | `text-xs` |
| Mono hash | 12px | 400 | `.mono text-xs` |

### Rules
- Display text 32px+ uses `letter-spacing: -0.02em` to `-0.04em`
- All-caps labels use `letter-spacing: 0.06em` to `0.1em`
- Balances, addresses, and IDs use `tabular-nums`
- Body copy stays under `65ch`

---

## 4. Spacing

Follow Tailwind's default 4px base unit. Key layout values:

| Context | Value |
|---|---|
| Page max-width | `max-w-6xl` (1152px) |
| Narrow (forms, sheets) | `max-w-lg` (512px) |
| Page horizontal padding | `px-4` (16px) |
| Card padding | `p-5` (20px) |
| Inner field padding | `p-4` (16px) |
| Card gap | `gap-4` (16px) |
| Row gap inside card | `gap-3` (12px) |

---

## 5. Component patterns

### Glass card
```
background: var(--card-bg)
border: 1px solid var(--card-border)
backdrop-filter: blur(24px) saturate(180%)
border-radius: 16px (rounded-2xl)
padding: 20px (p-5)
```
Used for: bounty cards, report cards, dashboard stats, submission review.

### Glass inner (nested field)
```
background: var(--inner-bg)
border: 1px solid var(--inner-border)
border-radius: 12px (rounded-xl)
```
Used for: text inputs, textareas, info strips, nested data rows.

### Glass sheet (bottom sheet)
```
background: var(--sheet-bg)
backdrop-filter: blur(40px) saturate(200%)
border-radius: 24px top corners (rounded-t-3xl)
```
Used for: PostBountySheet, confirmation modals.

### Primary CTA button
```
background: var(--accent)
color: var(--bg)
border-radius: 12px (rounded-xl)
padding: 14px vertical (py-3.5)
font: 14px 600
transition: opacity 0.15s, scale 0.1s
hover: opacity 0.9
active: scale 0.99
disabled: opacity 0.4, cursor not-allowed
```

### Ghost / secondary button
```
background: var(--inner-bg)
border: 1px solid var(--border)
color: var(--muted)
Same radius and padding as primary
```

### Tier badge
```
background: var(--tier-{tier})
color: var(--tier-{tier}-ink)
border-radius: 8px (rounded-lg)
padding: 2px 8px
font: 12px 600 tabular-nums
```

### Category tag
```
background: var(--tag-{category})
color: var(--tag-{category}-ink)
border-radius: 9999px (rounded-full)
padding: 2px 8px
font: 12px 600 uppercase, letter-spacing 0.06em
```

---

## 6. Motion

Framer Motion is available. Use it sparingly.

| Pattern | When |
|---|---|
| `y: '100%' → y: 0` spring | Bottom sheet enter/exit |
| `opacity: 0 → 1` | Overlay backdrop |
| `animate-spin` (Tailwind) | Loading spinner inside CTA |
| `animate-pulse` (Tailwind) | Skeleton loading states |
| No layout animations | Never animate `width`, `height`, `margin`, `padding` |

Spring config for sheets: `{ type: 'spring', damping: 30, stiffness: 300 }`.

---

## 7. Icons

Use `lucide-react` exclusively. No emojis. No custom SVG unless strictly necessary (the wordmark shield icon is the one exception).

Key icons in use:

| Icon | Use |
|---|---|
| `ShieldCheck` | Wordmark, empty states |
| `Lock` | Encryption status, submit CTA |
| `Clock` | Expiry countdown |
| `DollarSign` | Pool balance |
| `CheckCircle2` | Confirmed, receipt success |
| `XCircle` | Rejected |
| `Upload` | File attachment |
| `Download` | Key file download |
| `Sun` / `Moon` | Theme toggle |
| `User` / `Building2` | Mode toggle pill |
| `Plus` | Add bounty |
| `ChevronRight` / `ChevronLeft` | Step navigation |
| `FileText` | Empty queue state |

---

## 8. Responsive layout

| Viewport | Layout |
|---|---|
| Mobile (< 640px) | Single column. Max-width `max-w-md` for forms. Stack all panels. |
| Tablet (640–1024px) | Two-column grid for bounty cards. Org stats in 2×2 grid. |
| Desktop (> 1024px) | Two-column grid for report queue. Full 6-col max-width. |

Minimum tap target: 44px height on all interactive elements.

---

## 9. Accessibility

- All interactive elements have visible focus states (`:focus-visible` ring using `--focus` token)
- Form inputs use `<label>` elements with `htmlFor` wired to `id`
- Icon-only buttons have `aria-label`
- Color is never the sole differentiator — tier badges use text labels, not color only
- Theme preference is read from `prefers-color-scheme` on first load
