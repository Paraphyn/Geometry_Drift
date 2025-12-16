import { defineConfig } from 'vite';

export default defineConfig({
  // Defaults are fine for Vercel (dist output, base '/').
  server: {
    host: true,
  },
});
