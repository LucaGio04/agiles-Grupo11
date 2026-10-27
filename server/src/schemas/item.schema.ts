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

export const itemIdParamsSchema = z.object({
  id: z.coerce.number().int().positive('El id del ítem no es válido'),
});

// Filtros del listado (HU-04). Todos opcionales; los valores vacíos se toman como "sin filtro".
export const ITEMS_PAGE_SIZE = 12;
export const ITEMS_MAX_PAGE_SIZE = 50;

const positiveInt = (message: string) =>
  z.coerce.number({ error: message }).int(message).positive(message);

export const listItemsQuerySchema = z.object({
  query: z
    .string({ error: 'La búsqueda no es válida' })
    .trim()
    .max(100, 'La búsqueda puede tener hasta 100 caracteres')
    .optional()
    .transform((value) => value || undefined),
  // Un "?category=" vacío (el chip "Todas") equivale a no filtrar.
  category: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(Categoria, { error: 'La categoría no es válida' }).optional()
  ),
  page: positiveInt('La página tiene que ser un número mayor a 0').default(1),
  limit: positiveInt('El límite tiene que ser un número mayor a 0')
    .max(ITEMS_MAX_PAGE_SIZE, `El límite máximo es ${ITEMS_MAX_PAGE_SIZE}`)
    .default(ITEMS_PAGE_SIZE),
});

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
