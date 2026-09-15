import { Switch as UiSwitch } from '@/components/ui/switch'

/**
 * The app's only on/off switch, on the shadcn control. `label` is required
 * because a switch with no text of its own is announced as an unnamed control.
 */
export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange(v: boolean): void
  label: string
}): React.JSX.Element {
  return <UiSwitch checked={checked} onCheckedChange={onChange} aria-label={label} />
}
