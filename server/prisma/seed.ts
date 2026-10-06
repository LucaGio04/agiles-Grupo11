import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import type { Prisma } from '../src/generated/prisma/client.js';

// Contraseña común de todos los usuarios de prueba (solo para desarrollo).
const SEED_PASSWORD = 'Trueque123';

const usuarios = [
  { nombre: 'Tomás Bellizzi', email: 'tomas@utn.edu.ar', carrera: 'Ingeniería en Sistemas' },
  { nombre: 'Luca Giordani', email: 'luca@utn.edu.ar', carrera: 'Ingeniería en Sistemas' },
  { nombre: 'Facundo Devida', email: 'facundo@utn.edu.ar', carrera: 'Ingeniería Civil' },
  { nombre: 'Joaquín Rodríguez', email: 'joaquin@utn.edu.ar', carrera: 'Ingeniería Eléctrica' },
  { nombre: 'Martina López', email: 'martina@utn.edu.ar', carrera: 'Ingeniería Química' },
];

// ownerIndex apunta a la posición en `usuarios`.
const items: (Omit<Prisma.ItemCreateManyInput, 'ownerId'> & { ownerIndex: number })[] = [
  {
    ownerIndex: 0,
    titulo: 'Análisis Matemático I - Thomas Finney',
    categoria: 'LIBRO',
    estadoConservacion: 'BUENO',
    materia: 'Análisis Matemático I',
    descripcion: 'Edición 11, con algunas marcas en lápiz.',
  },
  {
    ownerIndex: 0,
    titulo: 'Calculadora Casio fx-991ES Plus',
    categoria: 'CALCULADORA',
    estadoConservacion: 'BUENO',
    descripcion: 'Funciona perfecto, con tapa.',
  },
  {
    ownerIndex: 0,
    titulo: 'Apuntes de Algoritmos y Estructuras de Datos',
    categoria: 'APUNTE',
    estadoConservacion: 'USADO',
    materia: 'Algoritmos y Estructuras de Datos',
  },
  {
    ownerIndex: 0,
    titulo: 'Física I - Resnick',
    categoria: 'LIBRO',
    estadoConservacion: 'USADO',
    materia: 'Física I',
  },
  {
    ownerIndex: 1,
    titulo: 'Álgebra y Geometría Analítica - Kozak',
    categoria: 'LIBRO',
    estadoConservacion: 'BUENO',
    materia: 'Álgebra y Geometría Analítica',
  },
  {
    ownerIndex: 1,
    titulo: 'Resumen de Sistemas y Organizaciones',
    categoria: 'APUNTE',
    estadoConservacion: 'NUEVO',
    materia: 'Sistemas y Organizaciones',
    descripcion: 'Resumen completo, impreso y anillado.',
  },
  {
    ownerIndex: 1,
    titulo: 'Calculadora científica Casio fx-82MS',
    categoria: 'CALCULADORA',
    estadoConservacion: 'USADO',
  },
  {
    ownerIndex: 1,
    titulo: 'Arquitectura de Computadoras - Tanenbaum',
    categoria: 'LIBRO',
    estadoConservacion: 'BUENO',
    materia: 'Arquitectura de Computadoras',
  },
  {
    ownerIndex: 2,
    titulo: 'Kit de escuadras y compás',
    categoria: 'INSTRUMENTAL',
    estadoConservacion: 'BUENO',
    materia: 'Sistemas de Representación',
    descripcion: 'Escuadras de 45° y 60°, compás de precisión.',
  },
  {
    ownerIndex: 2,
    titulo: 'Tablero de dibujo A3',
    categoria: 'INSTRUMENTAL',
    estadoConservacion: 'USADO',
    materia: 'Sistemas de Representación',
  },
  {
    ownerIndex: 2,
    titulo: 'Química General - Chang',
    categoria: 'LIBRO',
    estadoConservacion: 'BUENO',
    materia: 'Química General',
  },
  {
    ownerIndex: 2,
    titulo: 'Apuntes de Estabilidad I',
    categoria: 'APUNTE',
    estadoConservacion: 'USADO',
    materia: 'Estabilidad I',
  },
  {
    ownerIndex: 3,
    titulo: 'Electrotecnia - Apuntes de cátedra',
    categoria: 'APUNTE',
    estadoConservacion: 'BUENO',
    materia: 'Electrotecnia',
  },
  {
    ownerIndex: 3,
    titulo: 'Multímetro digital',
    categoria: 'INSTRUMENTAL',
    estadoConservacion: 'BUENO',
    descripcion: 'Con puntas de prueba, sin batería.',
  },
  {
    ownerIndex: 3,
    titulo: 'Análisis Matemático II - Rabuffetti',
    categoria: 'LIBRO',
    estadoConservacion: 'USADO',
    materia: 'Análisis Matemático II',
  },
  {
    ownerIndex: 3,
    titulo: 'Calculadora graficadora TI-84',
    categoria: 'CALCULADORA',
    estadoConservacion: 'BUENO',
  },
  {
    ownerIndex: 4,
    titulo: 'Guía de trabajos prácticos de Física II',
    categoria: 'APUNTE',
    estadoConservacion: 'NUEVO',
    materia: 'Física II',
  },
  {
    ownerIndex: 4,
    titulo: 'Tabla periódica plastificada',
    categoria: 'OTRO',
    estadoConservacion: 'BUENO',
    materia: 'Química General',
  },
  {
    ownerIndex: 4,
    titulo: 'Probabilidad y Estadística - Walpole',
    categoria: 'LIBRO',
    estadoConservacion: 'BUENO',
    materia: 'Probabilidad y Estadística',
  },
  {
    ownerIndex: 4,
    titulo: 'Guardapolvo de laboratorio talle M',
    categoria: 'OTRO',
    estadoConservacion: 'USADO',
    descripcion: 'Para los laboratorios de Química.',
  },
];

async function main() {
  // Limpia en orden inverso a las dependencias para que el seed se pueda correr varias veces.
  await prisma.rating.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const creados = [];
  for (const u of usuarios) {
    creados.push(await prisma.user.create({ data: { ...u, passwordHash } }));
  }

  await prisma.item.createMany({
    data: items.map(({ ownerIndex, ...item }) => ({ ...item, ownerId: creados[ownerIndex].id })),
  });

  console.log(`Seed OK: ${creados.length} usuarios y ${items.length} ítems.`);
  console.log(`Todos los usuarios usan la contraseña "${SEED_PASSWORD}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
