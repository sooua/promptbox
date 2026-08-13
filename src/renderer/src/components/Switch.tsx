/**
 * The app's only on/off switch. Settings and the cloud-sync modal each grew
 * their own copy at different sizes, and only one of them was labelled — a
 * switch with no text of its own is announced as an unnamed control, so
 * `label` is required rather than optional.
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
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        checked ? 'bg-brand' : 'bg-surface-2'
      }`}
    >
      {/* `bg-on-brand` rather than a hard-coded white: it is the token that
          means "sits on the terracotta fill" and it holds in both themes. */}
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-on-brand shadow-sm transition-all ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
