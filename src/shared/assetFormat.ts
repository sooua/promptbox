import type { Asset, AssetInput, AssetKind } from './types'

/**
 * Conversion between PromptBox assets and their on-disk file formats:
 *  - skill → SKILL.md (YAML frontmatter + markdown body)
 *  - agent → <name>.md (frontmatter with tools/model + system prompt body)
 *  - mcp   → mcp.json ({ "mcpServers": { name: {...} } })
 *
 * A tiny line-based frontmatter parser is used instead of a full YAML lib —
 * sufficient for the small, controlled set of fields we emit.
 */

export function slugFor(name: string): string {
  return name.trim().replace(/\s+/g, '-').replace(/[^\w.-]/g, '') || 'untitled'
}

export function fileNameFor(asset: Pick<Asset, 'kind' | 'name'>): string {
  const slug = slugFor(asset.name)
  // Skills are a folder (<slug>/SKILL.md) — the inner file is always SKILL.md.
  if (asset.kind === 'skill') return 'SKILL.md'
  if (asset.kind === 'agent') return `${slug}.md`
  return `${slug}.mcp.json`
}

export function extensionFor(kind: AssetKind): { name: string; extensions: string[] } {
  if (kind === 'mcp') return { name: 'JSON', extensions: ['json'] }
  return { name: 'Markdown', extensions: ['md'] }
}

function yamlEscape(v: string): string {
  // quote if it contains characters that would confuse our simple parser
  return /[:#]|^\s|\s$/.test(v) ? JSON.stringify(v) : v
}

function frontmatter(fields: Array<[string, string | undefined]>): string {
  const lines = fields.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${yamlEscape(v!.trim())}`)
  return `---\n${lines.join('\n')}\n---\n`
}

export function assetToText(asset: Asset): string {
  if (asset.kind === 'skill') {
    return (
      frontmatter([
        ['name', asset.name],
        ['description', asset.description],
        ['allowed-tools', asset.meta.allowedTools]
      ]) +
      '\n' +
      asset.content.trim() +
      '\n'
    )
  }
  if (asset.kind === 'agent') {
    return (
      frontmatter([
        ['name', asset.name],
        ['description', asset.description],
        ['tools', asset.meta.tools],
        ['model', asset.meta.model]
      ]) +
      '\n' +
      asset.content.trim() +
      '\n'
    )
  }
  // mcp — wrapper key is configurable (Claude/Cursor use mcpServers, VS Code uses servers)
  const key = asset.meta.schemaKey === 'servers' ? 'servers' : 'mcpServers'
  return JSON.stringify({ [key]: { [asset.name]: mcpServerObject(asset) } }, null, 2)
}

export function mcpServerObject(asset: Asset): Record<string, unknown> {
  const transport = asset.meta.transport || 'stdio'
  if (transport === 'stdio') {
    const obj: Record<string, unknown> = { command: asset.meta.command || '' }
    const args = splitLines(asset.meta.args)
    if (args.length) obj.args = args
    const env = parseEnv(asset.meta.env)
    if (Object.keys(env).length) obj.env = env
    return obj
  }
  const obj: Record<string, unknown> = { type: transport, url: asset.meta.url || '' }
  const headers = parseEnv(asset.meta.headers)
  if (Object.keys(headers).length) obj.headers = headers
  return obj
}

function stringifyKV(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return ''
  return Object.entries(obj as Record<string, string>)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

function splitLines(s?: string): string[] {
  return (s ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function parseEnv(s?: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of splitLines(s)) {
    const i = line.indexOf('=')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

// ---- Parsing (import) ----

function parseFrontmatter(text: string): { fields: Record<string, string>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { fields: {}, body: text }
  const fields: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      try {
        value = JSON.parse(value)
      } catch {
        value = value.slice(1, -1)
      }
    }
    fields[key] = value
  }
  return { fields, body: m[2].trim() }
}

export function parseAssetFile(kind: AssetKind, text: string, fallbackName: string): AssetInput[] {
  if (kind === 'mcp') return parseMcp(text)
  const { fields, body } = parseFrontmatter(text)
  const meta: Record<string, string> =
    kind === 'skill'
      ? { allowedTools: fields['allowed-tools'] ?? '' }
      : { tools: fields.tools ?? '', model: fields.model ?? '' }
  return [
    {
      kind,
      name: fields.name || fallbackName,
      description: fields.description ?? '',
      content: body,
      meta
    }
  ]
}

function parseMcp(text: string): AssetInput[] {
  const json = JSON.parse(text)
  const schemaKey = json.mcpServers ? 'mcpServers' : json.servers ? 'servers' : 'mcpServers'
  const servers: Record<string, unknown> = json.mcpServers ?? json.servers ?? json
  const out: AssetInput[] = []
  for (const [name, raw] of Object.entries(servers)) {
    if (typeof raw !== 'object' || raw === null) continue
    const s = raw as Record<string, unknown>
    const transport = (s.type as string) || (s.url ? 'http' : 'stdio')
    const meta: Record<string, string> = { transport, schemaKey }
    if (transport === 'stdio') {
      meta.command = String(s.command ?? '')
      meta.args = Array.isArray(s.args) ? s.args.join('\n') : ''
      meta.env = stringifyKV(s.env)
    } else {
      meta.url = String(s.url ?? '')
      meta.headers = stringifyKV(s.headers)
    }
    out.push({ kind: 'mcp', name, description: '', content: '', meta })
  }
  return out
}
