import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CreateItemInput, ListItemsQuery, UpdateItemInput } from '../schemas/item.schema.js';
import { reputacionDe } from './reputation.js';

// Publica un ítem nuevo del usuario logueado (HU-03). Arranca siempre DISPONIBLE (default del modelo).
export async function createItem(ownerId: number, data: CreateItemInput) {
  return prisma.item.create({ data: { ...data, ownerId } });
}

// Detalle de un ítem con los datos públicos de su dueño y su reputación (HU-05).
// RESERVADO e INTERCAMBIADO se ven igual. Un PAUSADO solo lo ve el dueño:
// para cualquier otra persona es el mismo 404 que si no existiera.
export async function getItemById(id: number, viewerId: number) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { owner: { select: { id: true, nombre: true, carrera: true } } },
  });
  if (!item || (item.estado === 'PAUSADO' && item.ownerId !== viewerId)) {
    throw AppError.notFound('No encontramos esa publicación');
  }

  const reputacion = await reputacionDe(item.ownerId);

  const { owner, ...itemData } = item;
  return {
    item: itemData,
    owner: {
      ...owner,
      reputacion: { promedio: reputacion.promedio, cantidad: reputacion.cantidad },
    },
  };
}

// Listado del inicio con búsqueda, filtro por categoría y paginación (HU-04).
// Solo muestra ítems DISPONIBLES de otros usuarios, del más reciente al más antiguo.
export async function listItems(userId: number, { query, category, page, limit }: ListItemsQuery) {
  const where: Prisma.ItemWhereInput = {
    estado: 'DISPONIBLE',
    ownerId: { not: userId },
    ...(category && { categoria: category }),
    ...(query && {
      OR: [
        { titulo: { contains: query, mode: 'insensitive' } },
        { descripcion: { contains: query, mode: 'insensitive' } },
        { materia: { contains: query, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  return { data, page, totalPages: Math.ceil(total / limit), total };
}

// Elimina lógicamente un ítem propio (HU-15).
// - Bloquea si hay una propuesta ACEPTADA en curso (→ 409).
// - Cancela todas las propuestas PENDIENTES sobre el ítem.
// - Marca el ítem como ELIMINADO (borrado lógico para conservar el historial de calificaciones).
export async function deleteItem(itemId: number, requesterId: number) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });

  if (!item) {
    throw AppError.notFound('No encontramos esa publicación');
  }
  if (item.ownerId !== requesterId) {
    throw AppError.forbidden('Solo el dueño puede eliminar esta publicación');
  }

  // Regla de negocio: no se puede eliminar con una propuesta ACEPTADA activa.
  const accepted = await prisma.proposal.findFirst({
    where: {
      OR: [{ itemSolicitadoId: itemId }, { itemOfrecidoId: itemId }],
      estado: 'ACEPTADA',
    },
  });
  if (accepted) {
    throw new AppError(
      409,
      'PROPOSAL_ACCEPTED',
      'No podés eliminar este ítem porque tiene una propuesta aceptada en curso'
    );
  }

  // Cancelar propuestas PENDIENTES y marcar el ítem como ELIMINADO en una transacción.
  await prisma.$transaction([
    prisma.proposal.updateMany({
      where: {
        OR: [{ itemSolicitadoId: itemId }, { itemOfrecidoId: itemId }],
        estado: 'PENDIENTE',
      },
      data: { estado: 'CANCELADA' },
    }),
    prisma.item.update({
      where: { id: itemId },
      data: { estado: 'ELIMINADO' },
    }),
  ]);
}

// Edita una publicación propia (HU-14).
// - Solo el dueño puede editar (→ 403).
// - No se puede editar un ítem INTERCAMBIADO (→ 400).
// - Permite pausar y reactivar cambiando el estado entre DISPONIBLE y PAUSADO.
export async function updateItem(id: number, userId: number, data: UpdateItemInput) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    throw AppError.notFound('No encontramos esa publicación');
  }

  if (item.ownerId !== userId) {
    throw AppError.forbidden('Solo el dueño puede editar esta publicación');
  }

  if (item.estado === 'INTERCAMBIADO') {
    throw AppError.badRequest('No podés editar una publicación que ya fue intercambiada');
  }

  if ((item.estado as string) === 'ELIMINADO') {
    throw AppError.badRequest('No podés editar una publicación eliminada');
  }

  return prisma.item.update({
    where: { id },
    data,
  });
}
