import { useState, type FormEvent } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/useAuth.ts';
import { Button } from '../ui/Button.tsx';

export function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const onHome = pathname === '/';

  // El buscador muestra la búsqueda de la URL del inicio (?q=), así queda al día si se limpia
  // desde el listado o se vuelve atrás con el navegador.
  const urlQuery = onHome ? (searchParams.get('q') ?? '') : '';
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  const [menuOpen, setMenuOpen] = useState(false);

  // Busca en el inicio. Si ya se estaba filtrando por categoría, el filtro se mantiene (HU-04).
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    const categoria = onHome ? searchParams.get('categoria') : null;
    const trimmed = query.trim();
    if (trimmed) params.set('q', trimmed);
    if (categoria) params.set('categoria', categoria);
    const search = params.toString();
    navigate(search ? `/?${search}` : '/');
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
        <NavLink
          to="/"
          className="navbar-brand"
          onClick={closeMenu}
          aria-label="TruequeUTN, inicio"
        >
          <span className="wordmark">
            Trueque<span className="wordmark-utn">UTN</span>
          </span>
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
            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                isActive ? 'navbar-link navbar-link-active' : 'navbar-link'
              }
              onClick={closeMenu}
            >
              Perfil
            </NavLink>
          </nav>

          <Button variant="secondary" className="navbar-logout" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
