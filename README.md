# Subux

Personal writing at https://www.subux.dev, built with Qwik 2 and deployed to Cloudflare Pages.

## Development

Use Node.js 24.21.0 (see `.node-version`) and pnpm 12.10.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm check
pnpm build
pnpm serve
```

`pnpm build` checks types and lint, then builds the client and Cloudflare Worker.
`pnpm serve` runs that Worker locally. `pnpm preview` uses the Node preview adapter.

## Runtime and dependencies

- Qwik core and router are pinned together at **2.0.0-rc.2**. This is a release candidate; upgrade them together after checking the [migration guide](https://next.qwik.dev/docs/upgrade/).
- Vite+ 1.1.0 bundles Vite 8.3.3. The narrow Vite peer exceptions account for the alias package's different version number. Tests use Node's test runner; Qwik's optional Vitest integration is not used (its declared peer range excludes Vite+'s Vitest 5).
- The Cloudflare adapter selects Worker exports for SSR. Browser-only Markdown exports require `document` and cannot run in a Worker.
- Frontmatter is YAML only. JavaScript engines, custom executable tags and aliases are rejected. Generated Markdown URLs are restricted to safe protocols.
- Callouts are rendered from Markdown nodes locally; raw HTML is not enabled. Mermaid remains lazy-loaded and uses its classic appearance and Dagre layout.
- Security overrides in `pnpm-workspace.yaml` cover upstream ranges that still select vulnerable versions. Recheck them with `pnpm audit` when updating dependencies.
- The Qwik 1 prefetch worker is retired. Keep the cleanup component and worker endpoint while existing visitors may still have it installed.

Articles remain in `src/articles`, `src/tech` and `src/translations`; their existing URLs and CSS are preserved.
