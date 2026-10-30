// Tipos y etiquetas de los ítems. Los valores coinciden con los enums de Prisma del backend.

export const CATEGORIAS = {
  LIBRO: 'Libro',
  APUNTE: 'Apunte',
  CALCULADORA: 'Calculadora',
  INSTRUMENTAL: 'Instrumental',
  OTRO: 'Otro',
} as const;

export const ESTADOS_CONSERVACION = {
  NUEVO: 'Nuevo',
  BUENO: 'Bueno',
  USADO: 'Usado',
} as const;

export type Categoria = keyof typeof CATEGORIAS;
export type EstadoConservacion = keyof typeof ESTADOS_CONSERVACION;
export type EstadoItem = 'DISPONIBLE' | 'RESERVADO' | 'INTERCAMBIADO' | 'PAUSADO';

export type Item = {
  id: number;
  titulo: string;
  descripcion: string | null;
  categoria: Categoria;
  estadoConservacion: EstadoConservacion;
  materia: string | null;
  fotoUrl: string | null;
  estado: EstadoItem;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateItemData = {
  titulo: string;
  categoria: Categoria;
  estadoConservacion: EstadoConservacion;
  descripcion?: string;
  materia?: string;
  fotoUrl?: string;
};

export type UpdateItemData = {
  titulo?: string;
  categoria?: Categoria;
  estadoConservacion?: EstadoConservacion;
  descripcion?: string | null;
  materia?: string | null;
  fotoUrl?: string | null;
  estado?: 'DISPONIBLE' | 'PAUSADO';
};

export const ESTADOS_ITEM: Record<EstadoItem, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADO: 'Reservado',
  INTERCAMBIADO: 'Intercambiado',
  PAUSADO: 'Pausado',
};

export type ItemOwner = {
  id: number;
  nombre: string;
  carrera: string;
  reputacion: { promedio: number | null; cantidad: number };
};

export type ItemDetail = { item: Item; owner: ItemOwner };

// Respuesta de GET /api/items (HU-04).
export type ItemsPageResult = {
  data: Item[];
  page: number;
  totalPages: number;
  total: number;
};
