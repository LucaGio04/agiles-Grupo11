import { AppError } from '../errors/AppError.js';
import { prisma } from '../lib/prisma.js';
import type { UpdateProfileInput } from '../schemas/profile.schema.js';

// Datos propios que se muestran en el perfil (nunca el passwordHash).
const profileFields = {
  id: true,
  nombre: true,
  email: true,
  carrera: true,
  createdAt: true,
} as const;

// Arma el perfil con la reputación (promedio de las calificaciones recibidas) y la cantidad
// de intercambios concretados, como proponente o como receptor (HU-11).
async function withStats(user: { id: number }) {
  const [ratings, intercambiosConcretados] = await Promise.all([
    prisma.rating.aggregate({
      where: { evaluadoId: user.id },
      _avg: { puntaje: true },
      _count: true,
    }),
    prisma.proposal.count({
      where: {
        estado: 'CONCRETADA',
        OR: [{ proponenteId: user.id }, { receptorId: user.id }],
      },
    }),
  ]);

  return {
    user,
    reputacion: { promedio: ratings._avg.puntaje, cantidad: ratings._count },
    intercambiosConcretados,
  };
}

export async function getMyProfile(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileFields });
  if (!user) {
    // El token es válido pero el usuario ya no existe.
    throw AppError.unauthorized('La sesión ya no es válida, volvé a iniciar sesión');
  }
  return withStats(user);
}

// Solo el propio usuario edita su perfil: el id sale siempre del token.
export async function updateMyProfile(userId: number, { nombre, carrera }: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { nombre, carrera },
    select: profileFields,
  });
  return withStats(user);
}
