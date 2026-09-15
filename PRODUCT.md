# Product

## Register

product

## Users

Developers building web projects with AI tools — from beginners who don't yet know which prompt to reach for, to power users with a large library. The beginner is the design target: they should never have to *choose* from a pile, only follow the steps.

Their context: PromptBox sits next to Claude Code or Cursor. They read what the current step is for, type at most one sentence, copy, paste into the AI tool, come back and press "next". They may not know what a tech stack or a migration is; the prompts ask the AI to explain and decide, and the step copy explains in plain words what is happening. The power user still gets the three-pane library, the command palette and the global hotkey, but nothing on the route depends on knowing they exist.

## Product Purpose

PromptBox is a local-first desktop guide through the prompts of a software project. The user answers one question (what they are building: web / CLI / desktop / mobile / other, and whether they start from nothing or an existing codebase) and then follows one route: 想清楚 → 定方案 → 搭骨架 → 做功能 (repeated per feature) → 上线. Stages are fixed; the ordered *steps* inside them are user-editable, and every prompt belongs to a step, optionally as a variant for one project type. A built-in set covers all 13 steps (49 prompts, most steps with a variant per project type) out of the box; each takes at most one sentence of input and chains through files in `docs/`. The app fills `{{variable}}` templates, keeps per-item version history, and optionally syncs across devices (GitHub Gist / WebDAV / S3, end-to-end encrypted).

The route *is* the recommendation: only the current step is on screen, with a one-line "what you're doing now", the one input it needs, and a copy button. The three-pane library survives as an "advanced" entry for editing. Free-form organisation (tags, pins, batch operations, a marketplace) was removed because it put the sorting burden back on the user.

Success is a beginner getting from "I have an idea" to "other people can use it" without ever asking "which prompt do I use now?" — and, for anyone who edits prompts, an ironclad guarantee that they never lose their words (autosave, automatic backups, corrupt-file recovery, undo).

## Brand Personality

Neutral, precise, unobtrusive. The voice is calm and expert: plain, specific Chinese-first copy with no marketing gloss. Visually it is the shadcn / ReUI neutral system — black on white, one grey ramp, one face — so the interface recedes and the current step is the only thing with weight. Emotionally: focus and trust.

## Anti-references

- **Playful / consumer-toy aesthetics**: cartoon rounding, mascots, oversaturated candy palettes, bouncy motion. This is a working tool, not a toy.
- **Heavy enterprise software**: dense corporate chrome, conservative blue-gray palettes, modal-heavy bureaucratic flows, the "serious = grey and boxed" reflex.
- **Generic SaaS dashboard**: cool-gray cards-in-a-grid with gradient accents and a hero-metric template.

## Design Principles

1. **Never make the user choose.** One question up front, then one step at a time; the route decides what comes next. A feature earns its place only if a beginner would otherwise get stuck. Keyboard paths (⌘K, ⌘/Ctrl+Enter to copy, the global hotkey) stay for people who want speed, but nothing requires them.
2. **Never lose the user's words.** Autosave, version history, periodic + on-quit backups, corrupt-file quarantine/recovery, and undo are non-negotiable. Trust is earned by never dropping data.
3. **Calm over clever.** Warm, quiet surfaces; restrained motion; strong-but-soft hierarchy. The content (the prompt) is the hero and chrome stays out of the way.
4. **Local-first and user-owned.** Data lives in plain files the user controls. Sync and encryption are opt-in, transparent, and reversible — never a lock-in.
5. **Refine, don't reinvent.** Use what shadcn and ReUI already provide — variants, Stepper, Frame, Motion Icons — and spend effort on hierarchy, spacing and copy rather than custom chrome. Identity comes from precision, not novelty.

## Accessibility & Inclusion

Target WCAG 2.1 AA. The app ships light and dark themes through the shadcn CSS tokens and honors `prefers-color-scheme`. Navigation is keyboard-first, with ARIA roles on the command palette (combobox/listbox), lists, and live-region toasts.

Known watch-items: `muted-foreground` on `muted` backgrounds should be contrast-checked whenever a new pairing is introduced; any added motion must provide a `prefers-reduced-motion` alternative.
