import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parseMarkdown } from './markdown.ts'

test('preserves YAML metadata, timestamp dates and Markdown body', () => {
  const parsed = parseMarkdown(
    '---\ntitle: 글 제목\ndate: 2026-10-09\nseriesOrder: 2\n---\n\n# Body\n',
  )
  assert.equal(parsed.data.title, '글 제목')
  assert.equal(parsed.data.seriesOrder, 2)
  assert.ok(parsed.data.date instanceof Date)
  assert.equal(parsed.data.date.toISOString(), '2026-10-09T00:00:00.000Z')
  assert.equal(parsed.content, '\n# Body\n')
})

test('preserves BOM, CRLF, empty metadata and ordinary Markdown handling', () => {
  assert.deepEqual(parseMarkdown('\ufeff---\r\ntitle: Hello\r\n---\r\nBody'), {
    data: { title: 'Hello' },
    content: 'Body',
  })
  assert.deepEqual(parseMarkdown('---\n---\nBody'), {
    data: {},
    content: 'Body',
  })
  assert.deepEqual(parseMarkdown('\ufeff# Body'), {
    data: {},
    content: '# Body',
  })
  assert.equal(
    parseMarkdown('---yaml\ntitle: Hello\n---\n').data.title,
    'Hello',
  )
})

test('retains the existing repair for ambiguous colons without changing quoted values', () => {
  const { data } = parseMarkdown(
    '---\ntitle: Kubernetes: Pod networking # note\ndescription: "Already: quoted"\nurl: https://example.com\n---\n',
  )
  assert.deepEqual(data, {
    title: 'Kubernetes: Pod networking',
    description: 'Already: quoted',
    url: 'https://example.com',
  })
})

test('rejects executable frontmatter languages and JavaScript tags', () => {
  const previousTitle = process.title
  assert.throws(
    () => parseMarkdown('---js\n({title: (process.title = "unsafe")})\n---\n'),
    /Only YAML/,
  )
  assert.equal(process.title, previousTitle)
  assert.throws(() =>
    parseMarkdown('---\ntitle: !!js/function function() {}\n---\n'),
  )
})

test('rejects aliases, cyclic metadata, invalid YAML and non-mapping metadata', () => {
  for (const body of [
    'base: &base [one, two]\ncopy: *base',
    'cycle: &cycle [*cycle]',
    'title: [unclosed',
    '- item',
    'plain scalar',
  ]) {
    assert.throws(() => parseMarkdown(`---\n${body}\n---\n`), body)
  }
  assert.throws(() => parseMarkdown('---\ntitle: Unclosed'), /Unclosed/)
})

test('parses every published article without changing its body', async () => {
  for (const collection of ['articles', 'tech', 'translations']) {
    const root = new URL(`../${collection}/`, import.meta.url)
    const files = await readdir(root, { recursive: true })
    for (const file of files.filter((name) => /\.mdx?$/.test(name))) {
      const source = await readFile(new URL(file, root), 'utf8')
      const { data, content } = parseMarkdown(source)
      assert.equal(typeof data.title, 'string', file)
      assert.ok(data.date instanceof Date, file)
      assert.ok(source.endsWith(content), file)
      assert.ok(content.length > 0, file)
    }
  }
})
