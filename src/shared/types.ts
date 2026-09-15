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
  /** variant for one project type; null/undefined = applies to every type */
  track?: TrackId | null
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
  /**
   * Last *edit*: title, content, description, category, tags, or a soft delete.
   * This is what the sync merge orders items by.
   */
  updatedAt: number
  /**
   * Last change to the metadata fields (`favorite`, `pinned`, `useCount`,
   * `lastUsedAt`) — deliberately a separate clock. Toggling a favourite on one
   * device and editing the body on another are not in conflict, but sharing one
   * timestamp forced the merge to pick a single winner and throw the other
   * change away. Merged independently; see `mergeMeta` in sync/engine.
   */
  metaUpdatedAt?: number
  /**
   * Soft-delete marker. Set instead of removing the record so a delete stays
   * reversible (see the trash view); a real removal + tombstone only happens
   * after TRASH_TTL_MS or an explicit purge. Syncs like any other field.
   */
  deletedAt?: number | null
}

/** How long soft-deleted prompts stay recoverable before being purged. */
export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** The one choice a user makes: what kind of thing they are building. */
export type TrackId = 'web' | 'cli' | 'desk' | 'mobile' | 'other'

export interface TrackInfo {
  id: TrackId
  name: string
}

export const TRACKS: TrackInfo[] = [
  { id: 'web', name: '网站 / Web 应用' },
  { id: 'cli', name: '命令行工具' },
  { id: 'desk', name: '桌面应用' },
  { id: 'mobile', name: '手机 App' },
  { id: 'other', name: '其他' }
]

/**
 * The fixed stages of a project, in the order they happen. Categories are the
 * user-editable *steps* inside a stage (see `Category.stage`); the stages
 * themselves are product skeleton, not user data, so they live in code.
 * `build` repeats once per feature; the rest happen once.
 */
export type StageId = 'think' | 'plan' | 'scaffold' | 'build' | 'ship'

export interface StageInfo {
  id: StageId
  name: string
  /** one line: when you are in this stage */
  hint: string
  /** repeated per feature */
  loop?: boolean
}

export const STAGES: StageInfo[] = [
  { id: 'think', name: '想清楚', hint: '从一句话想法到一份需求' },
  { id: 'plan', name: '定方案', hint: '选技术、定架构和数据' },
  { id: 'scaffold', name: '搭骨架', hint: '空项目跑起来，底子铺好' },
  { id: 'build', name: '做功能', hint: '一次一个功能：拆任务、实现、测试、审查', loop: true },
  { id: 'ship', name: '上线', hint: '让别人用上' }
]

/** One hue per stage; steps inherit it. */
/**
 * One accent for the whole app; stages and project types share it. Kept as
 * maps so a step's stored colour and the tags still resolve through one place.
 */
export const ACCENT = '#2563eb'
export const STAGE_COLORS: Record<StageId, string> = {
  think: ACCENT,
  plan: ACCENT,
  scaffold: ACCENT,
  build: ACCENT,
  ship: ACCENT
}
export const TRACK_COLORS: Record<TrackId, string> = {
  web: ACCENT,
  cli: ACCENT,
  desk: ACCENT,
  mobile: ACCENT,
  other: ACCENT
}

/** Which starting point a step belongs to; undefined = both. */
export type Flow = 'fresh' | 'existing'

export interface Category {
  id: string
  name: string
  color?: string
  /** which stage this step belongs to; null = 其他 */
  stage?: StageId | null
  /** one line shown on the route card: what you are doing in this step */
  hint?: string
  /** what this step leaves behind (a file, a running app), shown on the card */
  output?: string
  /** only part of the route for one starting point; undefined = both */
  flow?: Flow
  /** manual sort order within the stage; lower comes first */
  order: number
  createdAt: number
  /** last change time, used for item-level sync merge */
  updatedAt: number
}

/** Records a deletion so it propagates during item-level sync merges. */
export interface Tombstone {
  id: string
  type: 'prompt' | 'category'
  deletedAt: number
}

export interface AppSettings {
  /** absolute path to the directory where promptbox.json lives */
  dataDir: string
  theme: ThemeMode
  /** UI language */
  language: Language
  /**
   * Network proxy for all outbound requests (sync, updates).
   * '' = follow system; 'direct' = no proxy; else proxy rules, e.g.
   * 'http://127.0.0.1:7890' or 'socks5://127.0.0.1:7891'.
   */
  proxy: string
  /** Electron accelerator string for the global quick-launch hotkey */
  globalHotkey: string
  /**
   * What the window's close button does. 'ask' (the default) prompts once and
   * remembers the answer — hiding to the tray without warning reads as "quit"
   * to most users, especially on Windows where the tray icon is collapsed.
   */
  closeAction: CloseAction
}

export type CloseAction = 'ask' | 'tray' | 'quit'

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
  tombstones: Tombstone[]
}

/** Payload accepted when creating a prompt — server fills the rest. */
export interface PromptInput {
  title: string
  content: string
  description?: string
  categoryId?: string | null
  track?: TrackId | null
  tags?: string[]
  favorite?: boolean
  variables?: PromptVariable[]
}

/** Fields a step (category) can be created or edited with. */
export type CategoryPatch = Partial<Pick<Category, 'name' | 'color' | 'stage' | 'hint' | 'output' | 'flow'>>

export interface ExportBundle {
  app: 'promptbox'
  version: number
  exportedAt: number
  prompts: Prompt[]
  categories: Category[]
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

export type SyncProviderId = 'gist' | 'webdav' | 's3'

export type SyncStatus = 'idle' | 'uptodate' | 'pushed' | 'pulled' | 'conflict' | 'error'

/** Provider metadata for rendering the cloud-service cards. */
export interface SyncProviderInfo {
  id: SyncProviderId
  name: string
}

/** Only providers with a real implementation belong here — a card that can
 *  never be connected is chrome, not a roadmap. */
export const SYNC_PROVIDERS: SyncProviderInfo[] = [
  { id: 'gist', name: 'GitHub Gist' },
  { id: 'webdav', name: 'WebDAV' },
  { id: 's3', name: 'S3 兼容存储' }
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
  /**
   * A provider is configured but its stored credential could not be decrypted
   * on this machine. Distinct from `connected: false`, which means "never set
   * up" — the user must be told to reconnect rather than left thinking sync is
   * simply off.
   */
  credentialError?: boolean
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
  tombstones: Tombstone[]
}
