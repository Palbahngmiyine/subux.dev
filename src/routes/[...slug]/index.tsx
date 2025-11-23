import { component$ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'
import { routeLoader$ } from '@builder.io/qwik-city'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkObsidianCallout from 'remark-obsidian-callout'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkWikiLink from 'remark-wiki-link'
import { unified } from 'unified'
import { formatFrontmatterDate } from '~/lib/date'
import { parseMarkdown } from '~/lib/markdown'

type MarkdownCollection = {
  baseFolder: 'articles' | 'translations'
  modules: Record<string, string>
}

const INDEX_CANDIDATES = ['@index.md', '@index.mdx', 'index.md', 'index.mdx']

const buildPathCandidates = (parts: string[], baseFolder: string): string[] => {
  const basePath = `../../${baseFolder}/${parts.join('/')}`
  const files = [`${basePath}.md`, `${basePath}.mdx`]
  for (const name of INDEX_CANDIDATES) {
    files.push(`../../${baseFolder}/${parts.join('/')}/${name}`)
  }
  return files
}

const findMarkdownEntry = (
  parts: string[],
  collections: MarkdownCollection[],
): { key: string; modules: Record<string, string> } | null => {
  for (const collection of collections) {
    const candidates = buildPathCandidates(parts, collection.baseFolder)
    for (const candidate of candidates) {
      if (candidate in collection.modules) {
        return { key: candidate, modules: collection.modules }
      }
    }
  }
  return null
}

interface ArticleData {
  content: string
  frontmatter: Record<string, unknown>
  title: string
}

export const useArticleData = routeLoader$<ArticleData>(
  async ({ params, status }) => {
    // Qwik City `[...slug]` provides `params.slug` as a slash-joined string
    const raw = params.slug ?? ''
    const parts = String(raw)
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean)

    // Edge/Chrome DevTools가 자동으로 요청하는 well-known 경로는 아티클 라우팅에서 조용히 무시 (404 반환, 에러 미발생)
    if (raw.startsWith('.well-known/')) {
      status(404)
      return {
        content: '',
        frontmatter: {},
        title: 'Not Found',
      }
    }

    try {
      const collections: MarkdownCollection[] = [
        {
          baseFolder: 'articles',
          modules: import.meta.glob('../../articles/**/*.{md,mdx}', {
            query: '?raw',
            import: 'default',
            eager: true,
          }) as Record<string, string>,
        },
        {
          baseFolder: 'translations',
          modules: import.meta.glob('../../translations/**/*.{md,mdx}', {
            query: '?raw',
            import: 'default',
            eager: true,
          }) as Record<string, string>,
        },
      ]

      const matchedEntry =
        parts.length > 0 ? findMarkdownEntry(parts, collections) : null
      if (!matchedEntry) {
        status(404)
        throw new Error(`Article not found: ${raw}`)
      }

      const fileContent = matchedEntry.modules[matchedEntry.key]

      const parsed = parseMarkdown(fileContent)

      const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkDirective)
        .use(remarkWikiLink, {
          pageResolver: (name: string) => [
            name.replace(/ /g, '-').toLowerCase(),
          ],
          hrefTemplate: (permalink: string) => `/${permalink}`,
          aliasDivider: '|',
        })
        .use(remarkObsidianCallout)
        .use(remarkRehype)
        .use(rehypeStringify)

      const result = await processor.process(parsed.content)
      const fm = parsed.data as Record<string, unknown>
      const title =
        typeof fm.title === 'string' && fm.title.trim().length > 0
          ? fm.title
          : (parts[parts.length - 1] ?? 'Article')

      return {
        content: result.toString(),
        frontmatter: fm,
        title,
      }
    } catch {
      status(404)
      throw new Error(`Article not found: ${raw}`)
    }
  },
)

export default component$(() => {
  const articleData = useArticleData()
  const fm = articleData.value.frontmatter as Record<string, unknown>
  const formattedDate = formatFrontmatterDate(fm.date)

  return (
    <section class="max-w-2xl mx-auto px-4 py-8">
      <div>
        <a href="/" class="default-link">
          <b>←</b> Back to Home
        </a>
      </div>
      <article class="w-full mx-auto px-4 py-8 bg-white rounded-lg mt-4">
        <h1 class="text-4xl font-bold break-keep">{articleData.value.title}</h1>
        {formattedDate && (
          <div class="text-gray-500 text-sm mt-2 mb-6">{formattedDate}</div>
        )}
        <div
          class="prose prose-lg max-w-none break-keep"
          dangerouslySetInnerHTML={articleData.value.content}
        />
      </article>
    </section>
  )
})

export const head: DocumentHead = ({ resolveValue }) => {
  const article = resolveValue(useArticleData)
  const fm = article?.frontmatter as Record<string, unknown> | undefined
  const fmTitle = typeof fm?.title === 'string' ? fm.title : ''

  return {
    title: fmTitle.trim().length > 0 ? fmTitle : 'www.subux.dev',
  }
}
