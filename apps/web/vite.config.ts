import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Multi-page app: new care client (index.html, React) + preserved 2D fallback
// (index2d.html) + voxel truth viewer (index3d.html). React plugin only applies
// to .tsx/.jsx files — index2d/index3d are vanilla TS and are unaffected.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        care2d: resolve(__dirname, 'index2d.html'),
        care3d: resolve(__dirname, 'index3d.html'),
      },
    },
  },
});