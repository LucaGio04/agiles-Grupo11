import { tokenStorage } from '../auth/tokenStorage.ts';
import type { EstadoItem, Item } from './items.ts';
import type { EstadoPropuesta, Intercambio } from './proposals.ts';

const API_URL = import.meta.env.VITE_API_URL;

const SKIP_UNAUTHORIZED_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/me'];

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// Error de la API con el formato estándar del backend: { error: { code, message } }.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  // Un objeto se envía como JSON; un FormData (subida de archivos) se envía tal cual.
  body?: unknown;
  token?: string | null;
};

function shouldSkipUnauthorizedHandler(path: string) {
  return SKIP_UNAUTHORIZED_PATHS.some(
    (skipPath) => path === skipPath || path.startsWith(`${skipPath}?`)
  );
}

// Wrapper de fetch para la API: agrega JSON y el token, y convierte las respuestas de error en ApiError.
// Si no hay conexión con el backend, fetch lanza un TypeError que se propaga tal cual.
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {}
) {
  const headers: Record<string, string> = {};
  const isFormData = body instanceof FormData;
  // Con FormData el navegador arma solo el Content-Type (multipart con su boundary): no hay que pisarlo.
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const authToken = token !== undefined ? token : tokenStorage.get();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !shouldSkipUnauthorizedHandler(path)) {
      unauthorizedHandler?.();
    }

    const error = (
      data as { error?: { code?: string; message?: string; details?: unknown } } | null
    )?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Error inesperado del servidor',
      error?.details
    );
  }
  return data as T;
}

// Publicaciones del usuario logueado. Sin status trae todos los estados, pausados incluidos.
export function getMyItems(status?: EstadoItem) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString();
  return apiFetch<{ data: Item[] }>(`/api/users/me/items${query ? `?${query}` : ''}`);
}

// Propuestas en las que participa el usuario logueado.
export function getMyProposals(status?: EstadoPropuesta) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString();
  return apiFetch<{ data: Intercambio[] }>(`/api/proposals${query ? `?${query}` : ''}`);
}
