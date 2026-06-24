import { useEffect } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { PromptList } from './components/PromptList'
import { EditorPanel } from './components/EditorPanel'
import { AssetList } from './components/AssetList'
import { AssetEditor } from './components/AssetEditor'
import { SettingsView } from './components/SettingsView'
import { CommandPalette } from './components/CommandPalette'
import { QuickFill } from './components/QuickFill'
import { CloudSyncModal } from './components/CloudSyncModal'
import { TitleBar } from './components/TitleBar'
import { ToastHost, toast } from './components/Toast'
import { t, useT } from './i18n'

function useThemeEffect(): void {
  const theme = useStore((s) => s.settings?.theme ?? 'system')
  useEffect(() => {
    const root = document.documentElement
    const apply = (dark: boolean) => root.classList.toggle('dark', dark)
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const listener = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', listener)
      return () => mq.removeEventListener('change', listener)
    }
    apply(theme === 'dark')
    return undefined
  }, [theme])
}

const WORKSPACE_KEYS: Record<string, 'prompts' | 'skill' | 'agent' | 'mcp'> = {
  '1': 'prompts',
  '2': 'skill',
  '3': 'agent',
  '4': 'mcp'
}

/**
 * Global keymap (all ⌘/Ctrl-modified): K palette, N new, D duplicate, S save,
 * F focus search, 1-4 workspace, , settings; Esc back.
 */
function useGlobalKeys(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useStore.getState()
      const modalOpen = s.paletteOpen || s.cloudOpen || s.quickFillPromptId !== null

      if (e.key === 'Escape') {
        if (!modalOpen && s.view === 'settings') s.setView('library')
        return
      }

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()

      if (k === 'k') {
        e.preventDefault()
        s.paletteOpen ? s.closePalette() : s.openPalette()
        return
      }
      // remaining shortcuts are suppressed while a modal is open
      if (modalOpen) return

      if (k === 'n') {
        e.preventDefault()
        if (s.view === 'settings') return
        if (s.workspace === 'prompts') {
          void s.createPrompt({ title: t('未命名 Prompt'), content: '', categoryId: null })
        } else {
          void s.createAsset(s.workspace)
        }
      } else if (k === 'd') {
        // duplicate the current item
        if (s.view === 'settings') return
        e.preventDefault()
        if (s.workspace === 'prompts') {
          if (s.selectedId) void s.duplicatePrompt(s.selectedId).then(() => toast.success(t('已创建副本')))
        } else if (s.selectedAssetId) {
          void s.duplicateAsset(s.selectedAssetId).then(() => toast.success(t('已创建副本')))
        }
      } else if (k === 's') {
        // edits autosave; flush any pending debounce and confirm.
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('promptbox:flush-save'))
        toast.success(t('已保存'))
      } else if (k === 'f') {
        // focus the current list's search box
        e.preventDefault()
        const el = document.querySelector<HTMLInputElement>('[data-search-input]')
        el?.focus()
        el?.select()
      } else if (e.key === ',') {
        e.preventDefault()
        s.setView('settings')
      } else if (WORKSPACE_KEYS[e.key]) {
        e.preventDefault()
        s.setWorkspace(WORKSPACE_KEYS[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App(): React.JSX.Element {
  const init = useStore((s) => s.init)
  const loading = useStore((s) => s.loading)
  const view = useStore((s) => s.view)
  const paletteOpen = useStore((s) => s.paletteOpen)
  const cloudOpen = useStore((s) => s.cloudOpen)
  const workspace = useStore((s) => s.workspace)

  const openPalette = useStore((s) => s.openPalette)
  const t = useT()

  useThemeEffect()
  useGlobalKeys()

  useEffect(() => {
    void init()
  }, [init])

  // Global hotkey / tray triggers palette open from the main process.
  useEffect(() => {
    return window.api.onOpenPalette(() => openPalette())
  }, [openPalette])

  // Auto-update lifecycle pushed from main: keep store in sync and surface the
  // moments that need the user (a downloaded update ready to install, or errors).
  useEffect(() => {
    return window.api.update.onStatus((status) => {
      useStore.getState().setUpdateStatus(status)
      if (status.state === 'downloaded') {
        toast.action(
          t('新版本 {version} 已下载', { version: status.version ?? '' }),
          t('重启安装'),
          () => void useStore.getState().installUpdate()
        )
      } else if (status.state === 'error') {
        toast.error(t('检查更新失败：{msg}', { msg: status.message ?? t('请稍后重试') }))
      }
    })
  }, [])

  // Auto-sync completion pushed from main. Surface failures once (don't spam on
  // each backoff retry) so the user knows their changes aren't reaching the cloud.
  useEffect(() => {
    let lastWasError = false
    return window.api.onSyncChanged((result) => {
      void useStore.getState().onAutoSync(result)
      if (result.status === 'error') {
        if (!lastWasError) toast.error(t('自动同步失败：{msg}', { msg: result.message ?? t('请检查网络或凭证') }))
        lastWasError = true
      } else {
        lastWasError = false
      }
    })
  }, [])

  // Pull from cloud once on startup if a provider is connected.
  useEffect(() => {
    if (loading) return
    const { syncState, runSync } = useStore.getState()
    if (syncState?.connected) void runSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas font-serif text-faint">
        {t('加载中…')}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {view === 'settings' ? (
          <SettingsView />
        ) : workspace === 'prompts' ? (
          <>
            <PromptList />
            <EditorPanel />
          </>
        ) : (
          <>
            <AssetList kind={workspace} />
            <AssetEditor />
          </>
        )}
      </div>
      {paletteOpen && <CommandPalette />}
      {cloudOpen && <CloudSyncModal />}
      <QuickFill />
      <ToastHost />
    </div>
  )
}
