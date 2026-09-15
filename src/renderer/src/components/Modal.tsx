import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared shell for the app's three overlays (command palette, quick-fill, cloud
 * sync). Collects the behaviour each of them was missing or doing differently:
 * dialog semantics, a Tab loop that can't escape into the background, Esc on
 * window level (so it works no matter where focus sits), and focus handed back
 * to whatever opened the overlay.
 *
 * Children keep their own key handling; this only adds Esc and the Tab trap.
 */
export function Modal({
  onClose,
  ariaLabel,
  className,
  overlayClassName,
  children
}: {
  onClose(): void
  ariaLabel: string
  /** classes for the dialog panel itself */
  className?: string
  /** classes for the backdrop (controls vertical placement) */
  overlayClassName?: string
  children: React.ReactNode
}): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null
    return () => {
      // The opener may itself have been unmounted (e.g. a row that got deleted);
      // isConnected guards against focusing a detached node.
      const el = restoreTo.current
      if (el?.isConnected) el.focus()
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!panel.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={overlayClassName ?? 'fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]'}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
