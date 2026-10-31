#!/usr/bin/env bash
# Se corre cada vez que se abre el Codespace: actualiza las URLs y levanta back + front.
set -euo pipefail
cd "$(dirname "$0")/.."

bash .devcontainer/env.sh

# Intentar dejar el puerto 5173 público para poder compartir el link sin login de GitHub.
# Si no hay permiso, hacerlo a mano: pestaña PORTS → clic derecho en 5173 → Port Visibility → Public.
if [[ -n "${CODESPACE_NAME:-}" ]] && command -v gh >/dev/null; then
  (sleep 15 && gh codespace ports visibility 5173:public -c "$CODESPACE_NAME" >/dev/null 2>&1 \
    && echo "Puerto 5173 público.") &
fi

npm run dev
