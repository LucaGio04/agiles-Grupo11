import { createContext } from 'react';

export type User = {
  id: number;
  nombre: string;
  email: string;
  carrera: string;
};

export type RegisterData = {
  nombre: string;
  email: string;
  password: string;
  carrera: string;
};

// checking: al cargar la app, mientras se valida el token guardado contra el backend.
export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
