// Error controlado de la aplicación. Los services y controllers lo lanzan
// y el middleware global de errores lo traduce al formato estándar de respuesta.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'No tenés permiso para realizar esta acción') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(409, 'CONFLICT', message, details);
  }
}
