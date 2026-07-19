import { defineConfig } from 'vite';
import { resolve } from 'path';

// Multi-page app: new care client (index.html) + preserved 2D fallback (index2d.html)
// + voxel truth viewer (index3d.html).
export default defineConfig({
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