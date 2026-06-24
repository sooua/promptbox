import { useEffect, useMemo, useState } from 'react'
import { Copy, CornerDownLeft, FileText, Wand2, X } from 'lucide-react'
import { useStore } from '../store'
import { fillTemplate, missingRequired } from '@shared/variables'
import { VariableInput, initialValue } from './VariableInput'
import { toast } from './Toast'

/**
 * Quick-fill-on-copy modal. Opened when a variable-containing prompt is copied
 * from a fast path. Fill the {{variables}}, then copy the resolved result.
 * ⌘/Ctrl+Enter copies the filled version; Esc cancels.
 */
export function QuickFill(): React.JSX.Element | null {
  const id = useStore((s) => s.quickFillPromptId)
  const prompt = useStore((s) => s.prompts.find((p) => p.id === s.quickFillPromptId) ?? null)
  const close = useStore((s) => s.closeQuickFill)
  const copyResolvedAndUse = useStore((s) => s.copyResolvedAndUse)
  const copyAndUse = useStore((s) => s.copyAndUse)
  const rememberVarValues = useStore((s) => s.rememberVarValues)

  const [values, setValues] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!prompt) return
    const init: Record<string, string> = {}
    for (const v of prompt.variables) init[v.name] = initialValue(v)
    setValues(init)
    setShowErrors(false)
  }, [prompt?.id])

  const resolved = useMemo(
    () => (prompt ? fillTemplate(prompt.content, values) : ''),
    [prompt, values]
  )
  const missing = useMemo(
    () => (prompt ? missingRequired(prompt.variables, values) : []),
    [prompt, values]
  )

  if (!id || !prompt) return null

  async function copyFilled() {
    if (missing.length > 0) {
      setShowErrors(true)
      toast.error(`请先填写必填变量：${missing.join('、')}`)
      return
    }
    const ok = await copyResolvedAndUse(prompt!.id, resolved)
    void rememberVarValues(prompt!.id, values)
    close()
    if (ok) toast.success('已复制填充后的 Prompt')
    else toast.error('复制失败')
  }

  async function copyRaw() {
    const ok = await copyAndUse(prompt!.id)
    close()
    if (ok) toast.success('已复制原始模板')
    else toast.error('复制失败')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void copyFilled()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]"
      onClick={close}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line-strong bg-surface shadow-[rgba(0,0,0,0.12)_0px_12px_48px]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <Wand2 size={16} className="text-brand" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-[17px] text-ink">{prompt.title}</div>
            <div className="text-[11px] text-faint">填充变量后复制 · {prompt.variables.length} 个变量</div>
          </div>
          <button onClick={close} className="rounded-lg p-1 text-faint transition hover:bg-surface-2 hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {prompt.variables.map((v, i) => (
              <div key={v.name}>
                <label className="mb-1 block text-xs text-muted">
                  <code className="var-chip">{v.label || v.name}</code>
                  {v.required && <span className="ml-1 text-rose-500" title="必填">*</span>}
                  {v.description && <span className="ml-2 text-faint">{v.description}</span>}
                </label>
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

          <div className="mt-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
              <FileText size={13} />
              预览结果
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-canvas p-3 font-mono text-xs text-ink">
              {resolved}
            </pre>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <button
            onClick={copyRaw}
            className="rounded-xl border border-line-strong px-3 py-1.5 text-sm text-muted transition hover:border-ring hover:text-ink"
          >
            复制原始模板
          </button>
          <span className="ml-auto text-[11px] text-faint">⌘/Ctrl + Enter</span>
          <button
            onClick={copyFilled}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-sm text-[#faf9f5] transition hover:bg-brand-strong"
          >
            <Copy size={14} />
            复制填充结果
            <CornerDownLeft size={13} className="opacity-70" />
          </button>
        </div>
      </div>
    </div>
  )
}
