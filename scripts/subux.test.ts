import assert from 'node:assert/strict'
import { test } from 'node:test'
import { releasePlatform, sha256 } from './subux.ts'

test('maps Node platform names to Subux release names', () => {
  assert.equal(releasePlatform('darwin', 'arm64'), 'darwin-arm64')
  assert.equal(releasePlatform('darwin', 'x64'), 'darwin-x86_64')
  assert.equal(releasePlatform('linux', 'x64'), 'linux-x86_64')
  assert.equal(releasePlatform('linux', 'arm64'), 'linux-arm64')
})

test('names the SUBUX_BIN escape hatch when no release exists', () => {
  assert.throws(() => releasePlatform('win32', 'x64'), /SUBUX_BIN/)
  assert.throws(() => releasePlatform('linux', 'riscv64'), /SUBUX_BIN/)
})

test('computes SHA-256 digests in the SHA256SUMS format', () => {
  assert.equal(
    sha256(new TextEncoder().encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})
