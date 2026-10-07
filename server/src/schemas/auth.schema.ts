import { z } from 'zod';

export const loginSchema = z.object({
  // Los emails se guardan en minúsculas, así que se normaliza antes de buscar.
  email: z.string().trim().toLowerCase().pipe(z.email('Ingresá un email válido')),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

export type LoginInput = z.infer<typeof loginSchema>;
