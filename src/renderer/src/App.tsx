import { useEffect } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { PromptList } from './components/PromptList'
import { EditorPanel } from './components/EditorPanel'
import { SettingsView } from './components/SettingsView'
import { TrashView } from './components/TrashView'
import { CommandPalette } from './components/CommandPalette'
import { QuickFill } from './components/QuickFill'
import { CloudSyncModal } from './components/CloudSyncModal'
import { DiscoverView } from './components/DiscoverView'
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

/**
 * Global keymap (all ⌘/Ctrl-modified): K palette, N new, D duplicate, S save,
 * F focus search, , settings; Esc back.
 */
function useGlobalKeys(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useStore.getState()
      const modalOpen = s.paletteOpen || s.cloudOpen || s.quickFillPromptId !== null

      if (e.key === 'Escape') {
        if (!modalOpen && s.view !== 'library') s.setView('library')
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
        void s.createPrompt({ title: t('未命名 Prompt'), content: '', categoryId: null })
      } else if (k === 'd') {
        // duplicate the current item
        if (s.view === 'settings') return
        e.preventDefault()
        if (s.selectedId) void s.duplicatePrompt(s.selectedId).then(() => toast.success(t('已创建副本')))
      } else if (k === 's') {
        // Edits autosave; just flush any pending debounce. The editor reports
        // the real outcome — this used to toast success unconditionally.
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('promptbox:flush-save'))
      } else if (k === 'f') {
        // focus the current list's search box
        e.preventDefault()
        const el = document.querySelector<HTMLInputElement>('[data-search-input]')
        el?.focus()
        el?.select()
      } else if (e.key === ',') {
        e.preventDefault()
        s.setView('settings')
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
    <div className="flex h-full bg-canvas text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          {view === 'settings' ? (
            <SettingsView />
          ) : view === 'discover' ? (
            <DiscoverView />
          ) : view === 'trash' ? (
            <TrashView />
          ) : (
            <>
              <PromptList />
              <EditorPanel />
            </>
          )}
        </div>
      </div>
      {paletteOpen && <CommandPalette />}
      {cloudOpen && <CloudSyncModal />}
      <QuickFill />
      <ToastHost />
    </div>
  )
}
