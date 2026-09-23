import { signal } from "@preact/signals";

interface ToastItem {
  id: number;
  message: string;
}

const toasts = signal<ToastItem[]>([]);
let nextId = 1;

export const showToast = (message: string, ms = 4000) => {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, message }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, ms);
};

export const Toasts = () => (
  <div class="toasts" role="status" aria-live="polite">
    {toasts.value.map((t) => (
      <div key={t.id} class="toast">
        {t.message}
      </div>
    ))}
  </div>
);
