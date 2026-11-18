# TruequeUTN

[![CI](https://github.com/LucaGio04/agiles-Grupo11/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/LucaGio04/agiles-Grupo11/actions/workflows/ci.yml)

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
│   ├── prisma/         # Schema, migraciones y seed de la base de datos
│   └── uploads/        # Fotos subidas por los usuarios (se crea sola, no se versiona)
├── docs/               # Documentación (diagrama entidad-relación, colección de Postman)
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

| Variable                | Paquete | Descripción                                                                                         |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `NODE_ENV`              | server  | `development` en local. En Render, `production` (oculta el stack de los errores 500)               |
| `PORT`                  | server  | Puerto del backend (default: 3001). En Render lo inyecta la plataforma: no lo cargues               |
| `CLIENT_URL`            | server  | Un solo origen del frontend para CORS, sin barra final                                             |
| `DATABASE_URL`          | server  | Conexión a PostgreSQL (el valor de ejemplo coincide con `docker-compose.yml`)                      |
| `JWT_SECRET`            | server  | Secreto para firmar los tokens de sesión (JWT). Usá un valor largo y aleatorio                     |
| `ALLOWED_EMAIL_DOMAIN`  | server  | Dominio permitido en el registro (default: `utn.edu.ar`)                                            |
| `UPLOADS_DIR`           | server  | (Opcional) Carpeta de las fotos de los ítems. Por defecto `server/uploads`                          |
| `API_PUBLIC_URL`        | server  | (Opcional en local) URL https del backend, sin barra final, para armar el link de las fotos        |
| `VITE_API_URL`          | client  | URL base del backend, sin barra final y sin `/api`                                                  |

Los valores de producción (ficticios en los example) están comentados al final de `server/.env.example` y `client/.env.example`. Cómo cargarlos en Render y Vercel está en [Deploy](#deploy).

### 3. Base de datos

Levantá PostgreSQL con Docker, aplicá las migraciones y cargá los datos de prueba:

```bash
npm run db:up        # docker compose up -d
npm run db:migrate   # npx prisma migrate dev (crea las tablas)
npm run seed         # carga 5 usuarios y 20 ítems de ejemplo
```

Todos los usuarios del seed (`tomas@utn.edu.ar`, `luca@utn.edu.ar`, `facundo@utn.edu.ar`, `joaquin@utn.edu.ar`, `martina@utn.edu.ar`) tienen la contraseña `Trueque123`. El seed borra y vuelve a crear los datos, así que se puede correr cuantas veces haga falta.

Para probar el perfil (un ítem en cada estado y el historial de intercambios) hay un seed aparte. No se corre con `npm run seed` ni con `prisma migrate reset`:

```bash
npm run db:seed:demo
```

Se puede correr varias veces: actualiza los mismos datos en lugar de duplicarlos. Reutiliza a `tomas@utn.edu.ar` si ya existe (no le cambia la contraseña) y crea a `sofia.demo@utn.edu.ar` con la contraseña `Trueque123` si no estaba. Tomás queda con un ítem disponible, uno reservado, uno pausado y uno intercambiado. Sofía queda con un ítem pausado, que Tomás no puede ver. Hay dos intercambios concretados entre los dos: uno con calificación dada y recibida, y otro sin calificar.

`npm run seed` borra toda la base antes de cargar, así que después hay que volver a correr `npm run db:seed:demo`. En el deploy no se engancha a ningún comando: si hace falta datos de demo en producción, se corre una sola vez y a mano sobre una base vacía (ver [Deploy](#deploy)).

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

Abrí el navegador en `http://localhost:5173`: la página de inicio es el **login**. Podés ingresar con cualquier usuario del seed (por ejemplo `tomas@utn.edu.ar` / `Trueque123`).

### 5. Otros comandos

```bash
npm run lint      # ESLint en client y server
npm test          # Tests del servidor (node:test)
npm run build     # Compila ambos paquetes
npm run format    # Prettier en todo el repo
```

**Integración continua.** En cada Pull Request (y en cada push a `develop` y `main`) GitHub Actions corre `npm ci`, `npm run lint`, `npm run build` y `npm test` ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Si alguno falla, el PR queda en rojo. Antes de abrir un PR, corré esos mismos comandos en local.

Para levantar un paquete por separado:

```bash
npm run dev -w server
npm run dev -w client
```

## Deploy

Front en Vercel, API en Render y PostgreSQL gestionado en Render. El cliente llama a la API con `VITE_API_URL`. No hay secretos en el repo: cada plataforma los carga en su panel.

```text
navegador → Vercel (client/dist) → Render (Express) → PostgreSQL
```

### Dónde se configura cada cosa

| | Vercel | Render (web service) |
| --- | --- | --- |
| Root directory | `client` | vacío (raíz del repo) |
| Framework / runtime | Vite | Node |
| Build | `npm run build` (lo detecta Vite) | `npm ci --include=dev && npm run build -w server` |
| Start | estático | `npm run db:migrate:deploy -w server && npm run start -w server` |

`tsc` y `prisma` son devDependencies. Render exporta `NODE_ENV=production` también durante el build, así que `npm ci` pelado no los instala: `--include=dev` los incluye. Esos `node_modules` quedan para el start, y `prisma migrate deploy` los necesita.

El mismo build y el mismo start están en [`render.yaml`](render.yaml). Se puede aplicar como Blueprint o copiar los comandos en el panel. Node 22 (el de CI).

`npm run db:migrate:deploy` (en `server/`, `prisma migrate deploy`) aplica las migraciones ya commiteadas. Va encadenado **antes** de `npm run start -w server`, así que cada arranque deja la base al día. No crea migraciones nuevas y no corre el seed. En local se sigue usando `npm run db:migrate` (`prisma migrate dev`).

Health check: `GET /api/health` → `{ "status": "ok" }`. En Render, Health Check Path: `/api/health`.

### Variables por servicio

**Render (API).** No cargues `PORT`: lo inyecta la plataforma.

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal Database URL de Render. Si usás la External Database URL, agregá `sslmode=require` |
| `JWT_SECRET` | Secreto largo y aleatorio, distinto del de desarrollo |
| `CLIENT_URL` | URL https del front, un solo origen, sin barra final. Ejemplo ficticio: `https://truequeutn.vercel.app` |
| `API_PUBLIC_URL` | URL https del propio backend, sin barra final. Ejemplo ficticio: `https://truequeutn-api.onrender.com` |
| `ALLOWED_EMAIL_DOMAIN` | `utn.edu.ar` |

`API_PUBLIC_URL` tiene que ser https. Las fotos se sirven desde el backend (`/uploads/...`) y, si el link sale en http, el navegador las bloquea por contenido mixto. Sin esta variable el server arma el link con el host del request, que detrás del proxy de Render puede ser http.

`CLIENT_URL` es un solo origen y se compara tal cual. Una barra final, o `www` de más, hace que el front reciba 403 `CORS_NOT_ALLOWED`.

**Vercel (front).** Una sola variable, disponible en build (Vite la embebe; cambiarla pide un redeploy):

| Variable | Valor |
| --- | --- |
| `VITE_API_URL` | URL https del backend, sin barra final y sin `/api`. Ejemplo ficticio: `https://truequeutn-api.onrender.com` |

El router es `BrowserRouter`. [`client/vercel.json`](client/vercel.json) reescribe todas las rutas a `index.html`, así recargar `/propuestas`, `/perfil` o `/items/1` no devuelve 404 del hosting.

### Fotos

Las fotos de los ítems se guardan en disco local (`server/uploads`, o `UPLOADS_DIR` si está definida) y se sirven en `/uploads`. En el plan de Render sin disco persistente ese directorio se borra al reiniciar o redeployar: los ítems siguen en la base, pero las imágenes dejan de cargar. No hay otro storage en este deploy.

### Migraciones y redeploy

- Cada arranque del backend corre `prisma migrate deploy` y después `node dist/index.js`. Una migración nueva se aplica sola al redeployar el API.
- Redeploy del API: push a la rama que sigue Render, o **Manual Deploy** en el panel. No hace falta un comando aparte para migrar.
- Redeploy del front: push a la rama que sigue Vercel, o **Redeploy** en el panel. Hace falta si cambia `VITE_API_URL` o el código del client.

### Seed en producción

No forma parte del build ni del start. `npm run seed` borra usuarios, ítems, propuestas y calificaciones, y carga cuentas de demo con la contraseña `Trueque123`.

Si la demo necesita esos datos, se corre **una sola vez, a mano, sobre una base vacía** (Shell de Render, desde la raíz del repo):

```bash
npm run seed -w server
```

Volver a correrlo pisa lo que haya. El registro sigue limitado a `ALLOWED_EMAIL_DOMAIN` (`utn.edu.ar` por defecto). `npm run db:seed:demo` tampoco se engancha al deploy.

### Checklist de prueba de humo

1. `GET https://agiles-grupo11.onrender.com/api/health` responde `200` y `{ "status": "ok" }`.
2. https://agiles-grupo11.vercel.app carga el login.
3. Recargar `/login`, `/registro`, `/propuestas` y `/perfil` muestra la app, no un 404 de Vercel.
4. Entrar con un usuario del seed (si se cargó) o registrarse con un mail `@utn.edu.ar`. Un dominio distinto tiene que rechazarse.
5. Ver el listado, publicar un ítem y subir una foto. La foto se ve y su URL es https (el mismo host que la API).
6. Cerrar sesión y volver a entrar.
7. En Render, `CLIENT_URL` es exactamente `https://agiles-grupo11.vercel.app`, sin barra final. Si el navegador muestra un error de CORS, ese valor no coincide.

## Producción

- Front: https://agiles-grupo11.vercel.app
- API: https://agiles-grupo11.onrender.com
- Health: https://agiles-grupo11.onrender.com/api/health

## Endpoints

La colección de Postman con todos los endpoints, ejemplos y respuestas está en [`docs/postman/TruequeUTN.postman_collection.json`](docs/postman/TruequeUTN.postman_collection.json) (en Postman: _File → Import_). El request de login guarda el token para usarlo en los endpoints protegidos.

**Correr la colección completa.** Con el server levantado y la base con el seed (`npm run db:migrate` y `npm run seed`), la colección corre de arriba hacia abajo sin tocar los datos del seed: publica un ítem propio, lo consulta, lo edita y lo elimina. Cada request tiene sus aserciones, y se puede repetir las veces que quieras (el registro usa un email nuevo en cada corrida). Por consola:

```bash
npx newman run docs/postman/TruequeUTN.postman_collection.json --working-dir docs/postman
```

`--working-dir` hace falta para que encuentre `foto-prueba.png`, la imagen que usa el request "Subir foto". En el Runner de Postman, apuntá el _Working directory_ a `docs/postman`. Si algún request falla, newman termina con código distinto de 0.

| Método | Ruta                  | Auth | Descripción                                                                                                |
| ------ | --------------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`         | No   | Estado del server                                                                                          |
| POST   | `/api/auth/register`  | No   | Crea una cuenta institucional: `{ user, token }` (HU-01)                                                   |
| POST   | `/api/auth/login`     | No   | Inicia sesión: devuelve `{ user, token }`                                                                  |
| GET    | `/api/auth/me`        | Sí   | Usuario del token (para restaurar la sesión)                                                               |
| GET    | `/api/users/me`       | Sí   | Mi perfil con reputación e intercambios concretados (HU-11)                                                |
| PATCH  | `/api/users/me`       | Sí   | Edita mi nombre y carrera: `{ nombre?, carrera? }` (HU-11)                                                 |
| GET    | `/api/items`          | Sí   | Lista y busca ítems: `{ data, page, totalPages, total }` (HU-04)                                           |
| POST   | `/api/items`          | Sí   | Publica un ítem del usuario logueado: `{ item }` (HU-03)                                                   |
| GET    | `/api/items/:id`      | Sí   | Detalle del ítem con su dueño: `{ item, owner }` (HU-05). Un `PAUSADO` ajeno o un `ELIMINADO` responde 404 |
| PATCH  | `/api/items/:id`      | Sí   | Edita un ítem propio, o lo pausa y reactiva: `{ item }` (HU-14)                                            |
| DELETE | `/api/items/:id`      | Sí   | Elimina lógicamente un ítem propio y cancela sus propuestas pendientes: 204 (HU-15)                        |
| POST   | `/api/uploads`        | Sí   | Sube una foto (JPG/PNG/WebP, hasta 5 MB): `{ url }` (HU-13)                                                |
| GET    | `/api/users/me/items` | Sí   | Ítems del token: `{ data }`. `?status=` opcional; sin filtro incluye pausados                              |
| GET    | `/api/users/:id`      | Sí   | Perfil público: nombre, carrera, reputación, intercambios, ítems disponibles y 5 calificaciones. Sin email |
| GET    | `/api/proposals`      | Sí   | Propuestas del token: `{ data }`. `?status=` opcional. Trae persona, ítems y calificaciones                |
| PATCH  | `/api/proposals/:id`  | Sí   | Cancela una propuesta: `{ accion: "cancelar" }` → `{ data }` en `CANCELADA`, misma vista que el listado    |

`GET /api/users/me/items` usa el id del token, nunca un id de la URL. `status` tiene que ser `DISPONIBLE`, `RESERVADO`, `PAUSADO` o `INTERCAMBIADO`. Un valor inválido responde 400.

```http
GET /api/users/me/items?status=PAUSADO
Authorization: Bearer <token>
```

```json
{ "data": [{ "id": 4, "titulo": "Demo: Calculadora pausada", "estado": "PAUSADO", "ownerId": 1 }] }
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos",
    "details": [{ "field": "query.status", "message": "El estado no es válido" }]
  }
}
```

`GET /api/users/:id` devuelve el perfil público de un estudiante. El id tiene que ser un entero positivo. No incluye email ni contraseña. `reputacionPromedio` es `null` si no tiene calificaciones. `items` son solo los `DISPONIBLE`. `ultimasCalificaciones` trae como máximo 5, con el nombre de quien calificó.

```http
GET /api/users/7
Authorization: Bearer <token>
```

```json
{
  "data": {
    "id": 7,
    "nombre": "Ana Demo",
    "carrera": "Ingeniería en Sistemas",
    "createdAt": "2026-03-01T12:00:00.000Z",
    "reputacionPromedio": 4.3,
    "cantidadResenas": 2,
    "cantidadIntercambios": 1,
    "items": [{ "id": 4, "titulo": "Apunte de álgebra", "estado": "DISPONIBLE", "ownerId": 7 }],
    "ultimasCalificaciones": [
      {
        "id": 9,
        "puntaje": 5,
        "comentario": "El intercambio fue claro.",
        "createdAt": "2026-03-01T12:00:00.000Z",
        "evaluador": { "id": 2, "nombre": "Sofía Demo" }
      }
    ]
  }
}
```

Un id que no existe responde 404. Un id inválido responde 400. Sin token responde 401.

`PATCH /api/proposals/:id` con `{ "accion": "cancelar" }` pasa la propuesta a `CANCELADA`. Solo puede hacerlo quien participa.

- En `PENDIENTE`, solo quien la envió. El receptor ya no puede aceptarla y los ítems no cambian de estado.
- En `ACEPTADA`, cualquiera de las dos partes. Los ítems que estaban `RESERVADO` vuelven a `DISPONIBLE`.
- `RECHAZADA`, `CANCELADA` o `CONCRETADA` responden 409. Quien no participa responde 403. Si no existe, 404.

```http
PATCH /api/proposals/20
Authorization: Bearer <token>
Content-Type: application/json

{ "accion": "cancelar" }
```

La respuesta es `{ data }` con la misma forma que un elemento de `GET /api/proposals`: rol, la otra persona, los ítems y las calificaciones. Si el estado cambió entre la lectura y la escritura, responde 409 y no libera los ítems.

```json
{
  "data": {
    "id": 20,
    "estado": "CANCELADA",
    "rol": "proponente",
    "persona": { "id": 2, "nombre": "Sofía Demo" },
    "itemSolicitado": { "id": 8, "titulo": "Libro de Sofía", "estado": "DISPONIBLE" },
    "itemOfrecido": { "id": 4, "titulo": "Apunte de Tomás", "estado": "DISPONIBLE" }
  }
}
```

`GET /api/proposals?status=CONCRETADA` lista solo intercambios donde el usuario es proponente o receptor. Sin `status` devuelve todos los suyos. La calificación es `null` si esa persona todavía no calificó.

```json
{
  "data": [
    {
      "id": 1,
      "estado": "CONCRETADA",
      "rol": "proponente",
      "persona": { "id": 6, "nombre": "Sofía Demo" },
      "itemSolicitado": { "id": 8, "titulo": "Demo: Libro pausado de Sofía", "estado": "PAUSADO" },
      "itemOfrecido": {
        "id": 5,
        "titulo": "Demo: Instrumental intercambiado",
        "estado": "INTERCAMBIADO"
      },
      "calificacionDada": { "puntaje": 5, "comentario": "El intercambio fue claro y rápido." },
      "calificacionRecibida": {
        "puntaje": 4,
        "comentario": "El material estaba como lo describió."
      }
    }
  ]
}
```

## Frontend: rutas y sesión

| Ruta                | Acceso     | Pantalla                                                                                        |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `/`                 | Con sesión | Inicio: listado con búsqueda (`?q=`), categoría (`?categoria=`) y páginas (`?page=`) (HU-04)    |
| `/login`            | Sin sesión | Inicio de sesión, con link a "Crear cuenta"                                                     |
| `/registro`         | Sin sesión | Formulario de registro institucional (HU-01)                                                    |
| `/publicar`         | Con sesión | Formulario para publicar un material (HU-03)                                                    |
| `/items/:id`        | Con sesión | Detalle de una publicación (HU-05)                                                              |
| `/items/:id/editar` | Con sesión | Editar, pausar o reactivar una publicación propia (HU-14)                                       |
| `/perfil`           | Con sesión | Datos personales, publicaciones por estado e historial de intercambios                          |
| `/propuestas`       | Con sesión | Propuestas enviadas y recibidas. En una pendiente enviada, o en una aceptada, se puede cancelar |
| `/usuarios/:id`     | Con sesión | Perfil público de quien publicó un ítem: reputación, intercambios e ítems disponibles           |

La sesión vive en `client/src/auth/`. El token se guarda en `localStorage` y al cargar la app se valida con `GET /api/auth/me`. En los componentes se usa el hook `useAuth()` (`user`, `status`, `login`, `logout`), y las rutas se protegen anidándolas bajo `<PrivateRoute>` (solo con sesión) o `<RedirectIfAuthenticated>` (solo sin sesión). Para llamar a la API usá `apiFetch` de `client/src/lib/api.ts`, que agrega el token y convierte los errores en `ApiError`.

## Backend: cómo agregar un endpoint

El servidor está organizado por capas dentro de `server/src/`:

```text
routes/       # Define las URLs y encadena validación + controller
controllers/  # Lee el request, llama al service y arma la respuesta
services/     # Lógica de negocio; único lugar que usa Prisma (lib/prisma.ts)
middlewares/  # validate (Zod), requireAuth (JWT), notFound y errorHandler
errors/       # AppError: errores controlados con status y código
```

Para sumar un recurso: crear `routes/<recurso>.routes.ts`, su controller y su service, y montar el router en `routes/index.ts` (todo queda bajo `/api`).

**Validación.** Los schemas de Zod se pasan al middleware `validate`; el controller recibe `req.body` / `req.query` / `req.params` ya parseados:

```ts
router.post('/', validate({ body: createItemSchema }), itemsController.create);
```

**Autenticación.** Las rutas que requieren usuario logueado usan el middleware `requireAuth`. Espera el header `Authorization: Bearer <token>`, verifica la firma y la expiración (24 h) y deja el usuario en `req.user = { id, email }`:

```ts
router.post('/', requireAuth, validate({ body: createItemSchema }), itemsController.create);

// En el controller
const ownerId = req.user!.id;
```

Los tokens se generan con `signToken({ id, email })` de `lib/jwt.ts`. Sin token, o con un token vencido o adulterado, la respuesta es 401 `UNAUTHORIZED`.

**Errores.** Todas las respuestas de error tienen el mismo formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

| Caso                                    | Status | `code`                |
| --------------------------------------- | ------ | --------------------- |
| Body/query/params inválidos             | 400    | `VALIDATION_ERROR`    |
| JSON mal formado                        | 400    | `INVALID_JSON`        |
| Email o contraseña incorrectos          | 401    | `INVALID_CREDENTIALS` |
| Sin token, vencido o adulterado         | 401    | `UNAUTHORIZED`        |
| Origen no permitido por CORS            | 403    | `CORS_NOT_ALLOWED`    |
| Acción sobre un recurso ajeno           | 403    | `FORBIDDEN`           |
| Ruta inexistente                        | 404    | `NOT_FOUND`           |
| Eliminar un ítem con propuesta aceptada | 409    | `PROPOSAL_ACCEPTED`   |
| Editar un ítem ya intercambiado         | 400    | `BAD_REQUEST`         |
| Pausar o reactivar un ítem reservado    | 409    | `CONFLICT`            |
| Eliminar un ítem ya intercambiado       | 409    | `CONFLICT`            |
| Error no controlado                     | 500    | `INTERNAL_ERROR`      |

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
