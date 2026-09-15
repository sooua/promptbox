import { useState } from 'react'
import { AppWindow, Boxes, Globe, Smartphone, TerminalSquare } from 'lucide-react'
import type { Flow, TrackId } from '@shared/types'
import { TRACKS } from '@shared/types'
import { useStore } from '../store'
import { routeSteps } from '../selectors'
import { useT } from '../i18n'

const ICONS: Record<TrackId, React.ReactNode> = {
  web: <Globe size={18} />,
  cli: <TerminalSquare size={18} />,
  desk: <AppWindow size={18} />,
  mobile: <Smartphone size={18} />,
  other: <Boxes size={18} />
}

/**
 * The one choice a beginner makes: what they are building, and whether they
 * start from nothing or from an existing codebase. Everything after this is a
 * fixed sequence.
 */
export function ChooseView(): React.JSX.Element {
  const t = useT()
  const route = useStore((s) => s.route)
  const setRoute = useStore((s) => s.setRoute)
  const setView = useStore((s) => s.setView)
  const categories = useStore((s) => s.categories)
  const [track, setTrack] = useState<TrackId | null>(route.track)
  const [flow, setFlow] = useState<Flow>(route.flow)

  const steps = routeSteps(categories, flow)
  // Progress carries over only for the same type and starting point; anything
  // else is a new project. "重新开始" clears it for a second project of the same kind.
  const sameRoute = track === route.track && flow === route.flow
  const resumeStep = sameRoute ? steps.findIndex((s) => s.id === route.cur) : -1
  const canResume = sameRoute && (route.done.length > 0 || resumeStep > 0)

  function start(fresh: boolean) {
    if (!track) return
    const keep = sameRoute && !fresh
    setRoute({
      track,
      flow,
      cur: keep && resumeStep >= 0 ? route.cur : (steps[0]?.id ?? null),
      done: keep ? route.done : [],
      feature: keep ? route.feature : 1
    })
    setView('route')
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 overflow-y-auto bg-canvas px-6 py-12 text-center">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{t('开始之前，只问一个问题')}</div>
        <h1 className="mt-2.5 font-serif text-[30px] leading-tight text-ink">{t('你要做的是什么？')}</h1>
        <p className="mx-auto mt-2.5 max-w-[34em] text-sm text-muted">
          {t('选一个，后面的每一步都为它准备好了。不用再挑 Prompt。')}
        </p>
      </div>

      <div className="grid w-full max-w-[860px] grid-cols-2 gap-3 md:grid-cols-5" role="group" aria-label={t('项目类型')}>
        {TRACKS.map((x) => {
          const on = track === x.id
          return (
            <button
              key={x.id}
              aria-pressed={on}
              onClick={() => setTrack(x.id)}
              className={`flex flex-col gap-2 rounded-2xl border bg-surface p-4 text-left transition hover:-translate-y-px ${
                on ? 'border-brand shadow-[inset_0_0_0_1px_var(--color-brand)]' : 'border-line-strong hover:border-ring'
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-[10px] ${
                  on ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink'
                }`}
              >
                {ICONS[x.id]}
              </span>
              <span className="font-serif text-[15px] text-ink">{t(x.name)}</span>
              <span className="text-xs leading-snug text-faint">{t(x.desc)}</span>
            </button>
          )
        })}
      </div>

      <div>
        <div className="inline-flex rounded-full border border-line-strong bg-canvas p-[3px]" role="group" aria-label={t('起点')}>
          {(
            [
              ['fresh', t('从零开始')],
              ['existing', t('我有现成代码')]
            ] as [Flow, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              aria-pressed={flow === f}
              onClick={() => setFlow(f)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                flow === f ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-faint">
          {flow === 'fresh'
            ? t('从想法开始，一步一步到上线。')
            : t('跳过想法和搭建，先读懂代码，然后一个功能一个功能做。')}
        </div>
      </div>

      {canResume ? (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => start(false)}
            className="rounded-xl bg-brand px-6 py-3 text-[15px] font-medium text-on-brand transition hover:bg-brand-strong"
          >
            {t('继续上次（第 {n} 步）→', { n: Math.max(resumeStep, 0) + 1 })}
          </button>
          <button
            onClick={() => start(true)}
            className="rounded-xl border border-line-strong bg-surface px-5 py-3 text-[15px] text-muted transition hover:border-ring hover:text-ink"
          >
            {t('重新开始')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => start(true)}
          disabled={!track}
          className="rounded-xl bg-brand px-7 py-3 text-[15px] font-medium text-on-brand transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('开始 →')}
        </button>
      )}
    </div>
  )
}
