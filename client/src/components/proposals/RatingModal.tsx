import { useRef, useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { ApiError, calificarIntercambio } from '../../lib/api.ts';

type RatingModalProps = {
  proposalId: number;
  nombreContraparte: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function RatingModal({
  proposalId,
  nombreContraparte,
  onClose,
  onSuccess,
}: RatingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [puntaje, setPuntaje] = useState<number>(5);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (submitting) return;
    if (e.target === dialogRef.current) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await calificarIntercambio(proposalId, puntaje, comentario.trim() || undefined);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo enviar la calificación. Intentá de nuevo.'
      );
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      open
      className="modal-backdrop"
      onClick={handleBackdropClick}
      aria-labelledby="rating-modal-title"
    >
      <div className="modal" role="document">
        <h2 id="rating-modal-title">Calificar a {nombreContraparte}</h2>
        <p>Tu opinión ayuda a construir confianza en los intercambios universitarios.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="field">
            <span id="label-puntaje">Puntaje</span>
            <div
              role="radiogroup"
              aria-labelledby="label-puntaje"
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setPuntaje(star)}
                  aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                  aria-checked={puntaje === star}
                  role="radio"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.75rem',
                    cursor: 'pointer',
                    color: star <= puntaje ? '#f59e0b' : 'var(--line)',
                    padding: '0.2rem',
                    lineHeight: 1,
                  }}
                >
                  ★
                </button>
              ))}
              <span className="muted" style={{ marginLeft: '0.5rem', fontSize: 'var(--text-sm)' }}>
                {puntaje} / 5
              </span>
            </div>
          </div>

          <label className="field" htmlFor="rating-comentario">
            <span>Comentario (opcional)</span>
            <textarea
              id="rating-comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="¿Cómo fue la experiencia del intercambio?"
            />
            <span className="field-hint" style={{ alignSelf: 'flex-end' }}>
              {comentario.length}/300
            </span>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              Guardar calificación
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
