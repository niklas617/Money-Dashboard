import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-xl border border-border bg-bg-alt shadow-card-lg sm:rounded-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-[16px] font-bold text-text-primary">{title}</h3>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-high hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
