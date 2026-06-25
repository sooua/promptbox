/**
 * Shared domain model for PromptBox.
 * Imported by both the Electron main process and the React renderer.
 */

export type ThemeMode = 'light' | 'dark' | 'system'

export type Language = 'zh' | 'en'

export type VariableType = 'text' | 'multiline' | 'select' | 'number' | 'date'

export interface PromptVariable {
  /** variable key as it appears between {{ }} */
  name: string
  /** human label, defaults to name */
  label?: string
  /** default value used when filling the template */
  defaultValue?: string
  description?: string
  /** input kind when filling; defaults to 'text' */
  type?: VariableType
  /** allowed values when type is 'select' */
  options?: string[]
  /** must be filled before the template can be copied */
  required?: boolean
  /** the value entered the last time this prompt was filled */
  lastValue?: string
}

export interface PromptVersion {
  id: string
  title: string
  content: string
  /** optional note describing what changed */
  note?: string
  createdAt: number
}

export interface Prompt {
  id: string
  title: string
  content: string
  description?: string
  categoryId?: string | null
  tags: string[]
  favorite: boolean
  /** pinned to the top of any list, independent of favorite */
  pinned: boolean
  variables: PromptVariable[]
  versions: PromptVersion[]
  /** number of times the prompt has been copied/used */
  useCount: number
  /** timestamp of the last copy/use, null if never used */
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: string
  name: string
  color?: string
  /** manual sort order; lower comes first */
  order: number
  createdAt: number
  /** last change time, used for item-level sync merge */
  updatedAt: number
}

/** Records a deletion so it propagates during item-level sync merges. */
export interface Tombstone {
  id: string
  type: 'prompt' | 'category' | 'asset'
  deletedAt: number
}

// ---- Assets (Skill / Agent / MCP) ----

export type AssetKind = 'skill' | 'agent' | 'mcp'

/**
 * A unified, extensible asset. `content` holds the primary body (SKILL.md body
 * or an agent's system prompt); `meta` holds kind-specific structured fields:
 *  - skill: { allowedTools? }
 *  - agent: { tools?, model? }
 *  - mcp:   { transport: 'stdio'|'sse'|'http', command?, args?, env?, url? }
 */
/** A bundled file shipped alongside a skill (script, reference, resource). */
export interface AssetFile {
  /** path relative to the skill folder, e.g. "scripts/run.py" */
  path: string
  content: string
}

export interface AssetVersion {
  id: string
  name: string
  content: string
  meta: Record<string, string>
  createdAt: number
}

export interface Asset {
  id: string
  kind: AssetKind
  name: string
  description?: string
  categoryId?: string | null
  tags: string[]
  favorite: boolean
  content: string
  meta: Record<string, string>
  /** bundled files (skills only) */
  files: AssetFile[]
  versions: AssetVersion[]
  createdAt: number
  updatedAt: number
}

export interface AssetInput {
  kind: AssetKind
  name: string
  description?: string
  categoryId?: string | null
  tags?: string[]
  content?: string
  meta?: Record<string, string>
  files?: AssetFile[]
}

export const ASSET_KINDS: { kind: AssetKind; label: string }[] = [
  { kind: 'skill', label: 'Skill' },
  { kind: 'agent', label: 'Agent' },
  { kind: 'mcp', label: 'MCP' }
]

export interface AppSettings {
  /** absolute path to the directory where promptbox.json lives */
  dataDir: string
  theme: ThemeMode
  /** UI language */
  language: Language
  /** allow the Discover page to fetch from the network (never silent/background) */
  marketEnabled: boolean
  /** user-added GitHub repos for the Skill/Agent Discover tabs */
  githubSources: GithubSourceConfig[]
  /** user-added MCP registries (official /v0/servers spec) */
  mcpRegistries: McpRegistryConfig[]
  /** user-added Prompt collection sources (raw CSV/JSON file URLs) */
  promptSources: PromptSourceConfig[]
  /**
   * Network proxy for all outbound requests (marketplace, sync, updates).
   * '' = follow system; 'direct' = no proxy; else proxy rules, e.g.
   * 'http://127.0.0.1:7890' or 'socks5://127.0.0.1:7891'.
   */
  proxy: string
  /** Electron accelerator string for the global quick-launch hotkey */
  globalHotkey: string
}

// ---- Discover / marketplace ----

/** A normalized MCP server listing from the official registry, for the Discover page. */
export interface McpDiscoverItem {
  /** reverse-DNS id, e.g. io.github.user/server */
  name: string
  title: string
  description: string
  version: string
  /** transports offered, e.g. ['http'], ['stdio'] */
  transports: string[]
  /** already imported into the local library (by source id) */
  imported: boolean
  /** which registry it came from: 'official' | 'smithery' | a custom base URL */
  registry: string
  /** raw registry object, carried back for import */
  server: unknown
}

/** A user-added MCP registry implementing the official /v0/servers spec. */
export interface McpRegistryConfig {
  name: string
  /** base URL, e.g. https://my-registry.example.com */
  url: string
}

export interface McpDiscoverResult {
  items: McpDiscoverItem[]
  /** cursor for the next page, if any */
  nextCursor?: string
  /** populated on failure (network/offline) */
  error?: string
}

