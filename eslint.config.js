import globals from 'globals';

// Kept deliberately small: catch undeclared names (which throw in ES modules) and stale imports.
export default [
  {ignores: ['dist/', 'prototype/', 'node_modules/']},
  {
    files: ['src/**/*.js'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser},
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', {vars: 'all', args: 'none', caughtErrors: 'none'}],
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', '*.js', '*.mjs'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: globals.node},
  },
];
