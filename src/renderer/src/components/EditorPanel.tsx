import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  CopyPlus,
  Eye,
  FileText,
  History as HistoryIcon,
  Pencil,
  Trash2,
  ArrowRight,
  Wand2
} from 'lucide-react'
import type { Prompt, PromptInput } from '@shared/types'
import { STAGES, TRACKS } from '@shared/types'
import { useStore } from '../store'
import { nextStep, relativeTime, stepsOf } from '../selectors'
import { MarkdownPreview } from './MarkdownPreview'
import { HighlightedEditor } from './HighlightedEditor'
import { VariableFiller } from './VariableFiller'
import { VersionHistory } from './VersionHistory'
import { toast } from './Toast'
import { useT } from '../i18n'

type Tab = 'edit' | 'preview' | 'variables' | 'history'

export function EditorPanel(): React.JSX.Element {
  const selectedId = useStore((s) => s.selectedId)
  const prompt = useStore((s) => s.prompts.find((p) => p.id === s.selectedId) ?? null)
  const t = useT()

  if (!prompt) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas text-faint">
        <FileText size={40} className="mb-3 opacity-40" />
        <p className="font-serif text-base">{t('选择左侧 Prompt，或新建一个开始')}</p>
        <p className="mt-2 text-xs text-faint">
          <kbd className="rounded border border-line-strong px-1">Ctrl/⌘ + N</kbd> {t('新建')} ·{' '}
          <kbd className="rounded border border-line-strong px-1">Ctrl/⌘ + K</kbd> {t('快速调用')}
        </p>
      </div>
    )
  }

  return <Editor key={prompt.id} prompt={prompt} selectedId={selectedId!} />
}

