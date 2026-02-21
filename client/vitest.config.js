import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setupTests.js'],
    include: [
      'src/**/*.vitest.test.{js,jsx}',
      'src/**/*.vitest.spec.{js,jsx}',
      'src/components/AnnotationEditor.interactions.test.jsx'
    ]
  }
});
