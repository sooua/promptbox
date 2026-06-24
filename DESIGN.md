---
name: PromptBox
description: A warm, local-first desktop home for AI prompts, Skills, Agents, and MCP configs.
colors:
  brand: "#c96442"
  brand-strong: "#b65535"
  coral: "#d97757"
  canvas: "#f5f4ed"
  surface: "#faf9f5"
  surface-2: "#e8e6dc"
  ink: "#141413"
  muted: "#5e5d59"
  faint: "#87867f"
  line: "#f0eee6"
  line-strong: "#e8e6dc"
  ring: "#d1cfc5"
  error: "#b53333"
  focus: "#3898ec"
  canvas-dark: "#141413"
  surface-dark: "#1e1d1b"
  surface-2-dark: "#30302e"
  ink-dark: "#f5f4ed"
  muted-dark: "#b0aea5"
typography:
  display:
    fontFamily: "Anthropic Serif, Georgia, 'Songti SC', 'Noto Serif SC', serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Anthropic Serif, Georgia, 'Songti SC', 'Noto Serif SC', serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Anthropic Sans, -apple-system, 'Segoe UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Anthropic Sans, -apple-system, 'Segoe UI', 'PingFang SC', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  code:
    fontFamily: "Anthropic Mono, 'JetBrains Mono', 'Fira Code', ui-monospace, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "-0.01em"
rounded:
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
  modal: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  input-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  list-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  modal-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.modal}"
    padding: "0px"
---

# Design System: PromptBox

## 1. Overview

**Creative North Star: "The Warm Writing Desk"**

PromptBox is the lamp-lit desk where a writer keeps the words they reach for again and again. The surface is warm parchment, the ink is near-black, the one accent is a terracotta the color of a fountain pen's barrel. Everything on the desk has a place; nothing on it shouts. The prompt being written or filled is the only true protagonist, and every piece of chrome, the rails, the lists, the toolbars, is furniture that holds still so the words can move.

The system is warm-neutral, not cream-as-decoration: the parchment canvas (`#f5f4ed`) earns its warmth from a near-black ink and a single saturated terracotta brand, not from a tinted near-white pretending to be a color. Density is calm and editorial. Type carries the hierarchy through a serif/sans/mono triad, not through boxes and dividers. Depth is conveyed by warm hairline borders and rings, with real shadows held back for things that genuinely float (modals, popovers, toasts). The whole interface flips to a warm-dark charcoal through the same semantic tokens, so the personality survives the theme switch intact.

This system explicitly rejects three things. It is **not a playful consumer toy**: no cartoon rounding, no mascots, no candy palette, no bouncy motion. It is **not heavy enterprise software**: no conservative blue-gray chrome, no modal-bureaucracy, no "serious means gray and boxed." And it is **not a generic SaaS dashboard**: no cool-gray card grid with gradient accents and a hero-metric template. Warmth here is identity, restraint is the craft.

**Key Characteristics:**
- Warm parchment canvas with a single terracotta accent used sparingly
- Serif headlines (weight 500) against a sans body and a mono technical voice
- Hairline-border and ring-based depth; shadows reserved for true overlays
- Semantic tokens that flip the entire UI to warm-dark with no `dark:` variants
- Keyboard-first surfaces (command palette, lists) where chrome recedes and content leads

## 2. Colors

A warm-neutral foundation carrying one committed terracotta accent; the only cool color in the system is the focus blue, and it appears solely as a focus signal.

### Primary
- **Terracotta** (`#c96442`): The single brand accent. Primary buttons, the active/selected tint (`brand/8`–`brand/15`), the `{{variable}}` chips, links in rendered markdown, and focus emphasis in the editor overlay. Its scarcity is what gives it weight.
- **Terracotta Deep** (`#b65535`): The hover/pressed state of any terracotta surface. In warm-dark, the brand hover lifts toward Coral instead.
- **Coral** (`#d97757`): The warmer sibling used for accents and links against dark surfaces, and as the brand-hover tone in the dark theme.

