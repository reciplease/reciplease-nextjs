const nextConfig = require('eslint-config-next');

// eslint-config-next exports a flat config array for ESLint 9
module.exports = [
  ...nextConfig,
  {
    // Relax display-name rule in test files — mock components don't need it
    files: ['src/**/*.test.tsx', 'src/**/*.test.ts', 'e2e/**/*.spec.ts'],
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    // Global ambient type files declare types used implicitly across the codebase;
    // the unused-vars rule cannot see their usage and must be silenced here.
    files: ['src/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
