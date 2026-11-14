import { useEffect, useRef, type ReactNode } from 'react';

type ModalProps = {
  labelledBy: string;
  describedBy?: string;
  className?: string;
  // Mientras es true (por ejemplo, enviando), ni Escape ni el clic afuera cierran el modal.
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
};

// Modal sobre <dialog> abierto con showModal(): el navegador lo pone por encima de todo,
// atrapa el foco, bloquea el resto de la página y lo cierra con Escape.
export function Modal({
  labelledBy,
  describedBy,
  className,
  busy = false,
  onClose,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal-backdrop"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => {
        // El cierre lo decide React (desmontando el componente), no el navegador.
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onClose();
      }}
    >
      <div className={['modal', className].filter(Boolean).join(' ')}>{children}</div>
    </dialog>
  );
}
