# Product

## Register

product

## Users

Developers building web projects with AI tools — from beginners who don't yet know which prompt to reach for, to power users with a large library. The beginner is the design target: they should never have to *choose* from a pile, only follow the steps.

Their context is mid-task: they're working inside Claude Code, the Claude apps, or a terminal, and need to reach for the right prompt without breaking flow. The primary job is *retrieval and reuse* — find the prompt, fill its variables, get it onto the clipboard in as few keystrokes as possible. The global hotkey and command palette exist for exactly this moment.

## Product Purpose

PromptBox is a local-first desktop guide through the prompts of a software project. The user answers one question (what they are building: web / CLI / desktop / mobile / other, and whether they start from nothing or an existing codebase) and then follows one route: 想清楚 → 定方案 → 搭骨架 → 做功能 (repeated per feature) → 上线. Stages are fixed; the ordered *steps* inside them are user-editable, and every prompt belongs to a step, optionally as a variant for one project type. A built-in set covers all 13 steps (28 prompts) out of the box; each takes at most one sentence of input and chains through files in `docs/`. The app fills `{{variable}}` templates, keeps per-item version history, and optionally syncs across devices (GitHub Gist / WebDAV / S3, end-to-end encrypted).

The route *is* the recommendation: only the current step is on screen, with a one-line "what you're doing now", the one input it needs, and a copy button. The three-pane library survives as an "advanced" entry for editing. Free-form organisation (tags, pins, batch operations, a marketplace) was removed because it put the sorting burden back on the user.

Success is the shortest path from "I need that prompt" to "it's filled in and on my clipboard" — measured in keystrokes — with an ironclad guarantee that the user never loses their words (autosave, automatic backups, corrupt-file recovery, undo).

## Brand Personality

Warm, precise, unobtrusive. The voice is calm and expert: plain, specific Chinese-first copy with no marketing gloss. It should feel like a quiet, trustworthy workspace — the confident restraint of a well-made writing tool, not a product demanding attention. Emotionally: focus and trust. The interface recedes so the prompt is the hero.

## Anti-references

- **Playful / consumer-toy aesthetics**: cartoon rounding, mascots, oversaturated candy palettes, bouncy motion. This is a working tool, not a toy.
- **Heavy enterprise software**: dense corporate chrome, conservative blue-gray palettes, modal-heavy bureaucratic flows, the "serious = grey and boxed" reflex.
- **Generic SaaS dashboard**: cool-gray cards-in-a-grid with gradient accents and a hero-metric template.

## Design Principles

1. **Keystrokes are the unit of cost.** Every frequent action (find, fill, copy, new, duplicate, search) is reachable from the keyboard. The fastest path always wins; the mouse is optional, never required.
2. **Never lose the user's words.** Autosave, version history, periodic + on-quit backups, corrupt-file quarantine/recovery, and undo are non-negotiable. Trust is earned by never dropping data.
3. **Calm over clever.** Warm, quiet surfaces; restrained motion; strong-but-soft hierarchy. The content (the prompt) is the hero and chrome stays out of the way.
4. **Local-first and user-owned.** Data lives in plain files the user controls. Sync and encryption are opt-in, transparent, and reversible — never a lock-in.
5. **Refine, don't reinvent.** Extend the established warm-editorial language through craft — hierarchy, spacing, contrast, motion, micro-interactions — rather than bolting on new gimmicks. Identity comes from precision, not novelty.

## Accessibility & Inclusion

Target WCAG 2.1 AA. The app ships warm-light and warm-dark themes through semantic CSS tokens and honors `prefers-color-scheme`. Navigation is keyboard-first, with ARIA roles on the command palette (combobox/listbox), lists, and live-region toasts.

Known watch-items: the muted/faint gray text ramp on the parchment canvas runs close to the 4.5:1 floor for body copy and should be contrast-audited; any added motion must provide a `prefers-reduced-motion` alternative.
