# Design System — Bunny's Whisper

## Brand

- **Name:** Bunny's Whisper
- **Tone:** Luxury dark streetwear — quiet, premium, purple glow
- **Default currency:** EGP

## Color palette

| Token | Hex | Usage |
|-------|-----|-------|
| Page background | `#07030d` | Main canvas |
| Card surface | `#0d0716` / `#0b0f1a` | Cards, panels |
| Purple accent | `#c084fc` / purple-300 | CTAs, highlights |
| Border | `border-purple-950` | Card edges |
| Success | green-300 on green-500/15 | In stock, income |
| Error | red-300 on red-500/15 | Cancelled, expense |

## Typography

- Headings: bold/black, gradient text on hero (`from-white via-purple-100 to-fuchsia-400`)
- Eyebrow labels: uppercase, wide tracking (`tracking-[0.32em]`)
- Body: gray-300/400 on dark background

## Components

| Pattern | Example |
|---------|---------|
| Primary CTA | Rounded-full purple border/fill buttons |
| Cards | `rounded-3xl border border-purple-950 bg-[#0d0716]` |
| Admin metrics | `MetricCard` component |
| Charts | Recharts inside `AnalyticsChartFrame` |
| Empty states | `PremiumEmptyState` |
| Loaders | `BrandLoader` with `/logo.png` |

## Wishlist (V1.1)

- **Empty heart:** outline, muted purple
- **Filled heart:** purple-300 fill + soft glow
- **Reward toast:** bottom-centered dark glass panel, 4.5s auto-dismiss

## Icons / PWA

- Logo: `/logo.png` (bunny mark)
- Apple touch: `/apple-touch-icon.png` (180×180, black background)
- Manifest icons: `/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`

## Mobile

- Min tap targets ~44px (`min-h-11`, `min-w-11`)
- Safe area insets on main layouts
- No horizontal overflow on filter/review rows

## Do not change casually

Global checkout styling, payment pages, or order admin layouts unless explicitly requested — regression risk on conversion flows.
