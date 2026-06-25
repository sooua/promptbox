import type { AssetInput, McpDiscoverItem, McpDiscoverResult } from '@shared/types'
import type { Repository } from '../store/repository'
import { httpFetch as fetch } from '../net'

/**
 * MCP Discover. Sources:
 *  - 'official'        → registry.modelcontextprotocol.io (official /v0/servers spec)
 *  - a custom base URL → any registry implementing the same spec
 *  - 'smithery'        → smithery.ai (its own API shape, mapped here)
 * Network is on-demand only and goes through net.fetch (honors the proxy).
 */
const OFFICIAL = 'https://registry.modelcontextprotocol.io'
const SMITHERY = 'https://registry.smithery.ai'
const SOURCE_PREFIX = 'mcp-registry:'
const PAGE = 30

// ---------- official spec ----------

interface RegPackage {
  registryType?: string
  identifier?: string
  version?: string
  runtimeHint?: string
  transport?: { type?: string }
  packageArguments?: Array<{ type?: string; value?: string; name?: string }>
  environmentVariables?: Array<{ name: string; default?: string }>
}
interface RegRemote {
  type?: string
  url?: string
  headers?: Array<{ name: string; value?: string }>
}
interface RegServer {
  name: string
  title?: string
  description?: string
  version?: string
  remotes?: RegRemote[]
  packages?: RegPackage[]
}

const displayName = (s: RegServer): string => s.title || s.name.split('/').pop() || s.name

function transportsOf(s: RegServer): string[] {
  const out = new Set<string>()
  for (const r of s.remotes ?? []) out.add(r.type === 'sse' ? 'sse' : 'http')
  for (const p of s.packages ?? []) out.add(p.transport?.type || 'stdio')
  return [...out]
}

function importedSources(repo: Repository): Set<string> {
  return new Set(
    repo
      .listAssets('mcp')
      .map((a) => a.meta?.source)
      .filter((v): v is string => !!v)
  )
}

async function searchOfficial(
  repo: Repository,
  baseUrl: string,
  registry: string,
  query: string,
  cursor?: string
): Promise<McpDiscoverResult> {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/v0/servers`)
  if (query.trim()) url.searchParams.set('search', query.trim())
  url.searchParams.set('limit', String(PAGE))
  if (cursor) url.searchParams.set('cursor', cursor)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` }
    const data = (await res.json()) as {
      servers?: Array<{ server: RegServer }>
      metadata?: { nextCursor?: string }
    }
    const imported = importedSources(repo)
    const items: McpDiscoverItem[] = (data.servers ?? []).map(({ server }) => ({
      name: server.name,
      title: displayName(server),
      description: server.description ?? '',
      version: server.version ?? '',
      transports: transportsOf(server),
      imported: imported.has(SOURCE_PREFIX + server.name),
      registry,
      server
    }))
    return { items, nextCursor: data.metadata?.nextCursor }
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) }
  }
}

function packageCommand(p: RegPackage): { command: string; args: string[] } {
  const id = p.identifier ?? ''
  const versioned = p.version ? `${id}@${p.version}` : id
  const extra = (p.packageArguments ?? []).map((a) => a.value ?? a.name ?? '').filter(Boolean)
  switch (p.registryType) {
    case 'npm':
      return { command: p.runtimeHint || 'npx', args: ['-y', versioned, ...extra] }
    case 'pypi':
      return { command: p.runtimeHint || 'uvx', args: [id, ...extra] }
    case 'oci':
      return { command: p.runtimeHint || 'docker', args: ['run', '-i', '--rm', id, ...extra] }
    default:
      return { command: p.runtimeHint || id, args: extra }
  }
}

