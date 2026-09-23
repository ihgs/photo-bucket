import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const pending = signal<Pending | null>(null);

export const confirm = (options: ConfirmOptions) =>
  new Promise<boolean>((resolve) => {
    pending.value?.resolve(false);
    pending.value = { ...options, resolve };
  });

const close = (ok: boolean) => {
  const p = pending.value;
  pending.value = null;
  p?.resolve(ok);
};

export const ConfirmDialogHost = () => {
  const p = pending.value;
  const ref = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!p) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
    return () => restoreFocus.current?.focus?.();
  }, [p]);

  if (!p) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    } else if (e.key === "Tab") {
      const focusables = [...(ref.current?.querySelectorAll<HTMLElement>("button") ?? [])];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div class="modal-backdrop" onClick={() => close(false)}>
      <dialog
        ref={ref}
        open
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={p.message ? "confirm-message" : undefined}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{p.title}</h2>
        {p.message && <p id="confirm-message">{p.message}</p>}
        <div class="dialog-actions">
          <button type="button" class="btn" data-autofocus onClick={() => close(false)}>
            {p.cancelLabel ?? "キャンセル"}
          </button>
          <button
            type="button"
            class={p.danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => close(true)}
          >
            {p.confirmLabel ?? "実行"}
          </button>
        </div>
      </dialog>
    </div>
  );
};
