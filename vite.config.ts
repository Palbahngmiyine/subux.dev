import { qwikVite } from '@qwik.dev/core/optimizer'
import { qwikRouter } from '@qwik.dev/router/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  plugins: [tailwindcss(), qwikRouter(), qwikVite()],
  resolve: {
    tsconfigPaths: true,
  },
  // Vite's dependency scanner transforms glob imports without tsconfig JSX settings.
  optimizeDeps: {
    rolldownOptions: {
      transform: {
        jsx: { importSource: '@qwik.dev/core' },
      },
    },
  },
  server: {
    headers: {
      'Cache-Control': 'public, max-age=0',
    },
  },
  preview: {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  },
  define: {
    global: 'globalThis',
  },
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**', 'tmp/**', 'server/**'],
    rules: {
      'eslint/prefer-const': 'error',
      'eslint/eqeqeq': 'error',
      'eslint/no-var': 'error',
      'react/no-danger': 'off',
    },
  },
  fmt: {
    ignorePatterns: ['dist/**', 'node_modules/**', 'tmp/**', 'server/**'],
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
  },
})
