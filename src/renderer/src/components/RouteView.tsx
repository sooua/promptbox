import { useMemo, useState } from 'react'
import { ArrowRight, Box, Check, Cloud, Copy, Library, RefreshCw, Settings } from 'lucide-react'
import type { Category, Flow, Prompt } from '@shared/types'
import { STAGES, STAGE_COLORS, TRACKS } from '@shared/types'
import { fillTemplate, missingRequired } from '@shared/variables'
import { useStore } from '../store'
import { routePrompt, routeSteps } from '../selectors'
import { VariableInput, initialValue } from './VariableInput'
import { toast } from './Toast'
import { TitleBar } from './TitleBar'
import { useT } from '../i18n'

const isMac = window.api.platform === 'darwin'

/**
 * The route: a fixed sequence of steps down the left, and only the current
 * step's card on the right. The user never picks a prompt — they copy the one
 * for the step they're on and press "下一步".
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

  if (!cur) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-faint">
        {t('还没有任何步骤。去「全部 Prompt」里给某个阶段新建一个步骤。')}
      </div>
    )
  }

  const idx = steps.indexOf(cur)
  const stage = STAGES.find((s) => s.id === cur.stage)!
  const isLast = idx === steps.length - 1
  const buildSteps = steps.filter((s) => s.stage === 'build')
  const loopEnd = stage.loop && cur === buildSteps[buildSteps.length - 1]

  function finish() {
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

  let n = 0
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-canvas">
        <div className={`app-drag flex h-14 shrink-0 items-center gap-2.5 border-b border-line ${isMac ? 'pl-[78px] pr-4' : 'px-5'}`}>
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
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 pt-3 pb-2">
          {STAGES.map((st) => {
            const mine = steps.filter((s) => s.stage === st.id)
            if (!mine.length) return null
            const color = STAGE_COLORS[st.id]
            return (
              <div key={st.id} className="mb-2.5">
                <div className="flex items-center gap-2 px-2 pb-1 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-serif text-[13px] text-ink">{t(st.name)}</span>
                  {st.loop && (
                    <span className="ml-auto text-[11px] text-faint">
                      ↻ {route.feature > 1 ? t('第 {n} 个', { n: route.feature }) : t('每个功能一轮')}
                    </span>
                  )}
                </div>
                {mine.map((s) => {
                  n++
                  const isDone = done.has(s.id)
                  const isCur = s.id === cur.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setRoute({ cur: s.id })}
                      aria-current={isCur ? 'step' : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm transition ${
                        isCur ? 'font-medium text-ink' : isDone ? 'text-faint' : 'text-muted hover:bg-surface-2'
                      }`}
                      style={isCur ? { background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
                    >
                      <span
                        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11px] tabular-nums"
                        style={
                          isDone
                            ? { background: color, borderColor: color, color: 'var(--color-on-brand)' }
                            : isCur
                              ? { borderColor: color, color, borderWidth: 2 }
                              : { borderColor: 'var(--color-line-strong)', color: 'var(--color-faint)' }
                        }
                      >
                        {isDone ? <Check size={12} /> : n}
                      </span>
                      <span className="flex-1 truncate">{s.name}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="flex flex-col border-t border-line p-2 text-sm">
          <RailButton icon={<RefreshCw size={14} />} onClick={() => setView('choose')}>
            {t('换项目类型')}
          </RailButton>
          <RailButton icon={<Library size={14} />} onClick={() => setView('library')}>
            {t('高级 · 全部 Prompt')}
          </RailButton>
          <div className="flex">
            <RailButton icon={<Settings size={14} />} onClick={() => setView('settings')}>
              {t('设置')}
            </RailButton>
            <button onClick={openCloud} title={t('云同步')} className="rounded-lg px-3 text-muted transition hover:bg-surface-2 hover:text-ink">
              <Cloud size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex gap-1.5 px-9 pt-4">
          {STAGES.filter((st) => steps.some((s) => s.stage === st.id)).map((st) => {
            const mine = steps.filter((s) => s.stage === st.id)
            const pct = Math.round((mine.filter((s) => done.has(s.id)).length / mine.length) * 100)
            return (
              <span key={st.id} className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-2" title={t(st.name)}>
                <span className="absolute inset-y-0 left-0 transition-all" style={{ width: `${pct}%`, background: STAGE_COLORS[st.id] }} />
              </span>
            )
          })}
        </div>

        <StepCard
          key={cur.id + (route.track ?? '')}
          step={cur}
          stage={stage}
          index={idx}
          total={steps.length}
          feature={route.feature}
          flow={route.flow}
          prompt={routePrompt(prompts, cur.id, route.track)}
          isDone={done.has(cur.id)}
          isLast={isLast}
          loopEnd={!!loopEnd}
          onFinish={finish}
          onAgain={again}
        />
        </div>
      </div>
    </div>
  )
}

function StepCard({
  step,
  stage,
  index,
  total,
  feature,
  flow,
  prompt,
  isDone,
  isLast,
  loopEnd,
  onFinish,
  onAgain
}: {
  step: Category
  stage: (typeof STAGES)[number]
  index: number
  total: number
  feature: number
  flow: Flow
  prompt: Prompt | undefined
  isDone: boolean
  isLast: boolean
  loopEnd: boolean
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
    toast.success(t('已复制，去 Claude Code 里粘贴'))
  }

  return (
    <div className="flex max-w-[760px] flex-1 flex-col gap-4 px-9 pb-6 pt-7">
      <div className="flex items-center gap-2.5 text-xs text-faint">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {t(stage.name)} · {t('第 {n} 步 / 共 {total} 步', { n: index + 1, total })}
        {stage.loop && feature > 1 ? ` · ${t('第 {n} 个功能', { n: feature })}` : ''}
      </div>
      <h2 className="font-serif text-[28px] leading-tight text-ink">{step.name}</h2>
      {step.hint && <p className="max-w-[40em] text-sm text-muted">{step.hint}</p>}

      {index === 0 && !copiedOnce && (
        <ol className="list-decimal space-y-0.5 rounded-xl border border-line-strong bg-surface px-4 py-3 pl-8 text-xs text-muted">
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

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={copy}
          disabled={!prompt}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-on-brand transition hover:bg-brand-strong disabled:opacity-40"
        >
          <Copy size={15} />
          {t('复制，去 Claude Code 里粘贴')}
          {prompt?.variables.length ? <span className="font-mono text-[11px] opacity-75">⌘↵</span> : null}
        </button>
        {loopEnd && (
          <button
            onClick={onAgain}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm text-ink transition hover:border-ring"
          >
            <RefreshCw size={14} />
            {t('再做一个功能')}
          </button>
        )}
        <button
          onClick={onFinish}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm text-ink transition hover:border-ring"
        >
          {isDone ? t('下一步') : isLast ? t('完成') : t('完成，下一步')}
          {isLast && !isDone ? <Check size={14} /> : <ArrowRight size={14} />}
        </button>
      </div>

      {step.output && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-faint">
          {t('这一步的产物')} →
          <code className="rounded-md bg-surface-2 px-1.5 py-px font-mono text-[11.5px] text-ink">{step.output}</code>
          {!isLast && <span>· {t('下一步会读它')}</span>}
        </div>
      )}

      {prompt && (
        <details className="mt-auto border-t border-line pt-3">
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

function RailButton({
  icon,
  onClick,
  children
}: {
  icon: React.ReactNode
  onClick(): void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      {icon}
      {children}
    </button>
  )
}
