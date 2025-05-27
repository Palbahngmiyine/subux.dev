import { cloudflarePagesAdapter } from "@builder.io/qwik-city/adapters/cloudflare-pages/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rollupOptions: {
        input: ["src/entry.cloudflare-pages.tsx", "@qwik-city-plan"],
        external: ["fs", "path", "gray-matter", "unified", "remark-parse", "remark-gfm", "remark-directive", "remark-wiki-link", "remark-obsidian-callout", "remark-rehype", "rehype-stringify"]
      },
    },
    ssr: {
      external: ["fs", "path", "gray-matter", "unified", "remark-parse", "remark-gfm", "remark-directive", "remark-wiki-link", "remark-obsidian-callout", "remark-rehype", "rehype-stringify"],
      noExternal: []
    },
    plugins: [cloudflarePagesAdapter()],
  };
});
