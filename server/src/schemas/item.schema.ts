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

// Texto opcional en edición (HU-14): permite string no vacío, o null/vacío para borrar el campo.
const optionalNullableText = (max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max, message).nullable().optional()
  );

// Foto opcional en edición (HU-14): URL válida o null/vacío para borrarla.
const optionalNullablePhotoUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .max(500, 'La URL de la foto es demasiado larga')
    .pipe(z.url({ protocol: /^https?$/, error: 'Ingresá una URL válida (http o https)' }))
    .nullable()
    .optional()
);

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

// Edición de un ítem propio (HU-14). Todos los campos son opcionales pero debe enviarse al menos uno.
// Permite pausar/reactivar la publicación alternando estado entre DISPONIBLE y PAUSADO.
export const updateItemSchema = z
  .object({
    titulo: z
      .string({ error: 'Ingresá un título' })
      .trim()
      .min(3, 'El título debe tener al menos 3 caracteres')
      .max(80, 'El título puede tener hasta 80 caracteres')
      .optional(),
    descripcion: optionalNullableText(500, 'La descripción puede tener hasta 500 caracteres'),
    categoria: z.enum(Categoria, { error: 'Elegí una categoría' }).optional(),
    estadoConservacion: z
      .enum(EstadoConservacion, { error: 'Elegí el estado de conservación' })
      .optional(),
    materia: optionalNullableText(80, 'La materia puede tener hasta 80 caracteres'),
    fotoUrl: optionalNullablePhotoUrl,
    estado: z
      .enum(['DISPONIBLE', 'PAUSADO'], {
        error: 'El estado solo puede ser DISPONIBLE o PAUSADO',
      })
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Tenés que enviar al menos un campo para actualizar',
  });

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

const INVALID_ITEM_ID = 'El id del ítem no es válido';

// Mismo mensaje para cualquier id inválido: no numérico (abc), decimal (7.5), cero o negativo.
export const itemIdParamsSchema = z.object({
  id: z.coerce.number({ error: INVALID_ITEM_ID }).int(INVALID_ITEM_ID).positive(INVALID_ITEM_ID),
});

// Filtros del listado (HU-04). Todos opcionales; los valores vacíos se toman como "sin filtro".
export const ITEMS_PAGE_SIZE = 12;
export const ITEMS_MAX_PAGE_SIZE = 50;

// Tope de `page`: evita enteros fuera del rango seguro y que `(page - 1) * limit` desborde el `skip` de Prisma.
export const ITEMS_MAX_PAGE = 100_000;

// Entero positivo con tope y valor por defecto. Un valor vacío ("?page=") se toma como "no enviado",
// igual que `query` y `category`. El tope va primero y corta (`abort`), así un número enorme
// responde solo "demasiado grande" y no también "no es un entero".
const boundedPositiveInt = (message: string, max: number, maxMessage: string, fallback: number) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number({ error: message })
      .max(max, { error: maxMessage, abort: true })
      .int(message)
      .positive(message)
      .default(fallback)
  );

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
  page: boundedPositiveInt(
    'La página tiene que ser un número mayor a 0',
    ITEMS_MAX_PAGE,
    `La página máxima es ${ITEMS_MAX_PAGE}`,
    1
  ),
  limit: boundedPositiveInt(
    'El límite tiene que ser un número mayor a 0',
    ITEMS_MAX_PAGE_SIZE,
    `El límite máximo es ${ITEMS_MAX_PAGE_SIZE}`,
    ITEMS_PAGE_SIZE
  ),
});

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
