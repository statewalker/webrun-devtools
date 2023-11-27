import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  root: resolve(__dirname, './src'),
  base : "./",
  publicDir: false,
  build: {
    outDir: resolve(__dirname, './dist/'),
    lib : {
      entry: resolve(__dirname, './src/api-client/index.js'),
      name: "api",
      formats: ["es"],
      fileName: "webrun-devtools",
    }
  },
})