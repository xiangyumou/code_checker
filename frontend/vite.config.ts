import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow Vite to be accessed from network (needed for Docker)
    port: 5173, // Explicitly define the port Vite should run on inside the container
    proxy: {
      // Proxy API requests starting with /api to the backend service
      '/api': {
        target: 'http://backend:8000', // Target the backend service name and port
        changeOrigin: true, // Needed for virtual hosted sites
      },
      // Add proxy rule for WebSocket connections
      '/ws': {
        target: 'ws://backend:8000', // Target the backend WebSocket endpoint (use ws://)
        ws: true, // IMPORTANT: Enable WebSocket proxying
        changeOrigin: true, // May be needed depending on server setup
      },
    },
  },
})