import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  CopyPlus,
  Eye,
  FileText,
  History as HistoryIcon,
  Pencil,
  Pin,
  Star,
  Trash2,
  Wand2,
  X
} from 'lucide-react'
import type { Prompt, PromptInput } from '@shared/types'
import { useStore } from '../store'
import { MarkdownPreview } from './MarkdownPreview'
import { HighlightedEditor } from './HighlightedEditor'
import { VariableFiller } from './VariableFiller'
import { VersionHistory } from './VersionHistory'
import { toast } from './Toast'

type Tab = 'edit' | 'preview' | 'variables' | 'history'

export function EditorPanel(): React.JSX.Element {
  const selectedId = useStore((s) => s.selectedId)
  const prompt = useStore((s) => s.prompts.find((p) => p.id === s.selectedId) ?? null)

  if (!prompt) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas text-faint">
        <FileText size={40} className="mb-3 opacity-40" />
        <p className="font-serif text-base">选择左侧 Prompt，或新建一个开始</p>
        <p className="mt-2 text-xs text-faint">
          <kbd className="rounded border border-line-strong px-1">Ctrl/⌘ + N</kbd> 新建 ·{' '}
          <kbd className="rounded border border-line-strong px-1">Ctrl/⌘ + K</kbd> 快速调用
        </p>
      </div>
    )
  }

  return <Editor key={prompt.id} prompt={prompt} selectedId={selectedId!} />
}

function Editor({ prompt }: { prompt: Prompt; selectedId: string }): React.JSX.Element {
  const categories = useStore((s) => s.categories)
  const allPrompts = useStore((s) => s.prompts)
  const updatePrompt = useStore((s) => s.updatePrompt)
  const deletePrompt = useStore((s) => s.deletePrompt)
  const duplicatePrompt = useStore((s) => s.duplicatePrompt)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const togglePin = useStore((s) => s.togglePin)
  const recordUse = useStore((s) => s.recordUse)

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
  const [tagDraft, setTagDraft] = useState('')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Accumulates debounced field edits so none are lost when several fields
  // change quickly or the editor unmounts (e.g. switching prompts) mid-debounce.
  const pending = useRef<Partial<PromptInput>>({})

  function commit() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (Object.keys(pending.current).length > 0) {
      const patch = pending.current
      pending.current = {}
      void updatePrompt(prompt.id, patch)
    }
  }

  function scheduleSave(patch: Partial<PromptInput>) {
    pending.current = { ...pending.current, ...patch }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(commit, 500)
  }

  function flushSave(patch: Partial<PromptInput>) {
    pending.current = { ...pending.current, ...patch }
    commit()
  }

  // Flush any pending edits when the editor unmounts (prompt switch / close).
  useEffect(() => {
    return () => commit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ⌘/Ctrl+S flushes the debounced autosave immediately.
  useEffect(() => {
    const onFlush = () => commit()
    window.addEventListener('promptbox:flush-save', onFlush)
    return () => window.removeEventListener('promptbox:flush-save', onFlush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyContent() {
    await navigator.clipboard.writeText(content)
    void recordUse(prompt.id)
    toast.success('已复制 Prompt 内容')
  }

  function addTag(raw: string) {
    const tag = raw.trim().replace(/^#/, '')
    if (!tag || prompt.tags.includes(tag)) {
      setTagDraft('')
      return
    }
    flushSave({ tags: [...prompt.tags, tag] })
    setTagDraft('')
  }

  function removeTag(tag: string) {
    flushSave({ tags: prompt.tags.filter((t) => t !== tag) })
  }

  async function handleDelete() {
    const snapshot = prompt
    await deletePrompt(prompt.id)
    toast.undo(`已删除「${snapshot.title}」`, () => {
      void useStore.getState().restorePrompt(snapshot)
    })
  }

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      {/* Toolbar */}
      <div className="app-drag app-drag-pad flex items-center gap-2 border-b border-line px-6 py-3.5">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            scheduleSave({ title: e.target.value })
          }}
          className="min-w-0 flex-1 bg-transparent font-serif text-[22px] leading-tight text-ink outline-none placeholder:text-faint"
          placeholder="Prompt 标题"
        />
        <ToolbarButton
          title={prompt.pinned ? '取消置顶' : '置顶'}
          active={prompt.pinned}
          onClick={() => togglePin(prompt.id)}
        >
          <Pin size={17} className="-rotate-45" fill={prompt.pinned ? 'currentColor' : 'none'} />
        </ToolbarButton>
        <ToolbarButton title="收藏" active={prompt.favorite} onClick={() => toggleFavorite(prompt.id)}>
          <Star size={17} fill={prompt.favorite ? 'currentColor' : 'none'} />
        </ToolbarButton>
        <ToolbarButton title="复制内容" onClick={copyContent}>
          <Copy size={17} />
        </ToolbarButton>
        <ToolbarButton
          title="创建副本"
          onClick={async () => {
            await duplicatePrompt(prompt.id)
            toast.success('已创建副本')
          }}
        >
          <CopyPlus size={17} />
        </ToolbarButton>
        <ToolbarButton title="删除" danger onClick={handleDelete}>
          <Trash2 size={17} />
        </ToolbarButton>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-2.5">
        <select
          value={prompt.categoryId ?? ''}
          onChange={(e) => flushSave({ categoryId: e.target.value || null })}
          className="rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-focus"
        >
          <option value="">未分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-1">
          {prompt.tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
            >
              #{t}
              <button onClick={() => removeTag(t)} className="hover:text-error">
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagDraft)
              }
              if (e.key === 'Backspace' && !tagDraft && prompt.tags.length) {
                removeTag(prompt.tags[prompt.tags.length - 1])
              }
            }}
            placeholder="添加标签…"
            className="w-24 bg-transparent text-[11px] text-ink outline-none placeholder:text-faint"
          />
        </div>
      </div>

      {/* Description */}
      <div className="border-b border-line px-6 py-2">
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            scheduleSave({ description: e.target.value })
          }}
          placeholder="一句话描述（可选）"
          className="w-full bg-transparent text-xs text-muted outline-none placeholder:text-faint"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-line px-4">
        <TabButton active={tab === 'edit'} onClick={() => setTab('edit')} icon={<Pencil size={14} />}>
          编辑
        </TabButton>
        <TabButton active={tab === 'preview'} onClick={() => setTab('preview')} icon={<Eye size={14} />}>
          预览
        </TabButton>
        <TabButton
          active={tab === 'variables'}
          onClick={() => setTab('variables')}
          icon={<Wand2 size={14} />}
        >
          变量
          {prompt.variables.length > 0 && (
            <span className="ml-1 rounded-full bg-brand/15 px-1.5 text-[10px] text-brand">
              {prompt.variables.length}
            </span>
          )}
        </TabButton>
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          icon={<HistoryIcon size={14} />}
        >
          历史
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
            placeholder={'在此编写 Prompt，使用 {{变量名}} 创建可填充模板…\n\n支持 Markdown 语法。'}
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
    </div>
  )
}

function ToolbarButton({
  children,
  title,
  onClick,
  active,
  danger
}: {
  children: React.ReactNode
  title: string
  onClick(): void
  active?: boolean
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${
        active
          ? 'text-brand'
          : danger
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
          ? 'border-brand font-medium text-brand'
          : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
