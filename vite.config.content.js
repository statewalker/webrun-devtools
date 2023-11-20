import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  root: resolve(__dirname, './src'),
  base : "./",
  publicDir: false,
  build: {
    outDir: resolve(__dirname, './dist/extension/content'),
    lib : {
      entry: resolve(__dirname, './src/content/index.js'),
      name: "content",
      formats: ["es"],
      fileName: "index",
    },
  },
})