/** A Skill or Agent listing pulled from a trusted GitHub repo. */
export interface GithubDiscoverItem {
  /** stable id / source key: github:<repo>@<path> */
  id: string
  title: string
  /** derived grouping (plugin / category folder) */
  category: string
  repo: string
  branch: string
  path: string
  kind: 'skill' | 'agent'
  /** already imported into the local library (by source id) */
  imported: boolean
}

export interface GithubDiscoverResult {
  items: GithubDiscoverItem[]
  error?: string
}

/** A prompt pulled from a CSV/JSON collection or a markdown repo file. */
export interface PromptDiscoverItem {
  /** stable id / source key: promptsrc:<sourceId>@<index|path> */
  id: string
  title: string
  /** the prompt body; empty for repo items until import (fetched lazily) */
  content: string
  /** display label of the source it came from */
  source: string
  /** secondary line shown when content is not yet available (e.g. category) */
  subtitle?: string
  /** already in the local library (matched by title) */
  imported: boolean
  /** present for repo-backed items: fetch raw on import */
  repo?: string
  branch?: string
  path?: string
}

export interface PromptDiscoverResult {
  items: PromptDiscoverItem[]
  error?: string
}

/** A selectable prompt collection (built-in recommendation or user-added). */
export interface PromptSource {
  id: string
  label: string
  /** false for user-added sources */
  builtin: boolean
}

/** A user-added prompt collection: a raw CSV/JSON file URL. */
export interface PromptSourceConfig {
  name: string
  /** raw file URL — CSV with act,prompt columns or JSON array of {act,prompt} */
  url: string
  format: 'csv' | 'json'
}

/** A user-added GitHub repo to browse Skills/Agents from. */
export interface GithubSourceConfig {
  /** owner/name */
  repo: string
  kind: 'skill' | 'agent'
  /** optional path glob; defaults to **\/SKILL.md (skill) or **\/agents\/**\/*.md (agent) */
  glob?: string
}

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'

/** Preset accelerators offered in settings (avoids building a key recorder). */
export const HOTKEY_PRESETS: { value: string; label: string }[] = [
  { value: 'CommandOrControl+Shift+Space', label: 'Ctrl/⌘ + Shift + Space' },
  { value: 'CommandOrControl+Shift+P', label: 'Ctrl/⌘ + Shift + P' },
  { value: 'CommandOrControl+Alt+P', label: 'Ctrl/⌘ + Alt + P' },
  { value: 'CommandOrControl+Shift+K', label: 'Ctrl/⌘ + Shift + K' }
]

/** Shape of the on-disk JSON document. */
export interface PromptBoxData {
  version: number
  prompts: Prompt[]
  categories: Category[]
  assets: Asset[]
  tombstones: Tombstone[]
}

/** Payload accepted when creating a prompt — server fills the rest. */
export interface PromptInput {
  title: string
  content: string
  description?: string
  categoryId?: string | null
  tags?: string[]
  favorite?: boolean
  variables?: PromptVariable[]
}

export interface ExportBundle {
  app: 'promptbox'
  version: number
  exportedAt: number
  prompts: Prompt[]
  categories: Category[]
  assets: Asset[]
  tombstones?: Tombstone[]
}

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  importedPrompts: number
  importedCategories: number
}

export interface BackupInfo {
  file: string
  createdAt: number
  size: number
}

// ---- Auto update ----

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'none'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'dev'

export interface UpdateStatus {
  state: UpdateState
  /** the new version, when known (available / downloaded) */
  version?: string
  /** download progress percent 0-100 */
  percent?: number
  message?: string
}

// ---- Cloud sync ----

export type SyncProviderId = 'gist' | 'gdrive' | 'onedrive' | 'webdav' | 's3'

export type SyncStatus = 'idle' | 'uptodate' | 'pushed' | 'pulled' | 'conflict' | 'error'

/** Provider metadata for rendering the cloud-service cards. */
export interface SyncProviderInfo {
  id: SyncProviderId
  name: string
  /** false until the provider is actually implemented */
  available: boolean
}

export const SYNC_PROVIDERS: SyncProviderInfo[] = [
  { id: 'gist', name: 'GitHub Gist', available: true },
  { id: 'gdrive', name: 'Google Drive', available: false },
  { id: 'onedrive', name: 'Microsoft OneDrive', available: false },
  { id: 'webdav', name: 'WebDAV', available: true },
  { id: 's3', name: 'S3 兼容存储', available: true }
]

/** Connect payloads (sent from renderer; secrets are encrypted at rest in main). */
export interface WebDavConfigInput {
  url: string
  username: string
  password: string
}

export interface S3ConfigInput {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  prefix?: string
}

/** State exposed to the renderer (never includes secrets). */
export interface SyncState {
  provider: SyncProviderId | null
  connected: boolean
  account?: string
  autoSync: boolean
  encrypted: boolean
  lastSyncedAt?: number
  lastStatus?: SyncStatus
  lastMessage?: string
  deviceId: string
}

export interface SyncResult {
  status: SyncStatus
  message?: string
}

export interface SyncVersion {
  id: string
  createdAt: number
  label?: string
}

/** The document stored on the remote. */
export interface SyncEnvelope {
  app: 'promptbox'
  schemaVersion: number
  updatedAt: number
  deviceId: string
  prompts: Prompt[]
  categories: Category[]
  assets: Asset[]
  tombstones: Tombstone[]
}
