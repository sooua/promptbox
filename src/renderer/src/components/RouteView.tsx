import { useEffect, useMemo, useState } from 'react'
import type { Category, Flow, Prompt, StageInfo } from '@shared/types'
import { STAGES, TRACKS } from '@shared/types'
import { fillTemplate, missingRequired } from '@shared/variables'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Frame, FramePanel } from '@/components/reui/frame'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger
} from '@/components/reui/stepper'
import { BookIcon, CheckIcon, CloudIcon, CopyIcon, CopySuccessIcon, RefreshIcon, SettingsIcon } from '../icons'
import { useStore } from '../store'
import { routePrompt, routeSteps } from '../selectors'
import { VariableInput, initialValue } from './VariableInput'
import { toast } from './Toast'
import { useT } from '../i18n'

const isMac = window.api.platform === 'darwin'

/**
 * The route, one step at a time — the same single-column, centred shape as the
 * choose screen so a beginner never sees a list to pick from. Orientation comes
 * from the stage stepper on top; everything else on screen belongs to the
 * current step.
 */
export function RouteView(): React.JSX.Element {
  const t = useT()
  const route = useStore((s) => s.route)
  const setRoute = useStore((s) => s.setRoute)
  const setView = useStore((s) => s.setView)
  const openCloud = useStore((s) => s.openCloud)
  const categories = useStore((s) => s.categories)
  const prompts = useStore((s) => s.prompts)

  const steps = useMemo(() => routeSteps(categories, route.flow), [categories, route.flow])
  const cur = steps.find((s) => s.id === route.cur) ?? steps[0]
  const track = TRACKS.find((x) => x.id === route.track) ?? TRACKS[TRACKS.length - 1]
  const done = new Set(route.done)

  const idx = cur ? steps.indexOf(cur) : -1
  const stage = cur ? STAGES.find((s) => s.id === cur.stage)! : null
  const isLast = idx === steps.length - 1
  const buildSteps = steps.filter((s) => s.stage === 'build')
  const loopEnd = !!stage?.loop && cur === buildSteps[buildSteps.length - 1]

  function finish() {
    if (!cur) return
    const next = isLast ? cur.id : steps[idx + 1].id
    setRoute({ done: [...new Set([...route.done, cur.id])], cur: next })
    if (isLast) toast.success(t('这一轮走完了。可以「再做一个功能」，或换个项目。'))
  }

  function again() {
    const ids = new Set(buildSteps.map((s) => s.id))
    setRoute({
      done: route.done.filter((id) => !ids.has(id)),
      cur: buildSteps[0].id,
      feature: route.feature + 1
    })
    toast.info(t('开始第 {n} 个功能', { n: route.feature + 1 }))
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <header
        className={`app-drag flex h-14 shrink-0 items-center gap-3 border-b border-border ${
          isMac ? 'pl-[78px] pr-4' : 'pl-5 pr-[150px]'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">PromptBox</div>
          <div className="truncate text-[11px] leading-tight text-muted-foreground">
            {t(track.name)}，{route.flow === 'fresh' ? t('从零开始') : t('已有代码')}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setView('choose')}>
            <RefreshIcon />
            {t('换项目类型')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView('library')}>
            <BookIcon />
            {t('全部 Prompt')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView('settings')}>
            <SettingsIcon />
            {t('设置')}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={openCloud} title={t('云同步')}>
            <CloudIcon />
          </Button>
        </div>
      </header>

      {!cur || !stage ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('还没有任何步骤。去「全部 Prompt」里给某个阶段新建一个步骤。')}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 pb-10 pt-8">
            <StageStepper steps={steps} cur={cur} done={done} feature={route.feature} onJump={(id) => setRoute({ cur: id })} />
            <StepCard
              key={cur.id + (route.track ?? '')}
              step={cur}
              stage={stage}
              index={idx}
              total={steps.length}
              flow={route.flow}
              prompt={routePrompt(prompts, cur.id, route.track)}
              isDone={done.has(cur.id)}
              isLast={isLast}
              loopEnd={loopEnd}
              onBack={idx > 0 ? () => setRoute({ cur: steps[idx - 1].id }) : undefined}
              onFinish={finish}
              onAgain={again}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One dot per stage on a ReUI Stepper. Finished stages are ticked and can be
 * clicked to go back to their first step; upcoming ones are inert.
 */
function StageStepper({
  steps,
  cur,
  done,
  feature,
  onJump
}: {
  steps: Category[]
  cur: Category
  done: Set<string>
  feature: number
  onJump(stepId: string): void
}): React.JSX.Element {
  const t = useT()
  const stages = STAGES.filter((st) => steps.some((s) => s.stage === st.id))
  const curIdx = stages.findIndex((st) => st.id === cur.stage)
  return (
    <Stepper
      value={curIdx + 1}
      onValueChange={(n) => {
        const st = stages[n - 1]
        const first = steps.find((s) => s.stage === st?.id)
        if (first && n - 1 <= curIdx) onJump(first.id)
      }}
      indicators={{ completed: <CheckIcon className="size-3.5" /> }}
    >
      <StepperNav>
        {stages.map((st, i) => {
          const mine = steps.filter((s) => s.stage === st.id)
          const finished = mine.every((s) => done.has(s.id))
          return (
            <StepperItem
              key={st.id}
              step={i + 1}
              completed={finished}
              disabled={i > curIdx && !finished}
            >
              <StepperTrigger className="flex flex-col items-center gap-2 px-1 text-center">
                <StepperIndicator className="size-7 text-xs font-medium data-[state=active]:ring-4 data-[state=active]:ring-primary/20">
                  {i + 1}
                </StepperIndicator>
                <StepperTitle className="text-xs font-medium text-muted-foreground group-data-[state=active]/step:text-foreground">
                  {t(st.name)}
                  {st.loop && i === curIdx && feature > 1 ? (
                    <span className="block text-[10px] font-normal text-muted-foreground">{t('第 {n} 个功能', { n: feature })}</span>
                  ) : null}
                </StepperTitle>
              </StepperTrigger>
              {i < stages.length - 1 && (
                <StepperSeparator className="mb-6 group-data-[state=completed]/step:bg-primary" />
              )}
            </StepperItem>
          )
        })}
      </StepperNav>
    </Stepper>
  )
}

function StepCard({
  step,
  stage,
  index,
  total,
  flow,
  prompt,
  isDone,
  isLast,
  loopEnd,
  onBack,
  onFinish,
  onAgain
}: {
  step: Category
  stage: StageInfo
  index: number
  total: number
  flow: Flow
  prompt: Prompt | undefined
  isDone: boolean
  isLast: boolean
  loopEnd: boolean
  onBack?: () => void
  onFinish(): void
  onAgain(): void
}): React.JSX.Element {
  const t = useT()
  const copyResolvedAndUse = useStore((s) => s.copyResolvedAndUse)
  const rememberVarValues = useStore((s) => s.rememberVarValues)
  const select = useStore((s) => s.select)

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const v of prompt?.variables ?? []) init[v.name] = initialValue(v)
    return init
  })
  const [showErrors, setShowErrors] = useState(false)
  // Shown on the very first step until the user has copied once: a beginner
  // has no project folder yet and doesn't know where the text goes.
  const [copiedOnce, setCopiedOnce] = useState(() => localStorage.getItem('promptbox.copiedOnce') === '1')
  // The copy button itself confirms the copy for a moment (tick + label swap)
  // instead of a toast in the corner the eye is not on.
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(id)
  }, [copied])

  const missing = prompt ? missingRequired(prompt.variables, values) : []

  async function copy() {
    if (!prompt) return
    if (missing.length) {
      setShowErrors(true)
      toast.error(t('先填一下上面的输入框'))
      return
    }
    const ok = await copyResolvedAndUse(prompt.id, fillTemplate(prompt.content, values))
    if (!ok) return toast.error(t('复制失败'))
    if (prompt.variables.length) void rememberVarValues(prompt.id, values)
    localStorage.setItem('promptbox.copiedOnce', '1')
    setCopiedOnce(true)
    setCopied(true)
  }

  return (
    <Frame className="route-card-in" spacing="lg">
      <FramePanel className="flex flex-col gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge size="sm" variant="primary-light">
              {t(stage.name)}
            </Badge>
            {t('第 {n} 步 / 共 {total} 步', { n: index + 1, total })}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{step.name}</h2>
          {step.hint && <p className="mt-2 max-w-[40em] text-sm text-muted-foreground">{step.hint}</p>}
        </div>

        {index === 0 && !copiedOnce && (
          <Alert variant="info">
            <AlertTitle>{t('第一次用？三步')}</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>{flow === 'fresh' ? t('新建一个空文件夹，作为这个项目的家') : t('找到你的项目文件夹')}</li>
                <li>{t('在这个文件夹里打开 Claude Code（或 Cursor）')}</li>
                <li>{t('把下面复制的内容粘贴进去，按回车')}</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        {!prompt ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            {t('这一步还没有 Prompt。在「全部 Prompt」里给它加一条。')}
          </div>
        ) : prompt.variables.length ? (
          <div
            className="flex flex-col gap-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void copy()
              }
            }}
          >
            {prompt.variables.map((v, i) => (
              <div key={v.name}>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{v.label || v.name}</label>
                <VariableInput
                  variable={v}
                  value={values[v.name] ?? ''}
                  invalid={showErrors && missing.includes(v.name)}
                  onChange={(val) => setValues((s) => ({ ...s, [v.name]: val }))}
                  autoFocus={i === 0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            {t('这一步不用你输入。AI 会读上一步写下的文件。')}
          </div>
        )}

        <Button size="lg" onClick={copy} disabled={!prompt} aria-live="polite" className="h-11 w-full text-[15px]">
          {copied ? (
            <>
              <CopySuccessIcon className="route-pop size-[18px]" />
              {t('已复制，去 Claude Code 里粘贴')}
            </>
          ) : (
            <>
              <CopyIcon className="size-[18px]" />
              {t('复制，去 Claude Code 里粘贴')}
              {prompt?.variables.length ? (
                <Kbd className="ml-1 bg-primary-foreground/15 text-primary-foreground">{isMac ? '⌘' : 'Ctrl'} ↵</Kbd>
              ) : null}
            </>
          )}
        </Button>

        {step.output && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {t('这一步的产物')}
            <code className="rounded-md bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground">{step.output}</code>
            {!isLast && <span>{t('下一步会读它')}</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              {t('上一步')}
            </Button>
          )}
          {loopEnd && (
            <Button variant="outline" onClick={onAgain}>
              <RefreshIcon />
              {t('再做一个功能')}
            </Button>
          )}
          <Button variant="outline" onClick={onFinish} className="ml-auto">
            {isDone ? t('下一步') : isLast ? t('完成') : t('完成，下一步')}
            {isLast && !isDone ? <CheckIcon /> : null}
          </Button>
        </div>

        {prompt && (
          <details className="-mb-2">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              {t('看这条 Prompt')}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  select(prompt.id)
                }}
                className="ml-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('去改')}
              </button>
            </summary>
            <pre className="mt-2.5 max-h-64 overflow-auto rounded-lg border border-border bg-background px-4 py-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {prompt.content}
            </pre>
          </details>
        )}
      </FramePanel>
    </Frame>
  )
}
