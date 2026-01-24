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
import { NotFound } from '~/components/not-found'
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

const formatKoreanDate = (dateValue: unknown): string | null => {
  if (!dateValue) return null

  let date: Date | null = null

  if (dateValue instanceof Date) {
    date = dateValue
  } else if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue)
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed
    }
  } else if (typeof dateValue === 'number') {
    date = new Date(dateValue)
  }

  if (!date || Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}년 ${month}월 ${day}일`
}

interface ArticleData {
  content: string
  frontmatter: Record<string, unknown>
  title: string
  formattedDate: string | null
  isNotFound: boolean
}

export const useArticleData = routeLoader$<ArticleData>(
  async ({ params, status }) => {
    const raw = params.slug ?? ''
    const parts = String(raw)
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean)

    if (raw.startsWith('.well-known/')) {
      status(404)
      return {
        content: '',
        frontmatter: {},
        title: 'Not Found',
        formattedDate: null,
        isNotFound: true,
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
        return {
          content: '',
          frontmatter: {},
          title: 'Not Found',
          formattedDate: null,
          isNotFound: true,
        }
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
        formattedDate: formatKoreanDate(fm.date),
        isNotFound: false,
      }
    } catch {
      status(404)
      return {
        content: '',
        frontmatter: {},
        title: 'Not Found',
        formattedDate: null,
        isNotFound: true,
      }
    }
  },
)

export default component$(() => {
  const articleData = useArticleData()

  if (articleData.value.isNotFound) {
    return <NotFound />
  }

  return (
    <section class="content-wrapper">
      <nav class="article-nav">
        <a href="/" class="back-link">
          ← 처음으로
        </a>
      </nav>
      <article>
        <header class="article-header">
          <h1>{articleData.value.title}</h1>
          {articleData.value.formattedDate && (
            <time>{articleData.value.formattedDate}</time>
          )}
        </header>
        <div
          class="article-content"
          dangerouslySetInnerHTML={articleData.value.content}
        />
      </article>
    </section>
  )
})

export const head: DocumentHead = ({ resolveValue }) => {
  const article = resolveValue(useArticleData)

  if (article?.isNotFound) {
    return {
      title: '이곳엔 아무것도 없습니다 | subux.dev',
    }
  }

  const fm = article?.frontmatter as Record<string, unknown> | undefined
  const fmTitle = typeof fm?.title === 'string' ? fm.title : ''

  return {
    title: fmTitle.trim().length > 0 ? fmTitle : 'www.subux.dev',
  }
}