### Neutral
- **Parchment** (`#f5f4ed`): The page canvas. The warm ground everything sits on.
- **Ivory** (`#faf9f5`): Elevated surfaces, cards, list items at rest, modal panels.
- **Warm Sand** (`#e8e6dc`): Prominent surfaces and buttons, chip backgrounds, the strong divider tone.
- **Near Black** (`#141413`): Primary text. Also the warm-dark canvas, so the two themes are mirror images of one ink.
- **Olive Gray** (`#5e5d59`): Secondary text, labels, supporting copy.
- **Stone Gray** (`#87867f`): Tertiary text and metadata (timestamps, counts, tags).
- **Border Cream** (`#f0eee6`): The standard hairline border, nearly invisible against the canvas.
- **Border Warm** (`#e8e6dc`): Prominent dividers and input strokes.
- **Ring Warm** (`#d1cfc5`): The hover/focus ring, drawn as a 1px box-shadow outline.

### Tertiary (semantic)
- **Error Crimson** (`#b53333`): Destructive intent and validation failure only. Never decorative.
- **Focus Blue** (`#3898ec`): The lone cool color. Input focus borders only; it reads as "the system is listening," not as a second brand.

### Named Rules
**The One-Accent Rule.** Terracotta is the only brand color, and it stays under ~10% of any screen. If two things on the same view are competing in terracotta, one of them is wrong. Emphasis that isn't a true call-to-action comes from weight, ink, or a sand fill, not from more orange.

**The Warm-Mirror Rule.** Light and dark are the same design through one set of semantic tokens (`--color-canvas`, `--color-ink`, `--color-line`...). Never write a `dark:` utility or a zinc/slate value; if a color needs to change between themes, it changes in the `.dark` token block, nowhere else.

**The Cool-Color Quarantine Rule.** Blue exists only as `--color-focus` on a focused input. No blue links, no blue buttons, no blue info states. Warmth is the system's signature and a stray cool tone breaks it instantly.

## 3. Typography

**Display Font:** Anthropic Serif (Georgia, Songti SC, Noto Serif SC fallback)
**Body Font:** Anthropic Sans (-apple-system, Segoe UI, PingFang SC fallback)
**Label/Mono Font:** Anthropic Mono (JetBrains Mono, Fira Code fallback)

**Character:** A serif/sans/mono triad on a clear contrast axis. The serif gives titles an editorial, written-by-a-person warmth at a single confident weight (500). The sans is quiet and legible for everything the user reads in bulk. The mono is the technical voice: it marks the things that are *code* (asset names, the editor body, MCP fields, `{{variables}}`), so structure is legible by typeface alone. Chinese-first: every stack carries a CJK fallback so PingFang/Songti render cleanly.

### Hierarchy
- **Display** (Serif 500, 1.375rem, lh 1.15): The editing title field and the largest rendered-markdown headings. The single largest voice; there is no shouting hero scale.
- **Title** (Serif 500, ~1.0625rem, lh 1.3): Modal titles, the quick-fill prompt name, section headings inside rendered content.
- **Body** (Sans 400, 0.875rem, lh 1.5): The default reading size for descriptions, settings, and prose. Keep prose columns within 65–75ch.
- **Label** (Sans 500, 0.6875rem, lh 1.4): Metadata, counts, timestamps, tag pills. Sentence case, never all-caps.
- **Code** (Mono 400, 0.875rem, lh 1.7, -0.01em): The editor body, asset names, fill previews, MCP command/args. The "this is a literal string" voice.

### Named Rules
**The Single-Serif-Weight Rule.** The serif speaks at weight 500 across every size. Hierarchy comes from size and the serif/sans contrast, not from stacking serif weights. (`.font-serif` hard-sets 500 on purpose.)

