import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  root: resolve(__dirname, './src'),
  base : "./",
  publicDir: resolve(__dirname, './src/public'),
  build: {
    outDir: resolve(__dirname, './dist/webrun-devtools-extension'),
    rollupOptions: {
      input: {
        popup: resolve(__dirname, './src/popup/index.html'),
      },
    },
  },
})