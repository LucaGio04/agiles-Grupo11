import { z } from 'zod';

export const createRatingSchema = z.object({
  puntaje: z
    .number({ error: 'Elegí un puntaje' })
    .int('Elegí un puntaje entero')
    .min(1, 'El puntaje debe ser entre 1 y 5')
    .max(5, 'El puntaje debe ser entre 1 y 5'),
  comentario: z
    .string()
    .trim()
    .max(300, 'El comentario puede tener hasta 300 caracteres')
    .optional()
    .transform((value) => value || undefined),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
