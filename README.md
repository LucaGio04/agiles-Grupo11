# TruequeUTN

Trabajo Práctico para la materia Metodologías Ágiles — Grupo 11.

Plataforma web académica para que estudiantes de la UTN intercambien materiales de estudio (libros, apuntes, calculadoras) sin dinero de por medio. Los usuarios podrán publicar materiales que ya no usan, buscar los que necesitan y proponer un intercambio directo con otro estudiante.

## Stack

| Capa          | Tecnología                     | Estado      |
| ------------- | ------------------------------ | ----------- |
| Frontend      | React + Vite + TypeScript      | Configurado |
| Backend       | Node.js + Express + TypeScript | Configurado |
| Base de datos | PostgreSQL 16 + Prisma 7       | Configurado |

## Requisitos previos

- **Node.js** >= 20 (LTS recomendado)
- **npm** >= 10 (incluido con Node)
- **Docker** con Docker Compose (para la base de datos local)

## Estructura del proyecto

```text
/
├── client/             # Frontend React + Vite
├── server/             # Backend Express + TypeScript
│   └── prisma/         # Schema, migraciones y seed de la base de datos
├── docs/               # Documentación (diagrama entidad-relación)
├── docker-compose.yml  # PostgreSQL para desarrollo
├── package.json        # Monorepo (npm workspaces)
├── eslint.config.mjs   # ESLint compartido
└── README.md
```

## Primeros pasos

### 1. Clonar e instalar

```bash
git clone <url-del-repo>
cd agiles-Grupo11
npm install
```

### 2. Variables de entorno

Copiá los archivos de ejemplo y ajustá si es necesario:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

| Variable       | Paquete | Descripción                                                                   |
| -------------- | ------- | ----------------------------------------------------------------------------- |
| `PORT`         | server  | Puerto del backend (default: 3001)                                            |
| `CLIENT_URL`   | server  | URL del frontend para CORS                                                    |
| `DATABASE_URL` | server  | Conexión a PostgreSQL (el valor de ejemplo coincide con `docker-compose.yml`) |
| `VITE_API_URL` | client  | URL base del backend                                                          |

### 3. Base de datos

Levantá PostgreSQL con Docker, aplicá las migraciones y cargá los datos de prueba:

```bash
npm run db:up        # docker compose up -d
npm run db:migrate   # npx prisma migrate dev (crea las tablas)
npm run seed         # carga 5 usuarios y 20 ítems de ejemplo
```

Todos los usuarios del seed (`tomas@utn.edu.ar`, `luca@utn.edu.ar`, `facundo@utn.edu.ar`, `joaquin@utn.edu.ar`, `martina@utn.edu.ar`) tienen la contraseña `Trueque123`. El seed borra y vuelve a crear los datos, así que se puede correr cuantas veces haga falta.

Otros comandos útiles (desde `server/`):

```bash
npx prisma studio            # explorar la base en el navegador
npx prisma migrate dev --name <cambio>   # crear una migración después de editar schema.prisma
npx prisma migrate reset     # borrar la base, reaplicar migraciones y correr el seed
```

El cliente de Prisma se genera en `server/src/generated/` (no se versiona) automáticamente al hacer `npm install`. Si cambiás el schema, `migrate dev` lo regenera. En el código se usa la instancia única de `server/src/lib/prisma.ts`.

El modelo de datos está documentado en [`docs/der.md`](docs/der.md).

### 4. Levantar en desarrollo

Desde la raíz del proyecto:

```bash
npm run dev
```

Esto inicia el backend en `http://localhost:3001` y el frontend en `http://localhost:5173`.

Abrí el navegador en `http://localhost:5173`. Deberías ver **TruequeUTN** y el estado del backend en **ok**.

### 5. Otros comandos

```bash
npm run lint      # ESLint en client y server
npm test          # Tests del servidor (node:test)
npm run build     # Compila ambos paquetes
npm run format    # Prettier en todo el repo
```

Para levantar un paquete por separado:

```bash
npm run dev -w server
npm run dev -w client
```

## Backend: cómo agregar un endpoint

El servidor está organizado por capas dentro de `server/src/`:

```text
routes/       # Define las URLs y encadena validación + controller
controllers/  # Lee el request, llama al service y arma la respuesta
services/     # Lógica de negocio; único lugar que usa Prisma (lib/prisma.ts)
middlewares/  # validate (Zod), notFound y errorHandler
errors/       # AppError: errores controlados con status y código
```

Para sumar un recurso: crear `routes/<recurso>.routes.ts`, su controller y su service, y montar el router en `routes/index.ts` (todo queda bajo `/api`).

**Validación.** Los schemas de Zod se pasan al middleware `validate`; el controller recibe `req.body` / `req.query` / `req.params` ya parseados:

```ts
router.post('/', validate({ body: createItemSchema }), itemsController.create);
```

**Errores.** Todas las respuestas de error tienen el mismo formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

| Caso                              | Status | `code`             |
| --------------------------------- | ------ | ------------------ |
| Body/query/params inválidos       | 400    | `VALIDATION_ERROR` |
| JSON mal formado                  | 400    | `INVALID_JSON`     |
| Origen no permitido por CORS      | 403    | `CORS_NOT_ALLOWED` |
| Ruta inexistente                  | 404    | `NOT_FOUND`        |
| Error no controlado               | 500    | `INTERNAL_ERROR`   |

En los services y controllers alcanza con lanzar un `AppError` (por ejemplo `throw AppError.notFound('Ítem no encontrado')`): el middleware global lo convierte en la respuesta. No hace falta `try/catch` en handlers `async`, Express 5 reenvía el error solo. Con `NODE_ENV=production` el 500 no incluye el mensaje ni el stack.

## Estrategia de ramas

| Rama                        | Propósito                                                                   |
| --------------------------- | --------------------------------------------------------------------------- |
| `main`                      | Código estable y deployable. Protegida: solo se actualiza vía Pull Request. |
| `develop`                   | Integración de features antes de llegar a `main`.                           |
| `feature/HU-XX-descripcion` | Una rama por historia de usuario o tarjeta técnica.                         |

Ejemplo: `feature/HU-01-registro-usuario`, `feature/TEC-01-setup-repo`.

## Convención de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: agregar formulario de publicación
fix: corregir validación de email
chore: actualizar dependencias
docs: actualizar README con instrucciones de deploy
```

Tipos comunes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

## Equipo

Grupo 11 — Metodologías Ágiles, UTN.
