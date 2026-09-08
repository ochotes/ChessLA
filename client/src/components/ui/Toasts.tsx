import { useToast } from "../../context/ToastContext";
import { IconClose } from "./Icons";

const VARIANT_STYLES: Record<string, string> = {
  info: "border-border bg-surface text-text",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

export function Toasts() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`card flex items-start justify-between gap-3 border px-4 py-3 text-sm shadow-raised ${VARIANT_STYLES[toast.variant]}`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 text-text-muted hover:text-text"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
