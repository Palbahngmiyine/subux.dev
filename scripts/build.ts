import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  highlightCodeBlocks,
  loadImagesEagerly,
  restoreHead,
  useTrailingSlashSitemap,
  useTrailingSlashUrl,
} from './postprocess.ts'
import { ensureSubux, releaseVersion } from './subux.ts'

// Build the site: Subux renders the workspace, then the HTML gets the
// site-specific adjustments and Mermaid is copied in for self-hosting.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Where a downloaded Subux release is kept between builds. */
export const subuxCacheDir = path.join(root, 'node_modules', '.cache', 'subux')

const MERMAID_ENTRY = '/vendor/mermaid.mjs'

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html'))
    .map((file) => file.split(path.sep).join('/'))
    .sort()

/** Copy Mermaid's browser build to `<outputDir>/vendor`. */
const vendorMermaid = (outputDir: string): void => {
  const require = createRequire(import.meta.url)
  const packageDir = path.dirname(require.resolve('mermaid/package.json'))
  const { version } = JSON.parse(
    readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
  ) as { version: string }

  // The versioned directory is immutable (see src/public/_headers); the entry
  // module next to it is revalidated and points at the current version.
  const vendorDir = path.join(outputDir, 'vendor')
  const versionDir = path.join(vendorDir, 'mermaid', version)
  const notSourceMap = (source: string): boolean => !source.endsWith('.map')
  mkdirSync(versionDir, { recursive: true })
  cpSync(
    path.join(packageDir, 'dist', 'mermaid.esm.min.mjs'),
    path.join(versionDir, 'mermaid.esm.min.mjs'),
  )
  cpSync(
    path.join(packageDir, 'dist', 'chunks', 'mermaid.esm.min'),
    path.join(versionDir, 'chunks', 'mermaid.esm.min'),
    { recursive: true, filter: notSourceMap },
  )
  writeFileSync(
    path.join(vendorDir, path.basename(MERMAID_ENTRY)),
    `export { default } from './mermaid/${version}/mermaid.esm.min.mjs'\n`,
  )
}

/**
 * Render the Subux workspace `inputDir` into `outputDir`, replacing it.
 * Returns the output paths of the HTML pages.
 */
export const buildSite = async (
  inputDir: string,
  outputDir: string,
): Promise<string[]> => {
  const subux = await ensureSubux(subuxCacheDir)
  const { baseUrl } = JSON.parse(
    readFileSync(path.join(inputDir, 'subux.json'), 'utf8'),
  ) as { baseUrl: string }

  rmSync(outputDir, { recursive: true, force: true })
  execFileSync(subux, ['build', '-i', inputDir, '-o', outputDir], {
    stdio: ['ignore', 'inherit', 'pipe'],
    encoding: 'utf8',
  })

  const pages = htmlFiles(outputDir)
  for (const page of pages) {
    const file = path.join(outputDir, page)
    const html = readFileSync(file, 'utf8')
    writeFileSync(
      file,
      useTrailingSlashUrl(
        restoreHead(loadImagesEagerly(highlightCodeBlocks(html))),
        baseUrl,
        page,
      ),
    )
  }

  const sitemap = path.join(outputDir, 'sitemap.xml')
  writeFileSync(
    sitemap,
    useTrailingSlashSitemap(readFileSync(sitemap, 'utf8'), baseUrl),
  )

  vendorMermaid(outputDir)
  const profile = readFileSync(
    path.join(outputDir, 'assets', 'custom.js'),
    'utf8',
  )
  if (!profile.includes(`'${MERMAID_ENTRY}'`)) {
    throw new Error(`The site's custom.js must import ${MERMAID_ENTRY}`)
  }

  const version = releaseVersion(subux) ?? 'from SUBUX_BIN'
  console.log(`Adjusted ${pages.length} pages built by Subux ${version}`)
  return pages
}

if (import.meta.main) {
  await buildSite(path.join(root, 'src'), path.join(root, 'dist'))
}
