import { defineConfig } from 'vite';

// base './' để chạy được cả trên GitHub Pages (đường dẫn /ten-repo/) lẫn khi mở bản build cục bộ.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
