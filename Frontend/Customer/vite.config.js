import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ isSsrBuild }) => ({
  publicDir: isSsrBuild ? false : 'public',
  build: isSsrBuild ? {
    rolldownOptions: {
      output: { entryFileNames: '[name].mjs', chunkFileNames: 'assets/[name]-[hash].mjs' },
    },
  } : {},
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
}))
