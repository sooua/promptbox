import { useState } from 'react'
import {
  Box,
  Cloud,
  GripVertical,
  Layers,
  Map,
  Pencil,
  Plus,
  Settings,
  Star,
  Trash2
} from 'lucide-react'
import type { Category, StageId } from '@shared/types'
import { STAGES, STAGE_COLORS } from '@shared/types'
import { moveStep } from '@shared/steps'
import { useStore, type CategoryFilter } from '../store'
import { stepsOf } from '../selectors'
import { toast } from './Toast'
import { useT } from '../i18n'

const isMac = window.api.platform === 'darwin'

/**
 * The advanced library's rail: the five fixed stages, each holding the
 * user-editable steps (categories) inside it. Steps made before stages existed
 * have no stage and show under "其他". The route itself lives in RouteView.
 */
export function Sidebar(): React.JSX.Element {
  const prompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const categoryFilter = useStore((s) => s.categoryFilter)
  const view = useStore((s) => s.view)
  const setCategoryFilter = useStore((s) => s.setCategoryFilter)
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
  // Which stage (or null = 其他) has its "new step" input open.
  const [adding, setAdding] = useState<StageId | null | false>(false)
  const [newName, setNewName] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const countFor = (id: string) => prompts.filter((p) => p.categoryId === id).length
  const countForStage = (stage: StageId) =>
    stepsOf(categories, stage).reduce((n, c) => n + countFor(c.id), 0)
  const favCount = prompts.filter((p) => p.favorite).length

  function startRename(c: Category) {
    setEditingId(c.id)
    setEditName(c.name)
  }

  async function submitRename() {
    if (!editingId) return
    const name = editName.trim()
    const original = categories.find((c) => c.id === editingId)?.name
    const id = editingId
    setEditingId(null)
    if (!name || name === original) return
    if (categories.some((c) => c.id !== id && c.name === name)) {
      toast.error(t('已存在同名步骤'))
      return
    }
    await updateCategory(id, { name })
  }

  async function submitNew() {
    const stage = adding === false ? null : adding
    const name = newName.trim()
    setAdding(false)
    setNewName('')
    if (!name) return
    if (categories.some((c) => c.name === name)) {
      toast.error(t('已存在同名步骤'))
      return
    }
    const c = await createCategory({ name, stage, color: stage ? STAGE_COLORS[stage] : undefined })
    setCategoryFilter(c.id as CategoryFilter)
  }

  /**
   * Drop a step before another step, or onto a stage header (end of that
   * stage). Dropping into a different stage re-files the step there — the only
   * way to move a pre-route category with all its prompts onto the route at once.
   */
  async function handleDrop(target: Category | StageId | null) {
    const move = dragId ? moveStep(categories, dragId, target) : null
    const from = categories.find((c) => c.id === dragId)
    setDragId(null)
    setOverId(null)
    if (!move || !from) return
    if ((from.stage ?? null) !== move.stage) {
      await updateCategory(from.id, { stage: move.stage, color: move.stage ? STAGE_COLORS[move.stage] : undefined })
    }
    await reorderCategories(move.ids)
  }

  async function handleDelete(c: Category) {
    // Not undoable, and it silently re-files everything under it — say so.
    const n = countFor(c.id)
    if (
      !confirm(
        n > 0
          ? t('删除步骤「{name}」？其中 {n} 条 Prompt 会移至「其他」（Prompt 本身不会被删除）。', { name: c.name, n })
          : t('删除步骤「{name}」？', { name: c.name })
      )
    )
      return
    await deleteCategory(c.id)
  }

  function renderStep(c: Category) {
    if (editingId === c.id) {
      return (
        <input
          key={c.id}
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRename()
            if (e.key === 'Escape') setEditingId(null)
          }}
          className="mx-2 my-0.5 w-[calc(100%-1rem)] rounded-md border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-focus"
        />
      )
    }
    return (
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
          void handleDrop(c)
        }}
        className={`group relative rounded-lg transition ${dragId === c.id ? 'opacity-40' : ''} ${
          overId === c.id ? 'ring-1 ring-brand/50' : ''
        }`}
      >
        <div onDoubleClick={() => startRename(c)}>
          <NavItem
            label={c.name}
            active={view === 'library' && categoryFilter === c.id}
            count={countFor(c.id)}
            indent
            onClick={() => setCategoryFilter(c.id as CategoryFilter)}
          />
        </div>
        <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
          <span className="cursor-grab text-faint active:cursor-grabbing" title={t('拖拽排序')}>
            <GripVertical size={13} />
          </span>
          <button
            className="rounded p-1 text-faint hover:text-ink"
            title={t('重命名步骤')}
            onClick={(e) => {
              e.stopPropagation()
              startRename(c)
            }}
          >
            <Pencil size={13} />
          </button>
          <button
            className="rounded p-1 text-faint hover:text-error"
            title={t('删除步骤')}
            onClick={(e) => {
              e.stopPropagation()
              void handleDelete(c)
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  function renderNewInput(stage: StageId | null) {
    if (adding !== stage) return null
    return (
      <input
        autoFocus
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onBlur={submitNew}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submitNew()
          if (e.key === 'Escape') {
            setAdding(false)
            setNewName('')
          }
        }}
        placeholder={t('步骤名称…')}
        className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-[10px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-focus"
      />
    )
  }

  const legacySteps = stepsOf(categories, null)

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
          <div className="truncate text-[11px] leading-tight text-faint">{t('高级 · 全部 Prompt')}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pt-3 pb-2">
        <NavItem icon={<Map size={15} />} label={t('回到路线')} active={false} onClick={() => setView('route')} />
        <div className="my-2 border-t border-line" />
        {STAGES.map((stage, i) => {
          const filter = `stage:${stage.id}`
          const active = view === 'library' && categoryFilter === filter
          return (
            <div key={stage.id} className="mb-2">
              <div
                className={`group flex items-center rounded-lg pr-1 ${overId === stage.id ? 'ring-1 ring-brand/50' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragId) setOverId(stage.id)
                }}
                onDragLeave={() => setOverId((id) => (id === stage.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault()
                  void handleDrop(stage.id)
                }}
              >
                <button
                  onClick={() => setCategoryFilter(filter)}
                  title={t(stage.hint)}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                    active ? 'bg-brand/12 font-medium text-brand-text' : 'text-ink hover:bg-surface-2'
                  }`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                      active ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-left">{t(stage.name)}</span>
                  <span className="text-[11px] text-faint">{countForStage(stage.id)}</span>
                </button>
                <button
                  className="ml-0.5 rounded-md p-1 text-faint opacity-0 transition hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => setAdding(stage.id)}
                  title={t('新建步骤')}
                >
                  <Plus size={13} />
                </button>
              </div>
              {stepsOf(categories, stage.id).map(renderStep)}
              {renderNewInput(stage.id)}
            </div>
          )
        })}

        {legacySteps.length > 0 && (
          <div className="mb-2">
            <div
              className={`flex items-center justify-between rounded-lg pr-1 ${overId === 'other' ? 'ring-1 ring-brand/50' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragId) setOverId('other')
              }}
              onDragLeave={() => setOverId((id) => (id === 'other' ? null : id))}
              onDrop={(e) => {
                e.preventDefault()
                void handleDrop(null)
              }}
            >
              <SectionLabel>{t('其他')}</SectionLabel>
              <button
                className="rounded-md p-1 text-faint transition hover:bg-surface-2 hover:text-ink"
                onClick={() => setAdding(null)}
                title={t('新建步骤')}
              >
                <Plus size={13} />
              </button>
            </div>
            {legacySteps.map(renderStep)}
            {renderNewInput(null)}
          </div>
        )}

        <div className="my-2 border-t border-line" />
        <NavItem
          icon={<Star size={15} />}
          label={t('收藏')}
          active={view === 'library' && categoryFilter === 'favorites'}
          count={favCount}
          onClick={() => setCategoryFilter('favorites')}
        />
        <NavItem
          icon={<Layers size={15} />}
          label={t('全部')}
          active={view === 'library' && categoryFilter === 'all'}
          count={prompts.length}
          onClick={() => setCategoryFilter('all')}
        />
        <NavItem
          icon={<Trash2 size={15} />}
          label={t('回收站')}
          active={view === 'trash'}
          count={deletedCount}
          onClick={() => setView('trash')}
        />
      </nav>

      <div className="flex border-t border-line">
        <button
          onClick={() => setView('settings')}
          className={`flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-sm transition ${
            view === 'settings'
              ? 'font-medium text-brand-text'
              : 'text-muted-foreground hover:bg-surface-2 hover:text-ink'
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
          className="relative flex items-center px-4 text-muted-foreground transition hover:bg-surface-2 hover:text-ink"
        >
          <Cloud size={16} />
          {(syncConnected || syncNeedsAttention) && (
            <span
              className={`absolute right-2.5 top-3 h-1.5 w-1.5 rounded-full ${
                syncFailed ? 'bg-error' : 'bg-success'
              }`}
            />
          )}
        </button>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.5px] text-faint">
      {children}
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  count,
  indent,
  onClick
}: {
  icon?: React.ReactNode
  label: string
  active: boolean
  count?: number
  indent?: boolean
  onClick(): void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-2.5 text-sm transition ${
        indent ? 'pl-[38px]' : 'pl-2.5'
      } ${active ? 'bg-brand/12 font-medium text-brand-text' : 'text-muted-foreground hover:bg-surface-2 hover:text-ink'}`}
    >
      {icon && <span className="flex w-4 justify-center text-faint">{icon}</span>}
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && <span className="text-[11px] text-faint">{count}</span>}
    </button>
  )
}
