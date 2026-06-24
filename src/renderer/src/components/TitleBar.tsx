import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Cloud,
  Download,
  Menu as MenuIcon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Upload,
  LogOut
} from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { toast } from './Toast'

type Item =
  | 'separator'
  | {
      icon: React.ReactNode
      label: string
      hint?: string
      onClick(): void
    }

/**
 * Slim custom title bar for the frameless window. The whole bar is a drag
 * region (window controls overlay sits at its right); the menu button on the
 * left opens a quick menu of common actions.
 */
export function TitleBar(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

  const s = useStore
  const workspace = useStore((st) => st.workspace)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function run(fn: () => void) {
    setOpen(false)
    fn()
  }

  async function checkUpdate() {
    const r = await s.getState().checkUpdate()
    if (r.state === 'dev') toast.info(t('开发模式，打包后可更新'))
    else if (r.state === 'none') toast.success(t('已是最新版本'))
  }

  const items: Item[] = [
    {
      icon: <Plus size={15} />,
      label: t('新建'),
      hint: 'Ctrl/⌘ N',
      onClick: () => {
        const st = s.getState()
        if (st.workspace === 'prompts') {
          void st.createPrompt({ title: '未命名 Prompt', content: '', categoryId: null })
        } else {
          void st.createAsset(st.workspace)
        }
      }
    },
    {
      icon: <Search size={15} />,
      label: t('快速调用'),
      hint: 'Ctrl/⌘ K',
      onClick: () => s.getState().openPalette()
    },
    'separator',
    {
      icon: <Cloud size={15} />,
      label: t('云同步'),
      onClick: () => s.getState().openCloud()
    },
    {
      icon: <Upload size={15} />,
      label: t('导入数据'),
      onClick: async () => {
        const r = await s.getState().importData('merge')
        if (r.ok) toast.success(t('导入完成'))
      }
    },
    {
      icon: <Download size={15} />,
      label: t('导出数据'),
      onClick: async () => {
        const r = await s.getState().exportData()
        if (r.ok) toast.success(t('数据已导出'))
      }
    },
    'separator',
    {
      icon: <RefreshCw size={15} />,
      label: t('检查更新'),
      onClick: checkUpdate
    },
    {
      icon: <Settings size={15} />,
      label: t('设置'),
      hint: 'Ctrl/⌘ ,',
      onClick: () => s.getState().setView('settings')
    },
    'separator',
    {
      icon: <LogOut size={15} />,
      label: t('退出 PromptBox'),
      onClick: () => void window.api.quit()
    }
  ]

  return (
    <div className="app-drag flex h-10 shrink-0 items-center border-b border-line bg-canvas pl-2 pr-2">
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          title={t('菜单')}
          className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition ${
            open ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <MenuIcon size={16} />
          <span className="flex items-center gap-1.5">
            <Box size={14} className="text-brand" />
            <span className="font-serif text-[13px] text-ink">PromptBox</span>
          </span>
        </button>

        {open && (
          <div className="app-no-drag absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-line-strong bg-surface py-1.5 shadow-[rgba(0,0,0,0.12)_0px_8px_28px]">
            {items.map((it, i) =>
              it === 'separator' ? (
                <div key={i} className="my-1.5 border-t border-line" />
              ) : (
                <button
                  key={i}
                  onClick={() => run(it.onClick)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-ink transition hover:bg-surface-2"
                >
                  <span className="flex w-4 justify-center text-muted">{it.icon}</span>
                  <span className="flex-1">{it.label}</span>
                  {it.hint && <span className="text-[11px] text-faint">{it.hint}</span>}
                </button>
              )
            )}
          </div>
        )}
      </div>
      {/* draggable spacer; window controls overlay floats over the right side */}
      <div className="h-full flex-1" />
      {workspace !== 'prompts' && (
        <span className="app-no-drag mr-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {workspace}
        </span>
      )}
    </div>
  )
}
