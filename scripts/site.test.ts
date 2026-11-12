import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildSite, subuxCacheDir } from './build.ts'
import { ensureSubux } from './subux.ts'

// End-to-end checks of the real build: the pinned Subux release plus this
// site's adjustments. They cover what the site promises about Markdown
// rendering and hostile input.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = path.join(root, 'src')
const temp = mkdtempSync(path.join(os.tmpdir(), 'subux-dev-test-'))

const fixtures: Record<string, string> = {
  wiki: '[[Pod Networking|별칭]] [[2026/Pod#dns]] [[already%20encoded]]',
  'wiki-hostile':
    '[[//evil.com]]\n\n[[\\evil.com]]\n\n[[\t//evil.com]]\n\n[[//evil.com/path]]\n\n[External](https://example.com)',
  callout:
    '> [!warning]+ **주의**\n> **본문**과 [링크](/post)입니다.\n>\n> 두 번째 문단',
  'callout-nested':
    '> [!unknown]- 제목 <img src=x onerror=alert(1)>\n> Body\n>\n> > [!tip] 내부\n> > [unsafe](javascript:alert%281%29)',
  gfm: '| Name | Count |\n| :--- | ---: |\n| Pod | 2 |\n\n- [x] Done\n\n~~Removed~~',
  code: '```sh\necho "hello"\n```\n\n```yml\nname: test\nitems:\n  - one\n```\n\n```json\n{"ready":true}\n```\n\n```text\nplain <text>\n```\n\n```mermaid\ngraph LR; A --> B\n```\n\n```html\n</code></pre><script>alert(1)</script>\n```',
  footnote: '> [!note] 각주\n> 문장[^1]\n\n[^1]: **설명**과 [링크](/post).',
  unsafe: [
    'javascript:alert%281%29',
    'JAVASCRIPT:alert%281%29',
    'data:text/html,unsafe',
    'vbscript:msgbox%281%29',
    'file:///etc/passwd',
  ]
    .map((url) => `[link](${url})\n\n![image](${url})`)
    .join('\n\n'),
  control: '[link](java&#x09;script:alert%281%29)',
  safe: [
    '/2026/PAPERBOOK-AND-MARKDOWN',
    '../post',
    '#user-content-fn-1',
    '//example.com/page',
    'https://example.com/page',
    'http://example.com/page',
    'mailto:reader@example.com',
    'tel:+821012345678',
  ]
    .map((url) => `[link](${url})`)
    .join('\n\n'),
  video: [
    '::video{src="https://cdn.example.com/demo.mp4" title="시연 영상"}',
    ...[
      'javascript:alert(1)',
      'java&#x09;script:alert(1)',
      'java\tscript:alert(1)',
      'java&#x0a;script:alert(1)',
      '  JAVASCRIPT:alert(1)',
      'data:text/html,unsafe',
      'mailto:x@y.z',
    ].map((url) => `::video{src="${url}"}`),
  ].join('\n\n'),
  image: '![그림](https://example.com/a.png)',
  raw: '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n문단',
}

/** A copy of the site's Subux workspace holding `articles` instead of its content. */
const workspace = (name: string, articles: Record<string, string>): string => {
  const dir = path.join(temp, name)
  for (const entry of ['subux.json', 'design', 'theme']) {
    cpSync(path.join(siteDir, entry), path.join(dir, entry), {
      recursive: true,
    })
  }
  mkdirSync(path.join(dir, 'articles'))
  for (const [slug, source] of Object.entries(articles)) {
    writeFileSync(path.join(dir, 'articles', `${slug}.md`), source)
  }
  return dir
}

const article = (body: string, title = 'Fixture'): string =>
  `---\ntitle: ${title}\ndate: 2026-01-02\n---\n\n${body}\n`

const fixtureOut = path.join(temp, 'fixture-out')
const siteOut = path.join(temp, 'site-out')
let subux = ''

/** Rendered Markdown body of a fixture page. */
const body = (slug: string): string => {
  const html = readFileSync(path.join(fixtureOut, slug, 'index.html'), 'utf8')
  const open = '<div class="article-content">'
  const start = html.indexOf(open)
  const end = html.indexOf('</div></article>')
  assert.ok(start >= 0 && end > start, `${slug}: article body not found`)
  return html.slice(start + open.length, end)
}

before(async () => {
  subux = await ensureSubux(subuxCacheDir)
  const pages = Object.fromEntries(
    Object.entries(fixtures).map(([slug, source]) => [slug, article(source)]),
  )
  await buildSite(workspace('fixture', pages), fixtureOut)
  await buildSite(siteDir, siteOut)
})

after(() => {
  rmSync(temp, { recursive: true, force: true })
})

test('wiki links retain aliases, nested paths and fragment targets', () => {
  const html = body('wiki')
  assert.match(html, /class="internal new" href="\/pod-networking">별칭<\/a>/)
  assert.match(html, /href="\/2026\/pod#dns"/)
  assert.match(html, /href="\/already%20encoded"/)
})

