import { z } from 'zod';
import { Categoria } from '../generated/prisma/enums.js';

// Filtros del listado (HU-04). Todos opcionales; los valores vacíos se toman como "sin filtro".
export const ITEMS_PAGE_SIZE = 12;
export const ITEMS_MAX_PAGE_SIZE = 50;

const positiveInt = (message: string) =>
  z.coerce.number({ error: message }).int(message).positive(message);

export const listItemsQuerySchema = z.object({
  query: z
    .string({ error: 'La búsqueda no es válida' })
    .trim()
    .max(100, 'La búsqueda puede tener hasta 100 caracteres')
    .optional()
    .transform((value) => value || undefined),
  // Un "?category=" vacío (el chip "Todas") equivale a no filtrar.
  category: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(Categoria, { error: 'La categoría no es válida' }).optional()
  ),
  page: positiveInt('La página tiene que ser un número mayor a 0').default(1),
  limit: positiveInt('El límite tiene que ser un número mayor a 0')
    .max(ITEMS_MAX_PAGE_SIZE, `El límite máximo es ${ITEMS_MAX_PAGE_SIZE}`)
    .default(ITEMS_PAGE_SIZE),
});

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
