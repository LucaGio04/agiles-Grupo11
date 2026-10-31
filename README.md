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

| Variable         | Paquete | Descripción                                                                    |
| ---------------- | ------- | ------------------------------------------------------------------------------ |
| `PORT`           | server  | Puerto del backend (default: 3001)                                             |
| `CLIENT_URL`     | server  | URL del frontend para CORS                                                     |
| `DATABASE_URL`   | server  | Conexión a PostgreSQL (el valor de ejemplo coincide con `docker-compose.yml`)  |
| `JWT_SECRET`     | server  | Secreto para firmar los tokens de sesión (JWT). Usá un valor largo y aleatorio |
| `UPLOADS_DIR`    | server  | (Opcional) Carpeta de las fotos de los ítems. Por defecto `server/uploads`     |
| `API_PUBLIC_URL` | server  | (Opcional) URL pública del backend para armar el link de las fotos             |
| `VITE_API_URL`   | client  | URL base del backend                                                           |

### 3. Base de datos

Levantá PostgreSQL con Docker, aplicá las migraciones y cargá los datos de prueba:

```bash
npm run db:up        # docker compose up -d
npm run db:migrate   # npx prisma migrate dev (crea las tablas)
npm run seed         # carga 5 usuarios y 20 ítems de ejemplo
```

Todos los usuarios del seed (`tomas@utn.edu.ar`, `luca@utn.edu.ar`, `facundo@utn.edu.ar`, `joaquin@utn.edu.ar`, `martina@utn.edu.ar`) tienen la contraseña `Trueque123`. El seed borra y vuelve a crear los datos, así que se puede correr cuantas veces haga falta. Las fotos de prueba de los ítems salen de `server/prisma/seed-assets/` y se copian a `server/uploads/`. Para sumar publicaciones en todos los estados e intercambios concretados, corré `npm run db:seed:demo -w server`.

Para probar el perfil (un ítem en cada estado y el historial de intercambios) hay un seed aparte. No se corre con `npm run seed` ni con `prisma migrate reset`:

```bash
npm run db:seed:demo
```

Se puede correr varias veces: actualiza los mismos datos en lugar de duplicarlos. Reutiliza a `tomas@utn.edu.ar` si ya existe (no le cambia la contraseña) y crea a `sofia.demo@utn.edu.ar` con la contraseña `Trueque123` si no estaba. Tomás queda con un ítem disponible, uno reservado, uno pausado y uno intercambiado. Sofía queda con un ítem pausado, que Tomás no puede ver. Hay dos intercambios concretados entre los dos: uno con calificación dada y recibida, y otro sin calificar.

`npm run seed` borra toda la base antes de cargar, así que después hay que volver a correr `npm run db:seed:demo`.

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

Para levantar un paquete por separado:

```bash
npm run dev -w server
npm run dev -w client
```

## Demo con GitHub Codespaces (sin instalar nada)

Para mostrar la app desde cualquier compu, solo con el navegador:

1. En GitHub, en la rama a mostrar (por ejemplo `develop`): **Code → Codespaces → Create codespace on develop**.
2. Esperar a que termine de armarse (la primera vez tarda unos minutos: instala dependencias, crea la base y carga los seeds). Al final se levanta solo `npm run dev`.
3. En la pestaña **PORTS**, el puerto **5173** es la app. Para compartir el link con alguien que no tiene acceso al repo: clic derecho → **Port Visibility → Public** (el script lo intenta hacer solo). Copiar la URL (`https://<nombre>-5173.app.github.dev`).
4. Ingresar con `tomas@utn.edu.ar` / `Trueque123` (o cualquier usuario del seed).

El front usa la API por su mismo origen (Vite hace de proxy de `/api` y `/uploads`), así que alcanza con compartir ese único puerto. El link funciona mientras el Codespace esté prendido; se apaga solo después de un rato sin uso y se vuelve a prender desde **Code → Codespaces**.

## Endpoints

La colección de Postman con todos los endpoints, ejemplos y respuestas está en [`docs/postman/TruequeUTN.postman_collection.json`](docs/postman/TruequeUTN.postman_collection.json) (en Postman: _File → Import_). El request de login guarda el token para usarlo en los endpoints protegidos.

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

| Ruta                | Acceso     | Pantalla                                                                                     |
| ------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| `/`                 | Con sesión | Inicio: listado con búsqueda (`?q=`), categoría (`?categoria=`) y páginas (`?page=`) (HU-04) |
| `/login`            | Sin sesión | Inicio de sesión, con link a "Crear cuenta"                                                  |
| `/registro`         | Sin sesión | Formulario de registro institucional (HU-01)                                                 |
| `/publicar`         | Con sesión | Formulario para publicar un material (HU-03)                                                 |
| `/items/:id`        | Con sesión | Detalle de una publicación (HU-05)                                                           |
| `/items/:id/editar` | Con sesión | Editar, pausar o reactivar una publicación propia (HU-14)                                    |
| `/perfil`           | Con sesión | Datos personales, publicaciones por estado e historial de intercambios                       |
| `/usuarios/:id`     | Con sesión | Perfil público de quien publicó un ítem: reputación, intercambios e ítems disponibles        |

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
