import type { PromptVariable } from './types'

/**
 * Matches {{ variable_name }} with flexible whitespace, plus an optional inline
 * default after a pipe: {{ name | fallback text }}. The default runs up to the
 * closing braces (so it may contain spaces but not `}`).
 */
const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*(?:\|([^}]*))?\}\}/g

export interface ParsedVariable {
  name: string
  /** inline default declared via {{ name | default }} */
  defaultValue?: string
}

/** Parse variables (name + optional inline default), preserving first-seen order. */
export function parseVariables(content: string): ParsedVariable[] {
  const byName = new Map<string, ParsedVariable>()
  const order: string[] = []
  let match: RegExpExecArray | null
  VARIABLE_RE.lastIndex = 0
  while ((match = VARIABLE_RE.exec(content)) !== null) {
    const name = match[1]
    const def = match[2]?.trim() || undefined
    const existing = byName.get(name)
    if (!existing) {
      byName.set(name, { name, defaultValue: def })
      order.push(name)
    } else if (def && !existing.defaultValue) {
      existing.defaultValue = def
    }
  }
  return order.map((n) => byName.get(n) as ParsedVariable)
}

/** Extract unique variable names from a template, preserving first-seen order. */
export function extractVariableNames(content: string): string[] {
  return parseVariables(content).map((v) => v.name)
}

/**
 * Reconcile a prompt's stored variable definitions with the variables actually
 * present in its content. Keeps existing metadata, adds new ones, drops removed.
 * An inline default ({{ name | x }}) seeds defaultValue only when the variable
 * has no explicit default yet, so editing settings always wins.
 */
export function syncVariables(
  content: string,
  existing: PromptVariable[]
): PromptVariable[] {
  const parsed = parseVariables(content)
  const byName = new Map(existing.map((v) => [v.name, v]))
  return parsed.map((p) => {
    const ex = byName.get(p.name)
    if (ex) {
      return p.defaultValue && !ex.defaultValue ? { ...ex, defaultValue: p.defaultValue } : ex
    }
    return p.defaultValue ? { name: p.name, defaultValue: p.defaultValue } : { name: p.name }
  })
}

/**
 * Fill a template using a name->value map. Falls back to the inline default,
 * then leaves the placeholder intact if there's nothing to substitute.
 */
export function fillTemplate(
  content: string,
  values: Record<string, string>
): string {
  return content.replace(VARIABLE_RE, (whole, name: string, inlineDefault?: string) => {
    const v = values[name]
    if (v !== undefined && v !== '') return v
    const def = inlineDefault?.trim()
    return def ? def : whole
  })
}

/**
 * Names of required variables that are still empty given the current values.
 * Used to block copying a half-filled template.
 */
export function missingRequired(
  variables: PromptVariable[],
  values: Record<string, string>
): string[] {
  return variables
    .filter((v) => v.required && !(values[v.name] ?? '').trim())
    .map((v) => v.name)
}
