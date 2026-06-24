import { useState } from 'react'
import { GitCompare, History, RotateCcw } from 'lucide-react'
import type { Prompt } from '@shared/types'
import { useStore } from '../store'
import { formatDate } from '../selectors'
import { DiffView } from './DiffView'
import { toast } from './Toast'

export function VersionHistory({ prompt }: { prompt: Prompt }): React.JSX.Element {
  const restoreVersion = useStore((s) => s.restoreVersion)
  const [diffId, setDiffId] = useState<string | null>(null)

  if (prompt.versions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-faint">
        暂无历史版本。每次修改内容后会自动保存上一版本。
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <History size={14} />
        历史版本（{prompt.versions.length}）
      </div>
      {prompt.versions.map((v) => (
        <div key={v.id} className="rounded-xl border border-line-strong bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-medium text-ink">{v.title}</span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setDiffId(diffId === v.id ? null : v.id)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] transition ${
                  diffId === v.id
                    ? 'border-brand text-brand'
                    : 'border-line-strong text-muted hover:border-brand hover:text-brand'
                }`}
              >
                <GitCompare size={11} />
                改动
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`恢复到 ${formatDate(v.createdAt)} 的版本？当前内容会存入历史。`)) return
                  await restoreVersion(prompt.id, v.id)
                  toast.success('已恢复到该版本')
                }}
                className="flex items-center gap-1 rounded-lg border border-line-strong px-2 py-0.5 text-[11px] text-muted transition hover:border-brand hover:text-brand"
              >
                <RotateCcw size={11} />
                恢复
              </button>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-faint">{formatDate(v.createdAt)}</div>
          {diffId === v.id ? (
            <div className="mt-2">
              <DiffView previous={v.content} current={prompt.content} />
            </div>
          ) : (
            <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-[11px] text-muted">
              {v.content.slice(0, 220) || '（空）'}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
