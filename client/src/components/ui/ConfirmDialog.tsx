import { useEffect, useRef } from 'react';
import { Button } from './Button.tsx';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirm: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Modal de confirmación sobre <dialog>: el navegador se ocupa del foco, del fondo y de Escape.
export function ConfirmDialog({
  title,
  message,
  confirm,
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onCancel();
      }}
    >
      <h2 id="confirm-dialog-title">{title}</h2>
      <p>{message}</p>
      <div className="confirm-dialog-actions">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Volver
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirm}
        </Button>
      </div>
    </dialog>
  );
}