**The Mono-Means-Code Rule.** Monospace is reserved for things that are literally machine text: asset identifiers, the prompt source, config fields, `{{variable}}` tokens. Never use mono for human prose to look "techy."

**The Sentence-Case Rule.** No ALL CAPS body or sentence text, and no tracked uppercase eyebrows above sections. Labels are short and sentence-cased; the warmth dies under uppercase tracking.

## 4. Elevation

Flat by default, with depth carried by warm hairline borders and 1px rings rather than shadows. A surface at rest is distinguished from its background by tone (Parchment vs Ivory vs Sand) and a `line`/`line-strong` border, not by a drop shadow. Real shadows are a signal of *floating*: they appear only on elements that genuinely sit above the page. Interaction depth is expressed by a ring (`box-shadow: 0 0 0 1px var(--color-ring)`) on hover and a border-color shift to Focus Blue on focus.

### Shadow Vocabulary
- **Overlay / Modal** (`box-shadow: 0 12px 48px rgba(0,0,0,0.12)`; the cloud-sync panel uses `0 16px 56px rgba(0,0,0,0.14)`): Command palette, quick-fill, and settings modals over a `rgba(0,0,0,0.30)` scrim.
- **Popover** (`box-shadow: 0 8px 28px rgba(0,0,0,0.12)`): The `{{ }}` autocomplete and other small floating menus.
- **Toast** (`box-shadow: 0 4px 24px rgba(0,0,0,0.08)`): Transient bottom-center notifications.
- **Soft Panel** (`box-shadow: 0 4px 24px rgba(0,0,0,0.05)`): The preview card, the one resting surface allowed a whisper of lift.
- **Hover Ring** (`box-shadow: 0 0 0 1px var(--color-ring)`): The default interactive-affordance cue; not a shadow so much as an outline that warms on hover.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat until something floats. If a card has a drop shadow while sitting in the page flow, the shadow is wrong: use a border and a tone shift instead. Shadows mean "above the page," nothing else.

**The Ring-Not-Glow Rule.** Hover and focus are drawn with crisp 1px rings and border shifts, never soft glows or blurred halos. The test: if depth looks like a 2014 app, the blur is too big and the color too dark.

## 5. Components

The whole kit is refined and restrained: soft 8–16px corners, hairline borders, content-first surfaces. Affordances reveal on hover rather than shouting at rest.

### Buttons
- **Shape:** Gently rounded, 12px (`rounded-lg`/`rounded-xl` in the larger sizes). Pills (`9999px`) are reserved for tags, not buttons.
- **Primary:** Terracotta fill (`#c96442`) with Ivory text (`#faf9f5`), padding ~`8px 14px`. The one loud control on a view.
- **Hover / Focus:** Background deepens to Terracotta Deep (`#b65535`); transitions are quick (~150ms) opacity/background, no transform bounce. Icon-only toolbar buttons use a `rounded-lg` hit area that warms to a Sand (`surface-2`) background on hover.
- **Ghost / Secondary:** Transparent or Ivory fill with a `line-strong` border and Olive Gray text; hover shifts the border toward Ring Warm and the text toward Ink. Destructive actions tint toward Error Crimson on hover only.

### Chips
- **Style:** Pill (`9999px`), Warm Sand (`surface-2`) background, Olive Gray text, no border, ~`2px 8px`. Tags read as `#tag`.
- **State:** Active filters invert to a terracotta wash (`brand/15`) with terracotta text. `{{variable}}` chips use a 16% terracotta tint (`.var-chip`) so they're legible as fillable slots in both prose and the editor.

### Cards / Containers (list items)
- **Corner Style:** 12px (`rounded-xl`).
- **Background:** Transparent at rest, Ivory (`surface`) on hover, a terracotta wash (`brand/8`, border `brand/30`) when selected; multi-selected rows deepen to `brand/12` with a `brand/50` border.
- **Shadow Strategy:** None. Depth is the border + tone shift only (see Elevation, Flat-At-Rest Rule).
- **Border:** Transparent → warms on state. Never a colored left/right stripe.
- **Internal Padding:** ~`10px 12px`.

