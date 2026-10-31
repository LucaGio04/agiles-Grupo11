import { prisma } from '../lib/prisma.js';

// Promedio de las calificaciones donde el usuario es el evaluado.
// Es el mismo cálculo del detalle de un ítem: null si todavía no lo calificaron.
// No redondea; cada pantalla decide cómo mostrar el número.
export async function reputacionDe(userId: number) {
  const ratings = await prisma.rating.aggregate({
    where: { evaluadoId: userId },
    _avg: { puntaje: true },
    _count: true,
  });

  return { promedio: ratings._avg.puntaje, cantidad: ratings._count };
}

// Un decimal para el perfil público (4.25 → 4.3). null si no hay calificaciones.
export function redondearPromedio(promedio: number | null) {
  if (promedio === null) return null;
  return Math.round(promedio * 10) / 10;
}