test('wiki links cannot become external hosts through slash or control prefixes', () => {
  const html = body('wiki-hostile')
  const hrefs = [...html.matchAll(/class="internal new" href="([^"]+)"/g)].map(
    (match) => match[1],
  )
  assert.equal(hrefs.length, 4)
  for (const href of hrefs) {
    assert.equal(
      new URL(href, 'https://subux.dev').origin,
      'https://subux.dev',
      href,
    )
  }
  assert.match(html, /<a href="https:\/\/example.com">External<\/a>/)
})

test('callouts retain titles, first-paragraph formatting, links and following paragraphs', () => {
  const html = body('callout')
  assert.match(
    html,
    /class="callout-warning" data-callout="warning" data-expandable="true" data-expanded="true"/,
  )
  assert.match(html, /class="callout-title-text"><strong>주의<\/strong>/)
  assert.match(html, /class="callout-content">/)
  assert.match(
    html,
    /<strong>본문<\/strong>과 <a href="\/post">링크<\/a>입니다\./,
  )
  assert.match(html, /<p>두 번째 문단<\/p>/)
})

test('callouts support defaults and nested content without admitting raw HTML', () => {
  const html = body('callout-nested')
  assert.match(
    html,
    /class="callout-note" data-callout="note" data-expandable="true" data-expanded="false"/,
  )
  assert.match(html, /class="callout-tip"/)
  assert.match(html, /<p>Body<\/p>/)
  assert.match(html, /<a>unsafe<\/a>/)
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('javascript:'))
})

test('raw HTML in Markdown is not admitted', () => {
  const html = body('raw')
  assert.ok(!html.includes('<script'))
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('onerror'))
  assert.match(html, /<p>문단<\/p>/)
})

test('GFM tables, task lists and strikethrough render as semantic HTML', () => {
  const html = body('gfm')
  assert.match(html, /<table>/)
  assert.match(html, /<th align="left">Name<\/th>/)
  assert.match(html, /<td align="right">2<\/td>/)
  assert.match(html, /<input type="checkbox" checked disabled>/)
  assert.match(html, /<del>Removed<\/del>/)
})

