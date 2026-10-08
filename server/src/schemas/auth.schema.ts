import { z } from 'zod';

export const loginSchema = z.object({
  // Los emails se guardan en minúsculas, así que se normaliza antes de buscar.
  email: z.string().trim().toLowerCase().pipe(z.email('Ingresá un email válido')),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá tu nombre'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Ingresá un email válido'))
    .refine(
      (email) => {
        const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN ?? 'utn.edu.ar').toLowerCase();
        const parts = email.split('@');
        if (parts.length !== 2) return false;
        const host = parts[1];
        return host === allowedDomain || host.endsWith(`.${allowedDomain}`);
      },
      {
        message: 'Usá tu mail institucional',
      }
    ),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  carrera: z.string().trim().min(1, 'Ingresá tu carrera'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
