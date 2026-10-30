import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, getMyItems, getMyProposals } from '../lib/api.ts';
import { ESTADOS_ITEM, type EstadoItem, type Item } from '../lib/items.ts';
import type { CalificacionResumen, Intercambio } from '../lib/proposals.ts';

const ITEMS_ERROR = 'No pudimos cargar tus publicaciones. Revisá tu conexión y probá de nuevo.';
const HISTORY_ERROR = 'No pudimos cargar tu historial. Revisá tu conexión y probá de nuevo.';

const TABS: { estado: EstadoItem; label: string }[] = [
  { estado: 'DISPONIBLE', label: 'Disponibles' },
  { estado: 'RESERVADO', label: 'Reservados' },
  { estado: 'PAUSADO', label: 'Pausados' },
  { estado: 'INTERCAMBIADO', label: 'Intercambiados' },
];

type SectionState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: T };

function messageFrom(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function useSection<T>(load: () => Promise<T>, fallback: string) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<SectionState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: messageFrom(err, fallback) });
      });
    return () => {
      cancelled = true;
    };
  }, [load, fallback, retry]);

  function retryLoad() {
    setState({ status: 'loading' });
    setRetry((n) => n + 1);
  }

  return { state, retryLoad };
}

export function PerfilPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<EstadoItem>('DISPONIBLE');
  const loadItems = useCallback(() => getMyItems(), []);
  const loadHistory = useCallback(() => getMyProposals('CONCRETADA'), []);
  const items = useSection(loadItems, ITEMS_ERROR);
  const history = useSection(loadHistory, HISTORY_ERROR);

  const mine = items.state.status === 'ok' ? items.state.data.data : [];
  const visibles = mine.filter((item) => item.estado === tab);

  return (
    <div className="profile-page">
      <header className="profile-header">
        <p className="eyebrow">Mi perfil</p>
        <h1>{user?.nombre ?? 'Mi perfil'}</h1>
      </header>

      <section className="profile-section" aria-labelledby="mis-publicaciones">
        <h2 id="mis-publicaciones">Mis publicaciones</h2>
        {items.state.status === 'loading' ? (
          <Loader label="Cargando tus publicaciones..." />
        ) : items.state.status === 'error' ? (
          <div className="empty-state">
            <ErrorMessage message={items.state.message} />
            <Button variant="secondary" onClick={items.retryLoad}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="profile-tabs" role="tablist" aria-label="Estado de tus publicaciones">
              {TABS.map((itemTab) => {
                const count = mine.filter((item) => item.estado === itemTab.estado).length;
                return (
                  <button
                    key={itemTab.estado}
                    type="button"
                    role="tab"
                    aria-selected={tab === itemTab.estado}
                    className="profile-tab"
                    onClick={() => setTab(itemTab.estado)}
                  >
                    {itemTab.label}
                    <span className="profile-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div role="tabpanel">
              {visibles.length === 0 ? (
                <div className="empty-state">
                  <p>Todavía no tenés ítems en este estado</p>
                </div>
              ) : (
                <ul className="profile-list">
                  {visibles.map((item) => (
                    <li key={item.id}>
                      <ItemPublicacion item={item} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <section className="profile-section" aria-labelledby="historial">
        <h2 id="historial">Historial de intercambios</h2>
        {history.state.status === 'loading' ? (
          <Loader label="Cargando tu historial..." />
        ) : history.state.status === 'error' ? (
          <div className="empty-state">
            <ErrorMessage message={history.state.message} />
            <Button variant="secondary" onClick={history.retryLoad}>
              Reintentar
            </Button>
          </div>
        ) : history.state.data.data.length === 0 ? (
          <div className="empty-state">
            <p>Todavía no concretaste ningún intercambio</p>
          </div>
        ) : (
          <ul className="profile-list">
            {history.state.data.data.map((intercambio) => (
              <li key={intercambio.id}>
                <IntercambioCard intercambio={intercambio} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ItemPublicacion({ item }: { item: Item }) {
  return (
    <Card className="profile-item-card">
      <div className="profile-item-heading">
        <h3>
          <Link to={`/items/${item.id}`}>{item.titulo}</Link>
        </h3>
        <span className="profile-item-status">{ESTADOS_ITEM[item.estado]}</span>
      </div>
      <div className="profile-item-actions">
        {/* TODO(HU-14): acá va la llamada para editar o pausar/reactivar, y el refresco de la lista sin recargar. */}
        <Button variant="secondary" disabled title="Próximamente">
          Editar
        </Button>
        <Button variant="secondary" disabled title="Próximamente">
          {item.estado === 'PAUSADO' ? 'Reactivar' : 'Pausar'}
        </Button>
      </div>
    </Card>
  );
}

function IntercambioCard({ intercambio }: { intercambio: Intercambio }) {
  const ofreci =
    intercambio.rol === 'proponente' ? intercambio.itemOfrecido : intercambio.itemSolicitado;
  const recibi =
    intercambio.rol === 'proponente' ? intercambio.itemSolicitado : intercambio.itemOfrecido;

  return (
    <Card className="profile-exchange-card">
      <h3>Con {intercambio.persona.nombre}</h3>
      <p>Ofreciste: {ofreci.titulo}</p>
      <p>Recibiste: {recibi.titulo}</p>
      <CalificacionLine label="Calificación dada" value={intercambio.calificacionDada} />
      <CalificacionLine label="Calificación recibida" value={intercambio.calificacionRecibida} />
    </Card>
  );
}

function CalificacionLine({ label, value }: { label: string; value: CalificacionResumen | null }) {
  return (
    <p>
      <span className="muted">{label}: </span>
      {value
        ? `${value.puntaje}/5${value.comentario ? ` — ${value.comentario}` : ''}`
        : 'Sin calificar'}
    </p>
  );
}
