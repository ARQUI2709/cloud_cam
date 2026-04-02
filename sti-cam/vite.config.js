import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/sti_cam/',
  server: {
    https: false,      // En dev local. getUserMedia requiere HTTPS en producción
    host: true,        // Accesible desde el celular en la misma red
  },
});
