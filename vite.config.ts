import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Windows is case-insensitive: /license would otherwise serve the LICENSE file. */
function spaLegalRoutes(): Plugin {
    const legalPaths = new Set(['/license', '/privacy', '/terms', '/cookies', '/studio', '/markdown', '/math']);
  return {
    name: 'spa-legal-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '').split('?')[0]?.toLowerCase() ?? '';
        if (legalPaths.has(pathname)) {
          req.url = '/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), spaLegalRoutes()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    host: true,
  },
  preview: {
    port: 5180,
    host: true,
  },
});
