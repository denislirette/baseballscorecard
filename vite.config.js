import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        game: 'game.html',
        styles: 'styles.html',
      },
    },
  },
});
