import { HistoryIcon, TrashIcon } from '../icons'
import { TRASH_TTL_MS } from '@shared/types'
import { useStore } from '../store'
import { formatDate } from '../selectors'
import { toast } from './Toast'
import { useT } from '../i18n'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The trash. Deleting a prompt is now reversible for TRASH_TTL_MS; this is where
 * it can be undone after the toast is gone. Purging is the only irreversible
 * action here, so both purge paths confirm first.
 */
export function TrashView(): React.JSX.Element {
  const t = useT()
  const deleted = useStore((s) => s.deletedPrompts)
  const restoreDeleted = useStore((s) => s.restoreDeleted)
  const bulkRestoreDeleted = useStore((s) => s.bulkRestoreDeleted)
  const purgePrompt = useStore((s) => s.purgePrompt)
  const purgeAllDeleted = useStore((s) => s.purgeAllDeleted)
  const select = useStore((s) => s.select)

  const days = Math.round(TRASH_TTL_MS / DAY_MS)

  function daysLeft(deletedAt: number): number {
    return Math.max(0, Math.ceil((deletedAt + TRASH_TTL_MS - Date.now()) / DAY_MS))
  }

  /**
   * Restoring empties the row out of the page the user is standing on, with no
   * hint of where it went. The action jumps straight to it in the library.
   */
  async function handleRestore(id: string, title: string) {
    await restoreDeleted(id)
    toast.action(t('已恢复「{title}」', { title }), t('查看'), () => select(id))
  }

  async function handleRestoreAll() {
    const n = deleted.length
    await bulkRestoreDeleted(deleted.map((p) => p.id))
    toast.success(t('已恢复 {n} 条', { n }))
  }

  async function handlePurge(id: string, title: string) {
    if (!confirm(t('永久删除「{title}」？此操作不可撤销。', { title }))) return
    await purgePrompt(id)
    toast.info(t('已永久删除'))
  }

  async function handlePurgeAll() {
    if (!confirm(t('清空回收站？其中 {n} 条 Prompt 将被永久删除，不可撤销。', { n: deleted.length })))
      return
    const n = await purgeAllDeleted()
    toast.info(t('已永久删除 {n} 条', { n }))
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-8 py-10">
        <div className="mb-2 flex items-center gap-2">
          <TrashIcon className="size-5 text-foreground" />
          <h1 className="font-semibold tracking-tight text-[32px] leading-tight text-foreground">{t('回收站')}</h1>
        </div>
        <p className="mb-6 text-xs text-muted-foreground">
          {t('删除的 Prompt 会在这里保留 {days} 天，之后自动永久删除。', { days })}
        </p>

        {deleted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {t('回收站是空的。')}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('{n} 项', { n: deleted.length })}</span>
              <div className="flex items-center gap-2">
                {/* Recovering a mis-fired bulk delete was 20 individual clicks,
                    while wiping all 20 was one — the destructive path was the
                    cheaper one. */}
                <button
                  onClick={handleRestoreAll}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {t('全部恢复')}
                </button>
                <button
                  onClick={handlePurgeAll}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive"
                >
                  {t('清空回收站')}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {deleted.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  {/* One truncated line is often not enough to tell two similar
                      prompts apart, and there is no preview in here to fall back
                      on before an irreversible purge. */}
                  <div className="min-w-0 flex-1" title={p.content.slice(0, 600)}>
                    <div className="truncate text-sm font-medium text-foreground">{p.title}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {p.description || p.content.slice(0, 80) || t('空内容')}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {t('删除于 {date} · {n} 天后永久删除', {
                        date: formatDate(p.deletedAt ?? 0),
                        n: daysLeft(p.deletedAt ?? 0)
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleRestore(p.id, p.title)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                  >
                    <HistoryIcon className="size-3" />
                    {t('恢复')}
                  </button>
                  <button
                    onClick={() => void handlePurge(p.id, p.title)}
                    title={t('永久删除')}
                    className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground transition hover:border-destructive hover:text-destructive"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
