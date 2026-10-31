import { z } from 'zod';

// Filtro opcional de GET /api/users/me/items. "?status=" vacío equivale a no filtrar.
// ELIMINADO no es un filtro válido: los ítems eliminados no se listan.
export const listMyItemsQuerySchema = z.object({
  status: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .enum(['DISPONIBLE', 'RESERVADO', 'PAUSADO', 'INTERCAMBIADO'], {
        error: 'El estado no es válido',
      })
      .optional()
  ),
});

export type ListMyItemsQuery = z.infer<typeof listMyItemsQuerySchema>;

const INVALID_USER_ID = 'El id del usuario no es válido';

// Mismo criterio que el id de un ítem: entero positivo. "abc", "7.5", "0" y "-3" son inválidos.
export const userIdParamsSchema = z.object({
  id: z.coerce.number({ error: INVALID_USER_ID }).int(INVALID_USER_ID).positive(INVALID_USER_ID),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
