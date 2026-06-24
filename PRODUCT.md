# Product

## Register

product

## Users

Power users of Claude and other AI tools — developers, prompt engineers, and AI-heavy knowledge workers — who accumulate a large library of reusable prompts and Claude assets (Skills, Agents, MCP configs) and need a fast, private home for them.

Their context is mid-task: they're working inside Claude Code, the Claude apps, or a terminal, and need to reach for the right prompt without breaking flow. The primary job is *retrieval and reuse* — find the asset, fill its variables, get it onto the clipboard (or deployed to a config) in as few keystrokes as possible. The global hotkey and command palette exist for exactly this moment.

## Product Purpose

PromptBox is a local-first desktop manager for AI prompt assets. It stores prompts and Claude Skill / Agent / MCP definitions as plain JSON the user owns, organizes them by category and tags, fills `{{variable}}` templates, keeps per-item version history, and optionally syncs across devices (GitHub Gist / WebDAV / S3, end-to-end encrypted).

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
