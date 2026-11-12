# Subux

Personal writing at https://www.subux.dev, built as a static site with [Subux](https://github.com/Palbahngmiyine/subux) and deployed to Cloudflare Pages.

## Development

Use Node.js 24.21.0 (see `.node-version`) and pnpm 12.10.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm check
pnpm build
```

`pnpm build` checks types and lint, then builds the site into `dist/`.
`pnpm dev` builds the site and serves it with Wrangler; run it again after an edit. `pnpm serve` serves the last build.

## Writing

Articles are Markdown files in `src/articles`, `src/tech` and `src/translations`, one folder per tab on the home page. A file's path below its folder is its URL: `src/tech/2026/POST.md` is served at `/2026/POST/`. Frontmatter takes `title`, `date`, `description`, and `series` with `seriesOrder`.

## How the site is built

`src/` is a Subux blog workspace:

- `subux.json`: site title, base URL, favicon and manifest links.
- `design/tokens.json`: the site's colors, fonts and spacing. The site has one light theme.
- `theme/custom.css` and `theme/custom.js`: what this site renders differently from the Subux default theme.
- `public/`: files copied to the site root as they are.

`scripts/build.ts` runs the build:

1. It downloads Subux 0.2.0 for the current platform, verifies its checksum and keeps it in `node_modules/.cache/subux`. Set `SUBUX_BIN` to use a local `subux` executable instead.
2. `subux build -i src -o dist` renders the pages.
3. `scripts/postprocess.ts` adjusts the HTML: code blocks are tokenized with highlight.js grammars, images load with the page, the head keeps the `#7fcfff` theme color and loads the Pretendard stylesheet directly, and article URLs end with a slash, as Cloudflare Pages serves them.
4. Mermaid is copied to `dist/vendor/` so diagrams render without a third-party script host.

Each adjustment stops the build when the Subux markup it expects is missing. After changing the Subux version in `scripts/subux.ts`, run `pnpm test` and compare the pages.

## Runtime and dependencies

- The pages need no JavaScript to read. Scripts switch the home page tabs in place, prefetch links, and render Mermaid diagrams, which load only on pages that have one.
- Frontmatter is YAML only. Subux rejects tags, anchors and aliases, and keeps only `http:`, `https:` and relative URLs in links and media, plus `mailto:` and `tel:` in links. Raw HTML in Markdown is not rendered. `scripts/site.test.ts` checks this against the real build.
- A callout marked `[!type]+` or `[!type]-` is collapsible, and a callout without a title shows its type as the title.
- Vite+ 1.1.0 provides the linter and formatter only. The Vite peer exceptions and security overrides in `pnpm-workspace.yaml` account for its dependency ranges; recheck them with `pnpm audit` when updating dependencies.
- `public/service-worker.js` and the cleanup in `theme/custom.js` retire the service worker of earlier Qwik builds. Keep both while returning visitors may still have it installed.
