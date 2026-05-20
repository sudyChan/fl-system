
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 10821,
    open: true,
    watch: {
      ignored: ['**/venv/**', '**/data/**', '**/node_modules/**', '**/.git/**', '**/server/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8816', //后端服务地址
        changeOrigin: true,
      },
    },
  },
});
