// ====================================================
// File Name   : eslint.config.mjs
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2026-09-10
//
// Description:
// - ESLint flat configuration for TUIZ backend
// - TypeScript-aware rules with strict type checking for src/**
// - Node.js, import, and security plugin integration
//
// Notes:
// - Uses tsconfig.json for type-aware linting on source files
// - Special rules for test files (tests/**, vitest configs)
// - Prettier compatibility ensured
// - ES2022 target alignment with TypeScript config
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier';

//----------------------------------------------------
// 2. Configuration
//----------------------------------------------------
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.husky/**',
      'commitlint.config.cjs',
      'eslint.config.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  n.configs['flat/recommended'],
  security.configs.recommended,
  prettier,

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.json' },
    },
    rules: {
      'no-console': 'warn',
      'import/order': ['error', { alphabetize: { order: 'asc', caseInsensitive: true } }],
      'import/no-unresolved': 'off',
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  {
    files: ['tests/**/*.ts', 'vitest.config.ts', 'vitest.ci.config.ts'],
    rules: {
      'import/no-unresolved': 'off',
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
];
