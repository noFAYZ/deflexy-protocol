import { useSyncExternalStore } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toastStore } from "@/lib/toast";

export function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[100] flex w-72 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="bg-card animate-in slide-in-from-bottom-2 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg">
          {t.type === "pending" && <Loader2 className="size-4 shrink-0 animate-spin" />}
          {t.type === "success" && <CheckCircle2 className="text-success size-4 shrink-0" />}
          {t.type === "error" && <XCircle className="text-destructive size-4 shrink-0" />}
          <span className="truncate">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
