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
  {
    // Blocks the "x as unknown as Y" double-cast escape hatch in production code —
    // it defeats type checking entirely with no compiler feedback. Test files are
    // exempt: casting through `unknown` to build a partial/incompatible mock object
    // is an accepted, common pattern there (see src/__tests__/**, src/**/*.test.ts(x)).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/types/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
          message:
            'Avoid `x as unknown as Y` — it bypasses type checking entirely. Narrow the type properly, use a type guard, or (for genuinely incompatible ambient/DOM types) use a `declare global` augmentation instead.',
        },
        {
          // Blocks `[key: string]: unknown` / `[key: number]: unknown` index signatures used
          // as a cast escape hatch — they make EVERY property access on the type (including
          // typos) silently type-check as `unknown`, defeating the point of the interface.
          selector: "TSIndexSignature[typeAnnotation.typeAnnotation.type='TSUnknownKeyword']",
          message:
            'Avoid an `unknown`-typed index signature as a cast escape hatch — it silently type-checks every property access on this type, including typos. Type the fields you actually use instead, or validate the shape at runtime (e.g. with zod).',
        },
      ],
    },
  },
];
