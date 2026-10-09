import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from '../lib/api.ts';
import { AuthContext, type AuthStatus, type RegisterData, type User } from './AuthContext.ts';
import { tokenStorage } from './tokenStorage.ts';

type AuthResponse = { user: User; token: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.get() ? 'checking' : 'anonymous'
  );

  // Al cargar la app, si hay un token guardado se valida contra el backend para restaurar la sesión.
  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) return;

    let cancelled = false;
    apiFetch<{ user: User }>('/api/auth/me', { token })
      .then(({ user }) => {
        if (cancelled) return;
        setUser(user);
        setStatus('authenticated');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Token vencido o inválido: se descarta. Si el backend no responde, se conserva
        // para reintentar en la próxima carga, pero por ahora se trata como no logueado.
        if (err instanceof ApiError && err.status === 401) tokenStorage.clear();
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user, token } = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    tokenStorage.set(token);
    setUser(user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const { user, token } = await apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: data,
    });
    tokenStorage.set(token);
    setUser(user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
