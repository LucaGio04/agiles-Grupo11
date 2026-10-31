import { z } from 'zod';
import { EstadoPropuesta } from '../generated/prisma/enums.js';

// Filtro opcional de GET /api/proposals. "?status=" vacío equivale a no filtrar.
export const listProposalsQuerySchema = z.object({
  status: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(EstadoPropuesta, { error: 'El estado de la propuesta no es válido' }).optional()
  ),
});

export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
