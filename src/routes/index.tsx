import { component$ } from '@builder.io/qwik'
import { type DocumentHead, Link, routeLoader$ } from '@builder.io/qwik-city'
import matter from 'gray-matter'
import { formatFrontmatterDate } from '~/lib/date'

export const useArticlesList = routeLoader$(async () => {
  try {
    type Article = {
      slug: string
      title: string
      description: string
      filename: string
      date: string | null
    }

    const INDEX_CANDIDATES = [
      '@index.md',
      '@index.mdx',
      'index.md',
      'index.mdx',
    ]

    const modules = import.meta.glob('../articles/**/*.{md,mdx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>

    const computeSlugAndFilename = (
      key: string,
    ): { slug: string; filename: string } => {
      const normalized = key.replace(/\\/g, '/')
      const afterArticles = normalized.split('articles/').pop() || normalized
      const filename = afterArticles
      const withoutExt = afterArticles.replace(/\.(md|mdx)$/i, '')

      // Handle index candidates -> slug is directory path
      if (INDEX_CANDIDATES.some((name) => afterArticles.endsWith(`/${name}`))) {
        const dir = afterArticles.split('/').slice(0, -1).join('/')
        return { slug: dir, filename }
      }

      return { slug: withoutExt, filename }
    }

    const articles: Article[] = []
    for (const [key, raw] of Object.entries(modules)) {
      try {
        const { slug, filename } = computeSlugAndFilename(key)
        const parsed = matter(raw)
        const frontmatter = parsed.data as Record<string, unknown>
        articles.push({
          slug,
          title: (frontmatter.title as string) || slug,
          description: (frontmatter.description as string) || '',
          filename,
          date: formatFrontmatterDate(frontmatter.date),
        })
      } catch (error) {
        console.error('Error processing file:', key, error)
      }
    }

    return articles
  } catch (error) {
    console.error('Error reading articles (bundle):', error)
    return []
  }
})

export default component$(() => {
  const articles = useArticlesList()

  return (
    <div class="container mx-auto px-4 py-8">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-4xl font-bold">subux.dev</h1>
        <a
          href="https://github.com/Palbahngmiyine"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open GitHub repository"
          class="text-gray-500 hover:text-gray-900 transition-colors"
        >
          <span class="sr-only">Open GitHub repository</span>
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            class="h-8 w-8"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
      {articles.value.length === 0 ? (
        <div class="text-center p-8">
          <div class="mb-8">
            <div class="text-6xl mb-4">📝</div>
            <h2 class="text-2xl font-bold text-gray-800 mb-4">
              No articles yet
            </h2>
            <p class="text-gray-600">Will be updated soon...</p>
          </div>
        </div>
      ) : (
        <div class="max-w-2xl mx-auto space-y-6">
          {articles.value.map((article) => (
            <Link
              key={article.slug}
              href={`/${article.slug}`}
              class="no-underline"
            >
              <article class="bg-white cursor-pointer border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow mb-4">
                <h2 class="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                  {article.title}
                </h2>
                {article.date && (
                  <div class="text-gray-500 text-sm mt-1 mb-2">
                    {article.date}
                  </div>
                )}
                {article.description && (
                  <p class="text-gray-600 mb-4">{article.description}</p>
                )}
                <div class="inline-flex items-center text-blue-600 font-medium">
                  Read more →
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
})

export const head: DocumentHead = () => {
  return {
    title: 'Just my thoughts | subux.dev',
  }
}
