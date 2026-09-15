const isMac = window.api.platform === 'darwin'

/**
 * Draggable strip above the main area. The OS window controls overlay sits at
 * its right (Windows reserves ~150px there); `children` render just left of it.
 * `plain` drops the bottom rule for screens with nothing under it.
 */
export function TitleBar({ plain, children }: { plain?: boolean; children?: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className={`app-drag flex h-14 shrink-0 items-center justify-end bg-background ${isMac ? 'pr-4' : 'pr-[150px]'} ${
        plain ? '' : 'border-b border-border'
      }`}
    >
      {children}
    </div>
  )
}
