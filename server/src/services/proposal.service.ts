import { prisma } from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ListProposalsQuery } from '../schemas/proposal.schema.js';

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
