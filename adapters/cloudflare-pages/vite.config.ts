import { cloudflarePagesAdapter } from '@qwik.dev/router/adapters/cloudflare-pages/vite'
import { extendConfig } from '@qwik.dev/router/vite'
import baseConfig from '../../vite.config'

export default extendConfig(baseConfig, () => ({
  build: {
    ssr: true,
    rolldownOptions: {
      input: ['src/entry.cloudflare-pages.tsx'],
    },
  },
  // Worker SSR must select non-DOM exports in the Markdown pipeline.
  ssr: {
    resolve: {
      conditions: ['workerd', 'worker', 'module', 'production'],
    },
  },
  plugins: [cloudflarePagesAdapter()],
}))
