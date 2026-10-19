import bcrypt from 'bcryptjs';
import { AppError } from '../errors/AppError.js';
import { Prisma } from '../generated/prisma/client.js';
import { signToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';

// Campos del usuario que se pueden devolver en la API (nunca el passwordHash).
const publicUserFields = { id: true, nombre: true, email: true, carrera: true } as const;

// Hash de una contraseña cualquiera: si el email no existe se compara igual contra este,
// así la respuesta tarda lo mismo y no se puede deducir qué emails están registrados.
const DUMMY_HASH = bcrypt.hashSync('contraseña-que-no-coincide', 10);

// Mismo mensaje para email inexistente y contraseña incorrecta (regla de negocio de HU-02).
const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    throw invalidCredentials();
  }

  const publicUser = { id: user.id, nombre: user.nombre, email: user.email, carrera: user.carrera };
  return { user: publicUser, token: signToken({ id: user.id, email: user.email }) };
}

// Devuelve el usuario del token. Se usa al recargar la página para restaurar la sesión.
export async function getCurrentUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserFields });
  if (!user) {
    // El token es válido pero el usuario ya no existe.
    throw AppError.unauthorized('La sesión ya no es válida, volvé a iniciar sesión');
  }
  return user;
}

// Registra un nuevo estudiante institucional (HU-01).
export async function register({ nombre, email, password, carrera }: RegisterInput) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw AppError.conflict('Ese email ya tiene una cuenta');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        nombre: nombre.trim(),
        email: normalizedEmail,
        passwordHash,
        carrera: carrera.trim(),
      },
      select: publicUserFields,
    });
  } catch (err) {
    // Dos registros simultáneos con el mismo email pasan el findUnique y el segundo
    // choca con el índice único (P2002): se responde 409 igual que en el caso normal.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw AppError.conflict('Ese email ya tiene una cuenta');
    }
    throw err;
  }

  const token = signToken({ id: user.id, email: user.email });
  return { user, token };
}
