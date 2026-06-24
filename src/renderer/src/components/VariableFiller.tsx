import { useEffect, useMemo, useState } from 'react'
import { Copy, Settings2, Wand2 } from 'lucide-react'
import type { Prompt, PromptVariable, VariableType } from '@shared/types'
import { fillTemplate, missingRequired } from '@shared/variables'
import { useStore } from '../store'
import { VariableInput, initialValue } from './VariableInput'
import { toast } from './Toast'

const TYPE_LABELS: { value: VariableType; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'multiline', label: '多行' },
  { value: 'select', label: '下拉' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' }
]

export function VariableFiller({ prompt }: { prompt: Prompt }): React.JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const recordUse = useStore((s) => s.recordUse)
  const rememberVarValues = useStore((s) => s.rememberVarValues)
  const updatePrompt = useStore((s) => s.updatePrompt)

  useEffect(() => {
    const init: Record<string, string> = {}
    for (const v of prompt.variables) init[v.name] = initialValue(v)
    setValues(init)
    setShowErrors(false)
  }, [prompt.id, prompt.variables])

  const resolved = useMemo(() => fillTemplate(prompt.content, values), [prompt.content, values])
  const missing = useMemo(() => missingRequired(prompt.variables, values), [prompt.variables, values])

  async function copyResolved() {
    if (missing.length > 0) {
      setShowErrors(true)
      toast.error(`请先填写必填变量：${missing.join('、')}`)
      return
    }
    await navigator.clipboard.writeText(resolved)
    await Promise.all([recordUse(prompt.id), rememberVarValues(prompt.id, values)])
    toast.success('已复制填充后的 Prompt')
  }

  function updateVariable(name: string, patch: Partial<PromptVariable>) {
    const variables = prompt.variables.map((v) => (v.name === name ? { ...v, ...patch } : v))
    void updatePrompt(prompt.id, { variables })
  }

  if (prompt.variables.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-faint">
        暂无变量。在内容里写 <code className="var-chip">{'{{变量名}}'}</code> 即可。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Wand2 size={14} />
        变量填充
      </div>
      {prompt.variables.map((v) => (
        <div key={v.name}>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-muted">
              <code className="var-chip">{v.label || v.name}</code>
              {v.required && <span className="ml-1 text-rose-500" title="必填">*</span>}
              {v.description && <span className="ml-2 text-faint">{v.description}</span>}
            </label>
            <button
              onClick={() => setEditing(editing === v.name ? null : v.name)}
              title="变量设置"
              className={`rounded p-0.5 ${editing === v.name ? 'text-brand' : 'text-faint hover:text-ink'}`}
            >
              <Settings2 size={13} />
            </button>
          </div>

          {editing === v.name && (
            <VariableSettings variable={v} onChange={(patch) => updateVariable(v.name, patch)} />
          )}

          <VariableInput
            variable={v}
            value={values[v.name] ?? ''}
            invalid={showErrors && missing.includes(v.name)}
            onChange={(val) => setValues((s) => ({ ...s, [v.name]: val }))}
          />
        </div>
      ))}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">预览结果</span>
          <button
            onClick={copyResolved}
            className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs text-[#faf9f5] transition hover:bg-brand-strong"
          >
            <Copy size={12} />
            复制结果
          </button>
        </div>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-line-strong bg-surface p-3 font-mono text-xs text-ink">
          {resolved}
        </pre>
      </div>
    </div>
  )
}

function VariableSettings({
  variable,
  onChange
}: {
  variable: PromptVariable
  onChange(patch: Partial<PromptVariable>): void
}): React.JSX.Element {
  const fieldCls =
    'w-full rounded-lg border border-line-strong bg-canvas px-2.5 py-1.5 text-xs text-ink outline-none focus:border-focus'
  return (
    <div className="mb-2 space-y-2 rounded-xl border border-line-strong bg-surface p-3">
      <div className="flex gap-2">
        <input
          value={variable.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="显示名称（可选）"
          className={fieldCls}
        />
        <select
          value={variable.type ?? 'text'}
          onChange={(e) => onChange({ type: e.target.value as VariableType })}
          className={fieldCls}
        >
          {TYPE_LABELS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <input
        value={variable.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="说明（可选）"
        className={fieldCls}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={variable.required ?? false}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        必填（未填写时禁止复制）
      </label>
      {variable.type === 'select' ? (
        <textarea
          rows={2}
          value={(variable.options ?? []).join('\n')}
          onChange={(e) =>
            onChange({ options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="下拉选项，每行一个"
          className={`${fieldCls} resize-y`}
        />
      ) : (
        <input
          value={variable.defaultValue ?? ''}
          onChange={(e) => onChange({ defaultValue: e.target.value })}
          placeholder="默认值（可选）"
          className={fieldCls}
        />
      )}
    </div>
  )
}
