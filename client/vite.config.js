import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      // In Docker or behind reverse proxies, the client may attempt to open
      // a WS connection to the wrong host/port. Pin it explicitly.
      protocol: 'ws',
      host: process.env.HMR_HOST || 'localhost',
      clientPort: Number(process.env.HMR_CLIENT_PORT || 5173)
    }
  }
})