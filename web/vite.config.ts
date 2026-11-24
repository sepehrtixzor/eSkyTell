import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Base path: GitHub Pages project site https://sepehrtixzor.github.io/eSkyTell/
// Override with BASE_PATH=/ npm run build (e.g. for a custom domain or local preview).
const base = process.env.BASE_PATH ?? '/eSkyTell/';

export default defineConfig({
  base,
  plugins: [preact()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] } },
    },
  },
});
