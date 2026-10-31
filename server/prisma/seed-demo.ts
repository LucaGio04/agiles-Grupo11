import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

// Datos extra para probar el perfil. No lo corre `npm run seed` ni `prisma migrate reset`.
// Se puede ejecutar varias veces: busca por email, título o mensaje y actualiza lo que ya existe.
const DEMO_PASSWORD = 'Trueque123';

const CON_CALIFICACION = 'demo:intercambio-con-calificacion';
const SIN_CALIFICACION = 'demo:intercambio-sin-calificacion';

const principalData = {
  nombre: 'Tomás Bellizzi',
  email: 'tomas@utn.edu.ar',
  carrera: 'Ingeniería en Sistemas',
};

const otroData = {
  nombre: 'Sofía Demo',
  email: 'sofia.demo@utn.edu.ar',
  carrera: 'Ingeniería en Sistemas',
};

type DemoItem = {
  titulo: string;
  descripcion: string;
  categoria: 'LIBRO' | 'APUNTE' | 'CALCULADORA' | 'INSTRUMENTAL';
  estadoConservacion: 'NUEVO' | 'BUENO' | 'USADO';
  materia: string;
  estado: 'DISPONIBLE' | 'RESERVADO' | 'PAUSADO' | 'INTERCAMBIADO';
};

const itemsPrincipal: DemoItem[] = [
  {
    titulo: 'Demo: Análisis Matemático disponible',
    descripcion: 'Ítem de demo en estado disponible.',
    categoria: 'LIBRO',
    estadoConservacion: 'BUENO',
    materia: 'Análisis Matemático I',
    estado: 'DISPONIBLE',
  },
  {
    titulo: 'Demo: Apunte reservado',
    descripcion: 'Ítem de demo en estado reservado.',
    categoria: 'APUNTE',
    estadoConservacion: 'NUEVO',
    materia: 'Algoritmos y Estructuras de Datos',
    estado: 'RESERVADO',
  },
  {
    titulo: 'Demo: Calculadora pausada',
    descripcion: 'Ítem de demo en estado pausado. Solo lo ve el dueño.',
    categoria: 'CALCULADORA',
    estadoConservacion: 'BUENO',
    materia: 'Física I',
    estado: 'PAUSADO',
  },
  {
    titulo: 'Demo: Instrumental intercambiado',
    descripcion: 'Ítem de demo ya intercambiado.',
    categoria: 'INSTRUMENTAL',
    estadoConservacion: 'USADO',
    materia: 'Sistemas de Representación',
    estado: 'INTERCAMBIADO',
  },
];

const itemAjeno: DemoItem = {
  titulo: 'Demo: Libro pausado de Sofía',
  descripcion: 'Ítem pausado de otro usuario. No aparece en el perfil de Tomás.',
  categoria: 'LIBRO',
  estadoConservacion: 'BUENO',
  materia: 'Química General',
  estado: 'PAUSADO',
};

async function ensureUser(data: { nombre: string; email: string; carrera: string }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return { user: existing, created: false };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({ data: { ...data, passwordHash } });
  return { user, created: true };
}

async function ensureItem(ownerId: number, item: DemoItem) {
  const existing = await prisma.item.findFirst({
    where: { ownerId, titulo: item.titulo },
  });
  if (existing) {
    return prisma.item.update({ where: { id: existing.id }, data: item });
  }
  return prisma.item.create({ data: { ...item, ownerId } });
}

async function ensureProposal(data: {
  mensaje: string;
  proponenteId: number;
  receptorId: number;
  itemSolicitadoId: number;
  itemOfrecidoId: number;
}) {
  const existing = await prisma.proposal.findFirst({ where: { mensaje: data.mensaje } });
  if (existing) {
    return prisma.proposal.update({
      where: { id: existing.id },
      data: { ...data, estado: 'CONCRETADA' },
    });
  }
  return prisma.proposal.create({ data: { ...data, estado: 'CONCRETADA' } });
}

async function ensureRating(
  proposalId: number,
  evaluadorId: number,
  evaluadoId: number,
  puntaje: number,
  comentario: string
) {
  const existing = await prisma.rating.findFirst({ where: { proposalId, evaluadorId } });
  const data = { evaluadoId, puntaje, comentario };
  if (existing) {
    return prisma.rating.update({ where: { id: existing.id }, data });
  }
  return prisma.rating.create({ data: { proposalId, evaluadorId, ...data } });
}

async function main() {
  const principal = await ensureUser(principalData);
  const otro = await ensureUser(otroData);

  const propios = [];
  for (const item of itemsPrincipal) {
    propios.push(await ensureItem(principal.user.id, item));
  }
  const pausadoAjeno = await ensureItem(otro.user.id, itemAjeno);

  const disponible = propios.find((item) => item.estado === 'DISPONIBLE');
  const intercambiado = propios.find((item) => item.estado === 'INTERCAMBIADO');
  if (!disponible || !intercambiado) {
    throw new Error('Faltan ítems de demo del usuario principal');
  }

  const calificado = await ensureProposal({
    mensaje: CON_CALIFICACION,
    proponenteId: principal.user.id,
    receptorId: otro.user.id,
    itemOfrecidoId: intercambiado.id,
    itemSolicitadoId: pausadoAjeno.id,
  });
  await ensureRating(
    calificado.id,
    principal.user.id,
    otro.user.id,
    5,
    'El intercambio fue claro y rápido.'
  );
  await ensureRating(
    calificado.id,
    otro.user.id,
    principal.user.id,
    4,
    'El material estaba como lo describió.'
  );

  const sinCalificar = await ensureProposal({
    mensaje: SIN_CALIFICACION,
    proponenteId: otro.user.id,
    receptorId: principal.user.id,
    itemOfrecidoId: pausadoAjeno.id,
    itemSolicitadoId: disponible.id,
  });
  // Si en una corrida anterior quedó alguna calificación, este intercambio sigue sin calificar.
  await prisma.rating.deleteMany({ where: { proposalId: sinCalificar.id } });

  const cuentasNuevas = [principal, otro].filter((entry) => entry.created);
  console.log('Seed demo OK. Se puede volver a correr: actualiza los mismos datos.');
  console.log(
    `- ${principal.user.email}: un ítem en cada estado (disponible, reservado, pausado, intercambiado).`
  );
  console.log(`- ${otro.user.email}: un ítem pausado, que el otro usuario no puede ver.`);
  console.log(
    '- 2 intercambios concretados: uno con calificación dada y recibida, otro sin calificar.'
  );
  if (cuentasNuevas.length > 0) {
    const emails = cuentasNuevas.map((entry) => entry.user.email).join(', ');
    console.log(`Cuentas creadas ahora (${emails}): contraseña "${DEMO_PASSWORD}".`);
  } else {
    console.log('Las dos cuentas ya existían: no se les cambió la contraseña.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
