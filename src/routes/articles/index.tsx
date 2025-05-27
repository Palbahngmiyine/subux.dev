import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

export const useArticlesList = routeLoader$(async () => {
    try {
        const contentDir = join(process.cwd(), 'src/routes/articles/content');
        const allFiles = readdirSync(contentDir);

        const files = allFiles.filter(file =>
            file.endsWith('.md') || file.endsWith('.mdx')
        );

        const articles = files.map(file => {
            const filePath = join(contentDir, file);

            try {
                const fileContent = readFileSync(filePath, 'utf-8');

                // 프론트매터 파싱
                const parsed = matter(fileContent);
                const slug = file.replace(/\.(md|mdx)$/, '');

                const frontmatter = parsed.data;
                console.log('Frontmatter:', frontmatter);

                const article = {
                    slug,
                    title: frontmatter.title || slug,
                    description: frontmatter.description || '',
                    filename: file
                };

                return article;
            } catch (error) {
                console.error('Error processing file:', file, error);
                return null;
            }
        }).filter((article): article is NonNullable<typeof article> => article !== null);

        return articles;
    } catch (error) {
        console.error('Error reading articles:', error);
        return [];
    }
});

export default component$(() => {
    const articles = useArticlesList();

    return (
        <div class="max-w-4xl mx-auto px-4 py-8">
            <h1 class="text-4xl font-bold mb-8">Articles</h1>

            {articles.value.length === 0 ? (
                <div class="text-center p-8">
                    <div class="mb-8">
                        <div class="text-6xl mb-4">📝</div>
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">
                            No articles yet
                        </h2>
                        <p class="text-gray-600">
                            Add some markdown files to the content folder to get started!
                        </p>
                    </div>
                </div>
            ) : (
                <div class="space-y-6">
                    {articles.value.map((article) => (
                        <Link key={article.slug} href={`/articles/${article.slug}`} class="no-underline">
                            <article class="bg-white cursor-pointer border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow mb-4">
                                <h2 class="text-2xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                                    {article.title}
                                </h2>
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
    );
}); 