import { prisma } from '../lib/prisma.js';
import type { ListProposalsQuery } from '../schemas/proposal.schema.js';

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
