import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['test/**/*.test.{ts,tsx}'], pool: 'forks', poolOptions: { forks: { singleFork: true } } },
});
