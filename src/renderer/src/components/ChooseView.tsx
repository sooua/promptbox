import { useState } from 'react'
import type { Flow, TrackId } from '@shared/types'
import { TRACKS } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StaggeredText from '@/components/react-bits/staggered-text'
import { CliIcon, DeskIcon, MobileIcon, OtherIcon, WebIcon } from '../icons'
import { useStore } from '../store'
import { routeSteps } from '../selectors'
import { useT } from '../i18n'

const ICONS: Record<TrackId, React.ComponentType<{ className?: string }>> = {
  web: WebIcon,
  cli: CliIcon,
  desk: DeskIcon,
  mobile: MobileIcon,
  other: OtherIcon
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
    <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto bg-background px-6 py-12 text-center">
      <div className="route-card-in">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('开始之前，只问一个问题')}</div>
        <StaggeredText
          as="h1"
          text={t('你要做的是什么？')}
          segmentBy="chars"
          delay={35}
          duration={0.5}
          direction="bottom"
          className="mt-3 text-3xl font-semibold tracking-tight text-foreground"
        />
        <p className="mx-auto mt-3 max-w-[34em] text-sm text-muted-foreground">
          {t('选一个，后面的每一步都为它准备好了。不用再挑 Prompt。')}
        </p>
      </div>

      <div className="grid w-full max-w-[880px] grid-cols-2 gap-3 md:grid-cols-5" role="radiogroup" aria-label={t('项目类型')}>
        {TRACKS.map((x, i) => {
          const on = track === x.id
          const Icon = ICONS[x.id]
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTrack(x.id)}
              style={{ animationDelay: `${60 + i * 40}ms` }}
              className={`route-card-in flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all outline-none hover:-translate-y-px hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 ${
                on ? 'border-primary bg-accent/40 ring-1 ring-primary' : 'border-border hover:border-ring'
              }`}
            >
              <span
                className={`grid size-10 place-items-center rounded-lg transition-colors ${
                  on ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                <Icon className="size-5" />
              </span>
              <span className="text-[15px] font-medium text-foreground">{t(x.name)}</span>
              <span className="text-xs leading-snug text-muted-foreground">{t(x.desc)}</span>
            </button>
          )
        })}
      </div>

      <div className="route-card-in" style={{ animationDelay: '260ms' }}>
        <Tabs value={flow} onValueChange={(v) => setFlow(v as Flow)}>
          <TabsList aria-label={t('起点')}>
            <TabsTrigger value="fresh">{t('从零开始')}</TabsTrigger>
            <TabsTrigger value="existing">{t('我有现成代码')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-2.5 text-xs text-muted-foreground">
          {flow === 'fresh' ? t('从想法开始，一步一步到上线。') : t('跳过想法和搭建，先读懂代码，然后一个功能一个功能做。')}
        </div>
      </div>

      <div className="route-card-in flex flex-wrap items-center justify-center gap-2.5" style={{ animationDelay: '320ms' }}>
        {canResume ? (
          <>
            <Button size="lg" onClick={() => start(false)}>
              {t('继续上次（第 {n} 步）', { n: Math.max(resumeStep, 0) + 1 })}
            </Button>
            <Button size="lg" variant="outline" onClick={() => start(true)}>
              {t('重新开始')}
            </Button>
          </>
        ) : (
          <Button size="lg" disabled={!track} onClick={() => start(true)} className="min-w-40">
            {t('开始')}
          </Button>
        )}
      </div>
    </div>
  )
}
