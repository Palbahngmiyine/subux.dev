# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog/portfolio website (subux.dev) built as a static site with Subux (https://github.com/Palbahngmiyine/subux), an OCaml static site generator, and deployed to Cloudflare Pages. Subux renders Markdown articles with frontmatter metadata, wiki-style links and Obsidian callouts. There is no application framework, no server code and no build script: the repository holds the articles, the site settings and the theme overrides.

## Commands

- `pnpm build` - Build the site into `dist/` (`subux build -i src -o dist`)
- `pnpm check` - Validate the articles and settings without writing files (`subux check -i src`)
- `pnpm dev` - Build the site, then serve `dist/` with Wrangler. Run it again after an edit; there is no watch mode
- `pnpm serve` - Serve the last build with Wrangler
- `pnpm deploy` - Deploy `dist/` to Cloudflare Pages by hand. Cloudflare Pages also builds and deploys every pushed branch

## Architecture

### Subux workspace

`src/` is a Subux blog workspace:

- `src/subux.json` - Site title, base URL, GitHub link, favicon and manifest links, the paths of the custom CSS and JS, and the page options below
- `src/articles/`, `src/tech/`, `src/translations/` - Markdown articles, one folder per home page tab. The tab names and the translation disclaimer are Subux blog-mode defaults
- `src/public/` - Files copied to the site root as they are (`_headers`, favicons, `manifest.json`, `service-worker.js`)
- `src/design/tokens.json` - Design tokens compiled into `--sx-*` CSS variables. Every color has one value, so the site ignores dark mode
- `src/theme/custom.css` - Only what differs from the Subux default theme. It is loaded after the theme
- `src/theme/custom.js` - Tab link addresses, Mermaid rendering and service-worker cleanup. Mermaid loads from jsDelivr at a pinned version, only on a page that has a diagram

### Page options

Four settings in `src/subux.json` keep the pages as they were before the site moved to Subux:

- `"themeColor": "#7fcfff"` - the browser UI color
- `"fontDisplay": "swap"` - the Pretendard stylesheet loads with the page, so a first visit shows the web font
- `"lazyImages": false` - article images load with the page. They carry no width and height, so a late image would shift the text below it
- `"trailingSlash": true` - canonical links and the sitemap name each page as Cloudflare Pages serves it, `/<path>/`

### Subux

Subux is a development dependency. `package.json` names the npm-format package of a Subux release by its URL, and `pnpm-lock.yaml` records its integrity hash, so `pnpm install` needs network access to GitHub. The package holds the native executables; the `subux` command runs the one for the current platform.

### Routing

Cloudflare Pages serves the static files:

- **Home page** (`/`): all three article lists; `?tab=tech` or `?tab=translations` selects a tab in the browser. `/articles/`, `/tech/` and `/translations/` are the same page with that tab selected, for visitors without JavaScript
- **Article pages**: `src/<collection>/<path>.md` becomes `dist/<path>/index.html`, served at `/<path>/`. `/<path>` redirects there
- **404**: `dist/404.html`

### Deployment Target

Cloudflare Pages, connected to the GitHub repository: a push builds the site and publishes `dist`. `wrangler.toml` names the output directory; the build command is a Cloudflare project setting and has to run the `build` script.

## Code Style

No linter or formatter runs in this repository. `src/theme/custom.js` keeps the style it was written in:

- 2-space indentation
- Single quotes
- Semicolons only when necessary (ASI)
- Line width: 80 characters
- `const` and `let`, never `var`
- `===`, never `==`

## Important Patterns

1. **The site must look the same after a change to the theme or the Subux version**: compare rendered pages before and after, at phone and desktop widths
2. **Theme changes go in `src/theme/custom.css` or `src/design/tokens.json`**, never in generated files. Use the `--sx-*` variables and their `--color-*`, `--space-*` aliases instead of literal values
3. **Article slug**: the file path below its collection folder without the extension. Two collections must not hold the same path
4. **Subux upgrades**: change the release URL of `subux` in `package.json`, run `pnpm install`, then `pnpm build`, and compare the pages
5. **Code blocks**: Subux colors code with its own tokenizer. Shell, YAML and JSON get the tokens highlight.js gave them before; other languages are colored more simply. `custom.css` gives every element the sans font, so a token inside a code block is drawn in it while the text between tokens stays monospace
6. **Caching**: HTML is revalidated on every request (Cloudflare Pages default). Subux marks its fingerprinted theme stylesheet immutable
