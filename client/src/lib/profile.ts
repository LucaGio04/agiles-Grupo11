import type { User } from '../auth/AuthContext.ts';
import { apiFetch } from './api.ts';

// Perfil propio (HU-11): respuesta de GET y PATCH /api/users/me.
export type Profile = {
  user: User & { createdAt: string };
  reputacion: { promedio: number | null; cantidad: number };
  intercambiosConcretados: number;
};

export type ProfileChanges = { nombre?: string; carrera?: string };

export function getMyProfile() {
  return apiFetch<Profile>('/api/users/me');
}

export function updateMyProfile(changes: ProfileChanges) {
  return apiFetch<Profile>('/api/users/me', { method: 'PATCH', body: changes });
}
