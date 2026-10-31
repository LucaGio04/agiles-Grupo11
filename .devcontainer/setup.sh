#!/usr/bin/env bash
# Se corre una sola vez, al crear el Codespace.
set -euo pipefail
cd "$(dirname "$0")/.."

bash .devcontainer/env.sh
npm install

# Esperar a que PostgreSQL acepte conexiones.
for _ in $(seq 1 30); do
  node -e "require('net').connect(5432,'localhost').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" && break
  sleep 2
done

cd server
npx prisma migrate deploy
npm run seed
npm run db:seed:demo
