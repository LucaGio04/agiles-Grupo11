import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { ListProposalsQuery, ProposeItemInput } from '../schemas/proposal.schema.js';

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

function findProposals(where: Prisma.ProposalWhereInput) {
  return prisma.proposal.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    include: {
      proponente: { select: { id: true, nombre: true } },
      receptor: { select: { id: true, nombre: true } },
      itemSolicitado: { select: itemSelect },
      itemOfrecido: { select: itemSelect },
      calificaciones: {
        select: { puntaje: true, comentario: true, evaluadorId: true, evaluadoId: true },
      },
    },
  });
}

type ProposalRow = Awaited<ReturnType<typeof findProposals>>[number];

// La persona, los ítems y las calificaciones se arman desde el punto de vista de quien consulta.
function toView(proposal: ProposalRow, userId: number) {
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
