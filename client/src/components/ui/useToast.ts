import { useContext } from 'react';
import { ToastContext } from './ToastContext.ts';

export function useToast() {
  return useContext(ToastContext);
}
