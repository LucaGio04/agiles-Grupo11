import { z } from 'zod';

// Edición del perfil propio (HU-11): solo nombre y carrera. Los dos son opcionales, pero
// tiene que venir al menos uno. El email no se puede cambiar: si llega, se rechaza con un
// mensaje claro en vez de ignorarlo en silencio.
export const updateProfileSchema = z
  .object({
    nombre: z
      .string({ error: 'Ingresá tu nombre' })
      .trim()
      .min(1, 'Ingresá tu nombre')
      .max(80, 'El nombre puede tener hasta 80 caracteres')
      .optional(),
    carrera: z
      .string({ error: 'Ingresá tu carrera' })
      .trim()
      .min(1, 'Ingresá tu carrera')
      .max(100, 'La carrera puede tener hasta 100 caracteres')
      .optional(),
    email: z.never({ error: 'El email no se puede modificar' }).optional(),
  })
  .refine((data) => data.nombre !== undefined || data.carrera !== undefined, {
    message: 'Enviá el nombre o la carrera para actualizar',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
