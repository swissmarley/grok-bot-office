import { useOffice } from '../store';

export function Toaster() {
  const toasts = useOffice((s) => s.toasts);
  const dismiss = useOffice((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4 md:bottom-14">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-md rounded-xl px-4 py-2 text-sm font-medium shadow-lg ring-1 ${
            t.tone === 'error' ? 'bg-[#2A1215] text-red-200 ring-st-error/60' : 'bg-panel-2 text-text ring-line'
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
