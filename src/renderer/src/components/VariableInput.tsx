import type { PromptVariable } from '@shared/types'
import { useT } from '../i18n'

const inputCls =
  'w-full rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-focus'

/** Renders the right control for a variable based on its type. */
export function VariableInput({
  variable,
  value,
  onChange,
  autoFocus,
  invalid
}: {
  variable: PromptVariable
  value: string
  onChange(v: string): void
  autoFocus?: boolean
  /** highlight as a missing required field */
  invalid?: boolean
}): React.JSX.Element {
  const t = useT()
  const cls = invalid ? `${inputCls} border-error focus:border-error` : inputCls
  if (variable.type === 'select' && variable.options?.length) {
    return (
      <select autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">{t('（请选择）')}</option>
        {variable.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }
  if (variable.type === 'multiline') {
    return (
      <textarea
        autoFocus={autoFocus}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={variable.defaultValue || t('输入 {name}…', { name: variable.name })}
        className={`${cls} resize-y`}
      />
    )
  }
  if (variable.type === 'number' || variable.type === 'date') {
    return (
      <input
        type={variable.type}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={variable.defaultValue || t('输入 {name}…', { name: variable.name })}
        className={cls}
      />
    )
  }
  return (
    <input
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={variable.defaultValue || t('输入 {name}…', { name: variable.name })}
      className={cls}
    />
  )
}

/** Initial fill value for a variable: remembered value, else default. */
export function initialValue(v: PromptVariable): string {
  return v.lastValue ?? v.defaultValue ?? ''
}
