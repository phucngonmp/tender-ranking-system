import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const frontendPort = parseInt(env.FRONTEND_PORT || process.env.FRONTEND_PORT || '8080', 10);
  const backendPort = env.PORT || process.env.PORT || '3000';
  const backendInternalUrl = env.BACKEND_INTERNAL_URL || process.env.BACKEND_INTERNAL_URL || `http://backend:${backendPort}`;

  return {
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 80,
      watch: {
        usePolling: true, // Fix for Windows/Docker file watch events
      },
      hmr: {
        clientPort: frontendPort, // Dynamic mapping to external docker host port
      },
      proxy: {
        '/api': {
          target: backendInternalUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\//, '/'),
        },
      },
    },
  };
});

