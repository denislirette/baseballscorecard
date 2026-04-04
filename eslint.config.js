import js from '@eslint/js';
import compat from 'eslint-plugin-compat';
import globals from 'globals';

export default [
  // Base recommended rules
  js.configs.recommended,

  // Browser compatibility checking
  compat.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Code quality
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'no-implicit-globals': 'error',

      // Warn on console.log (allow warn/error)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Ignore non-source files
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'docs/**',
      'fixtures/**',
      'eslint.config.js',
      'vite.config.js',
      'playwright.config.js',
      'tests/**',
    ],
  },
];
