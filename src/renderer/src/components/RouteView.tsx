import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Box, Check, Cloud, Copy, Library, RefreshCw, Settings } from 'lucide-react'
import type { Category, Flow, Prompt, StageInfo } from '@shared/types'
import { STAGES, STAGE_COLORS, TRACKS } from '@shared/types'
import { fillTemplate, missingRequired } from '@shared/variables'
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
    <div className="flex min-w-0 flex-1 flex-col">
      <header
        className={`app-drag flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-canvas ${
          isMac ? 'pl-[78px] pr-4' : 'pl-5 pr-[150px]'
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
            {t(track.name)} · {route.flow === 'fresh' ? t('从零开始') : t('已有代码')}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-0.5 text-xs text-muted">
          <HeaderButton icon={<RefreshCw size={13} />} onClick={() => setView('choose')} label={t('换项目类型')} />
          <HeaderButton icon={<Library size={13} />} onClick={() => setView('library')} label={t('高级 · 全部 Prompt')} />
          <HeaderButton icon={<Settings size={13} />} onClick={() => setView('settings')} label={t('设置')} />
          <HeaderButton icon={<Cloud size={13} />} onClick={openCloud} label={t('云同步')} iconOnly />
        </div>
      </header>

      {!cur || !stage ? (
        <div className="flex flex-1 items-center justify-center text-sm text-faint">
          {t('还没有任何步骤。去「全部 Prompt」里给某个阶段新建一个步骤。')}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8 px-6 pb-10 pt-8">
            <Stepper steps={steps} cur={cur} done={done} feature={route.feature} onJump={(id) => setRoute({ cur: id })} />
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
 * Five dots for the five stages. The current one is coloured, finished ones are
 * ticked, the rest are outlines — enough to know where you are without listing
 * every step. Finished stages can be clicked to go back to their first step.
 */
function Stepper({
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
    <ol className="flex items-start" aria-label={t('阶段')}>
      {stages.map((st, i) => {
        const mine = steps.filter((s) => s.stage === st.id)
        const isCur = i === curIdx
        const reached = i < curIdx || mine.every((s) => done.has(s.id))
        const color = STAGE_COLORS[st.id]
        const line = (on: boolean) => ({ background: on ? color : 'var(--color-line-strong)' })
        return (
          <li key={st.id} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-center">
              <span className={`h-px flex-1 ${i === 0 ? 'invisible' : ''}`} style={line(reached || isCur)} />
              <button
                onClick={() => reached && onJump(mine[0].id)}
                disabled={!reached}
                aria-current={isCur ? 'step' : undefined}
                title={t(st.hint)}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[12px] font-medium tabular-nums transition ${
                  isCur ? 'route-pop' : ''
                } ${reached ? 'cursor-pointer' : 'cursor-default'}`}
                style={
                  reached
                    ? { background: color, borderColor: color, color: 'var(--color-on-brand)' }
                    : isCur
                      ? { borderColor: color, color, background: 'var(--color-surface)' }
                      : { borderColor: 'var(--color-line-strong)', color: 'var(--color-faint)' }
                }
              >
                {reached ? <Check size={13} /> : i + 1}
              </button>
              <span className={`h-px flex-1 ${i === stages.length - 1 ? 'invisible' : ''}`} style={line(reached)} />
            </div>
            <span className={`text-center text-xs ${isCur ? 'font-medium text-ink' : reached ? 'text-muted' : 'text-faint'}`}>
              {t(st.name)}
              {st.loop && isCur && feature > 1 ? (
                <span className="block text-[10px] text-faint">{t('第 {n} 个功能', { n: feature })}</span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ol>
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
  const color = STAGE_COLORS[stage.id]

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
    <div className="route-card-in flex flex-col gap-5 rounded-2xl border border-line-strong bg-surface px-8 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div>
        <div className="flex items-center gap-2.5 text-xs text-faint">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          {t(stage.name)} · {t('第 {n} 步 / 共 {total} 步', { n: index + 1, total })}
        </div>
        <h2 className="mt-2 font-serif text-[28px] leading-tight text-ink">{step.name}</h2>
        {step.hint && <p className="mt-2 max-w-[40em] text-sm text-muted">{step.hint}</p>}
      </div>

      {index === 0 && !copiedOnce && (
        <ol className="list-decimal space-y-0.5 rounded-xl bg-canvas px-4 py-3 pl-8 text-xs text-muted">
          <li>{flow === 'fresh' ? t('新建一个空文件夹，作为这个项目的家') : t('找到你的项目文件夹')}</li>
          <li>{t('在这个文件夹里打开 Claude Code（或 Cursor）')}</li>
          <li>{t('把下面复制的内容粘贴进去，按回车')}</li>
        </ol>
      )}

      {!prompt ? (
        <div className="rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-xs text-faint">
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
              <label className="mb-1.5 block text-xs text-muted">{v.label || v.name}</label>
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
        <div className="rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-xs text-faint">
          {t('这一步不用你输入。AI 会读上一步写下的文件。')}
        </div>
      )}

      <button
        onClick={copy}
        disabled={!prompt}
        aria-live="polite"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-[15px] font-medium text-on-brand transition hover:bg-brand-strong active:scale-[0.98] disabled:opacity-40"
      >
        {copied ? (
          <>
            <Check size={16} className="route-pop" />
            {t('已复制，去 Claude Code 里粘贴')}
          </>
        ) : (
          <>
            <Copy size={15} />
            {t('复制，去 Claude Code 里粘贴')}
            {prompt?.variables.length ? <span className="font-mono text-[11px] opacity-75">⌘↵</span> : null}
          </>
        )}
      </button>

      {step.output && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-faint">
          {t('这一步的产物')} →
          <code className="rounded-md bg-surface-2 px-1.5 py-px font-mono text-[11.5px] text-ink">{step.output}</code>
          {!isLast && <span>· {t('下一步会读它')}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition hover:text-ink"
          >
            <ArrowLeft size={14} />
            {t('上一步')}
          </button>
        )}
        {loopEnd && (
          <button
            onClick={onAgain}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-canvas px-4 py-2.5 text-sm text-ink transition hover:border-ring"
          >
            <RefreshCw size={14} />
            {t('再做一个功能')}
          </button>
        )}
        <button
          onClick={onFinish}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-line-strong bg-canvas px-4 py-2.5 text-sm text-ink transition hover:border-ring"
        >
          {isDone ? t('下一步') : isLast ? t('完成') : t('完成，下一步')}
          {isLast && !isDone ? <Check size={14} /> : <ArrowRight size={14} />}
        </button>
      </div>

      {prompt && (
        <details className="-mb-2">
          <summary className="cursor-pointer text-xs text-muted">
            {t('看这条 Prompt')}
            <button
              onClick={(e) => {
                e.preventDefault()
                select(prompt.id)
              }}
              className="ml-2 text-brand-text hover:underline"
            >
              {t('去改')}
            </button>
          </summary>
          <pre className="mt-2.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-canvas px-4 py-3.5 font-mono text-xs leading-relaxed text-muted">
            {prompt.content}
          </pre>
        </details>
      )}
    </div>
  )
}

function HeaderButton({
  icon,
  label,
  onClick,
  iconOnly
}: {
  icon: React.ReactNode
  label: string
  onClick(): void
  iconOnly?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-2 hover:text-ink"
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  )
}
