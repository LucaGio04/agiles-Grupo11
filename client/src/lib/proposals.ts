import type { EstadoItem } from './items.ts';

export type EstadoPropuesta = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'CANCELADA' | 'CONCRETADA';

export type CalificacionResumen = {
  puntaje: number;
  comentario: string | null;
};

// Un intercambio visto desde el usuario logueado.
export type Intercambio = {
  id: number;
  estado: EstadoPropuesta;
  mensaje: string | null;
  createdAt: string;
  updatedAt: string;
  rol: 'proponente' | 'receptor';
  persona: { id: number; nombre: string };
  itemSolicitado: { id: number; titulo: string; estado: EstadoItem };
  itemOfrecido: { id: number; titulo: string; estado: EstadoItem };
  calificacionDada: CalificacionResumen | null;
  calificacionRecibida: CalificacionResumen | null;
};
