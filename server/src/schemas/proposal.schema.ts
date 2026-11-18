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

const INVALID_PROPOSAL_ID = 'El id de la propuesta no es válido';

export const proposalIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: INVALID_PROPOSAL_ID })
    .int(INVALID_PROPOSAL_ID)
    .positive(INVALID_PROPOSAL_ID),
});

// Body de PATCH /api/proposals/:id. Cada acción tiene sus propias reglas de quién y cuándo:
// - aceptar / rechazar: el receptor, sobre una PENDIENTE (HU-08).
// - cancelar: quien la envió si está PENDIENTE, o cualquiera de las partes si está ACEPTADA (HU-16).
// - concretar: cualquiera de las partes, sobre una ACEPTADA (HU-17).
export const ACCIONES_PROPUESTA = ['aceptar', 'rechazar', 'cancelar', 'concretar'] as const;

export const updateProposalSchema = z.object({
  accion: z.enum(ACCIONES_PROPUESTA, {
    error: 'La acción debe ser "aceptar", "rechazar", "cancelar" o "concretar"',
  }),
});

export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type RespondProposalBody = { accion: 'aceptar' | 'rechazar' };

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
