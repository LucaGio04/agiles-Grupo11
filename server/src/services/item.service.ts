import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { CreateItemInput } from '../schemas/item.schema.js';

// Publica un ítem nuevo del usuario logueado (HU-03). Arranca siempre DISPONIBLE (default del modelo).
export async function createItem(ownerId: number, data: CreateItemInput) {
  return prisma.item.create({ data: { ...data, ownerId } });
}

// Detalle de un ítem con los datos públicos de su dueño y su reputación (HU-05).
// Es visible en cualquier estado (por ejemplo RESERVADO); el front decide qué acciones mostrar.
export async function getItemById(id: number) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { owner: { select: { id: true, nombre: true, carrera: true } } },
  });
  if (!item) {
    throw AppError.notFound('No encontramos esa publicación');
  }

  const ratings = await prisma.rating.aggregate({
    where: { evaluadoId: item.ownerId },
    _avg: { puntaje: true },
    _count: true,
  });

  const { owner, ...itemData } = item;
  return {
    item: itemData,
    owner: {
      ...owner,
      reputacion: { promedio: ratings._avg.puntaje, cantidad: ratings._count },
    },
  };
}
