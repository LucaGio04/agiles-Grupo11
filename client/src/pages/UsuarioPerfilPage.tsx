import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { ItemCard } from '../components/items/ItemCard.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, getUserProfile } from '../lib/api.ts';
import type { CalificacionPublica, PerfilPublico } from '../lib/users.ts';

type Result =
  | { status: 'ok'; data: PerfilPublico }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

const fechaLarga = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' });

const LOAD_ERROR = 'No pudimos cargar este perfil. Revisá tu conexión y probá de nuevo.';

function intercambiosLabel(cantidad: number) {
  return cantidad === 1 ? '1 intercambio concretado' : `${cantidad} intercambios concretados`;
}

function resenasLabel(cantidad: number) {
  return cantidad === 1 ? '1 reseña' : `${cantidad} reseñas`;
}

function ReputacionPublica({ promedio, cantidad }: { promedio: number | null; cantidad: number }) {
  if (promedio === null || cantidad === 0) {
    return <p className="muted">Sin calificaciones todavía</p>;
  }
  return (
    <p className="reputation" aria-label={`${promedio.toFixed(1)} de 5, ${resenasLabel(cantidad)}`}>
      <span className="reputation-score">{promedio.toFixed(1)}</span>
      <span className="reputation-scale">/ 5</span>
      <span className="muted">· {resenasLabel(cantidad)}</span>
    </p>
  );
}

function CalificacionCard({ calificacion }: { calificacion: CalificacionPublica }) {
  const comentario = calificacion.comentario?.trim();
  return (
    <Card className="public-profile-rating">
      <p className="public-profile-rating-score">{calificacion.puntaje}/5</p>
      {comentario && <p>{comentario}</p>}
      <p className="muted">
        {calificacion.evaluador.nombre}
        {' · '}
        <time dateTime={calificacion.createdAt}>
          {fechaLarga.format(new Date(calificacion.createdAt))}
        </time>
      </p>
    </Card>
  );
}

// Perfil público de quien publicó un ítem. No reemplaza a /perfil.
export function UsuarioPerfilPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<(Result & { forId: string }) | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getUserProfile(id)
      .then((body) => {
        if (!cancelled) setResult({ status: 'ok', data: body.data, forId: id });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          setResult({ status: 'not-found', forId: id });
          return;
        }
        setResult({
          status: 'error',
          forId: id,
          message: err instanceof ApiError ? err.message : LOAD_ERROR,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, retry]);

  if (!id || !result || result.forId !== id) return <Loader label="Cargando perfil..." />;

  if (result.status === 'not-found') {
    return (
      <section className="empty-state">
        <p className="eyebrow">Error 404</p>
        <h1>No encontramos a ese estudiante</h1>
        <p className="muted">Puede que el link esté mal escrito o que la cuenta ya no exista.</p>
        <Link to="/" className="btn-primary">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="empty-state">
        <ErrorMessage message={result.message} />
        <Button
          variant="secondary"
          onClick={() => {
            setResult(null);
            setRetry((n) => n + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const perfil = result.data;
  const esElMio = user?.id === perfil.id;

  return (
    <div className="profile-page public-profile">
      <header className="profile-header public-profile-header">
        <p className="eyebrow">Perfil</p>
        <h1>{perfil.nombre}</h1>
        {perfil.carrera.trim() && <p className="muted">{perfil.carrera}</p>}
        <ReputacionPublica promedio={perfil.reputacionPromedio} cantidad={perfil.cantidadResenas} />
        <p>{intercambiosLabel(perfil.cantidadIntercambios)}</p>
        {esElMio && <Link to="/perfil">Ver mi perfil completo</Link>}
      </header>

      <section className="profile-section" aria-labelledby="items-disponibles">
        <h2 id="items-disponibles">Ítems disponibles</h2>
        {perfil.items.length === 0 ? (
          <div className="empty-state">
            <p>No tiene ítems disponibles por ahora</p>
          </div>
        ) : (
          <ul className="items-grid">
            {perfil.items.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile-section" aria-labelledby="ultimas-calificaciones">
        <h2 id="ultimas-calificaciones">Últimas calificaciones</h2>
        {perfil.ultimasCalificaciones.length === 0 ? (
          <div className="empty-state">
            <p>Todavía no recibió calificaciones</p>
          </div>
        ) : (
          <ul className="public-profile-ratings">
            {perfil.ultimasCalificaciones.map((calificacion) => (
              <li key={calificacion.id}>
                <CalificacionCard calificacion={calificacion} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
