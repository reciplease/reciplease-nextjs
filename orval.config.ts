import { defineConfig } from 'orval';

export default defineConfig({
  reciplease: {
    input: {
      target: `${process.env.BACKEND_URL || 'http://localhost:8080'}/openapi`,
    },
    output: {
      mode: 'single',
      target: 'src/types/generated/zod.ts',
      client: 'zod',
    },
  },
});
