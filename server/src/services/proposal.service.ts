import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { EstadoPropuesta } from '../generated/prisma/enums.js';
import type {
  ListProposalsQuery,
  ProposeItemInput,
  RespondProposalBody,
} from '../schemas/proposal.schema.js';

type RatingRow = { puntaje: number; comentario: string | null };

function toRating(rating: RatingRow | undefined) {
  if (!rating) return null;
  return { puntaje: rating.puntaje, comentario: rating.comentario };
}

const itemSelect = {
  id: true,
  titulo: true,
  estado: true,
  categoria: true,
  fotoUrl: true,
} as const;

// Misma forma que cada elemento de GET /api/proposals. Aceptar, rechazar y cancelar responden una de estas.
const proposalInclude = {
  proponente: { select: { id: true, nombre: true, email: true } },
  receptor: { select: { id: true, nombre: true, email: true } },
  itemSolicitado: { select: itemSelect },
  itemOfrecido: { select: itemSelect },
  calificaciones: {
    select: { puntaje: true, comentario: true, evaluadorId: true, evaluadoId: true },
  },
} as const;

function findProposals(where: Prisma.ProposalWhereInput) {
  return prisma.proposal.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    include: proposalInclude,
  });
}

type ProposalRow = Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>;

const EMAIL_VISIBLE: EstadoPropuesta[] = ['ACEPTADA', 'CONCRETADA'];

// La persona, los ítems y las calificaciones se arman desde el punto de vista de quien consulta.
function toView(proposal: ProposalRow, userId: number) {
  const soyProponente = proposal.proponenteId === userId;
  const dada = proposal.calificaciones.find((rating) => rating.evaluadorId === userId);
  const recibida = proposal.calificaciones.find((rating) => rating.evaluadoId === userId);
  const { email, ...persona } = soyProponente ? proposal.receptor : proposal.proponente;
  return {
    id: proposal.id,
    estado: proposal.estado,
    mensaje: proposal.mensaje,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    rol: soyProponente ? ('proponente' as const) : ('receptor' as const),
    // El email de la otra persona solo se muestra cuando el trueque se acordó (para coordinar el encuentro).
    persona: EMAIL_VISIBLE.includes(proposal.estado) ? { ...persona, email } : persona,
    itemSolicitado: proposal.itemSolicitado,
    itemOfrecido: proposal.itemOfrecido,
    calificacionDada: toRating(dada),
    calificacionRecibida: toRating(recibida),
  };
}

// Propuestas en las que participa el usuario logueado. No lista las de terceros.
// Con type=sent / type=received se limita a las enviadas / recibidas; sin type trae ambas.
// Responde además `pendientesRecibidas`: cuántas propuestas recibidas esperan respuesta, sin
// importar los filtros (es el contador de la pestaña "Recibidas").
export async function listMyProposals(
  userId: number,
  {
    status,
    type,
  }: { status?: ListProposalsQuery['status']; type?: ListProposalsQuery['type'] } = {}
) {
  const participa: Prisma.ProposalWhereInput =
    type === 'sent'
      ? { proponenteId: userId }
      : type === 'received'
        ? { receptorId: userId }
        : { OR: [{ proponenteId: userId }, { receptorId: userId }] };

  const [proposals, pendientesRecibidas] = await Promise.all([
    findProposals({ ...participa, ...(status ? { estado: status } : {}) }),
    prisma.proposal.count({ where: { receptorId: userId, estado: 'PENDIENTE' } }),
  ]);

  // Las recibidas pendientes van primero; el resto conserva el orden por última actividad.
  const pendienteRecibida = (proposal: ProposalRow) =>
    proposal.receptorId === userId && proposal.estado === 'PENDIENTE' ? 0 : 1;
  const ordenadas = [...proposals].sort((a, b) => pendienteRecibida(a) - pendienteRecibida(b));

  return {
    data: ordenadas.map((proposal) => toView(proposal, userId)),
    pendientesRecibidas,
  };
}

// El receptor acepta o rechaza una propuesta pendiente (HU-08).
// Al aceptar, todo el cambio de estados va en una transacción: la propuesta pasa a ACEPTADA, los dos
// ítems a RESERVADO y el resto de las pendientes sobre esos ítems a RECHAZADA.
export async function respondProposal(
  userId: number,
  proposalId: number,
  accion: RespondProposalBody['accion']
) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { receptorId: true, estado: true, itemSolicitadoId: true, itemOfrecidoId: true },
  });
  if (!proposal) throw AppError.notFound('La propuesta no existe');
  if (proposal.receptorId !== userId) {
    throw AppError.forbidden('Solo quien recibió la propuesta puede aceptarla o rechazarla');
  }
  const noPendiente = () => AppError.conflict('La propuesta ya no está pendiente');
  if (proposal.estado !== 'PENDIENTE') throw noPendiente();

  if (accion === 'rechazar') {
    // La condición sobre el estado evita pisar una propuesta que cambió entre la lectura y la escritura.
    const { count } = await prisma.proposal.updateMany({
      where: { id: proposalId, estado: 'PENDIENTE' },
      data: { estado: 'RECHAZADA' },
    });
    if (count === 0) throw noPendiente();
  } else {
    const itemIds = [proposal.itemSolicitadoId, proposal.itemOfrecidoId];
    // Si algo falla, el AppError lanzado dentro revierte toda la transacción.
    await prisma.$transaction(async (tx) => {
      const aceptada = await tx.proposal.updateMany({
        where: { id: proposalId, estado: 'PENDIENTE' },
        data: { estado: 'ACEPTADA' },
      });
      if (aceptada.count === 0) throw noPendiente();

      const reservados = await tx.item.updateMany({
        where: { id: { in: itemIds }, estado: 'DISPONIBLE' },
        data: { estado: 'RESERVADO' },
      });
      if (reservados.count !== itemIds.length) {
        throw AppError.conflict('Alguno de los ítems ya no está disponible');
      }

      await tx.proposal.updateMany({
        where: {
          id: { not: proposalId },
          estado: 'PENDIENTE',
          OR: [{ itemSolicitadoId: { in: itemIds } }, { itemOfrecidoId: { in: itemIds } }],
        },
        data: { estado: 'RECHAZADA' },
      });
    });
  }

  const [updated] = await findProposals({ id: proposalId });
  return { data: toView(updated, userId) };
}

