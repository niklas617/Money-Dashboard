import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: ToastKind; message: string }

type ToastCtx = {
  success: (m: string) => void
  error: (m: string) => void
  info: (m: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  const value: ToastCtx = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md border border-border bg-surface-high px-4 py-3 shadow-card-lg"
            >
              {t.kind === 'success' && <CheckCircle2 size={18} className="shrink-0 text-mint" />}
              {t.kind === 'error' && <XCircle size={18} className="shrink-0 text-negative" />}
              {t.kind === 'info' && <Info size={18} className="shrink-0 text-info" />}
              <span className="text-[13.5px] font-medium text-text-primary">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast muss innerhalb von ToastProvider genutzt werden')
  return ctx
}
