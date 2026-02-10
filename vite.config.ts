import { qwikVite } from '@builder.io/qwik/optimizer'
import { qwikCity } from '@builder.io/qwik-city/vite'
import tailwindcss from '@tailwindcss/vite'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkObsidianCallout from 'remark-obsidian-callout'
import remarkWikiLink from 'remark-wiki-link'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(() => {
  return {
    plugins: [
      tailwindcss(),
      qwikCity({
        mdx: {
          remarkPlugins: [
            remarkGfm,
            remarkDirective,
            [
              remarkWikiLink,
              {
                pageResolver: (name: string) => [
                  name.replace(/ /g, '-').toLowerCase(),
                ],
                hrefTemplate: (permalink: string) => `/${permalink}`,
                aliasDivider: '|',
              },
            ],
            remarkObsidianCallout,
          ],
          rehypePlugins: [],
        },
      }),
      qwikVite(),
      tsconfigPaths(),
    ],
    ssr: {
      external: [
        'node:fs',
        'node:path',
        'gray-matter',
        'unified',
        'remark-parse',
        'remark-gfm',
        'remark-directive',
        'remark-wiki-link',
        'remark-obsidian-callout',
        'remark-rehype',
        'rehype-stringify',
      ],
      noExternal: [],
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
  }
})
