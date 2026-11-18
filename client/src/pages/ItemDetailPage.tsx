import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { ItemPhoto } from '../components/items/ItemPhoto.tsx';
import { Button } from '../components/ui/Button.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, apiFetch, createProposal, getMyItems } from '../lib/api.ts';
import { useToast } from '../components/ui/useToast.ts';
import {
  CATEGORIAS,
  ESTADOS_CONSERVACION,
  ESTADOS_ITEM,
  type Item,
  type ItemDetail,
  type ItemOwner,
} from '../lib/items.ts';

// Resultado de la carga del ítem `forId`. Mientras no coincide con el id de la URL, se muestra el loader.
type Result =
  | { status: 'ok'; data: ItemDetail }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

const fechaLarga = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' });

function Reputacion({ reputacion }: { reputacion: ItemOwner['reputacion'] }) {
  if (reputacion.cantidad === 0 || reputacion.promedio === null) {
    return <span className="muted">Sin calificaciones todavía</span>;
  }
  const { promedio, cantidad } = reputacion;
  return (
    <span className="reputation" aria-label={`${promedio.toFixed(1)} de 5`}>
      <span className="reputation-score">{promedio.toFixed(1)}</span>
      <span className="reputation-scale">/ 5</span>
      <span className="muted">
        · {cantidad} {cantidad === 1 ? 'calificación' : 'calificaciones'}
      </span>
    </span>
  );
}

// Modal de confirmación para eliminar un ítem (HU-15).
function DeleteModal({
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Cierra el modal al hacer clic en el backdrop (fuera del recuadro blanco).
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      open
      className="modal-backdrop"
      onClick={handleBackdropClick}
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-desc"
    >
      <div className="modal" role="document">
        <h2 id="delete-modal-title">¿Eliminar publicación?</h2>
        <p id="delete-modal-desc">
          Las propuestas pendientes quedarán canceladas. Esta acción no se puede deshacer.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Eliminar
          </Button>
        </div>
      </div>
    </dialog>
  );
}

const MENSAJE_MAX = 300;

function proposalErrorText(err: unknown) {
  if (!(err instanceof ApiError)) {
    return 'No se pudo enviar la propuesta. Intentá de nuevo.';
  }
  const detail = Array.isArray(err.details) ? err.details[0] : undefined;
  if (
    err.status === 400 &&
    detail &&
    typeof detail === 'object' &&
    'message' in detail &&
    typeof detail.message === 'string'
  ) {
    return detail.message;
  }
  return err.message;
}

