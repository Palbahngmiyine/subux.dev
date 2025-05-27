import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import remarkWikiLink from "remark-wiki-link";
import remarkObsidianCallout from "remark-obsidian-callout";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";

export default defineConfig(() => {
  return {
    plugins: [
      tailwindcss(),
      qwikCity({
        mdx: {
          remarkPlugins: [
            remarkGfm,
            remarkDirective,
            [
              remarkWikiLink,
              {
                pageResolver: (name: string) => [name.replace(/ /g, "-").toLowerCase()],
                hrefTemplate: (permalink: string) => `/articles/${permalink}`,
                aliasDivider: "|",
              },
            ],
            remarkObsidianCallout,
          ],
          rehypePlugins: [],
        },
      }),
      qwikVite(),
      tsconfigPaths(),
    ],
    ssr: {
      external: ["fs", "path", "gray-matter", "unified", "remark-parse", "remark-gfm", "remark-directive", "remark-wiki-link", "remark-obsidian-callout", "remark-rehype", "rehype-stringify"],
      noExternal: []
    },
    server: {
      headers: {
        "Cache-Control": "public, max-age=0",
      },
    },
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
    define: {
      global: "globalThis",
    },
  };
});
