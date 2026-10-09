import { Link } from 'react-router';

// Placeholder para que el link "Crear cuenta" del login tenga destino.
// Se reemplaza por el formulario real en HU-01 (Registro de usuario).
export function RegisterPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Crear cuenta</h1>
        <p className="muted">El registro de usuarios todavía no está disponible.</p>
        <p className="auth-switch">
          <Link to="/login">Ya tengo cuenta</Link>
        </p>
      </div>
    </main>
  );
}
