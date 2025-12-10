import { Toast } from './Toast';
import { useToastStore } from './store';

export function ToastContainer() {
  const queue = useToastStore((state) => state.queue);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[70] flex flex-col gap-3 sm:inset-x-auto sm:right-4 sm:w-[360px] sm:items-end">
      {queue.map((toast) => (
        <div key={toast.id} className="flex justify-center sm:justify-end">
          <Toast toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
}
