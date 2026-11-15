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

const INVALID_PROPOSAL_ID = 'El id de la propuesta no es válido';

// Mismo mensaje para cualquier id inválido: no numérico (abc), decimal (7.5), cero o negativo.
export const proposalIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: INVALID_PROPOSAL_ID })
    .int(INVALID_PROPOSAL_ID)
    .positive(INVALID_PROPOSAL_ID),
});

// Body de PATCH /api/proposals/:id. Por ahora la única acción es cancelar.
export const cancelProposalSchema = z.object({
  accion: z.literal('cancelar', { error: 'La acción tiene que ser cancelar' }),
});

export type CancelProposalInput = z.infer<typeof cancelProposalSchema>;
