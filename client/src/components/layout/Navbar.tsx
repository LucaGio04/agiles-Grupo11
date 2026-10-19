import { useState, type FormEvent } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.ts';
import { Button } from '../ui/Button.tsx';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/');
    setMenuOpen(false);
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
    setMenuOpen(false);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand" onClick={closeMenu}>
          TruequeUTN
        </NavLink>

        <button
          type="button"
          className="navbar-toggle"
          aria-expanded={menuOpen}
          aria-controls="navbar-menu"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="navbar-toggle-bar" />
          <span className="navbar-toggle-bar" />
          <span className="navbar-toggle-bar" />
        </button>

        <div
          id="navbar-menu"
          className={['navbar-menu', menuOpen ? 'navbar-menu-open' : ''].join(' ')}
        >
          <form className="navbar-search" onSubmit={handleSearch}>
            <input
              type="search"
              name="q"
              placeholder="Buscar materiales..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar materiales"
            />
          </form>

          <nav className="navbar-links" aria-label="Navegación principal">
            <NavLink
              to="/publicar"
              className={({ isActive }) =>
                isActive ? 'navbar-link navbar-link-active' : 'navbar-link'
              }
              onClick={closeMenu}
            >
              Publicar
            </NavLink>
            <NavLink
              to="/propuestas"
              className={({ isActive }) =>
                isActive ? 'navbar-link navbar-link-active' : 'navbar-link'
              }
              onClick={closeMenu}
            >
              Propuestas
            </NavLink>
          </nav>

          <div className="navbar-user">
            {user && (
              <NavLink
                to="/perfil"
                className={({ isActive }) =>
                  isActive ? 'navbar-user-link navbar-user-link-active' : 'navbar-user-link'
                }
                title="Ir a mi perfil"
                onClick={closeMenu}
              >
                <span className="navbar-avatar" aria-hidden="true">
                  {user.nombre.trim().charAt(0).toUpperCase()}
                </span>
                <span className="navbar-user-name">{user.nombre}</span>
              </NavLink>
            )}
            <Button variant="secondary" className="navbar-logout" onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
