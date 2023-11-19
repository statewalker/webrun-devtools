import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  root: resolve(__dirname, './src'),
  base : "./",
  publicDir: resolve(__dirname, './public'),
  build: {
    outDir: resolve(__dirname, './dist'),
    lib : {
      entry: resolve(__dirname, './src/background/index.js'),
      name: "background",
      formats: ["es"],
      fileName: "background/index",
    }
  },
})