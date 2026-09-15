import { useState } from 'react'
import { CloudIcon, DragIcon, LayersIcon, PencilIcon, PlusIcon, RouteIcon, SettingsIcon, StarIcon, TrashIcon } from '../icons'
import type { Category, StageId } from '@shared/types'
import { STAGES, STAGE_COLORS } from '@shared/types'
import { moveStep } from '@shared/steps'
import { useStore, type CategoryFilter } from '../store'
import { stepsOf } from '../selectors'
import { toast } from './Toast'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'

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
          className="mx-2 my-0.5 w-[calc(100%-1rem)] rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus:border-ring"
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
          overId === c.id ? 'ring-1 ring-ring' : ''
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
          <span className="cursor-grab text-muted-foreground active:cursor-grabbing" title={t('拖拽排序')}>
            <DragIcon className="size-3.5" />
          </span>
          <button
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            title={t('重命名步骤')}
            onClick={(e) => {
              e.stopPropagation()
              startRename(c)
            }}
          >
            <PencilIcon className="size-3.5" />
          </button>
          <button
            className="rounded p-1 text-muted-foreground hover:text-destructive"
            title={t('删除步骤')}
            onClick={(e) => {
              e.stopPropagation()
              void handleDelete(c)
            }}
          >
            <TrashIcon className="size-3.5" />
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
        className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring"
      />
    )
  }

  const legacySteps = stepsOf(categories, null)

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-background">
      {/* macOS draws its traffic lights over the top-left of the window, exactly
          where the logo square would sit. There we drop the square and indent
          past the buttons (see trafficLightPosition in main), keeping only the
          wordmark. */}
      <div
        className={`app-drag flex h-14 shrink-0 items-center gap-2.5 border-b border-border ${
          isMac ? 'pl-[78px] pr-4' : 'px-5'
        }`}
      >
        <div className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">PromptBox</div>
      </div>

      <nav className="flex-1 overflow-y-auto border-r border-border px-2.5 pt-3 pb-2">
        <Button variant="outline" className="mb-3 w-full justify-start" onClick={() => setView('route')}>
          <RouteIcon />
          {t('回到路线')}
        </Button>
        {STAGES.map((stage, i) => {
          const filter = `stage:${stage.id}`
          const active = view === 'library' && categoryFilter === filter
          return (
            <div key={stage.id} className="mb-2">
              <div
                className={`group flex items-center rounded-lg pr-1 ${overId === stage.id ? 'ring-1 ring-ring' : ''}`}
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
                    active ? 'bg-accent font-medium text-foreground' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-left">{t(stage.name)}</span>
                  <span className="text-[11px] text-muted-foreground">{countForStage(stage.id)}</span>
                </button>
                <button
                  className="ml-0.5 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => setAdding(stage.id)}
                  title={t('新建步骤')}
                >
                  <PlusIcon className="size-3.5" />
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
              className={`flex items-center justify-between rounded-lg pr-1 ${overId === 'other' ? 'ring-1 ring-ring' : ''}`}
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
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => setAdding(null)}
                title={t('新建步骤')}
              >
                <PlusIcon className="size-3.5" />
              </button>
            </div>
            {legacySteps.map(renderStep)}
            {renderNewInput(null)}
          </div>
        )}

        <div className="my-2 border-t border-border" />
        <NavItem
          icon={<StarIcon className="size-4" />}
          label={t('收藏')}
          active={view === 'library' && categoryFilter === 'favorites'}
          count={favCount}
          onClick={() => setCategoryFilter('favorites')}
        />
        <NavItem
          icon={<LayersIcon className="size-4" />}
          label={t('全部')}
          active={view === 'library' && categoryFilter === 'all'}
          count={prompts.length}
          onClick={() => setCategoryFilter('all')}
        />
        <NavItem
          icon={<TrashIcon className="size-4" />}
          label={t('回收站')}
          active={view === 'trash'}
          count={deletedCount}
          onClick={() => setView('trash')}
        />
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-r border-border p-2">
        <Button
          variant={view === 'settings' ? 'secondary' : 'ghost'}
          className="w-full justify-start"
          onClick={() => setView('settings')}
        >
          <SettingsIcon />
          {t('设置')}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
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
        >
          <CloudIcon />
          {t('云同步')}
          {(syncConnected || syncNeedsAttention) && (
            <span className={`ml-auto h-1.5 w-1.5 rounded-full ${syncFailed ? 'bg-destructive' : 'bg-success'}`} />
          )}
        </Button>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
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
      } ${active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
    >
      {icon && <span className="flex w-4 justify-center text-muted-foreground">{icon}</span>}
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && <span className="text-[11px] text-muted-foreground group-hover:invisible">{count}</span>}
    </button>
  )
}
