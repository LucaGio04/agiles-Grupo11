import { z } from 'zod';
import { Categoria, EstadoConservacion } from '../generated/prisma/enums.js';

// Texto opcional: se recorta y un string vacío se toma como "no enviado".
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => value || undefined);

// El dueño no se acepta en el body: siempre es el usuario del token (regla de negocio de HU-03).
// Zod descarta las claves desconocidas, así que un `ownerId` o `estado` enviado se ignora.
export const createItemSchema = z.object({
  titulo: z
    .string({ error: 'Ingresá un título' })
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(80, 'El título puede tener hasta 80 caracteres'),
  descripcion: optionalText(500, 'La descripción puede tener hasta 500 caracteres'),
  categoria: z.enum(Categoria, { error: 'Elegí una categoría' }),
  estadoConservacion: z.enum(EstadoConservacion, { error: 'Elegí el estado de conservación' }),
  materia: optionalText(80, 'La materia puede tener hasta 80 caracteres'),
  // La subida de archivos llega con HU-13; por ahora la foto es solo una URL opcional.
  fotoUrl: optionalText(500, 'La URL de la foto es demasiado larga').pipe(
    z.url({ protocol: /^https?$/, error: 'Ingresá una URL válida (http o https)' }).optional()
  ),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
