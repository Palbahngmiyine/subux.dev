import { component$ } from '@builder.io/qwik'
import { Link, routeLoader$ } from '@builder.io/qwik-city'
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
      <h1 class="text-4xl font-bold mb-8">Subux.dev</h1>
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
