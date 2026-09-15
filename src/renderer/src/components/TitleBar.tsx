/**
 * Slim draggable strip above the main area. The OS window controls overlay
 * sits at its right; height matches the sidebar brand block so the top edge
 * lines up. `plain` drops the bottom rule for screens with nothing under it.
 */
export function TitleBar({ plain }: { plain?: boolean }): React.JSX.Element {
  return <div className={`app-drag h-14 shrink-0 bg-background ${plain ? '' : 'border-b border-border'}`} />
}
