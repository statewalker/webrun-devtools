import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  root: resolve(__dirname, './src'),
  base : "./",
  build: {
    outDir: resolve(__dirname, './dist'),
    lib : {
      entry: resolve(__dirname, './src/client/index.js'),
      name: "client",
      formats: ["es"],
      fileName: "index",
    }
  },
})