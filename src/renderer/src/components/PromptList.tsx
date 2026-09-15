import { useDeferredValue, useMemo, useRef } from 'react'
import { Copy, Plus, Search, Star, Trash2, Upload } from 'lucide-react'
import { STAGES, TRACKS } from '@shared/types'
import { useStore, isCategoryId, stageOf } from '../store'
import { categoryById, filterPrompts, stepsOf } from '../selectors'
import { requestCopy } from '../copy'
import { VirtualList } from './VirtualList'
import { toast } from './Toast'
import { useT } from '../i18n'

export function PromptList(): React.JSX.Element {
  const t = useT()
  const prompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const selectedId = useStore((s) => s.selectedId)
  const categoryFilter = useStore((s) => s.categoryFilter)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const select = useStore((s) => s.select)
  const createPrompt = useStore((s) => s.createPrompt)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const deletePrompt = useStore((s) => s.deletePrompt)
  const importPromptFiles = useStore((s) => s.importPromptFiles)

  // Defer the search term so typing stays responsive on large libraries —
  // filtering runs against the latest keystroke without blocking input.
  const deferredSearch = useDeferredValue(search)
  const filtered = useMemo(
    () => filterPrompts(prompts, categories, { categoryFilter, search: deferredSearch }),
    [prompts, categories, categoryFilter, deferredSearch]
  )

  const listRef = useRef<HTMLDivElement | null>(null)

  // Heading for the pane: the stage (with its "when you're here" line) or the
  // step, so the user always knows where in the walkthrough they are.
  const heading = useMemo(() => {
    const stageId = stageOf(categoryFilter)
    if (stageId) {
      const s = STAGES.find((x) => x.id === stageId)!
      return { title: `${STAGES.indexOf(s) + 1} · ${t(s.name)}`, hint: t(s.hint) }
    }
    if (isCategoryId(categoryFilter)) {
      const step = categoryById(categories, categoryFilter)
      if (!step) return null
      const stage = STAGES.find((x) => x.id === step.stage)
      const idx = stepsOf(categories, step.stage ?? null).indexOf(step) + 1
      return {
        title: step.name,
        hint: stage ? `${t(stage.name)} · ${t('第 {n} 步', { n: idx })}` : t('其他')
      }
    }
    return null
  }, [categoryFilter, categories, t])

  // Whatever is being looked at is where a new prompt lands: the step itself,
  // or the first step of the stage.
  function targetStep(): string | null {
    if (isCategoryId(categoryFilter)) return categoryFilter
    const stageId = stageOf(categoryFilter)
    return stageId ? (stepsOf(categories, stageId)[0]?.id ?? null) : null
  }

  async function handleNew() {
    // A new prompt matches no search term, so it would be created *and
    // immediately hidden*. Clear it first so the user sees what they just made.
    setSearch('')
    await createPrompt({ title: t('未命名 Prompt'), content: '', categoryId: targetStep() })
    toast.success(t('已创建 Prompt'))
  }

  async function handleImportFiles() {
    setSearch('')
    const res = await importPromptFiles(targetStep())
    if (res.count > 0) toast.success(t('已导入 {n} 条 Prompt', { n: res.count }))
    if (res.failed.length > 0)
      toast.error(t('{n} 个文件无法读取：{names}', { n: res.failed.length, names: res.failed.join('、') }))
    else if (res.count === 0) toast.info(t('未导入任何文件'))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (filtered.length === 0) return
    const idx = filtered.findIndex((p) => p.id === selectedId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = filtered[Math.min(idx + 1, filtered.length - 1)] ?? filtered[0]
      select(next.id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = filtered[Math.max(idx - 1, 0)] ?? filtered[0]
      select(prev.id)
    } else if (e.key === 'Enter' && selectedId) {
      e.preventDefault()
      void requestCopy(selectedId)
    }
  }

  const hasSearch = search.trim().length > 0

  return (
    <section className="flex w-80 shrink-0 flex-col border-r border-line bg-canvas">
      {heading && (
        <div className="border-b border-line px-4 pb-3 pt-4">
          <div className="font-serif text-[17px] leading-tight text-ink">{heading.title}</div>
          <div className="mt-1 text-xs text-faint">{heading.hint}</div>
        </div>
      )}

      <div className="flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            data-search-input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              // ↓ / Enter hand off from the search box to the list, so the whole
              // filter→pick→copy loop is reachable without the mouse.
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                if (filtered.length === 0) return
                e.preventDefault()
                // Never act on a prompt the current filter hides.
                const visibleSelection = filtered.some((p) => p.id === selectedId)
                if (e.key === 'Enter') {
                  void requestCopy(visibleSelection ? selectedId! : filtered[0].id)
                  return
                }
                if (!visibleSelection) select(filtered[0].id)
                listRef.current?.focus()
              }
            }}
            placeholder={t('筛选…（Ctrl/⌘ + F）')}
            className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none transition focus:border-focus"
          />
        </div>
        <button
          onClick={handleNew}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand shadow-[0_0_0_1px_var(--color-brand)] transition hover:bg-brand-strong"
          title={t('新建 Prompt')}
        >
          <Plus size={18} />
        </button>
      </div>

      {filtered.length === 0 ? (
        // Two different empty states: "your search hides everything" needs a way
        // back, "nothing here yet" needs a way forward.
        <div className="flex-1 px-4 pt-16 text-center text-sm text-faint">
          {hasSearch ? (
            <>
              {t('没有匹配的 Prompt。')}
              <br />
              <button
                onClick={() => setSearch('')}
                className="mt-3 rounded-lg border border-line-strong px-3 py-1.5 text-muted transition hover:border-brand hover:text-brand-text"
              >
                {t('清除筛选条件')}
              </button>
            </>
          ) : (
            <>
              {t('这里还没有 Prompt。')}
              <br />
              {t('点击')} <span className="text-brand-text">＋</span> {t('新建一个。')}
              <div className="mt-4">
                <button
                  onClick={handleImportFiles}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-muted transition hover:border-brand hover:text-brand-text"
                >
                  <Upload size={14} />
                  {t('从 Markdown 文件导入…')}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <VirtualList
          items={filtered}
          rowHeight={84}
          tabIndex={0}
          innerRef={listRef}
          role="listbox"
          ariaLabel={t('Prompt 列表')}
          ariaActiveDescendant={selectedId ? `prompt-row-${selectedId}` : undefined}
          onKeyDown={onKeyDown}
          scrollToIndex={filtered.findIndex((p) => p.id === selectedId)}
          className="flex-1 px-2.5 pb-3 outline-none"
          renderItem={(p) => {
            const step = categoryById(categories, p.categoryId)
            const stage = STAGES.find((s) => s.id === step?.stage)
            const isSel = selectedId === p.id
            return (
              <div
                id={`prompt-row-${p.id}`}
                role="option"
                aria-selected={isSel}
                onClick={() => select(p.id)}
                className={`group relative mb-1 w-full cursor-pointer rounded-xl border px-3 py-2 text-left transition ${
                  isSel ? 'border-brand/30 bg-brand/8' : 'border-transparent hover:bg-surface'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{p.title}</div>
                    <div className="mt-0.5 truncate text-xs text-faint">
                      {p.description || p.content.slice(0, 80) || t('空内容')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void toggleFavorite(p.id)
                      }}
                      title={p.favorite ? t('取消收藏') : t('收藏')}
                      className={`rounded p-0.5 ${
                        p.favorite
                          ? 'text-brand-text'
                          : 'text-faint opacity-0 transition-opacity hover:text-brand-text focus-visible:opacity-100 group-hover:opacity-100'
                      }`}
                    >
                      <Star size={15} fill={p.favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const { id, title } = p
                        void deletePrompt(id).then(() =>
                          toast.undo(t('已移到回收站：「{title}」', { title }), () =>
                            useStore.getState().restoreDeleted(id)
                          )
                        )
                      }}
                      title={t('删除')}
                      className="rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
                  {step && (
                    <span className="flex items-center gap-1 truncate">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: step.color ?? 'var(--color-brand)' }}
                      />
                      {stage ? `${STAGES.indexOf(stage) + 1} · ` : ''}
                      {step.name}
                    </span>
                  )}
                  {p.track && (
                    <span className="rounded border border-line-strong px-1">
                      {t(TRACKS.find((x) => x.id === p.track)?.name ?? p.track)}
                    </span>
                  )}
                  {p.variables.length > 0 && (
                    <span className="rounded bg-surface-2 px-1.5">
                      {t('{n} 个变量', { n: p.variables.length })}
                    </span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    void requestCopy(p.id)
                  }}
                  title={t('复制内容')}
                  className="absolute bottom-2 right-2 hidden items-center gap-1 rounded-lg bg-brand-solid px-2 py-1 text-[10px] text-on-brand transition hover:bg-brand-solid-hover group-hover:flex"
                >
                  <Copy size={11} />
                  {t('复制')}
                </button>
              </div>
            )
          }}
        />
      )}
    </section>
  )
}
