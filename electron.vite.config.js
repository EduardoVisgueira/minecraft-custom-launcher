import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Módulos node built-in + electron que devem permanecer externos (não bundlados).
// undici PRECISA ser externo: se o Rollup o empacota, ele quebra a lazy-ness do
// require('node:sqlite') do SqliteCacheStore -> "No such built-in module:
// node:sqlite" no Electron (Node 20 não tem esse módulo).
const NODE_BUILTINS = [
  'path', 'fs', 'os', 'crypto', 'https', 'http', 'url', 'events',
  'stream', 'util', 'child_process', 'net', 'tls', 'zlib', 'buffer',
  'dns', 'sqlite', 'assert', 'process', 'zlib'
]
const EXTERNALS = [
  'electron',
  'undici',
  '@xmcl/core', '@xmcl/installer',
  ...NODE_BUILTINS,
  ...NODE_BUILTINS.map((m) => `node:${m}`)
]

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: 'electron/main.js'
      },
      rollupOptions: {
        external: EXTERNALS
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist-electron/preload',
      lib: {
        entry: 'electron/preload.js'
      },
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html')
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  }
})
