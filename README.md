# TruequeUTN

Trabajo Práctico para la materia Metodologías Ágiles — Grupo 11.

Plataforma web académica para que estudiantes de la UTN intercambien materiales de estudio (libros, apuntes, calculadoras) sin dinero de por medio. Los usuarios podrán publicar materiales que ya no usan, buscar los que necesitan y proponer un intercambio directo con otro estudiante.

## Stack

| Capa | Tecnología | Estado |
|------|------------|--------|
| Frontend | React + Vite + TypeScript | Configurado |
| Backend | Node.js + Express + TypeScript | Configurado |
| Base de datos | PostgreSQL + Prisma | Pendiente (tarjeta posterior) |

## Requisitos previos

- **Node.js** >= 20 (LTS recomendado)
- **npm** >= 10 (incluido con Node)

## Estructura del proyecto

```text
/
├── client/          # Frontend React + Vite
├── server/          # Backend Express + TypeScript
├── package.json     # Monorepo (npm workspaces)
├── eslint.config.mjs # ESLint compartido
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

| Variable | Paquete | Descripción |
|----------|---------|-------------|
| `PORT` | server | Puerto del backend (default: 3001) |
| `CLIENT_URL` | server | URL del frontend para CORS |
| `VITE_API_URL` | client | URL base del backend |

### 3. Levantar en desarrollo

Desde la raíz del proyecto:

```bash
npm run dev
```

Esto inicia el backend en `http://localhost:3001` y el frontend en `http://localhost:5173`.

Abrí el navegador en `http://localhost:5173`. Deberías ver **TruequeUTN** y el estado del backend en **ok**.

### 4. Otros comandos

```bash
npm run lint      # ESLint en client y server
npm run build     # Compila ambos paquetes
npm run format    # Prettier en todo el repo
```

Para levantar un paquete por separado:

```bash
npm run dev -w server
npm run dev -w client
```

## Estrategia de ramas

| Rama | Propósito |
|------|-----------|
| `main` | Código estable y deployable. Protegida: solo se actualiza vía Pull Request. |
| `develop` | Integración de features antes de llegar a `main`. |
| `feature/HU-XX-descripcion` | Una rama por historia de usuario o tarjeta técnica. |

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
