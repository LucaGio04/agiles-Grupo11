import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CreateItemInput, ListItemsQuery } from '../schemas/item.schema.js';

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
