import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { ApiError } from '../lib/api.ts';

const INVALID_CREDENTIALS = 'Email o contraseña incorrectos';

function errorMessage(err: unknown) {
  if (err instanceof ApiError) {
    return err.status === 401 ? INVALID_CREDENTIALS : err.message;
  }
  return 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.';
}

// Página de inicio del sistema. Al iniciar sesión, RedirectIfAuthenticated lleva al listado de ítems.
export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
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

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Iniciar sesión</h2>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="tu.nombre@utn.edu.ar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </label>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="auth-switch">
          ¿Todavía no tenés usuario? <Link to="/registro">Crear cuenta</Link>
        </p>
      </div>
    </main>
  );
}
