import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './useAuth.ts';

function Checking() {
  return <p className="page-loading">Cargando...</p>;
}

// Solo para usuarios logueados: si no hay sesión, manda a /login recordando a dónde quería ir.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <Checking />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

// Solo para usuarios sin sesión (login, registro). Al quedar logueado (por ejemplo, después del
// login) redirige a la página que quería ver antes de que se le pidiera la sesión, o al listado de ítems.
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <Checking />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/items';
    return <Navigate to={from} replace />;
  }
  return children;
}
