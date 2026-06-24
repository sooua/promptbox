import { useMemo } from 'react'
import { diffLines, diffStat } from '../diff'

/** Renders a compact line-level diff from `previous` → `current`. */
export function DiffView({
  previous,
  current
}: {
  previous: string
  current: string
}): React.JSX.Element {
  const ops = useMemo(() => diffLines(previous, current), [previous, current])
  const stat = useMemo(() => diffStat(ops), [ops])

  if (stat.added === 0 && stat.removed === 0) {
    return <div className="px-1 py-2 text-[11px] text-faint">与当前内容相同。</div>
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[10px] text-faint">
        <span className="text-emerald-600">+{stat.added}</span>
        <span className="text-rose-500">−{stat.removed}</span>
        <span>相对当前内容</span>
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg border border-line bg-canvas p-2 font-mono text-[11px] leading-relaxed">
        {ops.map((op, i) => (
          <div
            key={i}
            className={
              op.type === 'add'
                ? 'bg-emerald-500/10 text-emerald-700'
                : op.type === 'del'
                  ? 'bg-rose-500/10 text-rose-600'
                  : 'text-muted'
            }
          >
            <span className="select-none opacity-60">
              {op.type === 'add' ? '+ ' : op.type === 'del' ? '− ' : '  '}
            </span>
            {op.text || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}
