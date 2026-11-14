import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ItemPhoto } from '../components/items/ItemPhoto.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, getMyProposals } from '../lib/api.ts';
import {
  ESTADOS_PROPUESTA,
  type EstadoPropuesta,
  type Intercambio,
  type ItemDePropuesta,
  type TipoPropuesta,
} from '../lib/proposals.ts';
import '../styles/proposals.css';

const LOAD_ERROR = 'No pudimos cargar tus propuestas. Revisá tu conexión y probá de nuevo.';

const TABS: { type: TipoPropuesta; label: string }[] = [
  { type: 'received', label: 'Recibidas' },
  { type: 'sent', label: 'Enviadas' },
];

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' });

// Resultado de la carga para la combinación `forKey` (pestaña + filtro).
type Result =
  | { status: 'ok'; data: Intercambio[]; pendientesRecibidas: number }
  | { status: 'error'; message: string };

// Seguimiento de las propuestas enviadas y recibidas (HU-07).
export function PropuestasPage() {
  const [type, setType] = useState<TipoPropuesta>('received');
  const [status, setStatus] = useState<EstadoPropuesta | ''>('');
  const [result, setResult] = useState<(Result & { forKey: string }) | null>(null);
  const [retry, setRetry] = useState(0);
  // El contador de la pestaña "Recibidas" no depende del filtro: se conserva entre cargas.
  const [pendientes, setPendientes] = useState(0);
  const key = `${type}|${status}|${retry}`;

  useEffect(() => {
    let cancelled = false;
    getMyProposals(status || undefined, type)
      .then((res) => {
        if (cancelled) return;
        setPendientes(res.pendientesRecibidas);
        setResult({
          status: 'ok',
          data: res.data,
          pendientesRecibidas: res.pendientesRecibidas,
          forKey: key,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult({
          status: 'error',
          message: err instanceof ApiError ? err.message : LOAD_ERROR,
          forKey: key,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [type, status, key]);

  const current = result?.forKey === key ? result : null;

  return (
    <section className="proposals-page">
      <h1>Propuestas</h1>

      <div className="proposals-toolbar">
        <div className="profile-tabs" role="tablist" aria-label="Tipo de propuesta">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              type="button"
              role="tab"
              aria-selected={type === tab.type}
              className="profile-tab"
              onClick={() => setType(tab.type)}
            >
              {tab.label}
              {tab.type === 'received' && pendientes > 0 && (
                <span
                  className="proposal-counter"
                  aria-label={`${pendientes} pendientes de respuesta`}
                >
                  {pendientes}
                </span>
              )}
            </button>
          ))}
        </div>

        <label className="proposals-filter">
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as EstadoPropuesta | '')}
          >
            <option value="">Todos</option>
            {(Object.keys(ESTADOS_PROPUESTA) as EstadoPropuesta[]).map((estado) => (
              <option key={estado} value={estado}>
                {ESTADOS_PROPUESTA[estado]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="tabpanel">
        {!current ? (
          <Loader label="Cargando propuestas..." />
        ) : current.status === 'error' ? (
          <div className="empty-state">
            <ErrorMessage message={current.message} />
            <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
              Reintentar
            </Button>
          </div>
        ) : current.data.length === 0 ? (
          <div className="empty-state">
            <p>
              {status
                ? 'No hay propuestas con ese estado.'
                : type === 'received'
                  ? 'Todavía no recibiste propuestas.'
                  : 'Todavía no enviaste propuestas.'}
            </p>
            {!status && type === 'sent' && <Link to="/">Buscar materiales</Link>}
          </div>
        ) : (
          <ul className="profile-list">
            {current.data.map((propuesta) => (
              <li key={propuesta.id}>
                <PropuestaCard propuesta={propuesta} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PropuestaCard({ propuesta }: { propuesta: Intercambio }) {
  const pendienteRecibida = propuesta.rol === 'receptor' && propuesta.estado === 'PENDIENTE';
  const ofrece = propuesta.rol === 'proponente' ? 'Ofreciste' : 'Te ofrece';
  const pide = propuesta.rol === 'proponente' ? 'Pediste' : 'Pide tu ítem';

  return (
    <Card className={`proposal-card${pendienteRecibida ? ' proposal-card-pending' : ''}`}>
      <header className="proposal-card-header">
        <p>
          {propuesta.rol === 'proponente' ? 'Para ' : 'De '}
          <Link to={`/usuarios/${propuesta.persona.id}`}>{propuesta.persona.nombre}</Link>
        </p>
        <span className={`proposal-status proposal-status-${propuesta.estado.toLowerCase()}`}>
          {ESTADOS_PROPUESTA[propuesta.estado]}
        </span>
      </header>

      <div className="proposal-items">
        <ProposalItem label={ofrece} item={propuesta.itemOfrecido} />
        <span className="proposal-arrow" aria-hidden="true">
          ⇄
        </span>
        <ProposalItem label={pide} item={propuesta.itemSolicitado} />
      </div>

      {propuesta.mensaje && <p className="proposal-message">“{propuesta.mensaje}”</p>}
      <p className="muted proposal-date">
        Enviada el {dateFormat.format(new Date(propuesta.createdAt))}
      </p>
    </Card>
  );
}

function ProposalItem({ label, item }: { label: string; item: ItemDePropuesta }) {
  return (
    <div className="proposal-item">
      <ItemPhoto
        fotoUrl={item.fotoUrl}
        categoria={item.categoria}
        titulo={item.titulo}
        className="proposal-item-photo"
      />
      <p className="muted">{label}</p>
      <Link to={`/items/${item.id}`}>{item.titulo}</Link>
    </div>
  );
}
