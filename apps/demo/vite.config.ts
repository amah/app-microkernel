import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  resolve: {
    alias: {
      '@app-microkernel/impl': path.resolve(__dirname, '../../libs/app-microkernel-impl/src/index.ts'),
      '@app-microkernel/api':  path.resolve(__dirname, '../../libs/app-microkernel-api/src/index.ts'),
      '@app-microkernel/spi':  path.resolve(__dirname, '../../libs/app-microkernel-spi/src/index.ts'),
    }
  }
});
