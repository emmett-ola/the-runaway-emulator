import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Explicit tools-only invocation; the expensive benchmark is not a normal test.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tools/quality/index-benchmark.bench.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 30_000,
  },
});
