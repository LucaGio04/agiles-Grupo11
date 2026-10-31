import type { Item } from './items.ts';

// Calificación recibida en el perfil público. Quien calificó no trae email.
export type CalificacionPublica = {
  id: number;
  puntaje: number;
  comentario: string | null;
  createdAt: string;
  evaluador: { id: number; nombre: string };
};

// Respuesta de GET /api/users/:id. createdAt es la fecha de alta; la pantalla no la muestra.
export type PerfilPublico = {
  id: number;
  nombre: string;
  carrera: string;
  createdAt: string;
  reputacionPromedio: number | null;
  cantidadResenas: number;
  cantidadIntercambios: number;
  items: Item[];
  ultimasCalificaciones: CalificacionPublica[];
};
