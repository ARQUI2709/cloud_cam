import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: 'https://github.com/ARQUI2709/cloud_cam',  // ← Cambiar al nombre de tu repo en GitHub
  server: {
    https: false,      // En dev local. getUserMedia requiere HTTPS en producción
    host: true,        // Accesible desde el celular en la misma red
  },
});
