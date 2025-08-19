import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier';

export default [
  // 1) Ignore generated & config files so TS typed rules don't run on them
  { ignores: ['dist/**', 'node_modules/**', '.husky/**', 'commitlint.config.cjs', 'eslint.config.mjs'] },

  // 2) Base JS recommendations (no type info required)
  js.configs.recommended,

  // 3) Base TS rules (NON type-aware) applied globally to .ts files
  ...tseslint.configs.recommended,

  // 4) Node/import/security hygiene
  importPlugin.flatConfigs.recommended,
  n.configs['flat/recommended'],
  security.configs.recommended,

  // 5) Disable rules that conflict with Prettier
  prettier,

  // 6) Type-AWARE TS rules ONLY for our source code
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      'no-console': 'warn',
      'import/order': ['error', { alphabetize: { order: 'asc', caseInsensitive: true } }],
      'import/no-unresolved': 'off', // TypeScript handles this
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];
