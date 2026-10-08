// Se carga antes de cada archivo de test (ver script "test" en package.json).
// Valores de prueba para las variables que la app valida al cargarse. Prisma no se conecta
// hasta la primera consulta, y en los tests las consultas se mockean: no hace falta una base real.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'secreto-de-prueba';
