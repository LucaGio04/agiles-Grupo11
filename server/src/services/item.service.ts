import { prisma } from '../lib/prisma.js';
import type { CreateItemInput } from '../schemas/item.schema.js';

// Publica un ítem nuevo del usuario logueado (HU-03). Arranca siempre DISPONIBLE (default del modelo).
export async function createItem(ownerId: number, data: CreateItemInput) {
  return prisma.item.create({ data: { ...data, ownerId } });
}
