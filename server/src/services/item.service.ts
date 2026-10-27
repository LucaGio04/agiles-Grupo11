import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import type { ListItemsQuery } from '../schemas/item.schema.js';

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
