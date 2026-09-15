import { useState } from 'react'
import { CompareIcon, HistoryIcon, TrashIcon } from '../icons'
import type { Prompt } from '@shared/types'
import { useStore } from '../store'
import { formatDate } from '../selectors'
import { DiffView } from './DiffView'
import { toast } from './Toast'
import { useT } from '../i18n'

export function VersionHistory({ prompt }: { prompt: Prompt }): React.JSX.Element {
  const restoreVersion = useStore((s) => s.restoreVersion)
  const deleteVersion = useStore((s) => s.deleteVersion)
  const [diffId, setDiffId] = useState<string | null>(null)
  const t = useT()

  if (prompt.versions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
        {t('暂无历史版本。修改后自动留存上一版。')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <HistoryIcon className="size-3.5" />
        {t('历史版本（{n}）', { n: prompt.versions.length })}
      </div>
      {prompt.versions.map((v) => (
        <div key={v.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-medium text-foreground">{v.title}</span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setDiffId(diffId === v.id ? null : v.id)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] transition ${
                  diffId === v.id
                    ? 'border-primary text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
                }`}
              >
                <CompareIcon className="size-3" />
                {t('改动')}
              </button>
              <button
                onClick={async () => {
                  if (!confirm(t('恢复到 {date} 的版本？当前内容会存入历史。', { date: formatDate(v.createdAt) }))) return
                  await restoreVersion(prompt.id, v.id)
                  toast.success(t('已恢复到该版本'))
                }}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                <HistoryIcon className="size-3" />
                {t('恢复')}
              </button>
              <button
                onClick={async () => {
                  // The only copy of that snapshot; there is no undo for it.
                  if (!confirm(t('永久删除 {date} 的历史版本？此操作不可撤销。', { date: formatDate(v.createdAt) })))
                    return
                  if (diffId === v.id) setDiffId(null)
                  await deleteVersion(prompt.id, v.id)
                  toast.success(t('已删除该历史版本'))
                }}
                title={t('删除该版本')}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-destructive hover:text-destructive"
              >
                <TrashIcon className="size-3" />
              </button>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(v.createdAt)}</div>
          {diffId === v.id ? (
            <div className="mt-2">
              <DiffView previous={v.content} current={prompt.content} />
            </div>
          ) : (
            <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
              {v.content.slice(0, 220) || t('（空）')}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
