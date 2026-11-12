import { defineConfig } from 'vite-plus'

// Vite+ runs the linter and formatter here. Subux builds the site itself
// (see scripts/build.ts).
export default defineConfig({
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**'],
    rules: {
      'eslint/prefer-const': 'error',
      'eslint/eqeqeq': 'error',
      'eslint/no-var': 'error',
    },
  },
  fmt: {
    ignorePatterns: ['dist/**', 'node_modules/**'],
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
  },
})
