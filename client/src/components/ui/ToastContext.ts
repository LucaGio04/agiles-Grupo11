import { createContext } from 'react';

export type ToastKind = 'ok' | 'error';
export type ToastItem = { id: number; kind: ToastKind; message: string };

export type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
};

export const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});
