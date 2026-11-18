import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.tsx';
import { ItemPhoto } from '../components/items/ItemPhoto.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, getMyProposals, respondProposal } from '../lib/api.ts';
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
                <PropuestaCard propuesta={propuesta} onChanged={() => setRetry((n) => n + 1)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type Accion = 'aceptar' | 'rechazar' | 'cancelar' | 'concretar';

const CONFIRMACION: Record<Accion, { title: string; message: string; confirm: string }> = {
  aceptar: {
    title: '¿Aceptar la propuesta?',
    message:
      'Los dos ítems quedan reservados, se rechazan las otras propuestas pendientes sobre ellos y ambos van a ver el email del otro para coordinar el encuentro.',
    confirm: 'Aceptar',
  },
  rechazar: {
    title: '¿Rechazar la propuesta?',
    message: 'Tus ítems siguen disponibles y no se puede deshacer.',
    confirm: 'Rechazar',
  },
  cancelar: {
    title: '¿Cancelar la propuesta?',
    message:
      'La propuesta queda cancelada y no se puede deshacer. Si estaba aceptada, los ítems vuelven a estar disponibles.',
    confirm: 'Cancelar propuesta',
  },
  concretar: {
    title: '¿Marcar como concretado?',
    message:
      'Confirmá que el intercambio ya se hizo. Los dos ítems pasan a intercambiados y no se puede deshacer.',
    confirm: 'Marcar como concretado',
  },
};

const RESPOND_ERROR = 'No pudimos actualizar la propuesta. Revisá tu conexión y probá de nuevo.';

function PropuestaCard({
  propuesta,
  onChanged,
}: {
  propuesta: Intercambio;
  onChanged: () => void;
}) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!accion) return;
    setSaving(true);
    setError(null);
    try {
      await respondProposal(propuesta.id, accion);
      setAccion(null);
      onChanged();
    } catch (err) {
      // Un 409 (ya no está pendiente) o 403 trae su propio mensaje; sin respuesta, se asume la conexión.
      setError(err instanceof ApiError ? err.message : RESPOND_ERROR);
      setAccion(null);
      // Si otro la resolvió antes, la lista tiene que reflejarlo.
      if (err instanceof ApiError && err.status === 409) onChanged();
    } finally {
      setSaving(false);
    }
  }

  const pendienteRecibida = propuesta.rol === 'receptor' && propuesta.estado === 'PENDIENTE';
  const aceptada = propuesta.estado === 'ACEPTADA';
  // Una pendiente la cancela solo quien la envió; una aceptada, cualquiera de las partes (HU-16).
  const puedeCancelar =
    aceptada || (propuesta.estado === 'PENDIENTE' && propuesta.rol === 'proponente');
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
        <ProposalItem
          label={ofrece}
          item={propuesta.itemOfrecido}
          esMio={propuesta.rol === 'proponente'}
        />
        <span className="proposal-arrow" aria-hidden="true">
          ⇄
        </span>
        <ProposalItem
          label={pide}
          item={propuesta.itemSolicitado}
          esMio={propuesta.rol === 'receptor'}
        />
      </div>

      {propuesta.mensaje && <p className="proposal-message">“{propuesta.mensaje}”</p>}
      {propuesta.persona.email && (
        <p className="proposal-contact">
          Para coordinar el encuentro escribile a{' '}
          <a href={`mailto:${propuesta.persona.email}`}>{propuesta.persona.email}</a>
        </p>
      )}
      <p className="muted proposal-date">
        Enviada el {dateFormat.format(new Date(propuesta.createdAt))}
      </p>

      {error && <ErrorMessage message={error} />}
      {pendienteRecibida && (
        <div className="proposal-actions">
          <Button onClick={() => setAccion('aceptar')}>Aceptar</Button>
          <Button variant="danger" onClick={() => setAccion('rechazar')}>
            Rechazar
          </Button>
        </div>
      )}
      {(aceptada || puedeCancelar) && (
        <div className="proposal-actions">
          {aceptada && (
            <Button onClick={() => setAccion('concretar')}>Marcar como concretado</Button>
          )}
          {puedeCancelar && (
            <Button variant="secondary" onClick={() => setAccion('cancelar')}>
              Cancelar propuesta
            </Button>
          )}
        </div>
      )}

      {accion && (
        <ConfirmDialog
          {...CONFIRMACION[accion]}
          variant={accion === 'rechazar' || accion === 'cancelar' ? 'danger' : 'primary'}
          loading={saving}
          onConfirm={confirmar}
          onCancel={() => setAccion(null)}
        />
      )}
    </Card>
  );
}

// Un ítem eliminado da 404 para todos y uno pausado solo lo ve su dueño: en esos casos no hay link.
function isViewable(item: ItemDePropuesta, esMio: boolean) {
  if (item.estado === 'ELIMINADO') return false;
  return item.estado !== 'PAUSADO' || esMio;
}

function ProposalItem({
  label,
  item,
  esMio,
}: {
  label: string;
  item: ItemDePropuesta;
  esMio: boolean;
}) {
  return (
    <div className="proposal-item">
      <ItemPhoto
        fotoUrl={item.fotoUrl}
        categoria={item.categoria}
        titulo={item.titulo}
        className="proposal-item-photo"
      />
      <div className="proposal-item-text">
        <p className="muted">{label}</p>
        {isViewable(item, esMio) ? (
          <Link to={`/items/${item.id}`}>{item.titulo}</Link>
        ) : (
          <span className="proposal-item-title">{item.titulo}</span>
        )}
      </div>
    </div>
  );
}
