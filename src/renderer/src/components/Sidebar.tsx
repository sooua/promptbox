import { useMemo, useState } from 'react'
import {
  Box,
  Clock,
  Cloud,
  Compass,
  Flame,
  GripVertical,
  Pencil,
  Plus,
  Settings,
  Star,
  Tag,
  Trash2,
  Inbox,
  Layers
} from 'lucide-react'
import { useStore, type CategoryFilter } from '../store'
import { collectTags } from '../selectors'
import { toast } from './Toast'
import { useT } from '../i18n'

const SWATCHES = ['#c96442', '#d97757', '#7a8b6f', '#b08968', '#8a7355', '#a86b5c', '#6b7a8f']

const isMac = window.api.platform === 'darwin'

export function Sidebar(): React.JSX.Element {
  const prompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const categoryFilter = useStore((s) => s.categoryFilter)
  const tagFilters = useStore((s) => s.tagFilters)
  const view = useStore((s) => s.view)
  const setCategoryFilter = useStore((s) => s.setCategoryFilter)
  const toggleTagFilter = useStore((s) => s.toggleTagFilter)
  const setView = useStore((s) => s.setView)
  const createCategory = useStore((s) => s.createCategory)
  const updateCategory = useStore((s) => s.updateCategory)
  const deleteCategory = useStore((s) => s.deleteCategory)
  const reorderCategories = useStore((s) => s.reorderCategories)
  const openCloud = useStore((s) => s.openCloud)
  const syncConnected = useStore((s) => s.syncState?.connected ?? false)
  const syncFailed = useStore(
    (s) => s.syncState?.lastStatus === 'error' || (s.syncState?.credentialError ?? false)
  )
  const syncNeedsAttention = useStore((s) => s.syncState?.credentialError ?? false)
  const deletedCount = useStore((s) => s.deletedPrompts.length)

  const t = useT()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function startRename(id: string, current: string) {
    setEditingId(id)
    setEditName(current)
  }

  async function submitRename() {
    if (!editingId) return
    const name = editName.trim()
    const original = categories.find((c) => c.id === editingId)?.name
    const id = editingId
    setEditingId(null)
    if (!name || name === original) return
    if (categories.some((c) => c.id !== id && c.name === name)) {
      toast.error(t('已存在同名分类'))
      return
    }
    await updateCategory(id, { name })
    toast.success(t('分类已重命名'))
  }

  function handleDrop(targetId: string) {
    if (dragId && dragId !== targetId) {
      const ids = categories.map((c) => c.id).filter((id) => id !== dragId)
      ids.splice(ids.indexOf(targetId), 0, dragId)
      void reorderCategories(ids)
    }
    setDragId(null)
    setOverId(null)
  }

  const tags = useMemo(() => collectTags(prompts), [prompts])
  const favCount = prompts.filter((p) => p.favorite).length
  const uncatCount = prompts.filter((p) => !p.categoryId).length
  const recentCount = prompts.filter((p) => p.lastUsedAt).length
  const frequentCount = prompts.filter((p) => (p.useCount ?? 0) > 0).length

  const countFor = (id: string) => prompts.filter((p) => p.categoryId === id).length

  async function submitCategory() {
    const name = newName.trim()
    if (!name) {
      setAdding(false)
      return
    }
    if (categories.some((c) => c.name === name)) {
      toast.error(t('已存在同名分类'))
      return
    }
    const color = SWATCHES[categories.length % SWATCHES.length]
    await createCategory(name, color)
    setNewName('')
    setAdding(false)
    toast.success(t('已创建分类'))
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-canvas">
      {/* macOS draws its traffic lights over the top-left of the window, exactly
          where the logo square would sit. There we drop the square and indent
          past the buttons (see trafficLightPosition in main), keeping only the
          wordmark. */}
      <div
        className={`app-drag flex h-14 shrink-0 items-center gap-2.5 border-b border-line ${
          isMac ? 'pl-[78px] pr-4' : 'px-5'
        }`}
      >
        {!isMac && (
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-on-brand">
            <Box size={18} />
          </div>
        )}
        <div className="min-w-0">
          <div className="font-serif text-[16px] leading-tight text-ink">PromptBox</div>
          <div className="truncate text-[11px] leading-tight text-faint">
            {t('本地 Prompt 资产库')}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pt-3 pb-2">
        <SectionLabel>{t('资产库')}</SectionLabel>
        <NavItem
          icon={<Layers size={15} />}
          label={t('全部')}
          active={view === 'library' && categoryFilter === 'all'}
          count={prompts.length}
          onClick={() => setCategoryFilter('all')}
        />
        <NavItem
          icon={<Star size={15} />}
          label={t('收藏')}
          active={view === 'library' && categoryFilter === 'favorites'}
          count={favCount}
          onClick={() => setCategoryFilter('favorites')}
        />
        <NavItem
          icon={<Clock size={15} />}
          label={t('最近使用')}
          active={view === 'library' && categoryFilter === 'recent'}
          count={recentCount}
          onClick={() => setCategoryFilter('recent')}
        />
        <NavItem
          icon={<Flame size={15} />}
          label={t('最常用')}
          active={view === 'library' && categoryFilter === 'frequent'}
          count={frequentCount}
          onClick={() => setCategoryFilter('frequent')}
        />
        <NavItem
          icon={<Inbox size={15} />}
          label={t('未分类')}
          active={view === 'library' && categoryFilter === 'uncategorized'}
          count={uncatCount}
          onClick={() => setCategoryFilter('uncategorized')}
        />
        {/* The five items above filter the list in place; this one replaces the
            whole right-hand pane. Identical styling in one run read as "another
            filter", so the rule is separated out. */}
        <div className="my-1 border-t border-line" />
        <NavItem
          icon={<Trash2 size={15} />}
          label={t('回收站')}
          active={view === 'trash'}
          count={deletedCount}
          onClick={() => setView('trash')}
        />

        <div className="mt-4 flex items-center justify-between pr-1">
          <SectionLabel>{t('分类')}</SectionLabel>
          <button
            className="rounded-md p-1 text-faint transition hover:bg-surface-2 hover:text-ink"
            onClick={() => setAdding(true)}
            title={t('新建分类')}
          >
            <Plus size={14} />
          </button>
        </div>

        {categories.map((c) => (
          <div
            key={c.id}
            draggable
            onDragStart={() => setDragId(c.id)}
            onDragEnd={() => {
              setDragId(null)
              setOverId(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (dragId && dragId !== c.id) setOverId(c.id)
            }}
            onDragLeave={() => setOverId((id) => (id === c.id ? null : id))}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(c.id)
            }}
            className={`group relative rounded-lg transition ${
              dragId === c.id ? 'opacity-40' : ''
            } ${overId === c.id ? 'ring-1 ring-brand/50' : ''}`}
            title={t('拖拽可调整排序')}
          >
            {editingId === c.id ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: c.color ?? 'var(--color-brand)' }}
                />
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full rounded-md border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-focus"
                />
              </div>
            ) : (
              <>
                <div onDoubleClick={() => startRename(c.id, c.name)}>
                  <NavItem
                    icon={
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: c.color ?? 'var(--color-brand)' }}
                      />
                    }
                    label={c.name}
                    active={view === 'library' && categoryFilter === c.id}
                    count={countFor(c.id)}
                    onClick={() => setCategoryFilter(c.id as CategoryFilter)}
                  />
                </div>
                <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                  <span
                    className="cursor-grab text-faint active:cursor-grabbing"
                    title={t('拖拽排序')}
                  >
                    <GripVertical size={13} />
                  </span>
                  <button
                    className="rounded p-1 text-faint hover:text-ink"
                    title={t('重命名分类')}
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename(c.id, c.name)
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="rounded p-1 text-faint hover:text-error"
                    title={t('删除分类')}
                    onClick={async (e) => {
                      e.stopPropagation()
                      // Deleting a category is not undoable and silently
                      // re-files everything under it — say so before doing it.
                      const n = countFor(c.id)
                      if (
                        !confirm(
                          n > 0
                            ? t('删除分类「{name}」？其中 {n} 条 Prompt 会移至「未分类」（Prompt 本身不会被删除）。', { name: c.name, n })
                            : t('删除分类「{name}」？', { name: c.name })
                        )
                      )
                        return
                      await deleteCategory(c.id)
                      toast.info(t('分类已删除，相关 Prompt 移至未分类'))
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {adding && (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={submitCategory}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCategory()
              if (e.key === 'Escape') {
                setAdding(false)
                setNewName('')
              }
            }}
            placeholder={t('分类名称…')}
            className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-[10px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-focus"
          />
        )}

        {tags.length > 0 && (
          <>
            <SectionLabel className="mt-4">{t('标签')}</SectionLabel>
            <div className="flex flex-wrap gap-1.5 px-2 py-1">
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => {
                    setView('library')
                    toggleTagFilter(tag)
                  }}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
                    tagFilters.includes(tag)
                      ? 'bg-brand text-on-brand'
                      : 'bg-surface-2 text-muted hover:text-ink'
                  }`}
                >
                  <Tag size={10} />
                  {tag}
                  <span className="opacity-60">{count}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      {/* The three destinations that replace the whole right-hand pane live
          together down here. "发现" used to float above the library nav, where
          its prominence promised a primary action while it is an occasional
          errand — and it visually merged with the filters right below it. */}
      <div className="flex border-t border-line">
        <button
          onClick={() => setView('discover')}
          className={`flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-sm transition ${
            view === 'discover'
              ? 'font-medium text-brand'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <Compass size={16} />
          {t('发现')}
        </button>
        <button
          onClick={() => setView('settings')}
          className={`flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-sm transition ${
            view === 'settings'
              ? 'font-medium text-brand'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <Settings size={16} />
          {t('设置')}
        </button>
        <button
          onClick={openCloud}
          // A green dot for "connected" hid the case that matters most: connected
          // but the last sync failed. Colour the dot by outcome, not by config.
          title={
            syncNeedsAttention
              ? t('云同步：凭证无法解密，请重新连接')
              : syncFailed
                ? t('云同步：上次同步失败')
                : t('云同步')
          }
          className="relative flex items-center px-4 text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <Cloud size={16} />
          {(syncConnected || syncNeedsAttention) && (
            <span
              className={`absolute right-2.5 top-3 h-1.5 w-1.5 rounded-full ${
                syncFailed ? 'bg-error' : 'bg-emerald-500'
              }`}
            />
          )}
        </button>
      </div>
    </aside>
  )
}

function SectionLabel({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={`px-2 py-1 text-[10px] font-medium uppercase tracking-[0.5px] text-faint ${className}`}
    >
      {children}
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  count,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  count?: number
  onClick(): void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
        active
          ? 'bg-brand/12 font-medium text-brand'
          : 'text-muted hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <span className="flex w-4 justify-center text-faint">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] text-faint transition-opacity group-hover:opacity-0">
          {count}
        </span>
      )}
    </button>
  )
}
