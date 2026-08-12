import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ziel-Backend (gehostetes Render-Backend). Im Dev laeuft alles ueber den
// Vite-Proxy unter /api -> so umgehen wir CORS komplett waehrend der Entwicklung.
const BACKEND = 'https://money-dashboard-8blm.onrender.com'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
