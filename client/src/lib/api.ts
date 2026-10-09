const API_URL = import.meta.env.VITE_API_URL;

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
  body?: unknown;
  token?: string | null;
};

// Wrapper de fetch para la API: agrega JSON y el token, y convierte las respuestas de error en ApiError.
// Si no hay conexión con el backend, fetch lanza un TypeError que se propaga tal cual.
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {}
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
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
