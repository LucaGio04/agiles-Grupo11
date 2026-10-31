import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { ListMyItemsQuery } from '../schemas/user.schema.js';
import { redondearPromedio, reputacionDe } from './reputation.js';

// Publicaciones del usuario logueado, de la más reciente a la más antigua.
// Sin status devuelve todos sus estados, pausados incluidos. El id sale del token.
export async function listMyItems(ownerId: number, status?: ListMyItemsQuery['status']) {
  const data = await prisma.item.findMany({
    where: { ownerId, ...(status ? { estado: status } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return { data };
}

// Campos de ítem que ya muestra la tarjeta del listado. Nada del dueño más allá del ownerId.
const publicItemSelect = {
  id: true,
  titulo: true,
  descripcion: true,
  categoria: true,
  estadoConservacion: true,
  materia: true,
  fotoUrl: true,
  estado: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Perfil público. El select del usuario es una lista blanca: nunca email ni passwordHash.
// El mismo resultado si quien consulta es el propio usuario.
export async function getPublicProfile(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nombre: true, carrera: true, createdAt: true },
  });
  if (!user) throw AppError.notFound('No encontramos a ese estudiante');

  const [reputacion, cantidadIntercambios, items, ultimasCalificaciones] = await Promise.all([
    reputacionDe(id),
    prisma.proposal.count({
      where: {
        estado: 'CONCRETADA',
        OR: [{ proponenteId: id }, { receptorId: id }],
      },
    }),
    prisma.item.findMany({
      where: { ownerId: id, estado: 'DISPONIBLE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: publicItemSelect,
    }),
    prisma.rating.findMany({
      where: { evaluadoId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        puntaje: true,
        comentario: true,
        createdAt: true,
        evaluador: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  return {
    data: {
      ...user,
      reputacionPromedio: redondearPromedio(reputacion.promedio),
      cantidadResenas: reputacion.cantidad,
      cantidadIntercambios,
      items,
      ultimasCalificaciones,
    },
  };
}
