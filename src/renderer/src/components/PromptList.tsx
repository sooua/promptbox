import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Command, Copy, Download, Pin, Plus, Search, Star, Tag, Trash2, Upload, X } from 'lucide-react'
import { useStore, isCategoryId } from '../store'
import { categoryById, filterPrompts, relativeTime } from '../selectors'
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
  const tagFilters = useStore((s) => s.tagFilters)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const toggleTagFilter = useStore((s) => s.toggleTagFilter)
  const clearTagFilters = useStore((s) => s.clearTagFilters)
  const select = useStore((s) => s.select)
  const createPrompt = useStore((s) => s.createPrompt)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const togglePin = useStore((s) => s.togglePin)
  const deletePrompt = useStore((s) => s.deletePrompt)
  const openPalette = useStore((s) => s.openPalette)
  const bulkDeletePrompts = useStore((s) => s.bulkDeletePrompts)
  const bulkRestoreDeleted = useStore((s) => s.bulkRestoreDeleted)
  const bulkSetCategory = useStore((s) => s.bulkSetCategory)
  const bulkSetFavorite = useStore((s) => s.bulkSetFavorite)
  const bulkAddTag = useStore((s) => s.bulkAddTag)
  const importPromptFiles = useStore((s) => s.importPromptFiles)

  // Defer the search term so typing stays responsive on large libraries —
  // filtering runs against the latest keystroke without blocking input.
  const deferredSearch = useDeferredValue(search)
  const filtered = useMemo(
    () => filterPrompts(prompts, { categoryFilter, tagFilters, search: deferredSearch }),
    [prompts, categoryFilter, tagFilters, deferredSearch]
  )

  const listRef = useRef<HTMLDivElement | null>(null)

  // Multi-select for batch actions (Ctrl/⌘+click toggles, Shift+click ranges).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  // Drop selection when the visible set changes so we never act on hidden rows.
  useEffect(() => setSelected(new Set()), [categoryFilter, tagFilters, deferredSearch])

  function onRowClick(e: React.MouseEvent, id: string) {
    if (e.shiftKey && anchor) {
      const from = filtered.findIndex((p) => p.id === anchor)
      const to = filtered.findIndex((p) => p.id === id)
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from]
        setSelected(new Set(filtered.slice(lo, hi + 1).map((p) => p.id)))
        return
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelected((s) => {
        const next = new Set(s)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
      setAnchor(id)
      return
    }
    setSelected(new Set())
    setAnchor(id)
    select(id)
  }

  const selectedIds = useMemo(() => [...selected], [selected])

  async function batchDelete() {
    const ids = selectedIds
    await bulkDeletePrompts(ids)
    setSelected(new Set())
    toast.undo(t('已移到回收站 · {n} 项', { n: ids.length }), () => void bulkRestoreDeleted(ids))
  }

  function exportSelected() {
    const chosen = prompts.filter((p) => selected.has(p.id))
    const usedCats = new Set(chosen.map((p) => p.categoryId).filter(Boolean))
    const bundle = {
      app: 'promptbox' as const,
      version: 1,
      exportedAt: Date.now(),
      prompts: chosen,
      categories: categories.filter((c) => usedCats.has(c.id))
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `promptbox-export-${chosen.length}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('已导出 {n} 项', { n: chosen.length }))
  }

  async function handleNew() {
    // A new prompt matches neither the search box nor any tag filter, so it
    // would be created *and immediately hidden*. Clear both first so the user
    // actually sees what they just made.
    setSearch('')
    clearTagFilters()
    await createPrompt({
      title: t('未命名 Prompt'),
      content: '',
      categoryId: isCategoryId(categoryFilter) ? (categoryFilter as string) : null
    })
    toast.success(t('已创建 Prompt'))
  }

  const hasFilters = search.trim().length > 0 || tagFilters.length > 0

  async function handleImportFiles() {
    // Same trap as handleNew: imports that don't match the active filter would
    // land invisibly.
    setSearch('')
    clearTagFilters()
    const res = await importPromptFiles(
      isCategoryId(categoryFilter) ? (categoryFilter as string) : null
    )
    if (res.count > 0) toast.success(t('已导入 {n} 条 Prompt', { n: res.count }))
    if (res.failed.length > 0)
      toast.error(t('{n} 个文件无法读取：{names}', { n: res.failed.length, names: res.failed.join('、') }))
    else if (res.count === 0) toast.info(t('未导入任何文件'))
  }

  async function quickCopy(id: string) {
    await requestCopy(id)
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
      void quickCopy(selectedId)
    }
  }

  return (
    <section className="flex w-80 shrink-0 flex-col border-r border-line bg-canvas">
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
                  void quickCopy(visibleSelection ? selectedId! : filtered[0].id)
                  return
                }
                if (!visibleSelection) select(filtered[0].id)
                listRef.current?.focus()
              }
            }}
            placeholder={t('在当前列表内筛选…（Ctrl/⌘ + F）')}
            className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none transition focus:border-focus"
          />
        </div>
        <button
          onClick={openPalette}
          title={t('快速调用 (Ctrl/⌘ + K)')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface text-muted transition hover:text-brand hover:shadow-[0_0_0_1px_var(--color-ring)]"
        >
          <Command size={16} />
        </button>
        <button
          onClick={handleNew}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand shadow-[0_0_0_1px_var(--color-brand)] transition hover:bg-brand-strong"
          title={t('新建 Prompt')}
        >
          <Plus size={18} />
        </button>
      </div>

      {tagFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 text-xs text-muted">
          {tagFilters.map((t) => (
            <button
              key={t}
              onClick={() => toggleTagFilter(t)}
              className="flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-brand"
            >
              #{t}
              <X size={11} />
            </button>
          ))}
          {tagFilters.length > 1 && (
            <button onClick={clearTagFilters} className="text-faint underline hover:text-ink">
              {t('清除')}
            </button>
          )}
        </div>
      )}

      {selected.size > 0 ? (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/8 px-2.5 py-2 text-[11px]">
          <span className="font-medium text-brand">{t('已选 {n} 项', { n: selected.size })}</span>
          <button onClick={() => bulkSetFavorite(selectedIds, true)} className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-muted hover:text-brand" title={t('收藏')}>
            <Star size={12} />
          </button>
          <select
            value="__placeholder"
            onChange={(e) => {
              if (e.target.value === '__placeholder') return
              void bulkSetCategory(selectedIds, e.target.value || null)
              toast.success(t('已移动所选项'))
            }}
            className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-muted outline-none"
            title={t('移动到分类')}
          >
            {/* Sentinel value: an empty-string placeholder would collide with the
                "未分类" option and render as if that were already selected. */}
            <option value="__placeholder" disabled>
              {t('移动到…')}
            </option>
            <option value="">{t('未分类')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const tag = window.prompt(t('为所选项添加标签：'))
              if (tag) void bulkAddTag(selectedIds, tag).then(() => toast.success(t('已添加标签')))
            }}
            className="flex items-center gap-1 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-muted hover:text-brand"
            title={t('添加标签')}
          >
            <Tag size={12} />
          </button>
          <button
            onClick={exportSelected}
            className="flex items-center gap-1 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-muted hover:text-brand"
            title={t('导出所选')}
          >
            <Download size={12} />
          </button>
          <button
            onClick={batchDelete}
            className="flex items-center gap-1 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-muted hover:text-error"
            title={t('删除所选')}
          >
            <Trash2 size={12} />
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-faint underline hover:text-ink">
            {t('清除')}
          </button>
        </div>
      ) : (
        <div className="flex items-center px-4 pb-1 text-[11px] text-faint">
          <span>{t('{n} 项', { n: filtered.length })}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        // Two different empty states: "your filters hide everything" needs a way
        // back, "your library is empty" needs a way forward.
        <div className="flex-1 px-4 pt-16 text-center text-sm text-faint">
          {hasFilters ? (
            <>
              {t('没有匹配的 Prompt。')}
              <br />
              <button
                onClick={() => {
                  setSearch('')
                  clearTagFilters()
                }}
                className="mt-3 rounded-lg border border-line-strong px-3 py-1.5 text-muted transition hover:border-brand hover:text-brand"
              >
                {t('清除筛选条件')}
              </button>
            </>
          ) : (
            <>
              {t('这里还没有 Prompt。')}
              <br />
              {t('点击')} <span className="text-brand">＋</span> {t('新建一个。')}
              {/* Cold start: most users already have .md prompts on disk, and
                  this screen is where they are when they realise it. */}
              <div className="mt-4">
                <button
                  onClick={handleImportFiles}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-muted transition hover:border-brand hover:text-brand"
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
          rowHeight={108}
          tabIndex={0}
          innerRef={listRef}
          role="listbox"
          ariaLabel={t('Prompt 列表')}
          ariaActiveDescendant={selectedId ? `prompt-row-${selectedId}` : undefined}
          onKeyDown={onKeyDown}
          scrollToIndex={filtered.findIndex((p) => p.id === selectedId)}
          className="flex-1 px-2.5 pb-3 outline-none"
          renderItem={(p) => {
            const cat = categoryById(categories, p.categoryId)
            const isSel = selectedId === p.id
            const isMulti = selected.has(p.id)
            return (
              <div
                id={`prompt-row-${p.id}`}
                role="option"
                aria-selected={isSel}
                onClick={(e) => onRowClick(e, p.id)}
                className={`group relative mb-1 w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition ${
                  isMulti
                    ? 'border-brand/50 bg-brand/12'
                    : isSel
                      ? 'border-brand/30 bg-brand/8'
                      : 'border-transparent hover:bg-surface'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {p.pinned && (
                        <Pin size={11} className="shrink-0 -rotate-45 fill-brand text-brand" />
                      )}
                      <span className="truncate text-sm font-medium text-ink">{p.title}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-faint">
                      {p.description || p.content.slice(0, 80) || t('空内容')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void togglePin(p.id)
                      }}
                      title={p.pinned ? t('取消置顶') : t('置顶')}
                      className={`rounded p-0.5 ${
                        p.pinned
                          ? 'text-brand'
                          : 'text-faint opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100'
                      }`}
                    >
                      <Pin size={14} className="-rotate-45" fill={p.pinned ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void toggleFavorite(p.id)
                      }}
                      title={p.favorite ? t('取消收藏') : t('收藏')}
                      className={`rounded p-0.5 ${
                        p.favorite
                          ? 'text-brand'
                          : 'text-faint opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100'
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
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-faint">
                  {cat && (
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: cat.color ?? 'var(--color-brand)' }}
                      />
                      {cat.name}
                    </span>
                  )}
                  {p.tags.slice(0, 2).map((t) => (
                    <span key={t} className="rounded bg-surface-2 px-1.5">
                      #{t}
                    </span>
                  ))}
                  {(p.useCount ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5" title={t('使用次数')}>
                      <Copy size={9} />
                      {p.useCount}
                    </span>
                  )}
                  <span className="ml-auto">{relativeTime(p.updatedAt)}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    void quickCopy(p.id)
                  }}
                  title={t('复制内容')}
                  className="absolute bottom-2 right-2 hidden items-center gap-1 rounded-lg bg-brand px-2 py-1 text-[10px] text-on-brand transition hover:bg-brand-strong group-hover:flex"
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
