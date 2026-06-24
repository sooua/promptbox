import { useEffect, useRef, useState } from 'react'

/**
 * Minimal fixed-row virtual list (no dependency). Renders only the rows in (or
 * near) the viewport, so libraries of thousands of items stay smooth. Rows are
 * a fixed height; each item card is sized to fit within it.
 */
export function VirtualList<T extends { id: string }>({
  items,
  rowHeight,
  overscan = 6,
  renderItem,
  className,
  tabIndex,
  onKeyDown,
  scrollToIndex
}: {
  items: T[]
  rowHeight: number
  overscan?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  tabIndex?: number
  onKeyDown?: (e: React.KeyboardEvent) => void
  scrollToIndex?: number
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setViewport(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep the actively-selected row visible (e.g. keyboard navigation).
  useEffect(() => {
    const el = ref.current
    if (!el || scrollToIndex == null || scrollToIndex < 0) return
    const top = scrollToIndex * rowHeight
    const bottom = top + rowHeight
    if (top < el.scrollTop) el.scrollTop = top
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
  }, [scrollToIndex, rowHeight])

  const total = items.length * rowHeight
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const end = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan)
  const visible = items.slice(start, end)

  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={className}
      style={{ overflowY: 'auto' }}
    >
      <div style={{ height: total, position: 'relative' }}>
        <div style={{ position: 'absolute', top: start * rowHeight, left: 0, right: 0 }}>
          {visible.map((item, i) => (
            <div key={item.id} style={{ height: rowHeight }}>
              {renderItem(item, start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
