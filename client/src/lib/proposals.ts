import type { Categoria, EstadoItem } from './items.ts';

export type EstadoPropuesta = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'CANCELADA' | 'CONCRETADA';

export const ESTADOS_PROPUESTA: Record<EstadoPropuesta, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  CONCRETADA: 'Concretada',
};

export type TipoPropuesta = 'sent' | 'received';

export type ItemDePropuesta = {
  id: number;
  titulo: string;
  estado: EstadoItem;
  categoria: Categoria;
  fotoUrl: string | null;
};

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
  // El email solo viene cuando la propuesta está ACEPTADA o CONCRETADA.
  persona: { id: number; nombre: string; email?: string };
  itemSolicitado: ItemDePropuesta;
  itemOfrecido: ItemDePropuesta;
  calificacionDada: CalificacionResumen | null;
  calificacionRecibida: CalificacionResumen | null;
};
