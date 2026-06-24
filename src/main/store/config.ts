import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings, Language, ThemeMode } from '@shared/types'
import { DEFAULT_HOTKEY } from '@shared/types'

/**
 * App-level config (data directory + theme) lives in Electron's userData,
 * independent of the user-chosen data directory. This is the bootstrap record
 * that tells us where the actual prompt data lives.
 */

function configPath(): string {
  return join(app.getPath('userData'), 'promptbox.config.json')
}

function defaultDataDir(): string {
  return join(app.getPath('userData'), 'data')
}

export function loadSettings(): AppSettings {
  const fallback: AppSettings = {
    dataDir: defaultDataDir(),
    theme: 'system',
    language: 'zh',
    globalHotkey: DEFAULT_HOTKEY
  }
  try {
    const raw = readFileSync(configPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      dataDir: parsed.dataDir || fallback.dataDir,
      theme: (parsed.theme as ThemeMode) || fallback.theme,
      language: (parsed.language as Language) || fallback.language,
      globalHotkey: parsed.globalHotkey || fallback.globalHotkey
    }
  } catch {
    return fallback
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  ensureDir(app.getPath('userData'))
  writeFileSync(configPath(), JSON.stringify(settings, null, 2), 'utf-8')
  return settings
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
