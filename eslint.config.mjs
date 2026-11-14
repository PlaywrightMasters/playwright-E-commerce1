import js from '@eslint/js';
import playwright from 'eslint-plugin-playwright';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', 'playwright/.auth/'] },

  js.configs.recommended,

  {
    files: ['app/**/*.mjs', '*.mjs'],
    languageOptions: { globals: globals.node },
    // `const { secret, ...rest } = obj` is the idiomatic way to omit fields.
    rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
  {
    files: ['app/public/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },

  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  {
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // Page objects expose assertion helpers named expect*().
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]\\w*$', '\\.expect[A-Z]\\w*$'] }],
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/prefer-web-first-assertions': 'error',
    },
  },
);
