import type { AssetInput, McpDiscoverItem, McpDiscoverResult } from '@shared/types'
import type { Repository } from '../store/repository'
import { httpFetch as fetch } from '../net'

/**
 * Phase 1 Discover: read the official MCP registry and import servers into the
 * local library as editable MCP assets. Network is on-demand only (the renderer
 * gates calls on the marketEnabled setting); nothing fetches in the background.
 *
 * Registry API: https://registry.modelcontextprotocol.io (spec v0, frozen).
 */
const REGISTRY = 'https://registry.modelcontextprotocol.io/v0/servers'
const SOURCE_PREFIX = 'mcp-registry:'
const PAGE = 30

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

function displayName(s: RegServer): string {
  return s.title || s.name.split('/').pop() || s.name
}

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

export async function searchMcp(
  repo: Repository,
  query: string,
  cursor?: string
): Promise<McpDiscoverResult> {
  const url = new URL(REGISTRY)
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
      server
    }))
    return { items, nextCursor: data.metadata?.nextCursor }
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) }
  }
}

/** Map a registry package to a runnable stdio command + args. */
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

/** Convert a registry server into an importable MCP AssetInput (user-editable). */
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

export function importMcp(repo: Repository, serverRaw: unknown): { id: string; duplicate: boolean } {
  const input = serverToAssetInput(serverRaw)
  const source = input.meta?.source
  const existing = source
    ? repo.listAssets('mcp').find((a) => a.meta?.source === source)
    : undefined
  if (existing) return { id: existing.id, duplicate: true }
  const asset = repo.createAsset(input)
  return { id: asset.id, duplicate: false }
}
