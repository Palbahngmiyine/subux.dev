import { component$ } from '@builder.io/qwik'
import { routeLoader$, Link } from '@builder.io/qwik-city'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { formatFrontmatterDate } from '~/lib/date'

export const useArticlesList = routeLoader$(async () => {
    try {
        const contentDir = join(process.cwd(), 'src/articles')

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

        const readArticleFromFile = (
            absolutePath: string,
            slug: string,
            filename: string,
        ): Article | null => {
            try {
                const fileContent = readFileSync(absolutePath, 'utf-8')
                const parsed = matter(fileContent)
                const frontmatter = parsed.data as Record<string, unknown>
                return {
                    slug,
                    title: (frontmatter.title as string) || slug,
                    description: (frontmatter.description as string) || '',
                    filename,
                    date: formatFrontmatterDate(frontmatter.date),
                }
            } catch (error) {
                console.error('Error processing file:', filename, error)
                return null
            }
        }

        const MAX_DEPTH = 2 // e.g. src/articles/2025/test/index.md

        const collectArticlesFromDir = (
            dirAbsolutePath: string,
            slugParts: string[],
            depth: number,
        ): Article[] => {
            const entries = readdirSync(dirAbsolutePath, { withFileTypes: true })
            const articles: Article[] = []

            // Include loose files (*.md, *.mdx) at any depth (excluding index candidates)
            for (const entry of entries) {
                if (
                    entry.isFile() &&
                    (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))
                ) {
                    if (INDEX_CANDIDATES.includes(entry.name)) continue
                    const filePath = join(dirAbsolutePath, entry.name)
                    const baseSlug = entry.name.replace(/\.(md|mdx)$/i, '')
                    const slug = [...slugParts, baseSlug].join('/')
                    const filename = [...slugParts, entry.name].join('/')
                    const article = readArticleFromFile(filePath, slug, filename)
                    if (article) articles.push(article)
                }
            }

            // Subdirectories: look for index candidates and recurse
            for (const entry of entries) {
                if (!entry.isDirectory()) continue

                const subDirName = entry.name
                const nextSlugParts = [...slugParts, subDirName]
                const subDirPath = join(dirAbsolutePath, subDirName)

                const subEntries = readdirSync(subDirPath, { withFileTypes: true })
                const subFiles = new Set(
                    subEntries.filter((e) => e.isFile()).map((e) => e.name),
                )
                const indexFile = INDEX_CANDIDATES.find((name) => subFiles.has(name))

                if (indexFile) {
                    const slug = nextSlugParts.join('/')
                    const absoluteIndexPath = join(subDirPath, indexFile)
                    const filename = [...nextSlugParts, indexFile].join('/')
                    const article = readArticleFromFile(absoluteIndexPath, slug, filename)
                    if (article) articles.push(article)
                }

                if (depth + 1 <= MAX_DEPTH) {
                    articles.push(
                        ...collectArticlesFromDir(subDirPath, nextSlugParts, depth + 1),
                    )
                }
            }

            return articles
        }

        return collectArticlesFromDir(contentDir, [], 0)
    } catch (error) {
        console.error('Error reading articles:', error)
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
                <div class="space-y-6">
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
                                    <div class="text-gray-500 text-sm mt-1 mb-2">{article.date}</div>
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
