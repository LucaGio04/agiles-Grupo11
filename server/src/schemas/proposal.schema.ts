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

// Texto opcional: se recorta y un string vacío se toma como "no enviado".
const optionalMessage = z
  .string()
  .trim()
  .max(300, 'El mensaje puede tener hasta 300 caracteres')
  .optional()
  .transform((value) => value || undefined);

// Body de POST /api/items/:id/propose (HU-06). El receptor y el proponente no se aceptan:
// salen del dueño del ítem solicitado y del token.
export const proposeItemSchema = z.object({
  itemOfrecidoId: z
    .number({ error: 'Elegí el ítem que querés ofrecer' })
    .int('Elegí el ítem que querés ofrecer')
    .positive('Elegí el ítem que querés ofrecer'),
  mensaje: optionalMessage,
});

export type ProposeItemInput = z.infer<typeof proposeItemSchema>;

export const updateProposalSchema = z.object({
  accion: z.enum(['concretar'], { error: 'Acción no válida' }),
});
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
