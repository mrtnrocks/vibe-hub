import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { ipc } from '../lib/ipc'
import { useApp } from '../context/AppContext'

export function ToastContainer(): React.JSX.Element {
  const { toastQueue, dismissToast } = useApp()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toastQueue.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg backdrop-blur-sm"
          >
            <p className="text-sm text-foreground">{toast.message}</p>
            {toast.action && (
              <button
                className="shrink-0 text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  ipc.appSwitch(toast.action!.ipcChannel)
                  dismissToast(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
