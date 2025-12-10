import type { ToastMessage, ToastStoreState } from './types';

import { create } from 'zustand';

const DEFAULT_DURATION = 5000;
const DEFAULT_MAX_VISIBLE = 3;

const createToastId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const useToastStore = create<ToastStoreState>((set) => ({
  queue: [],
  maxVisible: DEFAULT_MAX_VISIBLE,
  showToast: (toast) => {
    const id = createToastId();
    const nextToast: ToastMessage = {
      ...toast,
      id,
      createdAt: Date.now(),
      duration: toast.duration ?? DEFAULT_DURATION,
    };

    set((state) => {
      const nextQueue = [...state.queue, nextToast];
      if (nextQueue.length <= state.maxVisible) {
        return { queue: nextQueue };
      }

      const overflow = nextQueue.length - state.maxVisible;
      if (overflow <= 0) {
        return { queue: nextQueue };
      }

      return { queue: nextQueue.slice(overflow) };
    });

    return id;
  },
  dismissToast: (id) =>
    set((state) => ({
      queue: state.queue.filter((toast) => toast.id !== id),
    })),
}));

export function useToast() {
  const showToast = useToastStore((state) => state.showToast);
  const dismissToast = useToastStore((state) => state.dismissToast);

  return { showToast, dismissToast };
}
