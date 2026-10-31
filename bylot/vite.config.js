import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://localhost:5000';

  return {
    base: process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/',
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      minify: 'esbuild',
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              const normalizedId = id.replace(/\\/g, '/');
              if (
                normalizedId.includes('node_modules/react/') ||
                normalizedId.includes('node_modules/react-dom/') ||
                normalizedId.includes('node_modules/react-router/') ||
                normalizedId.includes('node_modules/react-router-dom/')
              ) {
                return 'vendor-react';
              }
              if (normalizedId.includes('framer-motion')) {
                return 'vendor-framer';
              }
              if (normalizedId.includes('react-icons')) {
                return 'vendor-icons';
              }
              if (normalizedId.includes('react-parallax-tilt')) {
                return 'vendor-tilt';
              }
              if (normalizedId.includes('@react-oauth')) {
                return 'vendor-auth';
              }
              return 'vendor-libs';
            }
          },
        },
      },
    },
  };
});
