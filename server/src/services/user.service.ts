import { prisma } from '../lib/prisma.js';
import type { ListMyItemsQuery } from '../schemas/user.schema.js';

// Publicaciones del usuario logueado, de la más reciente a la más antigua.
// Sin status devuelve todos sus estados, pausados incluidos. El id sale del token.
export async function listMyItems(ownerId: number, status?: ListMyItemsQuery['status']) {
  const data = await prisma.item.findMany({
    where: { ownerId, ...(status ? { estado: status } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return { data };
}
