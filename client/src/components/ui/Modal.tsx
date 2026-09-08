import { useEffect, type ReactNode } from "react";
import { IconClose } from "./Icons";

export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="card w-full max-w-md p-6 shadow-raised"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          {onClose && (
            <button onClick={onClose} aria-label="Close dialog" className="text-text-muted hover:text-text">
              <IconClose className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="mt-3 text-sm text-text-muted">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
