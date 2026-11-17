import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, apiFetch, getMyProposals } from '../lib/api.ts';
import type { EstadoPropuesta, Intercambio } from '../lib/proposals.ts';

const ESTADOS_FILTRO: { valor: EstadoPropuesta | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'PENDIENTE', etiqueta: 'Pendientes' },
  { valor: 'ACEPTADA', etiqueta: 'Aceptadas' },
  { valor: 'CONCRETADA', etiqueta: 'Concretadas' },
  { valor: 'RECHAZADA', etiqueta: 'Rechazadas' },
  { valor: 'CANCELADA', etiqueta: 'Canceladas' },
];

export function PropuestasPage() {
  const [proposals, setProposals] = useState<Intercambio[] | null>(null);
  const [filtro, setFiltro] = useState<EstadoPropuesta | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null);
  const [concretandoId, setConcretandoId] = useState<number | null>(null);

  async function loadProposals(status?: EstadoPropuesta) {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyProposals(status);
      setProposals(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las propuestas. Intentá de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProposals(filtro ? filtro : undefined);
  }, [filtro]);

  async function handleConcretar(id: number) {
    setConcretandoId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/proposals/${id}`, {
        method: 'PATCH',
        body: { accion: 'concretar' },
      });
      await loadProposals(filtro ? filtro : undefined);
    } catch (err) {
      setActionError({
        id,
        message:
          err instanceof ApiError
            ? err.message
            : 'No se pudo marcar como concretado. Intentá de nuevo.',
      });
    } finally {
      setConcretandoId(null);
    }
  }

  return (
    <div className="page proposals-page">
      <header className="items-header">
        <div>
          <p className="eyebrow">Intercambios</p>
          <h1>Propuestas</h1>
        </div>
        <p className="muted">
          {proposals ? `${proposals.length} ${proposals.length === 1 ? 'propuesta' : 'propuestas'}` : ''}
        </p>
      </header>

      <div className="proposals-filter-bar" style={{ margin: '1rem 0' }}>
        <label htmlFor="filtro-estado" className="field" style={{ maxWidth: '240px' }}>
          <span>Filtrar por estado</span>
          <select
            id="filtro-estado"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as EstadoPropuesta | '')}
          >
            {ESTADOS_FILTRO.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <Loader label="Cargando propuestas..." />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && proposals && proposals.length === 0 && (
        <section className="empty-state">
          <p className="eyebrow">Sin actividad</p>
          <h2>No tenés propuestas {filtro ? 'en este estado' : 'todavía'}</h2>
          <p className="muted">
            {filtro
              ? 'Probá cambiando el filtro para ver otras propuestas.'
              : 'Explorá publicaciones para proponer intercambios con otros estudiantes.'}
          </p>
          <Link to="/" className="btn-primary">
            Explorar publicaciones
          </Link>
        </section>
      )}

      {!loading && !error && proposals && proposals.length > 0 && (
        <ul className="profile-list" style={{ marginTop: '1.5rem' }}>
          {proposals.map((prop) => {
            const esAceptada = prop.estado === 'ACEPTADA';
            const accionando = concretandoId === prop.id;

            return (
              <li key={prop.id} className="card profile-exchange-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <span className={`status-chip status-${prop.estado.toLowerCase()}`}>
                    {prop.estado}
                  </span>
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    Rol: {prop.rol === 'proponente' ? 'Enviada' : 'Recibida'}
                  </span>
                </div>

                <div style={{ margin: '0.5rem 0' }}>
                  <p style={{ margin: '0 0 0.25rem 0' }}>
                    <strong>Contraparte:</strong>{' '}
                    <Link to={`/usuarios/${prop.persona.id}`}>{prop.persona.nombre}</Link>
                  </p>
                  <p style={{ margin: '0 0 0.25rem 0' }}>
                    <strong>Ítem solicitado:</strong> {prop.itemSolicitado.titulo} (
                    {prop.itemSolicitado.estado.toLowerCase()})
                  </p>
                  <p style={{ margin: '0 0 0.25rem 0' }}>
                    <strong>Ítem ofrecido:</strong> {prop.itemOfrecido.titulo} (
                    {prop.itemOfrecido.estado.toLowerCase()})
                  </p>
                  {prop.mensaje && (
                    <p className="muted" style={{ fontStyle: 'italic', margin: '0.5rem 0' }}>
                      "{prop.mensaje}"
                    </p>
                  )}
                </div>

                {actionError && actionError.id === prop.id && (
                  <p className="form-error" role="alert">
                    {actionError.message}
                  </p>
                )}

                <div className="profile-item-actions">
                  {esAceptada && (
                    <Button
                      variant="primary"
                      onClick={() => handleConcretar(prop.id)}
                      loading={accionando}
                      disabled={accionando}
                    >
                      Marcar como concretado
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