### Inputs / Fields
- **Style:** Ivory or Canvas fill, `line-strong` 1px border, 12–16px radius, Ink text, Stone Gray placeholder.
- **Focus:** Border shifts to Focus Blue (`#3898ec`); the editor frame uses `focus-within:border-focus`. No glow.
- **Error:** Border shifts to a rose/Error tone and a `*` marks required variables; the field reads invalid without a full red fill.

### Navigation (sidebar + workspace rail)
- **Style:** A quiet vertical rail of categories and tags on the Canvas. Items are text-led with a small color dot for categories; the active item gets a soft terracotta wash, hover gets an Ivory fill. Workspace switches (Prompts / Skill / Agent / MCP) are keyboard-reachable (`Ctrl/⌘ + 1–4`).
- **States:** default (Olive Gray) → hover (Ink, Ivory fill) → active (terracotta wash). Drag-to-reorder dims the dragged row.

### Command Palette (signature component)
The keyboard heart of the app (`Ctrl/⌘ + K`): a `rounded-3xl` Ivory panel floating on a scrim with the Overlay shadow. A search field over a `listbox` of ranked prompts + assets; the active row gets a `brand/12` wash and a return-key glyph. Type by literal text or pinyin (full or initials). Enter copies, `⌘/Ctrl+Enter` opens. This is where "the chrome recedes, the content leads" is most literal.

### Highlighted Editor (signature component)
A textarea with a live syntax overlay: `{{variables}}` render in terracotta-600, inline code/bold/headings get weight and tone, all on a `rounded-2xl` Ivory frame that warms its border on focus. A `{{ }}` autocomplete popover suggests known variable names. The editor is the desk's writing surface and gets the most typographic care (mono, lh 1.7).

## 6. Do's and Don'ts

### Do:
- **Do** keep terracotta (`#c96442`) under ~10% of any screen; let weight, ink, and Sand fills carry secondary emphasis (The One-Accent Rule).
- **Do** change colors only through the semantic tokens and the `.dark` block. Use `bg-canvas`, `text-ink`, `border-line`; never a `dark:` utility or a zinc/slate value (The Warm-Mirror Rule).
- **Do** keep surfaces flat at rest; convey depth with `line`/`line-strong` borders and the Ring Warm hover outline. Reserve real shadows for modals, popovers, and toasts (The Flat-At-Rest Rule).
- **Do** use the serif at weight 500 for titles, the sans for prose, and mono only for literal machine text (asset names, prompt source, config, `{{variables}}`).
- **Do** make every frequent action keyboard-reachable and label buttons verb + object ("复制结果", "删除所选"), matching the keystrokes-are-the-unit-of-cost principle.
- **Do** verify the Olive Gray / Stone Gray text ramp hits ≥4.5:1 on Parchment for body and metadata; bump toward Ink when it's close.

### Don't:
- **Don't** make it a **playful consumer toy**: no cartoon rounding, no mascots, no candy/oversaturated palette, no bouncy or elastic motion.
- **Don't** make it **heavy enterprise software**: no conservative blue-gray chrome, no modal-bureaucracy, no "serious = gray and boxed."
- **Don't** make it a **generic SaaS dashboard**: no cool-gray card grid with gradient accents, no hero-metric template (big number + small label + gradient).
- **Don't** introduce a second accent or any blue beyond `--color-focus` on a focused input (The Cool-Color Quarantine Rule).
- **Don't** use ALL CAPS sentence text or tracked uppercase eyebrows above sections; labels stay short and sentence-cased.
- **Don't** use colored left/right stripe borders on cards or list items, gradient text (`background-clip: text`), or decorative glassmorphism. Depth is borders, tone, and rings.
- **Don't** put a drop shadow on a surface that sits in the page flow; if it isn't floating, it doesn't get a shadow.
