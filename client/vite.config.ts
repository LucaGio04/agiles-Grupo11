import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En GitHub Codespaces el front se abre por https://<codespace>-5173.app.github.dev
const enCodespaces = Boolean(process.env.CODESPACES);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: enCodespaces ? ['.app.github.dev'] : undefined,
    hmr: enCodespaces ? { clientPort: 443 } : undefined,
    // Permite usar la API por el mismo origen del front (VITE_API_URL = URL del front).
    // Así para mostrar la app alcanza con exponer un solo puerto.
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
