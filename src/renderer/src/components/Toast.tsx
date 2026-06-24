import { create } from 'zustand'
import { CheckCircle2, Info, Undo2, XCircle } from 'lucide-react'
import { t } from '../i18n'

type ToastKind = 'success' | 'error' | 'info'
interface ToastAction {
  label: string
  onClick(): void
}
interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

interface ToastState {
  toasts: Toast[]
  push(kind: ToastKind, message: string, action?: ToastAction, ms?: number): void
  dismiss(id: number): void
}

let counter = 1

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message, action, ms = 2600) => {
    const id = counter++
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, action }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/** Imperative helper usable anywhere without hooks. */
export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
  /** A toast with an "撤销" action; stays visible longer. */
  undo: (m: string, onUndo: () => void) =>
    useToastStore.getState().push('info', m, { label: t('撤销'), onClick: onUndo }, 6000),
  /** A toast with a custom labeled action button; stays visible long. */
  action: (m: string, label: string, onClick: () => void, ms = 12000) =>
    useToastStore.getState().push('info', m, { label, onClick }, ms)
}

const icons = {
  success: <CheckCircle2 size={16} className="text-brand" />,
  error: <XCircle size={16} className="text-error" />,
  info: <Info size={16} className="text-muted" />
}

export function ToastHost(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : undefined}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2 text-sm text-ink shadow-[rgba(0,0,0,0.08)_0px_4px_24px]"
        >
          {icons[t.kind]}
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.onClick()
                dismiss(t.id)
              }}
              className="ml-1 flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-xs text-[#faf9f5] transition hover:bg-brand-strong"
            >
              <Undo2 size={12} />
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} className="ml-1 text-faint hover:text-ink">
            <XCircle size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
