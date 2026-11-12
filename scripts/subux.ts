import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

// The Subux release that builds this site. Checksums are the SHA256SUMS of
// https://github.com/Palbahngmiyine/subux/releases/tag/v0.2.0.
export const SUBUX_VERSION = '0.2.0'

const ARCHIVE_SHA256: Record<string, string> = {
  'darwin-arm64':
    'c506a48112d2b059048085fe7c1267b53249ca0a16954c15debf0456e88889a5',
  'darwin-x86_64':
    '506ae606f55e0eea1383c5b4555f03844c391bd326aceeb25bc65a5fda235676',
  'linux-arm64':
    '5ae044f966af1047e05bb2510e235954d6c864b793ce72139b23ee3d87d69f85',
  'linux-x86_64':
    'd3ce6872522ae807ca1fc045de03b82d45761ad924a5cfd86b3f60496c1f3124',
}

export const releasePlatform = (
  platform: string = process.platform,
  arch: string = process.arch,
): string => {
  const cpu = arch === 'x64' ? 'x86_64' : arch
  const name = `${platform}-${cpu}`
  if (!(name in ARCHIVE_SHA256)) {
    throw new Error(
      `Subux ${SUBUX_VERSION} has no release for ${name}. Set SUBUX_BIN to a local subux executable.`,
    )
  }
  return name
}

export const sha256 = (data: Uint8Array): string =>
  createHash('sha256').update(data).digest('hex')

/**
 * Path of the Subux executable: SUBUX_BIN when set, otherwise the pinned
 * release, downloaded once into `cacheDir` and verified against its checksum.
 */
export const ensureSubux = async (cacheDir: string): Promise<string> => {
  const override = process.env.SUBUX_BIN
  if (override) return path.resolve(override)

  const platform = releasePlatform()
  const name = `subux-${SUBUX_VERSION}-${platform}`
  const binary = path.join(cacheDir, name, 'subux')
  if (existsSync(binary)) return binary

  const url = `https://github.com/Palbahngmiyine/subux/releases/download/v${SUBUX_VERSION}/${name}.tar.gz`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Downloading ${url} failed: HTTP ${response.status}`)
  }
  const archive = new Uint8Array(await response.arrayBuffer())
  const digest = sha256(archive)
  if (digest !== ARCHIVE_SHA256[platform]) {
    throw new Error(
      `Checksum mismatch for ${name}.tar.gz: expected ${ARCHIVE_SHA256[platform]}, got ${digest}`,
    )
  }

  // Extract in a staging directory and move the release into place in one
  // step, so an interrupted or concurrent build never leaves a partial binary
  // that later builds would trust.
  mkdirSync(cacheDir, { recursive: true })
  const staging = mkdtempSync(path.join(cacheDir, 'download-'))
  try {
    const archivePath = path.join(staging, `${name}.tar.gz`)
    writeFileSync(archivePath, archive)
    execFileSync('tar', ['-xzf', archivePath, '-C', staging], {
      stdio: 'inherit',
    })
    if (!existsSync(path.join(staging, name, 'subux'))) {
      throw new Error(`${name}.tar.gz did not contain ${name}/subux`)
    }
    try {
      renameSync(path.join(staging, name), path.join(cacheDir, name))
    } catch (error) {
      // Another build installed the same release first.
      if (!existsSync(binary)) throw error
    }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
  return binary
}

/** Version reported by a Subux release directory, for build logs. */
export const releaseVersion = (binary: string): string | null => {
  const file = path.join(path.dirname(binary), 'version.txt')
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null
}
