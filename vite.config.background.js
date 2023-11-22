import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  root: resolve(__dirname, './src'),
  base : "./",
  publicDir: false,
  build: {
    outDir: resolve(__dirname, './dist/webrun-devtools-extension/background'),
    lib : {
      entry: resolve(__dirname, './src/background/index.js'),
      name: "background",
      formats: ["es"],
      fileName: "index",
    },
  },
})