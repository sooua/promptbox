import { useEffect, useMemo, useState } from 'react'
import { Copy, Plus, Settings2, Wand2 } from 'lucide-react'
import type { Prompt, PromptVariable, VariableType } from '@shared/types'
import { fillTemplate, missingRequired } from '@shared/variables'
import { useStore } from '../store'
import { VariableInput, initialValue } from './VariableInput'
import { toast } from './Toast'
import { useT } from '../i18n'

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
  const t = useT()

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
      toast.error(t('请先填写必填变量：{names}', { names: missing.join('、') }))
      return
    }
    await navigator.clipboard.writeText(resolved)
    await Promise.all([recordUse(prompt.id), rememberVarValues(prompt.id, values)])
    toast.success(t('已复制填充后的 Prompt'))
  }

  function updateVariable(name: string, patch: Partial<PromptVariable>) {
    const variables = prompt.variables.map((v) => (v.name === name ? { ...v, ...patch } : v))
    void updatePrompt(prompt.id, { variables })
  }

  /** Create a variable by appending {{name}} to the content (its source of truth). */
  function addVariable(raw: string): boolean {
    const name = raw.replace(/[{}|]/g, '').trim()
    if (!name) return false
    if (prompt.variables.some((v) => v.name === name)) {
      toast.info(t('变量「{name}」已存在', { name }))
      return false
    }
    const sep = !prompt.content || /\s$/.test(prompt.content) ? '' : ' '
    void updatePrompt(prompt.id, { content: `${prompt.content}${sep}{{${name}}}` })
    toast.success(t('已添加变量「{name}」', { name }))
    return true
  }

  if (prompt.variables.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-faint">
          {t('暂无变量。在内容里写')} <code className="var-chip">{'{{变量名}}'}</code>{' '}
          {t('，或在下方新建。')}
        </div>
        <AddVariable onAdd={addVariable} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Wand2 size={14} />
        {t('变量填充')}
      </div>
      {prompt.variables.map((v) => (
        <div key={v.name}>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-muted">
              <code className="var-chip">{v.label || v.name}</code>
              {v.required && <span className="ml-1 text-error" title={t('必填')}>*</span>}
              {v.description && <span className="ml-2 text-faint">{v.description}</span>}
            </label>
            <button
              onClick={() => setEditing(editing === v.name ? null : v.name)}
              title={t('变量设置')}
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

      <AddVariable onAdd={addVariable} />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">{t('预览结果')}</span>
          <button
            onClick={copyResolved}
            className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs text-on-brand transition hover:bg-brand-strong"
          >
            <Copy size={12} />
            {t('复制结果')}
          </button>
        </div>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-line-strong bg-surface p-3 font-mono text-xs text-ink">
          {resolved}
        </pre>
      </div>
    </div>
  )
}

function AddVariable({ onAdd }: { onAdd(name: string): boolean }): React.JSX.Element {
  const t = useT()
  const [name, setName] = useState('')
  function submit() {
    if (onAdd(name)) setName('')
  }
  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={t('新建变量名（支持中文）')}
        className="flex-1 rounded-lg border border-line-strong bg-canvas px-2.5 py-1.5 text-xs text-ink outline-none focus:border-focus"
      />
      <button
        onClick={submit}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs text-muted transition hover:border-brand hover:text-brand"
      >
        <Plus size={13} />
        {t('新建变量')}
      </button>
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
  const t = useT()
  const fieldCls =
    'w-full rounded-lg border border-line-strong bg-canvas px-2.5 py-1.5 text-xs text-ink outline-none focus:border-focus'
  return (
    <div className="mb-2 space-y-2 rounded-xl border border-line-strong bg-surface p-3">
      <div className="flex gap-2">
        <input
          value={variable.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={t('显示名称（可选）')}
          className={fieldCls}
        />
        <select
          value={variable.type ?? 'text'}
          onChange={(e) => onChange({ type: e.target.value as VariableType })}
          className={fieldCls}
        >
          {TYPE_LABELS.map((tl) => (
            <option key={tl.value} value={tl.value}>
              {t(tl.label)}
            </option>
          ))}
        </select>
      </div>
      <input
        value={variable.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder={t('说明（可选）')}
        className={fieldCls}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={variable.required ?? false}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        {t('必填（未填写时禁止复制）')}
      </label>
      {variable.type === 'select' ? (
        <textarea
          rows={2}
          value={(variable.options ?? []).join('\n')}
          onChange={(e) =>
            onChange({ options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
          }
          placeholder={t('下拉选项，每行一个')}
          className={`${fieldCls} resize-y`}
        />
      ) : (
        <input
          value={variable.defaultValue ?? ''}
          onChange={(e) => onChange({ defaultValue: e.target.value })}
          placeholder={t('默认值（可选）')}
          className={fieldCls}
        />
      )}
    </div>
  )
}