// Modal para ofrecer uno de mis ítems a cambio (HU-06).
function ProposeModal({
  itemId,
  onClose,
  onSuccess,
}: {
  itemId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyItems('DISPONIBLE')
      .then((res) => {
        if (!cancelled) setItems(res.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : 'No se pudieron cargar tus publicaciones.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (submitting) return;
    if (e.target === dialogRef.current) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedId === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const texto = mensaje.trim();
      await createProposal(itemId, {
        itemOfrecidoId: selectedId,
        ...(texto ? { mensaje: texto } : {}),
      });
      showToast('Tu propuesta quedó pendiente de respuesta.', 'ok');
      onSuccess();
    } catch (err) {
      setError(proposalErrorText(err));
      setSubmitting(false);
    }
  }

  const disponibles = items ?? [];

  return (
    <dialog
      ref={dialogRef}
      open
      className="modal-backdrop"
      onClick={handleBackdropClick}
      aria-labelledby="propose-modal-title"
    >
      <div className="modal propose-modal" role="document">
        <h2 id="propose-modal-title">Proponer intercambio</h2>
        <p>Elegí uno de tus ítems disponibles para ofrecer a cambio.</p>

        {items === null && !loadError && <Loader label="Cargando tus publicaciones..." />}
        {loadError && (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        )}
        {items && disponibles.length === 0 && (
          <p>
            No tenés ítems disponibles para ofrecer. <Link to="/publicar">Publicar</Link>
          </p>
        )}

        {disponibles.length > 0 && (
          <form onSubmit={handleSubmit}>
            <fieldset className="propose-fieldset">
              <legend>Elegí qué ofrecer</legend>
              <ul className="propose-list">
                {disponibles.map((item) => (
                  <li key={item.id}>
                    <label className="propose-option">
                      <input
                        type="radio"
                        name="itemOfrecidoId"
                        value={item.id}
                        checked={selectedId === item.id}
                        onChange={() => setSelectedId(item.id)}
                        required
                      />
                      <span>
                        {item.titulo}
                        {item.materia && <span className="muted"> · {item.materia}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <label className="field" htmlFor="propuesta-mensaje">
              <span>Mensaje (opcional)</span>
              <textarea
                id="propuesta-mensaje"
                name="mensaje"
                rows={3}
                maxLength={MENSAJE_MAX}
                placeholder="Contale por qué te interesa el cambio"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
              />
              <span className="field-hint propose-count">
                {mensaje.length}/{MENSAJE_MAX}
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
              <Button type="submit" loading={submitting} disabled={selectedId === null}>
                Enviar propuesta
              </Button>
            </div>
          </form>
        )}

        {items && disponibles.length === 0 && (
          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}

// Detalle de una publicación (HU-05).
export function ItemDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const flash = (useLocation().state as { flash?: string } | null)?.flash;
  const [result, setResult] = useState<(Result & { forId: string }) | null>(null);

  // Estado del modal de eliminación (HU-15).
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Propuesta de intercambio (HU-06).
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposalNotice, setProposalNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setState = (r: Result) => !cancelled && setResult({ ...r, forId: id ?? '' });
    apiFetch<ItemDetail>(`/api/items/${id}`)
      .then((data) => setState({ status: 'ok', data }))
      .catch((err: unknown) => {
        if (cancelled) return;
        // Un id que no es numérico (400) tampoco corresponde a ninguna publicación.
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          setState({ status: 'not-found' });
        } else {
          setState({
            status: 'error',
            message:
              err instanceof ApiError
                ? err.message
                : 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/items/${id}`, { method: 'DELETE' });
      navigate('/', { state: { flash: 'Tu publicación fue eliminada.' } });
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : 'No se pudo eliminar. Intentá de nuevo.'
      );
      setDeleting(false);
    }
  }

  if (!result || result.forId !== id) return <Loader label="Cargando publicación..." />;
  const state = result;

  if (state.status === 'not-found') {
    return (
      <section className="empty-state">
        <p className="eyebrow">Error 404</p>
        <h1>Esta publicación no existe</h1>
        <p className="muted">Puede que el link esté mal escrito o que el dueño la haya borrado.</p>
        <Link to="/" className="btn-primary">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (state.status === 'error') return <ErrorMessage message={state.message} />;

  const { item, owner } = state.data;
  const isMine = user?.id === item.ownerId;
  const disponible = item.estado === 'DISPONIBLE';

  return (
    <article className="item-detail">
      {flash && (
        <p className="form-success item-detail-flash" role="status">
          {flash}
        </p>
      )}
      {proposalNotice && (
        <p className="form-success item-detail-flash" role="status">
          {proposalNotice}
        </p>
      )}

      <ItemPhoto
        className="item-detail-photo"
        fotoUrl={item.fotoUrl}
        categoria={item.categoria}
        titulo={item.titulo}
      />

      <div className="item-detail-body">
        <header className="item-detail-header">
          <span className={`status-chip status-${item.estado.toLowerCase()}`}>
            {ESTADOS_ITEM[item.estado]}
          </span>
          <h1>{item.titulo}</h1>
        </header>

        <dl className="spec-sheet">
          <div>
            <dt>Categoría</dt>
            <dd>{CATEGORIAS[item.categoria]}</dd>
          </div>
          <div>
            <dt>Conservación</dt>
            <dd>{ESTADOS_CONSERVACION[item.estadoConservacion]}</dd>
          </div>
          <div>
            <dt>Materia</dt>
            <dd>{item.materia ?? '—'}</dd>
          </div>
          <div>
            <dt>Publicado</dt>
            <dd>
              <time dateTime={item.createdAt}>{fechaLarga.format(new Date(item.createdAt))}</time>
            </dd>
          </div>
        </dl>

        {item.descripcion && <p className="item-detail-description">{item.descripcion}</p>}

        <section className="owner-card" aria-label="Dueño de la publicación">
          <span className="owner-avatar" aria-hidden="true">
            {owner.nombre.charAt(0)}
          </span>
          <div className="owner-info">
            <p className="owner-name">
              <Link to={`/usuarios/${owner.id}`}>{owner.nombre}</Link>
              {isMine && <span className="muted"> (vos)</span>}
            </p>
            <p className="muted">{owner.carrera}</p>
            <Reputacion reputacion={owner.reputacion} />
          </div>
        </section>

        <div className="item-detail-actions">
          {isMine ? (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate(`/items/${item.id}/editar`)}
                disabled={item.estado === 'INTERCAMBIADO'}
                title={
                  item.estado === 'INTERCAMBIADO'
                    ? 'No se puede editar un ítem intercambiado'
                    : undefined
                }
              >
                Editar
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowDeleteModal(true)}
                disabled={item.estado === 'INTERCAMBIADO'}
                title={
                  item.estado === 'INTERCAMBIADO'
                    ? 'No se puede eliminar un ítem intercambiado'
                    : undefined
                }
              >
                Eliminar
              </Button>
            </>
          ) : disponible ? (
            <Button onClick={() => setShowProposeModal(true)}>Proponer intercambio</Button>
          ) : (
            <p className="muted">
              Este material está {ESTADOS_ITEM[item.estado].toLowerCase()}: por ahora no recibe
              propuestas.
            </p>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeleteError(null);
          }}
          loading={deleting}
          error={deleteError}
        />
      )}

      {showProposeModal && (
        <ProposeModal
          itemId={item.id}
          onClose={() => setShowProposeModal(false)}
          onSuccess={() => {
            setShowProposeModal(false);
            setProposalNotice('Tu propuesta quedó pendiente.');
          }}
        />
      )}
    </article>
  );
}
