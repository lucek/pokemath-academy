export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  createdAt: number;
}

export interface ToastStoreState {
  queue: ToastMessage[];
  maxVisible: number;
  showToast: (toast: Omit<ToastMessage, 'id' | 'createdAt'>) => string;
  dismissToast: (id: string) => void;
}
