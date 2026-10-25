import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { ItemPhoto } from '../components/items/ItemPhoto.tsx';
import { Button } from '../components/ui/Button.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, apiFetch } from '../lib/api.ts';
import {
  CATEGORIAS,
  ESTADOS_CONSERVACION,
  ESTADOS_ITEM,
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

// Detalle de una publicación (HU-05).
export function ItemDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const flash = (useLocation().state as { flash?: string } | null)?.flash;
  const [result, setResult] = useState<(Result & { forId: string }) | null>(null);

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
              {owner.nombre}
              {isMine && <span className="muted"> (vos)</span>}
            </p>
            <p className="muted">{owner.carrera}</p>
            <Reputacion reputacion={owner.reputacion} />
          </div>
        </section>

        <div className="item-detail-actions">
          {isMine ? (
            <>
              {/* Editar y eliminar llegan con HU-14 y HU-15. */}
              <Button variant="secondary" disabled title="Próximamente">
                Editar
              </Button>
              <Button variant="danger" disabled title="Próximamente">
                Eliminar
              </Button>
            </>
          ) : disponible ? (
            // El flujo de propuestas es del sprint 3 (HU-06).
            <Button disabled title="Próximamente">
              Proponer intercambio
            </Button>
          ) : (
            <p className="muted">
              Este material está {ESTADOS_ITEM[item.estado].toLowerCase()}: por ahora no recibe
              propuestas.
            </p>
          )}
          {(isMine || disponible) && (
            <span className="field-hint">
              {isMine ? 'Editar y eliminar' : 'Las propuestas de intercambio'} van a estar
              disponibles muy pronto.
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
