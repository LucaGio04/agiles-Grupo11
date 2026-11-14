import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { EstadoPropuesta } from '../generated/prisma/enums.js';
import type { ListProposalsQuery, RespondProposalBody } from '../schemas/proposal.schema.js';

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
      proponente: { select: { id: true, nombre: true, email: true } },
      receptor: { select: { id: true, nombre: true, email: true } },
      itemSolicitado: { select: itemSelect },
      itemOfrecido: { select: itemSelect },
      calificaciones: {
        select: { puntaje: true, comentario: true, evaluadorId: true, evaluadoId: true },
      },
    },
  });
}

type ProposalRow = Awaited<ReturnType<typeof findProposals>>[number];

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
