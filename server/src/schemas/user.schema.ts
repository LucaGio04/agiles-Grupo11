import { z } from 'zod';
import { EstadoItem } from '../generated/prisma/enums.js';

// Filtro opcional de GET /api/users/me/items. "?status=" vacío equivale a no filtrar.
export const listMyItemsQuerySchema = z.object({
  status: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(EstadoItem, { error: 'El estado no es válido' }).optional()
  ),
});

export type ListMyItemsQuery = z.infer<typeof listMyItemsQuerySchema>;
