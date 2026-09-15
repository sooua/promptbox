---
name: PromptBox
description: A neutral, quiet desktop guide through the prompts of a software project, built on shadcn (base-nova) and ReUI.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  accent: "oklch(0.97 0 0)"
  border: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  success: "emerald-500"
  background-dark: "oklch(0.145 0 0)"
  card-dark: "oklch(0.205 0 0)"
  primary-dark: "oklch(0.922 0 0)"
  border-dark: "oklch(1 0 0 / 10%)"
typography:
  sans: "Inter, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
  mono: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace"
  display: { size: "1.875rem", weight: 600, tracking: "-0.02em" }
  title: { size: "1.5rem", weight: 600, tracking: "-0.01em" }
  body: { size: "0.875rem", weight: 400, lineHeight: 1.5 }
  caption: { size: "0.75rem", weight: 400 }
radius: "0.625rem"
---

## 1. Overview

PromptBox uses the shadcn neutral palette in its **base-nova** preset with ReUI on top. There is no house colour: black-on-white in light mode, off-white-on-near-black in dark, one grey ramp for everything else. Emphasis comes from weight and spacing, never from hue. The tokens live in `src/renderer/src/index.css` (`:root` / `.dark`, mapped into Tailwind through `@theme inline`); components come from `src/renderer/src/components/ui` (shadcn) and `components/reui` (ReUI Stepper, Frame, Badge, Alert). Nothing is hand-styled that one of those already provides.

## 2. Colors

Use the shadcn names directly: `bg-background` / `bg-card` / `bg-muted` for surfaces, `text-foreground` / `text-muted-foreground` for text, `border-border`, `bg-primary text-primary-foreground` for the single solid action on a screen, `text-destructive` for danger. `success` / `info` / `warning` exist for status only (sync dots, toasts). Never reach for a raw Tailwind colour.

## 3. Typography

One face, Inter falling back to the system sans and PingFang / YaHei for CJK. Headings are the same face at 600 weight with slight negative tracking; there is no serif and no display font. Code and file paths use the mono stack inside `<code>` or `<pre>`.

## 4. Elevation

Flat by default. Cards are a 1px `border-border` on `bg-card`; the ReUI `Frame` adds its own inset panel. Popovers and dialogs use `shadow-lg` / `shadow-2xl`. No coloured shadows, no glows.

## 5. Components

- **Buttons**: shadcn `Button`. `default` for the one primary action, `outline` for secondary, `ghost` for toolbar / nav, `destructive` for danger. Icons inside buttons need no size class.
- **Icons**: ReUI Motion Icons, outline style only, imported from `src/renderer/src/icons.ts`. No lucide, no other set.
- **Inputs**: `Input`, `Textarea`, `Select` (base-ui; pass `items` so the trigger shows labels), `Switch`, `Tabs` as a segmented control for 2–3 options.
- **Route**: ReUI `Stepper` for the five stages, `Frame` for the step card, `Kbd` for shortcuts. Headlines on the choose screen and the step card use React Bits `StaggeredText` (`components/react-bits`), chars, ≤ 0.5 s, reduced-motion aware.
- **React Bits**: only Starter components that need no WebGL. The Pro blocks (wizard, onboarding, app-shell) are SaaS forms and do not fit; do not install them.
- **Overlays**: the app's `Modal` shell (focus trap + Esc) with `bg-popover` panels; toasts bottom-centre.

## 6. Do's and Don'ts

- Do keep one primary button per screen.
- Do use the copy of a control's own state (a tick in the copy button) instead of a toast where the eye already is.
- Don't put arrows, dots or dashes in labels as decoration (`→`, `·`, `—`). Use a comma or a second line.
- Don't mix icon styles or add colour to icons; they inherit `currentColor`.
- Don't restyle a shadcn / ReUI component with ad-hoc classes when a variant exists.
- Every animation is short (≤ 300 ms) and collapsed under `prefers-reduced-motion`.
