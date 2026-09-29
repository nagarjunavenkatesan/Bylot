import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const backendTarget = 'https://localhost:5000'

const certPath = path.resolve(__dirname, '..', 'backend', 'certs')
const httpsConfig = fs.existsSync(path.join(certPath, 'key.pem'))
  ? {
      key: fs.readFileSync(path.join(certPath, 'key.pem')),
      cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
    }
  : undefined

export default defineConfig({
  base: "/",
  server: {
    host: true,
    port: 5173,
    ...(httpsConfig ? { https: httpsConfig } : {}),
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
    ...(httpsConfig ? { https: httpsConfig } : {}),
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
            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            if (id.includes('react-icons')) {
              return 'vendor-icons';
            }
            if (id.includes('react-parallax-tilt')) {
              return 'vendor-tilt';
            }
            return 'vendor-libs';
          }
        }
      }
    }
  }
})
