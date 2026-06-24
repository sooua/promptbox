import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    // Bind the dev server to IPv4 explicitly. On Windows, Vite otherwise listens
    // on IPv6 [::1] while Electron loads http://localhost (which resolves to
    // 127.0.0.1 first), causing a permanent ERR_CONNECTION_REFUSED on startup.
    server: {
      host: '127.0.0.1'
    },
    plugins: [react(), tailwindcss()]
  }
})