type ItemRef = { id: number; ownerId: number; estado: string };

// Un ítem eliminado se trata igual que uno que no existe.
function isGone(item: ItemRef | null): item is null {
  return !item || item.estado === 'ELIMINADO';
}

// Crea una propuesta PENDIENTE del usuario logueado sobre un ítem ajeno (HU-06).
// El receptor es el dueño del ítem solicitado: no se acepta en el body.
export async function createProposal(
  proponenteId: number,
  itemSolicitadoId: number,
  { itemOfrecidoId, mensaje }: ProposeItemInput
) {
  const solicitado = await prisma.item.findUnique({
    where: { id: itemSolicitadoId },
    select: { id: true, ownerId: true, estado: true },
  });
  if (isGone(solicitado)) throw AppError.notFound('No encontramos esa publicación');
  if (solicitado.ownerId === proponenteId) {
    throw AppError.badRequest('No podés proponer un intercambio sobre tu propia publicación');
  }
  if (solicitado.estado !== 'DISPONIBLE') {
    throw AppError.badRequest('Esta publicación no está disponible para intercambiar');
  }

  const ofrecido = await prisma.item.findUnique({
    where: { id: itemOfrecidoId },
    select: { id: true, ownerId: true, estado: true },
  });
  if (isGone(ofrecido)) throw AppError.notFound('No encontramos el ítem que querés ofrecer');
  if (ofrecido.ownerId !== proponenteId) {
    throw AppError.badRequest('Solo podés ofrecer un ítem propio');
  }
  if (ofrecido.estado !== 'DISPONIBLE') {
    throw AppError.badRequest('El ítem que ofrecés no está disponible');
  }

  // El lock ordenado por id serializa dos altas simultáneas del mismo par.
  // READ COMMITTED no alcanza: sin el FOR UPDATE, ambos requests pasan el findFirst.
  return prisma.$transaction(async (tx) => {
    const ids = [...new Set([itemSolicitadoId, itemOfrecidoId])].sort((a, b) => a - b);
    await tx.$queryRaw`
      SELECT id FROM "Item" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
    `;

    const duplicada = await tx.proposal.findFirst({
      where: { itemSolicitadoId, itemOfrecidoId, estado: 'PENDIENTE' },
      select: { id: true },
    });
    if (duplicada) {
      throw AppError.conflict('Ya tenés una propuesta pendiente para este intercambio');
    }

    return tx.proposal.create({
      data: {
        itemSolicitadoId,
        itemOfrecidoId,
        proponenteId,
        receptorId: solicitado.ownerId,
        mensaje,
        estado: 'PENDIENTE',
      },
    });
  });
}

// Cancela una propuesta en la que participa el usuario (HU-16).
// - PENDIENTE: solo quien la envió. Queda CANCELADA y el receptor ya no puede aceptarla.
// - ACEPTADA: cualquiera de las dos partes. Los ítems RESERVADO vuelven a DISPONIBLE.
// El FOR UPDATE y el update condicionado al estado leído evitan pisar un aceptar o rechazar concurrente.
export async function cancelProposal(userId: number, proposalId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Proposal" WHERE id = ${proposalId} FOR UPDATE`;

    const proposal = await tx.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        estado: true,
        proponenteId: true,
        receptorId: true,
        itemSolicitadoId: true,
        itemOfrecidoId: true,
      },
    });
    if (!proposal) throw AppError.notFound('No encontramos esa propuesta');

    const participa = proposal.proponenteId === userId || proposal.receptorId === userId;
    if (!participa) {
      throw AppError.forbidden('Solo podés cancelar una propuesta en la que participás');
    }

    if (proposal.estado === 'PENDIENTE') {
      if (proposal.proponenteId !== userId) {
        throw AppError.conflict('Mientras está pendiente, solo quien la envió puede cancelarla');
      }
    } else if (proposal.estado !== 'ACEPTADA') {
      throw AppError.conflict('Esta propuesta ya no se puede cancelar');
    }

    const cancelada = await tx.proposal.updateMany({
      where: { id: proposalId, estado: proposal.estado },
      data: { estado: 'CANCELADA' },
    });
    if (cancelada.count !== 1) {
      throw AppError.conflict('Esta propuesta ya no se puede cancelar');
    }

    if (proposal.estado === 'ACEPTADA') {
      const ids = [...new Set([proposal.itemSolicitadoId, proposal.itemOfrecidoId])].sort(
        (a, b) => a - b
      );
      await tx.$queryRaw`
        SELECT id FROM "Item" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
      `;
      await tx.item.updateMany({
        where: { id: { in: ids }, estado: 'RESERVADO' },
        data: { estado: 'DISPONIBLE' },
      });
    }

    const row = await tx.proposal.findUnique({
      where: { id: proposalId },
      include: proposalInclude,
    });
    if (!row) throw AppError.notFound('No encontramos esa propuesta');
    return toView(row, userId);
  });
}
