import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { ApiError } from '../lib/api.ts';

const CARRERAS_UTN = [
  'Ingeniería en Sistemas de Información',
  'Ingeniería Química',
  'Ingeniería Mecánica',
  'Ingeniería Eléctrica',
  'Ingeniería Electrónica',
  'Ingeniería Civil',
  'Ingeniería Industrial',
  'Licenciatura en Organización Industrial',
  'Tecnicatura Universitaria en Programación',
  'Otra carrera UTN',
];

type FieldErrors = {
  nombre?: string;
  email?: string;
  password?: string;
  carrera?: string;
};

function isInstitutionalEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const host = parts[1];
  return host === 'utn.edu.ar' || host.endsWith('.utn.edu.ar');
}

export function RegisterPage() {
  const { register } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [carrera, setCarrera] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateForm(): boolean {
    const errors: FieldErrors = {};

    if (!nombre.trim()) {
      errors.nombre = 'Ingresá tu nombre completo';
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Ingresá tu email';
    } else if (!trimmedEmail.includes('@') || !isInstitutionalEmail(trimmedEmail)) {
      errors.email = 'Usá tu mail institucional';
    }

    if (!carrera.trim()) {
      errors.carrera = 'Seleccioná o ingresá tu carrera';
    }

    if (password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);

    // Validación previa al envío (Criterio: menos de 8 caracteres no se envía y se marca el campo)
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      await register({
        nombre: nombre.trim(),
        email: email.trim(),
        carrera: carrera.trim(),
        password,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const conflictMsg = 'Ese email ya tiene una cuenta';
          setFieldErrors((prev) => ({ ...prev, email: conflictMsg }));
          setGeneralError(conflictMsg);
        } else if (err.status === 400 && Array.isArray(err.details)) {
          const newErrors: FieldErrors = {};
          for (const item of err.details as { field: string; message: string }[]) {
            if (item.field.includes('email')) newErrors.email = item.message;
            else if (item.field.includes('password')) newErrors.password = item.message;
            else if (item.field.includes('nombre')) newErrors.nombre = item.message;
            else if (item.field.includes('carrera')) newErrors.carrera = item.message;
          }
          setFieldErrors(newErrors);
          setGeneralError(err.message);
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('No se pudo conectar con el servidor. Probá de nuevo en unos minutos.');
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>TruequeUTN</h1>
        <p className="subtitle">
          Intercambiá materiales de estudio con otros estudiantes de la UTN
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2>Crear cuenta</h2>

          {generalError && (
            <p className="form-error" role="alert">
              {generalError}
            </p>
          )}

          <label className="field">
            <span>Nombre completo</span>
            <input
              type="text"
              name="nombre"
              autoComplete="name"
              placeholder="Ej. Juan Pérez"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                if (fieldErrors.nombre) {
                  setFieldErrors((prev) => ({ ...prev, nombre: undefined }));
                }
              }}
              className={fieldErrors.nombre ? 'input-error' : ''}
              required
            />
            {fieldErrors.nombre && (
              <span className="field-error" role="alert">
                {fieldErrors.nombre}
              </span>
            )}
          </label>

          <label className="field">
            <span>Email institucional</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="tu.nombre@utn.edu.ar"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              className={fieldErrors.email ? 'input-error' : ''}
              required
            />
            {fieldErrors.email && (
              <span className="field-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </label>

          <label className="field">
            <span>Carrera</span>
            <select
              name="carrera"
              value={carrera}
              onChange={(e) => {
                setCarrera(e.target.value);
                if (fieldErrors.carrera) {
                  setFieldErrors((prev) => ({ ...prev, carrera: undefined }));
                }
              }}
              className={fieldErrors.carrera ? 'input-error' : ''}
              required
            >
              <option value="">Seleccioná tu carrera</option>
              {CARRERAS_UTN.map((c) => (
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

          <label className="field">
            <span>Contraseña</span>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                className={fieldErrors.password ? 'input-error' : ''}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="field-error" role="alert">
                {fieldErrors.password}
              </span>
            )}
          </label>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          ¿Ya tenés cuenta? <Link to="/login">Ya tengo cuenta</Link>
        </p>
      </div>
    </main>
  );
}
