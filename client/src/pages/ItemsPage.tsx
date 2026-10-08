import { useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';

// Destino después del login. El listado real de ítems se implementa en su propia historia;
// por ahora muestra quién está logueado y permite cerrar la sesión.
export function ItemsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">TruequeUTN</span>
        <div className="topbar-user">
          <span>Hola, {user?.nombre}</span>
          <button type="button" className="btn-secondary" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>
      <main className="page">
        <h1>Ítems disponibles</h1>
        <p className="muted">El listado de ítems todavía no está disponible.</p>
      </main>
    </>
  );
}
