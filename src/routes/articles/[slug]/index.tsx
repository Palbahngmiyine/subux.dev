import { component$ } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkWikiLink from "remark-wiki-link";
import remarkObsidianCallout from "remark-obsidian-callout";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import matter from "gray-matter";

export const useArticleData = routeLoader$(async ({ params, status }) => {
    const slug = params.slug;

    try {
        // 마크다운 파일 경로 (MD 파일 우선, MDX 파일도 지원)
        const contentDir = resolve(process.cwd(), 'src/routes/articles/content');
        let filePath: string;
        let fileContent: string;

        // .md 파일을 먼저 찾고, 없으면 .mdx 파일을 찾음
        const mdPath = join(contentDir, `${slug}.md`);

        if (existsSync(mdPath)) {
            fileContent = readFileSync(mdPath, 'utf-8');
            filePath = mdPath;
        } else {
            status(404);
            throw new Error(`Article not found: ${slug}`);
        }

        // 프론트매터와 컨텐츠 파싱
        const parsed = matter(fileContent);

        const processor = unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkDirective)
            .use(remarkWikiLink, {
                pageResolver: (name: string) => [name.replace(/ /g, "-").toLowerCase()],
                hrefTemplate: (permalink: string) => `/articles/${permalink}`,
                aliasDivider: "|",
            })
            .use(remarkObsidianCallout)
            .use(remarkRehype)
            .use(rehypeStringify);

        const result = await processor.process(parsed.content);

        return {
            content: result.toString(),
            frontmatter: parsed.data,
            title: parsed.data?.title || slug
        };
    } catch (error) {
        // 파일이 없으면 404
        status(404);
        throw new Error(`Article not found: ${slug}`);
    }
});

export default component$(() => {
    const articleData = useArticleData();
    const loc = useLocation();

    return (
        <div class="max-w-4xl mx-auto px-4 py-8">
            <h1 class="text-4xl font-bold mb-6">{articleData.value.title}</h1>
            <div
                class="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={articleData.value.content}
            />
        </div>
    );
}); 