export function serverToAssetInput(serverRaw: unknown): AssetInput {
  const s = serverRaw as RegServer
  const meta: Record<string, string> = {
    source: SOURCE_PREFIX + s.name,
    sourceVersion: s.version ?? ''
  }
  const remote = s.remotes?.[0]
  const pkg = s.packages?.[0]
  if (remote) {
    meta.transport = remote.type === 'sse' ? 'sse' : 'http'
    meta.url = remote.url ?? ''
    if (remote.headers?.length) {
      meta.headers = remote.headers.map((h) => `${h.name}=${h.value ?? ''}`).join('\n')
    }
  } else if (pkg) {
    meta.transport = 'stdio'
    const { command, args } = packageCommand(pkg)
    meta.command = command
    if (args.length) meta.args = args.join('\n')
    if (pkg.environmentVariables?.length) {
      meta.env = pkg.environmentVariables.map((e) => `${e.name}=${e.default ?? ''}`).join('\n')
    }
  } else {
    meta.transport = 'stdio'
  }
  return {
    kind: 'mcp',
    name: displayName(s),
    description: s.description ?? '',
    tags: ['mcp-registry'],
    meta
  }
}

// ---------- smithery ----------

interface SmitheryServer {
  qualifiedName: string
  displayName?: string
  description?: string
  remote?: boolean
}

async function searchSmithery(
  repo: Repository,
  query: string,
  cursor?: string
): Promise<McpDiscoverResult> {
  const page = cursor ? Number(cursor) : 1
  const url = new URL(`${SMITHERY}/servers`)
  if (query.trim()) url.searchParams.set('q', query.trim())
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(PAGE))
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` }
    const data = (await res.json()) as {
      servers?: SmitheryServer[]
      pagination?: { currentPage?: number; totalPages?: number }
    }
    const imported = importedSources(repo)
    const items: McpDiscoverItem[] = (data.servers ?? []).map((s) => ({
      name: s.qualifiedName,
      title: s.displayName || s.qualifiedName,
      description: s.description ?? '',
      version: '',
      transports: s.remote ? ['http'] : ['stdio'],
      imported: imported.has(SOURCE_PREFIX + 'smithery/' + s.qualifiedName),
      registry: 'smithery',
      server: s
    }))
    const { currentPage = page, totalPages = page } = data.pagination ?? {}
    return { items, nextCursor: currentPage < totalPages ? String(currentPage + 1) : undefined }
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) }
  }
}

async function smitheryToAssetInput(s: SmitheryServer): Promise<AssetInput> {
  const meta: Record<string, string> = {
    source: SOURCE_PREFIX + 'smithery/' + s.qualifiedName,
    transport: 'http'
  }
  try {
    const res = await fetch(`${SMITHERY}/servers/${encodeURIComponent(s.qualifiedName)}`, {
      headers: { Accept: 'application/json' }
    })
    if (res.ok) {
      const d = (await res.json()) as {
        deploymentUrl?: string
        connections?: Array<{ type?: string; deploymentUrl?: string }>
      }
      const conn = d.connections?.[0]
      meta.url = conn?.deploymentUrl || d.deploymentUrl || ''
      if (conn?.type === 'sse') meta.transport = 'sse'
    }
  } catch {
    /* leave url blank for the user to fill */
  }
  return {
    kind: 'mcp',
    name: s.displayName || s.qualifiedName,
    description: s.description ?? '',
    tags: ['mcp-registry', 'smithery'],
    meta
  }
}

// ---------- public api ----------

export function searchMcp(
  repo: Repository,
  query: string,
  cursor?: string,
  registry: string = 'official'
): Promise<McpDiscoverResult> {
  if (registry === 'smithery') return searchSmithery(repo, query, cursor)
  const base = registry === 'official' ? OFFICIAL : registry
  return searchOfficial(repo, base, registry, query, cursor)
}

export async function importMcp(
  repo: Repository,
  item: McpDiscoverItem
): Promise<{ id: string; duplicate: boolean }> {
  const input =
    item.registry === 'smithery'
      ? await smitheryToAssetInput(item.server as SmitheryServer)
      : serverToAssetInput(item.server)
  const source = input.meta?.source
  const existing = source
    ? repo.listAssets('mcp').find((a) => a.meta?.source === source)
    : undefined
  if (existing) return { id: existing.id, duplicate: true }
  const asset = repo.createAsset(input)
  return { id: asset.id, duplicate: false }
}
