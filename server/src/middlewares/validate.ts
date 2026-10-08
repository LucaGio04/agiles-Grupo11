import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError.js';

type Schemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

// Valida body, query y/o params con Zod antes de llegar al controller.
// Si todo es válido, reemplaza cada parte del request por el resultado parseado
// (con defaults y coerciones aplicadas). Si no, responde 400 con el detalle por campo.
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: { field: string; message: string }[] = [];

    for (const part of ['body', 'query', 'params'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        // En Express 5 `req.query` es un getter, por eso no se puede asignar directamente.
        Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
        continue;
      }

      for (const issue of result.error.issues) {
        details.push({ field: [part, ...issue.path].join('.'), message: issue.message });
      }
    }

    if (details.length > 0) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', details));
      return;
    }
    next();
  };
}
