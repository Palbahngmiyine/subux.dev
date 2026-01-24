import { component$ } from '@builder.io/qwik'
import {
  type DocumentHead,
  Link,
  routeLoader$,
  useLocation,
} from '@builder.io/qwik-city'
import { Tabs } from '~/components/tabs'
import { parseMarkdown } from '~/lib/markdown'

type Article = {
  slug: string
  title: string
  description: string
  filename: string
  date: string | null
  dateObj: Date | null
}

const INDEX_CANDIDATES = ['@index.md', '@index.mdx', 'index.md', 'index.mdx']

const computeSlugAndFilename = (
  key: string,
  baseFolder: string,
): { slug: string; filename: string } => {
  const normalized = key.replace(/\\/g, '/')
  const afterBase = normalized.split(`${baseFolder}/`).pop() || normalized
  const filename = afterBase
  const withoutExt = afterBase.replace(/\.(md|mdx)$/i, '')

  if (INDEX_CANDIDATES.some((name) => afterBase.endsWith(`/${name}`))) {
    const dir = afterBase.split('/').slice(0, -1).join('/')
    return { slug: dir, filename }
  }

  return { slug: withoutExt, filename }
}

const parseDate = (
  dateValue: unknown,
): { formatted: string | null; dateObj: Date | null } => {
  if (!dateValue) return { formatted: null, dateObj: null }

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
    return { formatted: null, dateObj: null }
  }

  const month = date.getMonth() + 1
  const day = date.getDate()
  const formatted = `${month}월 ${day}일`

  return { formatted, dateObj: date }
}

const loadArticlesFromGlob = (
  modules: Record<string, string>,
  baseFolder: string,
): Article[] => {
  const articles: Article[] = []
  for (const [key, raw] of Object.entries(modules)) {
    try {
      const { slug, filename } = computeSlugAndFilename(key, baseFolder)
      const parsed = parseMarkdown(raw)
      const frontmatter = parsed.data as Record<string, unknown>
      const { formatted, dateObj } = parseDate(frontmatter.date)
      articles.push({
        slug,
        title: (frontmatter.title as string) || slug,
        description: (frontmatter.description as string) || '',
        filename,
        date: formatted,
        dateObj,
      })
    } catch (error) {
      console.error('Error processing file:', key, error)
    }
  }

  articles.sort((a, b) => {
    if (!a.dateObj && !b.dateObj) return 0
    if (!a.dateObj) return 1
    if (!b.dateObj) return -1
    return b.dateObj.getTime() - a.dateObj.getTime()
  })

  return articles
}

export const useArticlesList = routeLoader$(async () => {
  try {
    const modules = import.meta.glob('../articles/**/*.{md,mdx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>

    return loadArticlesFromGlob(modules, 'articles')
  } catch (error) {
    console.error('Error reading articles (bundle):', error)
    return []
  }
})

export const useTranslationsList = routeLoader$(async () => {
  try {
    const modules = import.meta.glob('../translations/**/*.{md,mdx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>

    return loadArticlesFromGlob(modules, 'translations')
  } catch (error) {
    console.error('Error reading translations (bundle):', error)
    return []
  }
})

type GroupedArticles = { year: number; articles: Article[] }[]

const groupArticlesByYear = (articles: Article[]): GroupedArticles => {
  const groups: Record<number, Article[]> = {}

  for (const article of articles) {
    const year = article.dateObj?.getFullYear() || new Date().getFullYear()
    if (!groups[year]) {
      groups[year] = []
    }
    groups[year].push(article)
  }

  return Object.entries(groups)
    .map(([year, arts]) => ({
      year: Number.parseInt(year, 10),
      articles: arts,
    }))
    .sort((a, b) => b.year - a.year)
}

const ArticleList = component$<{ articles: Article[] }>(({ articles }) => {
  if (articles.length === 0) {
    return (
      <div class="empty-state">
        <p>No articles yet. Will be updated soon...</p>
      </div>
    )
  }

  const grouped = groupArticlesByYear(articles)

  return (
    <nav class="articles">
      {grouped.map((group) => (
        <div key={group.year}>
          <h2>
            <time dateTime={String(group.year)}>{group.year}년</time>
          </h2>
          <ul>
            {group.articles.map((article) => (
              <li key={article.slug}>
                {article.date && (
                  <time dateTime={article.dateObj?.toISOString().split('T')[0]}>
                    {article.date}
                  </time>
                )}
                <Link href={`/${article.slug}`} class="article-link">
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
})

export default component$(() => {
  const articles = useArticlesList()
  const translations = useTranslationsList()
  const location = useLocation()

  const activeTab = location.url.searchParams.get('tab') || 'articles'
  const currentArticles =
    activeTab === 'translations' ? translations.value : articles.value

  const tabs = [
    { id: 'articles', label: '생각', href: '/?tab=articles' },
    { id: 'translations', label: '한국어 번역본', href: '/?tab=translations' },
  ]

  return (
    <div class="page-wrapper">
      <header class="site-header">
        <h1>subux.dev</h1>
        <a
          href="https://github.com/Palbahngmiyine"
          target="_blank"
          rel="noopener noreferrer"
          class="github-link"
          title="GitHub"
        >
          <span class="sr-only">GitHub</span>
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            width="24"
            height="24"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </header>

      <Tabs tabs={tabs}>
        <ArticleList articles={currentArticles} />
      </Tabs>
    </div>
  )
})

export const head: DocumentHead = () => {
  return {
    title: 'Just my thoughts | subux.dev',
  }
}
