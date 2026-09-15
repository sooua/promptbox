import type { PromptVariable } from '@shared/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '../i18n'

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
  const placeholder = variable.defaultValue || t('输入 {name}…', { name: variable.name })
  if (variable.type === 'select' && variable.options?.length) {
    return (
      <Select value={value || null} onValueChange={(v) => onChange((v as string) ?? '')}>
        <SelectTrigger aria-invalid={invalid || undefined} className="w-full">
          <SelectValue placeholder={t('（请选择）')} />
        </SelectTrigger>
        <SelectContent>
          {variable.options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (variable.type === 'multiline') {
    return (
      <Textarea
        autoFocus={autoFocus}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className="min-h-24 resize-y text-[15px]"
      />
    )
  }
  return (
    <Input
      type={variable.type === 'number' || variable.type === 'date' ? variable.type : 'text'}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
    />
  )
}

/** Initial fill value for a variable: remembered value, else default. */
export function initialValue(v: PromptVariable): string {
  return v.lastValue ?? v.defaultValue ?? ''
}
