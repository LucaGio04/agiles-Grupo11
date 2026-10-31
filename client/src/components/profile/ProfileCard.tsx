import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/useAuth.ts';
import { ApiError } from '../../lib/api.ts';
import { CARRERAS_UTN } from '../../lib/carreras.ts';
import { getMyProfile, updateMyProfile, type Profile } from '../../lib/profile.ts';
import { Button } from '../ui/Button.tsx';
import { ErrorMessage } from '../ui/ErrorMessage.tsx';
import { Input } from '../ui/Input.tsx';
import { Loader } from '../ui/Loader.tsx';
import '../../styles/profile.css';

type Field = 'nombre' | 'carrera';
type FieldErrors = Partial<Record<Field, string>>;

const NOMBRE_MAX = 80;
const LOAD_ERROR = 'No pudimos cargar tus datos. Revisá tu conexión y probá de nuevo.';
const SAVE_ERROR = 'No pudimos guardar los cambios. Revisá tu conexión y probá de nuevo.';
const fechaLarga = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' });

function Reputacion({ reputacion }: { reputacion: Profile['reputacion'] }) {
  const { promedio, cantidad } = reputacion;
  if (cantidad === 0 || promedio === null) {
    return <span className="muted">Sin calificaciones todavía</span>;
  }
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

// Datos del usuario logueado en /perfil, con modo vista y modo edición (HU-11).
// Solo se editan nombre y carrera; el email se muestra pero no se puede cambiar.
export function ProfileCard() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState('');
  const [carrera, setCarrera] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : LOAD_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  function retryLoad() {
    setLoadError(null);
    setRetry((n) => n + 1);
  }

  function startEditing(current: Profile) {
    setNombre(current.user.nombre);
    setCarrera(current.user.carrera);
    setFieldErrors({});
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  }

  function clearError(field: Field) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);

    const errors: FieldErrors = {};
    if (!nombre.trim()) errors.nombre = 'Ingresá tu nombre';
    if (!carrera.trim()) errors.carrera = 'Elegí tu carrera';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const updated = await updateMyProfile({ nombre: nombre.trim(), carrera: carrera.trim() });
      const { id, email } = updated.user;
      setProfile(updated);
      // La navbar y el resto de la app usan el usuario de la sesión: se actualiza también.
      updateUser({ id, email, nombre: updated.user.nombre, carrera: updated.user.carrera });
      setEditing(false);
      setSaved(true);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const errors: FieldErrors = {};
        for (const { field, message } of err.details as { field: string; message: string }[]) {
          const name = field.replace(/^body\./, '');
          if (name === 'nombre' || name === 'carrera') errors[name] ??= message;
        }
        setFieldErrors(errors);
        if (Object.keys(errors).length === 0) setSaveError(err.message);
      } else {
        setSaveError(err instanceof ApiError ? err.message : SAVE_ERROR);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <section className="profile-card">
        <ErrorMessage message={loadError} />
        <Button variant="secondary" onClick={retryLoad}>
          Reintentar
        </Button>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="profile-card">
        <Loader label="Cargando tus datos..." />
      </section>
    );
  }

  const { user, reputacion, intercambiosConcretados } = profile;
  // Si la carrera guardada no está en la lista (por ejemplo, la de un usuario viejo),
  // se agrega como opción para que el select la muestre elegida.
  const carreras = CARRERAS_UTN.includes(user.carrera)
    ? CARRERAS_UTN
    : [user.carrera, ...CARRERAS_UTN];

  return (
    <section className="profile-card" aria-labelledby="mis-datos">
      <header className="profile-card-header">
        <div>
          <p className="eyebrow">Mi perfil</p>
          <h1 id="mis-datos">{user.nombre}</h1>
        </div>
        {!editing && (
          <Button variant="secondary" onClick={() => startEditing(profile)}>
            Editar datos
          </Button>
        )}
      </header>

      {saved && (
        <p className="form-success" role="status">
          Listo, actualizamos tus datos.
        </p>
      )}

      {editing ? (
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          {saveError && <ErrorMessage message={saveError} />}

          <Input
            label="Nombre completo"
            name="nombre"
            autoComplete="name"
            maxLength={NOMBRE_MAX}
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              clearError('nombre');
            }}
            error={fieldErrors.nombre}
            disabled={saving}
          />

          <label className="field" htmlFor="carrera">
            <span>Carrera</span>
            <select
              id="carrera"
              name="carrera"
              value={carrera}
              onChange={(e) => {
                setCarrera(e.target.value);
                clearError('carrera');
              }}
              className={fieldErrors.carrera ? 'input-error' : undefined}
              aria-invalid={fieldErrors.carrera ? true : undefined}
              disabled={saving}
            >
              {carreras.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {fieldErrors.carrera && (
              <span className="field-error" role="alert">
                {fieldErrors.carrera}
              </span>
            )}
          </label>

          <label className="field" htmlFor="email">
            <span>Email institucional</span>
            <input id="email" name="email" type="email" value={user.email} readOnly disabled />
            <span className="field-hint">El email no se puede cambiar.</span>
          </label>

          <div className="profile-form-actions">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      ) : (
        <dl className="spec-sheet profile-sheet">
          <div>
            <dt>Nombre</dt>
            <dd>{user.nombre}</dd>
          </div>
          <div>
            <dt>Carrera</dt>
            <dd>{user.carrera}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd className="profile-email">{user.email}</dd>
          </div>
          <div>
            <dt>Miembro desde</dt>
            <dd>{fechaLarga.format(new Date(user.createdAt))}</dd>
          </div>
          <div>
            <dt>Reputación</dt>
            <dd>
              <Reputacion reputacion={reputacion} />
            </dd>
          </div>
          <div>
            <dt>Intercambios concretados</dt>
            <dd className="profile-count">{intercambiosConcretados}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
