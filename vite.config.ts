import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // In dev the browser talks to the game server through Vite's origin.
      '/ws': { target: 'ws://localhost:2567', ws: true },
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
