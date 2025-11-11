# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog/portfolio website (subux.dev) built with Qwik and deployed to Cloudflare Pages. The site renders markdown articles with frontmatter metadata and supports wiki-style links and Obsidian callouts.

## Commands

### Development
- `pnpm dev` - Start development server in SSR mode
- `pnpm start` - Alternative dev server with auto-open
- `pnpm dev.debug` - Start dev server with Node.js inspector for debugging

### Building
- `pnpm build` - Full production build (client + server)
- `pnpm build.client` - Build client-side only
- `pnpm build.server` - Build server adapter for Cloudflare Pages
- `pnpm build.types` - Type-check without emitting files

### Code Quality
- `pnpm lint` - Run Biome linter
- `pnpm lint.fix` - Auto-fix linting issues
- `pnpm fmt` - Format code with Biome
- `pnpm fmt.check` - Check formatting without modifying
- `pnpm check` - Run both lint and format checks

### Deployment
- `pnpm serve` - Test production build locally with Wrangler (requires nodejs_als compatibility flag)
- `pnpm deploy` - Deploy to Cloudflare Pages

## Architecture

### Content System

Articles are stored in `src/articles/` as Markdown/MDX files organized by year (e.g., `src/articles/2025/`). The content system uses:

- **Frontmatter parsing**: `gray-matter` extracts metadata (title, description, date)
- **Markdown processing pipeline**: unified + remark + rehype with plugins:
  - `remark-gfm` - GitHub Flavored Markdown
  - `remark-wiki-link` - Wiki-style `[[links]]` (converts to URL-friendly slugs)
  - `remark-obsidian-callout` - Obsidian-style callout blocks
  - `remark-directive` - Generic directive syntax support

### Routing

- **Home page** (`src/routes/index.tsx`): Lists all articles by scanning `src/articles/**/*.{md,mdx}` at build time using `import.meta.glob`
- **Article pages** (`src/routes/[...slug]/index.tsx`): Catch-all route that:
  - Accepts slugs like `2025/my-article` or `2025/folder/nested`
  - Looks for files in this priority: `{slug}.md`, `{slug}.mdx`, `{slug}/@index.md`, `{slug}/@index.mdx`, `{slug}/index.md`, `{slug}/index.mdx`
  - Returns 404 for missing articles or `.well-known` paths (silently ignored)
  - Processes markdown on the server side in the route loader

### SSR Configuration

The app uses Vite + Qwik with SSR. Key external dependencies for SSR are marked in `vite.config.ts` and `adapters/cloudflare-pages/vite.config.ts`:
- Node builtins: `node:fs`, `node:path`
- Markdown libs: `gray-matter`, `unified`, remark/rehype plugins

These must stay external because they're processed server-side by Cloudflare Workers with Node.js compatibility.

### Deployment Target

Cloudflare Pages with Node.js compatibility (`nodejs_compat` flag in `wrangler.toml`). The build adapter is in `adapters/cloudflare-pages/vite.config.ts`.

## Code Style

Using Biome (not Prettier/ESLint):
- 2-space indentation
- Single quotes for JS/TS, double quotes for JSX
- Semicolons only when necessary (ASI)
- Line width: 80 characters
- `noVar` and `useConst` enforced
- `noDoubleEquals` enforced (use `===`)
- `noDangerouslySetInnerHtml` disabled (needed for article rendering)

## Path Aliases

`~/*` maps to `./src/*` (configured in `tsconfig.json`)

## Important Patterns

1. **Article slug computation**: Remove extensions, handle index files specially (slug becomes parent directory)
2. **Date formatting**: Use `formatFrontmatterDate()` from `~/lib/date.ts` for consistent date display
3. **Caching strategy** (in `src/routes/layout.tsx`):
   - `staleWhileRevalidate`: 7 days
   - `maxAge`: 5 seconds
4. **Global styles**: TailwindCSS v4 via `@tailwindcss/vite` plugin, custom styles in `src/global.css`
