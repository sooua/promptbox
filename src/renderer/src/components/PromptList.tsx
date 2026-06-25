import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Command, Copy, Download, Pin, Plus, Search, Star, Tag, Trash2, X } from 'lucide-react'
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
  const bulkRestorePrompts = useStore((s) => s.bulkRestorePrompts)
  const bulkSetCategory = useStore((s) => s.bulkSetCategory)
  const bulkSetFavorite = useStore((s) => s.bulkSetFavorite)
  const bulkAddTag = useStore((s) => s.bulkAddTag)

  // Defer the search term so typing stays responsive on large libraries —
  // filtering runs against the latest keystroke without blocking input.
  const deferredSearch = useDeferredValue(search)
  const filtered = useMemo(
    () => filterPrompts(prompts, { categoryFilter, tagFilters, search: deferredSearch }),
    [prompts, categoryFilter, tagFilters, deferredSearch]
  )

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
    const snapshots = await bulkDeletePrompts(selectedIds)
    setSelected(new Set())
    toast.undo(t('已删除 {n} 项', { n: snapshots.length }), () => void bulkRestorePrompts(snapshots))
  }

  function exportSelected() {
    const chosen = prompts.filter((p) => selected.has(p.id))
    const usedCats = new Set(chosen.map((p) => p.categoryId).filter(Boolean))
    const bundle = {
      app: 'promptbox' as const,
      version: 1,
      exportedAt: Date.now(),
      prompts: chosen,
      categories: categories.filter((c) => usedCats.has(c.id)),
      assets: []
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
    await createPrompt({
      title: t('未命名 Prompt'),
      content: '',
      categoryId: isCategoryId(categoryFilter) ? (categoryFilter as string) : null
    })
    toast.success(t('已创建 Prompt'))
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
            value=""
            onChange={(e) => {
              void bulkSetCategory(selectedIds, e.target.value || null)
              toast.success(t('已移动所选项'))
            }}
            className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-muted outline-none"
            title={t('移动到分类')}
          >
            <option value="" disabled>
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
        <div className="flex-1 px-4 pt-16 text-center text-sm text-faint">
          {t('没有匹配的 Prompt。')}
          <br />
          {t('点击')} <span className="text-brand">＋</span> {t('新建一个。')}
        </div>
      ) : (
        <VirtualList
          items={filtered}
          rowHeight={92}
          tabIndex={0}
          onKeyDown={onKeyDown}
          scrollToIndex={filtered.findIndex((p) => p.id === selectedId)}
          className="flex-1 px-2.5 pb-3 outline-none"
          renderItem={(p) => {
            const cat = categoryById(categories, p.categoryId)
            const isSel = selectedId === p.id
            const isMulti = selected.has(p.id)
            return (
              <div
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
                          : 'text-faint opacity-0 hover:text-brand group-hover:opacity-100'
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
                          : 'text-faint opacity-0 hover:text-brand group-hover:opacity-100'
                      }`}
                    >
                      <Star size={15} fill={p.favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const snapshot = p
                        void deletePrompt(p.id).then(() =>
                          toast.undo(t('已删除「{title}」', { title: snapshot.title }), () =>
                            useStore.getState().restorePrompt(snapshot)
                          )
                        )
                      }}
                      title={t('删除')}
                      className="rounded p-0.5 text-faint opacity-0 hover:text-error group-hover:opacity-100"
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
