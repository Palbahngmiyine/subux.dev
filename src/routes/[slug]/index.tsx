import { component$ } from '@builder.io/qwik'
import { routeLoader$ } from '@builder.io/qwik-city'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkWikiLink from 'remark-wiki-link'
import remarkObsidianCallout from 'remark-obsidian-callout'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import matter from 'gray-matter'

interface ArticleData {
  content: string
  frontmatter: Record<string, unknown>
  title: string
}

export const useArticleData = routeLoader$<ArticleData>(
  async ({ params, status }) => {
    const slug = params.slug

    try {
      const contentDir = resolve(process.cwd(), 'src/articles')
      let fileContent: string | null = null

      // 1) 루트 수준 파일 우선 검색: <slug>.md / <slug>.mdx
      const rootMdPath = join(contentDir, `${slug}.md`)
      const rootMdxPath = join(contentDir, `${slug}.mdx`)
      if (existsSync(rootMdPath)) {
        fileContent = readFileSync(rootMdPath, 'utf-8')
      } else if (existsSync(rootMdxPath)) {
        fileContent = readFileSync(rootMdxPath, 'utf-8')
      }

      // 2) 없으면 폴더 인덱스(@index.md[x] / index.md[x]) 검색
      if (fileContent === null) {
        const slugParts = slug.split('-').filter(Boolean)
        const dirPath = join(contentDir, ...slugParts)
        const indexCandidates = [
          '@index.md',
          '@index.mdx',
          'index.md',
          'index.mdx',
        ]
        for (const candidate of indexCandidates) {
          const p = join(dirPath, candidate)
          if (existsSync(p)) {
            fileContent = readFileSync(p, 'utf-8')
            break
          }
        }
      }

      if (fileContent === null) {
        status(404)
        throw new Error(`Article not found: ${slug}`)
      }

      const parsed = matter(fileContent)

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
          : slug

      return {
        content: result.toString(),
        frontmatter: fm,
        title,
      }
    } catch {
      status(404)
      throw new Error(`Article not found: ${slug}`)
    }
  },
)

export default component$(() => {
  const articleData = useArticleData()

  return (
    <section class="w-full mx-auto px-4 py-8">
      <div>
        <a href="/"><b>&lt;</b> Go to Home</a>
      </div>
      <article class="w-full mx-auto px-4 py-8">
        <h1 class="text-4xl font-bold mb-6">{articleData.value.title}</h1>
        <div
          class="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={articleData.value.content}
        />
      </article>
    </section>
  )
})