function Editor({ prompt }: { prompt: Prompt; selectedId: string }): React.JSX.Element {
  const allPrompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const setCategoryFilter = useStore((s) => s.setCategoryFilter)
  const updatePrompt = useStore((s) => s.updatePrompt)
  const deletePrompt = useStore((s) => s.deletePrompt)
  const duplicatePrompt = useStore((s) => s.duplicatePrompt)
  const copyResolvedAndUse = useStore((s) => s.copyResolvedAndUse)
  const t = useT()

  // Known variable names across all prompts, offered in {{ }} autocomplete.
  const suggestions = useMemo(() => {
    const set = new Set<string>()
    for (const p of allPrompts) for (const v of p.variables) set.add(v.name)
    return [...set].sort()
  }, [allPrompts])

  const [tab, setTab] = useState<Tab>('edit')
  const [title, setTitle] = useState(prompt.title)
  const [description, setDescription] = useState(prompt.description ?? '')
  const [content, setContent] = useState(prompt.content)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Accumulates debounced field edits so none are lost when several fields
  // change quickly or the editor unmounts (e.g. switching prompts) mid-debounce.
  const pending = useRef<Partial<PromptInput>>({})
  // Autosave was completely silent; the user had no way to tell an edit had
  // landed on disk. 'dirty' while a write is pending, 'saved' once it resolves.
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  /** Returns whether anything was actually written. */
  function commit(): boolean {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (Object.keys(pending.current).length === 0) return false
    const patch = pending.current
    pending.current = {}
    void updatePrompt(prompt.id, patch).then(() => {
      setSaveState('saved')
      setSavedAt(Date.now())
    })
    return true
  }

  function scheduleSave(patch: Partial<PromptInput>) {
    pending.current = { ...pending.current, ...patch }
    setSaveState('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(commit, 500)
  }

  function flushSave(patch: Partial<PromptInput>) {
    pending.current = { ...pending.current, ...patch }
    commit()
  }

  // Flush any pending edits when the editor unmounts (prompt switch / close).
  useEffect(() => {
    return () => {
      commit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ⌘/Ctrl+S flushes the debounced autosave immediately. The toast lives here,
  // not in the global keymap, so it reports what actually happened instead of
  // unconditionally claiming success.
  useEffect(() => {
    const onFlush = () => {
      if (commit()) toast.success(t('已保存'))
      else toast.info(t('没有需要保存的改动'))
    }
    window.addEventListener('promptbox:flush-save', onFlush)
    return () => window.removeEventListener('promptbox:flush-save', onFlush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyContent() {
    // Copies what is on screen (which may be ahead of the last autosave), but
    // through the store so a rejected clipboard write is reported instead of
    // toasting success and counting a use that never happened.
    const ok = await copyResolvedAndUse(prompt.id, content)
    if (ok) toast.success(t('已复制 Prompt 内容'))
    else toast.error(t('复制失败'))
  }

  const next = useMemo(() => nextStep(categories, prompt.categoryId), [categories, prompt.categoryId])

  async function handleDelete() {
    const { id, title } = prompt
    await deletePrompt(id)
    toast.undo(t('已移到回收站：「{title}」', { title }), () => {
      void useStore.getState().restoreDeleted(id)
    })
  }

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-line px-6 py-3.5">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            scheduleSave({ title: e.target.value })
          }}
          className="min-w-0 flex-1 bg-transparent font-serif text-[22px] leading-tight text-ink outline-none placeholder:text-faint"
          placeholder={t('Prompt 标题')}
        />
        {/* Pin and favourite live on the list row, not here. The list pane is
            always on screen beside this one showing the same selected prompt,
            so a second pair of toggles was the same two controls twice at the
            same time. */}
        <ToolbarButton title={t('复制内容')} onClick={copyContent}>
          <Copy size={17} />
        </ToolbarButton>
        <ToolbarButton
          title={t('创建副本')}
          onClick={async () => {
            await duplicatePrompt(prompt.id)
            toast.success(t('已创建副本'))
          }}
        >
          <CopyPlus size={17} />
        </ToolbarButton>
        <ToolbarButton title={t('删除')} danger onClick={handleDelete}>
          <Trash2 size={17} />
        </ToolbarButton>
      </div>

      {/* Step + "when to use" + autosave state. The description doubles as the
          recommendation line shown in the list, so it asks for the situation,
          not a summary of the body. */}
      <div className="flex items-center gap-3 border-b border-line px-6 py-2">
        <select
          value={prompt.categoryId ?? ''}
          onChange={(e) => flushSave({ categoryId: e.target.value || null })}
          title={t('所属步骤')}
          className="max-w-[40%] shrink-0 truncate rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] text-muted outline-none focus:border-focus"
        >
          <option value="">{t('未归入步骤')}</option>
          {STAGES.map((stage, i) => (
            <optgroup key={stage.id} label={`${i + 1} · ${t(stage.name)}`}>
              {stepsOf(categories, stage.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
          {stepsOf(categories, null).length > 0 && (
            <optgroup label={t('其他')}>
              {stepsOf(categories, null).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <select
          value={prompt.track ?? ''}
          onChange={(e) => flushSave({ track: (e.target.value || null) as Prompt['track'] })}
          title={t('适用的项目类型')}
          className="shrink-0 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] text-muted outline-none focus:border-focus"
        >
          <option value="">{t('所有类型')}</option>
          {TRACKS.map((x) => (
            <option key={x.id} value={x.id}>
              {t(x.name)}
            </option>
          ))}
        </select>
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            scheduleSave({ description: e.target.value })
          }}
          placeholder={t('什么情况下用这条？一句话')}
          className="min-w-0 flex-1 bg-transparent text-xs text-muted outline-none placeholder:text-faint"
        />
        <span className="shrink-0 text-[11px] text-faint">
          {saveState === 'dirty'
            ? t('编辑中…')
            : saveState === 'saved' && savedAt
              ? t('已保存 · {when}', { when: relativeTime(savedAt) })
              : ''}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-line px-4">
        <TabButton active={tab === 'edit'} onClick={() => setTab('edit')} icon={<Pencil size={14} />}>
          {t('编辑')}
        </TabButton>
        <TabButton active={tab === 'preview'} onClick={() => setTab('preview')} icon={<Eye size={14} />}>
          {t('预览')}
        </TabButton>
        <TabButton
          active={tab === 'variables'}
          onClick={() => setTab('variables')}
          icon={<Wand2 size={14} />}
        >
          {t('变量')}
          {prompt.variables.length > 0 && (
            <span className="ml-1 rounded-full bg-brand/15 px-1.5 text-[10px] text-brand-text">
              {prompt.variables.length}
            </span>
          )}
        </TabButton>
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          icon={<HistoryIcon size={14} />}
        >
          {t('历史')}
          {prompt.versions.length > 0 && (
            <span className="ml-1 rounded-full bg-surface-2 px-1.5 text-[10px] text-faint">
              {prompt.versions.length}
            </span>
          )}
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'edit' && (
          <HighlightedEditor
            value={content}
            onChange={(v) => {
              setContent(v)
              scheduleSave({ content: v })
            }}
            onBlur={() => flushSave({ content })}
            placeholder={t('在此编写 Prompt，使用 {{变量名}} 创建可填充模板…\n\n支持 Markdown 语法。')}
            suggestions={suggestions}
          />
        )}
        {tab === 'preview' && (
          <div className="rounded-2xl border border-line-strong bg-surface p-6 shadow-[rgba(0,0,0,0.05)_0px_4px_24px]">
            <MarkdownPreview content={content} />
          </div>
        )}
        {tab === 'variables' && <VariableFiller prompt={prompt} />}
        {tab === 'history' && <VersionHistory prompt={prompt} />}
      </div>

      {next && (
        <button
          onClick={() => setCategoryFilter(next.step.id)}
          className="flex items-center gap-2 border-t border-line px-6 py-2.5 text-left text-xs text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <span className="text-faint">{t('下一步')}</span>
          <span className="font-medium text-ink">
            {STAGES.indexOf(next.stage) + 1} · {t(next.stage.name)} / {next.step.name}
          </span>
          <ArrowRight size={13} className="ml-auto text-faint" />
        </button>
      )}
    </div>
  )
}

function ToolbarButton({
  children,
  title,
  onClick,
  danger
}: {
  children: React.ReactNode
  title: string
  onClick(): void
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${
        danger
          ? 'text-faint hover:bg-error/10 hover:text-error'
          : 'text-faint hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function TabButton({
  children,
  active,
  onClick,
  icon
}: {
  children: React.ReactNode
  active: boolean
  onClick(): void
  icon: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition ${
        active
          ? 'border-brand font-medium text-brand-text'
          : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
