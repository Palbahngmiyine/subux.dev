# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog/portfolio website (subux.dev) built as a static site with Subux (https://github.com/Palbahngmiyine/subux), an OCaml static site generator, and deployed to Cloudflare Pages. Subux renders Markdown articles with frontmatter metadata, wiki-style links and Obsidian callouts. There is no application framework and no server code.

## Commands

### Development

- `pnpm dev` - Build the site, then serve `dist/` with Wrangler. Run it again after an edit; there is no watch mode
- `pnpm serve` - Serve the last build with Wrangler

### Building

- `pnpm build` - Type-check, lint, then build the site into `dist/`
- `pnpm build.site` - Build the site only (`node scripts/build.ts`)
- `pnpm build.types` - Type-check the build scripts without emitting files

### Code Quality

- `pnpm lint` - Run Oxlint linter (via Vite+)
- `pnpm lint.fix` - Auto-fix linting issues
- `pnpm fmt` - Format code with Oxfmt (via Vite+)
- `pnpm fmt.check` - Check formatting without modifying
- `pnpm check` - Run both lint and format checks
- `pnpm test` - Run the build-script unit tests and the Markdown preservation and security tests against a real build, with the Node test runner

### Deployment

- `pnpm deploy` - Deploy `dist/` to Cloudflare Pages by hand. Cloudflare Pages also builds and deploys every pushed branch

## Architecture

### Subux workspace

`src/` is a Subux blog workspace, built with `subux build -i src -o dist`:

- `src/subux.json` - Site title, base URL, GitHub link, favicon and manifest links, and the paths of the custom CSS and JS
- `src/articles/`, `src/tech/`, `src/translations/` - Markdown articles, one folder per home page tab. The tab names and the translation disclaimer are Subux blog-mode defaults
- `src/public/` - Files copied to the site root as they are (`_headers`, favicons, `manifest.json`, `service-worker.js`)
- `src/design/tokens.json` - Design tokens compiled into `--sx-*` CSS variables. Every color has one value, so the site ignores dark mode
- `src/theme/custom.css` - Only what differs from the Subux default theme. It is loaded after the theme
- `src/theme/custom.js` - Tab link addresses, Mermaid rendering and service-worker cleanup

### Build scripts

The scripts are TypeScript that Node runs directly (type stripping), so they use erasable syntax only.

- `scripts/subux.ts` - Downloads the pinned Subux release for the platform and verifies its SHA-256. `SUBUX_BIN` overrides it with a local executable
- `scripts/build.ts` - Runs Subux, applies the adjustments to every HTML page and the sitemap, and copies Mermaid's browser build to `dist/vendor/`
- `scripts/postprocess.ts` - Pure functions that adjust Subux output: highlight.js tokens in code blocks (lowlight, the same grammars and aliases as before), eager images, head metadata, and trailing-slash URLs. Each one throws when the Subux markup it expects is missing

### Routing

Cloudflare Pages serves the static files:

- **Home page** (`/`): all three article lists; `?tab=tech` or `?tab=translations` selects a tab in the browser. `/articles/`, `/tech/` and `/translations/` are the same page with that tab selected, for visitors without JavaScript
- **Article pages**: `src/<collection>/<path>.md` becomes `dist/<path>/index.html`, served at `/<path>/`. `/<path>` redirects there
- **404**: `dist/404.html`

### Deployment Target

Cloudflare Pages, connected to the GitHub repository: a push builds the site and publishes `dist`. `wrangler.toml` names the output directory; the build command is a Cloudflare project setting and has to run the `build` script. The build needs network access to download the Subux release from GitHub.

## Code Style

Using Vite+ (Oxlint + Oxfmt, not Prettier/ESLint/Biome):

- 2-space indentation
- Single quotes for JS/TS
- Semicolons only when necessary (ASI)
- Line width: 80 characters
- `no-var` and `prefer-const` enforced
- `eqeqeq` enforced (use `===`)

## Important Patterns

1. **The site must look the same after a change to the theme or the Subux version**: compare rendered pages before and after, at phone and desktop widths
2. **Theme changes go in `src/theme/custom.css` or `src/design/tokens.json`**, never in generated files. Use the `--sx-*` variables and their `--color-*`, `--space-*` aliases instead of literal values
3. **Article slug**: the file path below its collection folder without the extension. Two collections must not hold the same path
4. **Subux upgrades**: change the version and the four checksums in `scripts/subux.ts` together, then run `pnpm test`. A failing adjustment in `scripts/postprocess.ts` names the Subux markup that changed
5. **Caching**: HTML is revalidated on every request (Cloudflare Pages default). `src/public/_headers` marks `/vendor/mermaid/*` immutable, and Subux marks its fingerprinted theme stylesheet immutable
