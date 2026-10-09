import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Loader } from '../components/ui/Loader.tsx';
import { useAuth } from './useAuth.ts';

// Solo para usuarios logueados: si no hay sesión, manda a /login recordando a dónde quería ir.
export function PrivateRoute() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** @deprecated Usar PrivateRoute */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

// Solo para usuarios sin sesión (login, registro). Al quedar logueado redirige a la página
// que quería ver antes de que se le pidiera la sesión, o al inicio.
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (isAuthenticated) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }
  return children;
}
