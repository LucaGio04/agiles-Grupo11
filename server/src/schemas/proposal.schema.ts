import { z } from 'zod';
import { EstadoPropuesta } from '../generated/prisma/enums.js';

// Filtros opcionales de GET /api/proposals. "?status=" o "?type=" vacíos equivalen a no filtrar.
// type=sent trae las que envió el usuario; type=received, las que recibió.
export const listProposalsQuerySchema = z.object({
  type: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['sent', 'received'], { error: 'El tipo debe ser "sent" o "received"' }).optional()
  ),
  status: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(EstadoPropuesta, { error: 'El estado de la propuesta no es válido' }).optional()
  ),
});

export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
