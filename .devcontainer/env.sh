#!/usr/bin/env bash
# Escribe server/.env y client/.env con la URL pública del Codespace.
# El front llama a la API por su mismo origen (Vite hace de proxy de /api y /uploads al back),
# así alcanza con compartir un solo puerto: el 5173.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${CODESPACE_NAME:-}" ]]; then
  PUBLIC_URL="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
else
  PUBLIC_URL="http://localhost:5173"
fi

JWT_SECRET="$(grep -s '^JWT_SECRET=' server/.env | cut -d= -f2- || true)"
JWT_SECRET="${JWT_SECRET:-$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")}"

cat > server/.env <<ENV
PORT=3001
CLIENT_URL=${PUBLIC_URL}
DATABASE_URL="postgresql://trueque:trueque@localhost:5432/truequeutn?schema=public"
JWT_SECRET=${JWT_SECRET}
ALLOWED_EMAIL_DOMAIN=utn.edu.ar
API_PUBLIC_URL=${PUBLIC_URL}
ENV

echo "VITE_API_URL=${PUBLIC_URL}" > client/.env
echo "URL pública de la app: ${PUBLIC_URL}"
