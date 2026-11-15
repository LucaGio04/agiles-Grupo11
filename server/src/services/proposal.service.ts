import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { ListProposalsQuery, ProposeItemInput } from '../schemas/proposal.schema.js';

type RatingRow = { puntaje: number; comentario: string | null };

function toRating(rating: RatingRow | undefined) {
  if (!rating) return null;
  return { puntaje: rating.puntaje, comentario: rating.comentario };
}

// Misma forma que cada elemento de GET /api/proposals. Cancelar responde una de estas.
const proposalViewInclude = {
  proponente: { select: { id: true, nombre: true } },
  receptor: { select: { id: true, nombre: true } },
  itemSolicitado: { select: { id: true, titulo: true, estado: true } },
  itemOfrecido: { select: { id: true, titulo: true, estado: true } },
  calificaciones: {
    select: { puntaje: true, comentario: true, evaluadorId: true, evaluadoId: true },
  },
} as const;

type ProposalViewRow = Prisma.ProposalGetPayload<{ include: typeof proposalViewInclude }>;

function toProposalView(proposal: ProposalViewRow, userId: number) {
  const soyProponente = proposal.proponenteId === userId;
  const dada = proposal.calificaciones.find((rating) => rating.evaluadorId === userId);
  const recibida = proposal.calificaciones.find((rating) => rating.evaluadoId === userId);
  return {
    id: proposal.id,
    estado: proposal.estado,
    mensaje: proposal.mensaje,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    rol: soyProponente ? ('proponente' as const) : ('receptor' as const),
    persona: soyProponente ? proposal.receptor : proposal.proponente,
    itemSolicitado: proposal.itemSolicitado,
    itemOfrecido: proposal.itemOfrecido,
    calificacionDada: toRating(dada),
    calificacionRecibida: toRating(recibida),
  };
}

// Propuestas en las que participa el usuario logueado. No lista las de terceros.
// La persona, los ítems y las calificaciones se arman desde el punto de vista de quien consulta.
export async function listMyProposals(userId: number, status?: ListProposalsQuery['status']) {
  const proposals = await prisma.proposal.findMany({
    where: {
      OR: [{ proponenteId: userId }, { receptorId: userId }],
      ...(status ? { estado: status } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    include: proposalViewInclude,
  });

  return { data: proposals.map((proposal) => toProposalView(proposal, userId)) };
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
      include: proposalViewInclude,
    });
    if (!row) throw AppError.notFound('No encontramos esa propuesta');
    return toProposalView(row, userId);
  });
}
