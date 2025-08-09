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
            const contentDir = resolve(process.cwd(), 'src/articles')
            let fileContent: string | null = null

            // 1) 직접 파일: src/articles/<...parts>.md(x)
            if (parts.length >= 1) {
                const asPath = join(contentDir, ...parts)
                const mdPath = `${asPath}.md`
                const mdxPath = `${asPath}.mdx`
                if (existsSync(mdPath)) {
                    fileContent = readFileSync(mdPath, 'utf-8')
                } else if (existsSync(mdxPath)) {
                    fileContent = readFileSync(mdxPath, 'utf-8')
                }
            }

            // 2) 디렉토리 인덱스: src/articles/<...parts>/{@index,index}.md(x)
            if (fileContent === null && parts.length >= 1) {
                const dirPath = join(contentDir, ...parts)
                const indexCandidates = ['@index.md', '@index.mdx', 'index.md', 'index.mdx']
                for (const candidate of indexCandidates) {
                    const idx = join(dirPath, candidate)
                    if (existsSync(idx)) {
                        fileContent = readFileSync(idx, 'utf-8')
                        break
                    }
                }
            }

            if (fileContent === null) {
                status(404)
                throw new Error(`Article not found: ${raw}`)
            }

            const parsed = matter(fileContent)

            const processor = unified()
                .use(remarkParse)
                .use(remarkGfm)
                .use(remarkDirective)
                .use(remarkWikiLink, {
                    pageResolver: (name: string) => [name.replace(/ /g, '-').toLowerCase()],
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
                    : parts[parts.length - 1] ?? 'Article'

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

    return (
        <section class="w-full mx-auto px-4 py-8">
            <div>
                <a href="/" class="default-link"><b>←</b> Back to Home</a>
            </div>
            <article class="w-full mx-auto px-4 py-8 bg-white rounded-lg mt-4">
                <h1 class="text-4xl font-bold mb-6">{articleData.value.title}</h1>
                <div
                    class="prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={articleData.value.content}
                />
            </article>
        </section>
    )
})


