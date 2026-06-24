/**
 * Slim, empty draggable title strip for the frameless window. The OS window
 * controls overlay sits at its right; the rest is just a grab area.
 */
export function TitleBar(): React.JSX.Element {
  return <div className="app-drag h-10 shrink-0 border-b border-line bg-canvas" />
}
