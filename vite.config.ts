/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the app from /civicbid-studio/. Override with VITE_BASE=/ for other hosts.
const base = process.env.VITE_BASE ?? '/civicbid-studio/';

export default defineConfig({
  base,
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022' },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: false,
  },
});
