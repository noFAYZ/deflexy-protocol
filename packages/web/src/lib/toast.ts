// Minimal external-store toast bus (no deps). Hooks push a pending toast on tx
// submit and resolve it on receipt; <Toaster/> subscribes via useSyncExternalStore.

export type ToastType = "pending" | "success" | "error";
export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

const emit = () => listeners.forEach((l) => l());

export const toastStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot: () => toasts,
};

export function pushPending(message: string): number {
  const id = nextId++;
  toasts = [...toasts, { id, type: "pending", message }];
  emit();
  return id;
}

export function resolveToast(id: number, type: Exclude<ToastType, "pending">, message: string) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, type, message } : t));
  emit();
  window.setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    type === "error" ? 6000 : 3000,
  );
}