test('syntax highlighting preserves aliases and leaves text and Mermaid fences untouched', () => {
  const html = body('code')
  assert.match(html, /class="hljs language-sh"/)
  assert.match(html, /class="hljs-string">"hello"<\/span>/)
  assert.match(html, /class="hljs language-yml"/)
  assert.match(html, /class="hljs-attr">name:<\/span>/)
  assert.match(
    html,
    /<span class="hljs-bullet">-<\/span> <span class="hljs-string">one<\/span>/,
  )
  assert.match(html, /class="hljs language-json"/)
  assert.match(html, /<code class="language-text">plain &#x3C;text>/)
  assert.match(html, /<code class="language-mermaid">graph LR; A --> B/)
})

test('markup inside a code fence stays text', () => {
  const html = body('code')
  assert.ok(!html.includes('<script'))
  assert.equal(html.split('</code></pre>').length - 1, 6)
})

test('footnotes retain target links and plain-text hover content inside callouts', () => {
  const html = body('footnote')
  assert.match(html, /data-footnote-content="설명과 링크\."/)
  assert.match(html, /href="#user-content-fn-1"/)
  assert.match(html, /id="user-content-fn-1"/)
  assert.match(html, /href="#user-content-fnref-1"/)
  assert.match(html, /<strong>설명<\/strong>과 <a href="\/post">링크<\/a>/)
})

test('removes executable and data URLs including browser-normalized obfuscations', () => {
  const html = body('unsafe')
  assert.equal(html.split('<p><a>link</a></p>').length - 1, 5)
  assert.equal(html.split('<p><img alt="image"></p>').length - 1, 5)
  assert.ok(!/href=|src=/.test(html))
})

test('Markdown-encoded control characters remain inert relative paths', () => {
  assert.match(
    body('control'),
    /<p><a href="java%09script:alert%281%29">link<\/a><\/p>/,
  )
  assert.equal(
    new URL('java%09script:alert%281%29', 'https://example.com').protocol,
    'https:',
  )
})

test('preserves relative, fragment, network, HTTP and contact links', () => {
  const html = body('safe')
  for (const url of [
    '/2026/PAPERBOOK-AND-MARKDOWN',
    '../post',
    '#user-content-fn-1',
    '//example.com/page',
    'https://example.com/page',
    'http://example.com/page',
    'mailto:reader@example.com',
    'tel:+821012345678',
  ]) {
    assert.ok(html.includes(`<p><a href="${url}">link</a></p>`), url)
  }
})

test('preserves MP4 videos and rejects unsafe video sources', () => {
  const [safe = '', ...unsafe] = body('video').match(/<video[^>]*>/g) ?? []
  assert.match(safe, /src="https:\/\/cdn\.example\.com\/demo\.mp4"/)
  for (const attribute of [
    'controls',
    'muted',
    'playsinline',
    'preload="metadata"',
  ]) {
    assert.ok(safe.includes(attribute), attribute)
  }
  assert.match(safe, /class="article-video"/)
  assert.match(safe, /aria-label="시연 영상"/)
  assert.equal(unsafe.length, 7)
  for (const tag of unsafe) assert.ok(!tag.includes(' src='), tag)
})

test('images load with the page', () => {
  assert.match(
    body('image'),
    /<p><img src="https:\/\/example\.com\/a\.png" alt="그림"><\/p>/,
  )
})

test('rejects executable frontmatter, tags, aliases and malformed metadata', () => {
  const check = (name: string, source: string) => {
    const result = spawnSync(
      subux,
      ['check', '-i', workspace(name, { post: source })],
      { encoding: 'utf8' },
    )
    return { status: result.status, output: result.stdout + result.stderr }
  }

  const valid = check('frontmatter-valid', article('본문'))
  assert.equal(valid.status, 0, valid.output)

  const hostile: Record<string, string> = {
    'js-language': '---js\n({title: (process.title = "unsafe")})\n---\n',
    'js-tag': '---\ntitle: !!js/function function() {}\n---\n',
    alias: '---\nbase: &base [one, two]\ncopy: *base\n---\n',
    cycle: '---\ncycle: &cycle [*cycle]\n---\n',
    sequence: '---\n- item\n---\n',
    unclosed: '---\ntitle: Unclosed',
  }
  for (const [name, source] of Object.entries(hostile)) {
    const result = check(`frontmatter-${name}`, source)
    assert.notEqual(result.status, 0, `${name} was accepted`)
    assert.match(result.output, /^Error: /m, name)
  }
})

test('builds every published article with its title, date and URL', () => {
  const home = readFileSync(path.join(siteOut, 'index.html'), 'utf8')
  const sitemap = readFileSync(path.join(siteOut, 'sitemap.xml'), 'utf8')
  let count = 0
  for (const collection of ['articles', 'tech', 'translations']) {
    const dir = path.join(siteDir, collection)
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    for (const file of files.filter((name) => /\.mdx?$/.test(name))) {
      const source = readFileSync(path.join(dir, file), 'utf8')
      const title = /^title: (.*)$/m.exec(source)?.[1].replace(/^'|'$/g, '')
      const date = /^date: (\d{4})-(\d{2})-(\d{2})$/m.exec(source)
      assert.ok(title && date, file)

      const slug = file
        .split(path.sep)
        .join('/')
        .replace(/\.mdx?$/, '')
      const page = readFileSync(path.join(siteOut, slug, 'index.html'), 'utf8')
      const escaped = title.replace(/&/g, '&amp;')
      assert.ok(page.includes(`<title>${escaped}</title>`), file)
      assert.ok(
        page.includes(
          `${Number(date[1])}년 ${Number(date[2])}월 ${Number(date[3])}일</time>`,
        ),
        file,
      )
      assert.ok(
        page.includes(
          `<link rel="canonical" href="https://www.subux.dev/${slug}/">`,
        ),
        file,
      )
      assert.ok(home.includes(`href="/${slug}" class="article-link"`), file)
      assert.ok(
        sitemap.includes(`<loc>https://www.subux.dev/${slug}/</loc>`),
        file,
      )
      count++
    }
  }
  assert.ok(count >= 11, `only ${count} articles were checked`)
})

test('every page carries the site head and no theme leftovers', () => {
  const pages = readdirSync(siteOut, {
    recursive: true,
    encoding: 'utf8',
  }).filter((file) => file.endsWith('.html'))
  assert.ok(pages.includes('404.html'))
  for (const page of pages) {
    const html = readFileSync(path.join(siteOut, page), 'utf8')
    assert.ok(html.includes('<html lang="ko">'), page)
    assert.ok(
      html.includes('<meta name="theme-color" content="#7fcfff">'),
      page,
    )
    assert.ok(
      html.includes('<link rel="manifest" href="/manifest.json">'),
      page,
    )
    assert.ok(html.includes('href="/assets/custom.css"'), page)
    assert.ok(html.includes('src="/assets/custom.js"'), page)
    assert.ok(!html.includes('name="theme-color" media='), page)
    assert.ok(!html.includes('loading="lazy"'), page)
    assert.ok(!html.includes('favicon.svg'), page)
  }
})

test('ships the static files the pages refer to', () => {
  for (const file of [
    'manifest.json',
    'service-worker.js',
    'robots.txt',
    'favicons/favicon-32x32.png',
    'favicons/ms-icon-144x144.png',
    'vendor/mermaid.mjs',
  ]) {
    assert.ok(existsSync(path.join(siteOut, file)), file)
  }
  const entry = readFileSync(path.join(siteOut, 'vendor/mermaid.mjs'), 'utf8')
  const target = /from '\.\/(mermaid\/[^']+)'/.exec(entry)?.[1]
  assert.ok(target && existsSync(path.join(siteOut, 'vendor', target)), entry)

  const headers = readFileSync(path.join(siteOut, '_headers'), 'utf8')
  assert.match(
    headers,
    /^\/\*service-worker\.js\n {2}Cache-Control: no-store$/m,
  )
  assert.match(
    headers,
    /^\/vendor\/mermaid\/\*\n {2}Cache-Control: .*immutable$/m,
  )
})
