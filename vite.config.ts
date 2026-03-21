import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/2d-survival-card-demo/' : '/',
  plugins: [react()],
}));
