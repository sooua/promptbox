/**
 * Slim draggable strip above the main area (the brand lives in the sidebar's
 * top block). The OS window controls overlay sits at its right; height matches
 * the sidebar brand block so the top edge lines up.
 */
export function TitleBar(): React.JSX.Element {
  return <div className="app-drag h-14 shrink-0 border-b border-line bg-canvas" />
}
