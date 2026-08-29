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
  'reciplease-client': {
    input: {
      target: `${process.env.BACKEND_URL || 'http://localhost:8080'}/openapi`,
    },
    output: {
      mode: 'single',
      target: 'src/types/generated/client.ts',
      client: 'swr',
      override: {
        mutator: {
          path: 'src/lib/apiClientMutator.ts',
          name: 'apiClientMutator',
        },
        // The backend's /api/food/barcode/{barcode} operation has operationId
        // "barcode" with a path param also named "barcode" — orval's swr
        // client generates a function `barcode(barcode, ...)` whose body then
        // calls `barcode(...)`, self-shadowing the function with its own
        // string param and breaking the type (TS2349/TS2344). Rename just
        // this generated function to sidestep the collision without touching
        // the backend spec.
        operations: {
          barcode: {
            operationName: () => 'getFoodBarcode',
          },
        },
      },
    },
  },
});
