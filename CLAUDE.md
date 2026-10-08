# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog/portfolio website (subux.dev) built with Qwik 2 and deployed to Cloudflare Pages. The site renders markdown articles with frontmatter metadata and supports wiki-style links and Obsidian callouts.

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

- `pnpm lint` - Run Oxlint linter (via Vite+)
- `pnpm lint.fix` - Auto-fix linting issues
- `pnpm fmt` - Format code with Oxfmt (via Vite+)
- `pnpm fmt.check` - Check formatting without modifying
- `pnpm check` - Run both lint and format checks
- `pnpm test` - Run Markdown preservation and security tests with the Node test runner

### Deployment

- `pnpm serve` - Test production build locally with Wrangler (uses the nodejs_compat flag in wrangler.toml)
- `pnpm deploy` - Deploy to Cloudflare Pages

## Architecture

### Content System

Articles are stored in `src/articles/` as Markdown/MDX files organized by year (e.g., `src/articles/2025/`). The content system uses:

- **Frontmatter parsing**: `yaml` extracts metadata (title, description, date); the local parser rejects executable languages and aliases
- **Markdown processing pipeline**: unified + remark + rehype with plugins:
  - `remark-gfm` - GitHub Flavored Markdown
  - `remark-wiki-link` - Wiki-style `[[links]]` (converts to internal URL-friendly slugs)
  - `remark-obsidian-callout` - Obsidian-style callout blocks
  - `remark-directive` - Generic directive syntax support
- Local `remarkCallout` - Obsidian callout blocks without raw HTML
- Local `rehypeSafeUrls` - Safe protocols for rendered links and media

### Routing

- **Home page** (`src/routes/index.tsx`): Lists all articles by scanning `src/articles/**/*.{md,mdx}` at build time using `import.meta.glob`
- **Article pages** (`src/routes/[...slug]/index.tsx`): Catch-all route that:
  - Accepts slugs like `2025/my-article` or `2025/folder/nested`
  - Looks for files in this priority: `{slug}.md`, `{slug}.mdx`, `{slug}/@index.md`, `{slug}/@index.mdx`, `{slug}/index.md`, `{slug}/index.mdx`
  - Returns 404 for missing articles or `.well-known` paths (silently ignored)
  - Processes markdown on the server side in the route loader

### SSR Configuration

The app uses Qwik 2 with Vite+ (Vite 8) and SSR. The Cloudflare adapter bundles the Markdown dependencies and selects Worker conditions with `ssr.resolve.conditions` so browser-only DOM exports do not enter the server bundle. The adapter manages the Node async-hooks external needed by Qwik.

Qwik core/router are pinned together to 2.0.0-rc.2. Tests use `node --test`, not Qwik's optional Vitest integration.

### Deployment Target

Cloudflare Pages with Node.js compatibility (`nodejs_compat` flag in `wrangler.toml`). The build adapter is in `adapters/cloudflare-pages/vite.config.ts`.

## Code Style

Using Vite+ (Oxlint + Oxfmt, not Prettier/ESLint/Biome):

- 2-space indentation
- Single quotes for JS/TS
- Semicolons only when necessary (ASI)
- Line width: 80 characters
- `no-var` and `prefer-const` enforced
- `eqeqeq` enforced (use `===`)
- `react/no-danger` disabled (needed for article rendering)

## Path Aliases

`~/*` maps to `./src/*` (configured in `tsconfig.json`)

## Important Patterns

1. **Article slug computation**: Remove extensions, handle index files specially (slug becomes parent directory)
2. **Date formatting**: Each route handles date formatting inline
3. **Caching strategy** (in `src/routes/layout.tsx`):
   - `staleWhileRevalidate`: 7 days
   - `maxAge`: 5 seconds
4. **Global styles**: TailwindCSS v4 via `@tailwindcss/vite` plugin, custom styles in `src/global.css`
