import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { ListProposalsQuery, ProposeItemInput } from '../schemas/proposal.schema.js';

type RatingRow = { puntaje: number; comentario: string | null };

function toRating(rating: RatingRow | undefined) {
  if (!rating) return null;
  return { puntaje: rating.puntaje, comentario: rating.comentario };
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
    include: {
      proponente: { select: { id: true, nombre: true } },
      receptor: { select: { id: true, nombre: true } },
      itemSolicitado: { select: { id: true, titulo: true, estado: true } },
      itemOfrecido: { select: { id: true, titulo: true, estado: true } },
      calificaciones: {
        select: { puntaje: true, comentario: true, evaluadorId: true, evaluadoId: true },
      },
    },
  });

  return {
    data: proposals.map((proposal) => {
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
    }),
  };
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

export async function concretarPropuesta(proposalId: number, userId: number) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw AppError.notFound('Propuesta no encontrada');
  if (proposal.proponenteId !== userId && proposal.receptorId !== userId) {
    throw AppError.forbidden('No sos participante de esta propuesta');
  }
  if (proposal.estado !== 'ACEPTADA') {
    throw AppError.badRequest('Solo se puede concretar una propuesta ACEPTADA');
  }
  await prisma.$transaction([
    prisma.proposal.update({ where: { id: proposalId }, data: { estado: 'CONCRETADA' } }),
    prisma.item.update({ where: { id: proposal.itemSolicitadoId }, data: { estado: 'INTERCAMBIADO' } }),
    prisma.item.update({ where: { id: proposal.itemOfrecidoId }, data: { estado: 'INTERCAMBIADO' } }),
  ]);
  return { message: 'Intercambio concretado exitosamente' };
}
