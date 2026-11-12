import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decodeEntities,
  highlightCodeBlocks,
  loadImagesEagerly,
  restoreHead,
  useTrailingSlashSitemap,
  useTrailingSlashUrl,
} from './postprocess.ts'

const FONT =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'

// Head markup as Subux 0.2.0 writes it.
const subuxHead = (canonical: string) =>
  '<head><meta charset="utf-8"><title>T</title>' +
  '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fafafa">' +
  '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#171717">' +
  `<meta property="og:url" content="${canonical}">` +
  `<link rel="canonical" href="${canonical}">` +
  '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin="anonymous">' +
  `<link rel="preload" as="style" crossorigin="anonymous" href="${FONT}">` +
  `<link rel="stylesheet" crossorigin="anonymous" media="print" onload="try{for(const r of this.sheet.cssRules)if(r.type===5)r.style.fontDisplay='optional'}catch{}this.media='all'" href="${FONT}">` +
  `<noscript><link rel="stylesheet" crossorigin="anonymous" href="${FONT}"></noscript>` +
  `<script type="application/ld+json">{"@type":"BlogPosting","url":"${canonical}"}</script>` +
  '</head>'

test('decodes the entities Subux writes, once', () => {
  assert.equal(
    decodeEntities('a &#x3C;b> &amp;&amp; &quot;c&quot;'),
    'a <b> && "c"',
  )
  assert.equal(decodeEntities('&amp;lt; &#38; &apos;'), "&lt; & '")
})

test('code is tokenized again with highlight.js grammars', () => {
  // Subux marks `name:` together with its indentation and leaves `-` plain.
  const html = highlightCodeBlocks(
    '<pre><code class="hljs language-yaml"><span class="hljs-attr">  name:</span> <span class="hljs-string">backend</span>\n  - Ingress\n</code></pre>',
  )
  assert.equal(
    html,
    '<pre><code class="hljs language-yaml">  <span class="hljs-attr">name:</span> <span class="hljs-string">backend</span>\n  <span class="hljs-bullet">-</span> <span class="hljs-string">Ingress</span>\n</code></pre>',
  )
})

test('aliases highlight and keep the class the author wrote', () => {
  const sh = highlightCodeBlocks(
    '<pre><code class="hljs language-sh">echo "hello"\n</code></pre>',
  )
  assert.match(sh, /<code class="hljs language-sh">/)
  assert.match(sh, /<span class="hljs-string">"hello"<\/span>/)

  const yml = highlightCodeBlocks(
    '<pre><code class="hljs language-yml">name: test\n</code></pre>',
  )
  assert.match(yml, /<code class="hljs language-yml">/)
  assert.match(yml, /<span class="hljs-attr">name:<\/span>/)
})

test('plain-text, Mermaid and unlabeled fences carry no tokens', () => {
  assert.equal(
    highlightCodeBlocks(
      '<pre><code class="language-text">plain &#x3C;text> &amp; more\n</code></pre>',
    ),
    '<pre><code class="language-text">plain &#x3C;text> &#x26; more\n</code></pre>',
  )
  assert.equal(
    highlightCodeBlocks(
      '<pre><code class="language-mermaid">graph LR; A --> B\n</code></pre>',
    ),
    '<pre><code class="language-mermaid">graph LR; A --> B\n</code></pre>',
  )
  assert.equal(
    highlightCodeBlocks('<pre><code>no language &#x3C;b>\n</code></pre>'),
    '<pre><code>no language &#x3C;b>\n</code></pre>',
  )
})

test('an unregistered language keeps its text and the hljs block class', () => {
  assert.equal(
    highlightCodeBlocks(
      '<pre><code class="hljs language-nosuchlang">foo &#x3C;bar>\n</code></pre>',
    ),
    '<pre><code class="hljs language-nosuchlang">foo &#x3C;bar>\n</code></pre>',
  )
})

test('markup written as code stays text', () => {
  const html = highlightCodeBlocks(
    '<pre><code class="hljs language-html">&#x3C;/code>&#x3C;/pre>&#x3C;script>alert(<span class="hljs-number">3</span>)&#x3C;/script>\n</code></pre><p>after</p>',
  )
  assert.ok(!html.includes('<script'))
  assert.ok(!/<\/code><\/pre>[\s\S]*<\/code><\/pre>/.test(html))
  assert.ok(html.endsWith('</code></pre><p>after</p>'))
  assert.match(html, /^<pre><code class="hljs language-html">/)
})

test('unknown markup inside a code block stops the build', () => {
  assert.throws(
    () =>
      highlightCodeBlocks(
        '<pre><code class="language-text"><b>bold</b></code></pre>',
      ),
    /Unexpected markup inside a code block/,
  )
})

test('text outside code blocks is left alone', () => {
  const html = '<p>before <code>inline &amp; code</code></p>'
  assert.equal(highlightCodeBlocks(html), html)
})

test('article images load with the page', () => {
  assert.equal(
    loadImagesEagerly(
      '<p><img loading="lazy" decoding="async" src="/a.png" alt="A"></p>',
    ),
    '<p><img src="/a.png" alt="A"></p>',
  )
  assert.throws(
    () => loadImagesEagerly('<img src="/a.png" loading="lazy">'),
    /lazy image markup/,
  )
})

test('the head keeps the brand color and loads the web font as a stylesheet', () => {
  const head = restoreHead(subuxHead('https://www.subux.dev/'))
  assert.ok(
    head.includes(
      '<meta name="msapplication-TileColor" content="#7fcfff">' +
        '<meta name="msapplication-TileImage" content="/favicons/ms-icon-144x144.png">' +
        '<meta name="theme-color" content="#7fcfff">',
    ),
  )
  assert.ok(!head.includes('prefers-color-scheme'))
  assert.ok(head.includes(`<link rel="stylesheet" href="${FONT}">`))
  assert.ok(!head.includes('fontDisplay'))
  assert.ok(!head.includes('rel="preload"'))
  assert.ok(!head.includes('<noscript>'))
})

test('a head without the expected Subux markup stops the build', () => {
  assert.throws(
    () => restoreHead('<head><title>T</title></head>'),
    /exactly one theme-color pair/,
  )
  assert.throws(
    () =>
      restoreHead(subuxHead('/').replace('media="print"', 'media="screen"')),
    /exactly one web font link group/,
  )
  assert.throws(
    () => restoreHead(subuxHead('/') + subuxHead('/')),
    /exactly one/,
  )
})

test('an article page names its own URL with the trailing slash', () => {
  const html = useTrailingSlashUrl(
    subuxHead('https://www.subux.dev/2026/POST'),
    '2026/POST/index.html',
  )
  assert.ok(
    html.includes(
      '<link rel="canonical" href="https://www.subux.dev/2026/POST/">',
    ),
  )
  assert.ok(
    html.includes(
      '<meta property="og:url" content="https://www.subux.dev/2026/POST/">',
    ),
  )
  assert.ok(html.includes('"url":"https://www.subux.dev/2026/POST/"'))
})

test('URLs with Korean, spaces and ampersands get the slash too', () => {
  const korean = useTrailingSlashUrl(
    subuxHead('https://www.subux.dev/2026/한글 글'),
    '2026/한글 글/index.html',
  )
  assert.ok(korean.includes('href="https://www.subux.dev/2026/한글 글/">'))
  assert.ok(korean.includes('"url":"https://www.subux.dev/2026/한글 글/"'))

  // Subux escapes `&` in attributes but not in JSON-LD.
  const head = subuxHead('https://www.subux.dev/a&amp;b').replace(
    '"url":"https://www.subux.dev/a&amp;b"',
    '"url":"https://www.subux.dev/a&b"',
  )
  const ampersand = useTrailingSlashUrl(head, 'a&b/index.html')
  assert.ok(ampersand.includes('href="https://www.subux.dev/a&amp;b/">'))
  assert.ok(ampersand.includes('content="https://www.subux.dev/a&amp;b/">'))
  assert.ok(ampersand.includes('"url":"https://www.subux.dev/a&b/"'))
})

test('home, tab and error pages keep their URLs', () => {
  const home = subuxHead('https://www.subux.dev/')
  for (const page of ['index.html', 'tech/index.html']) {
    assert.equal(useTrailingSlashUrl(home, page), home, page)
  }
  const notFound = subuxHead('https://www.subux.dev/404.html')
  assert.equal(useTrailingSlashUrl(notFound, '404.html'), notFound)
})

test('a page without its canonical link or matching metadata stops the build', () => {
  assert.throws(
    () => useTrailingSlashUrl('<head></head>', '2026/POST/index.html'),
    /exactly one canonical link/,
  )
  assert.throws(
    () =>
      useTrailingSlashUrl(
        subuxHead('https://www.subux.dev/2026/POST').replace(
          'property="og:url" content="https://www.subux.dev/2026/POST"',
          'property="og:url" content="https://www.subux.dev/other"',
        ),
        '2026/POST/index.html',
      ),
    /exactly one og:url/,
  )
})

test('sitemap locations below the root end with a slash', () => {
  assert.equal(
    useTrailingSlashSitemap(
      '<url><loc>https://www.subux.dev/</loc></url>\n' +
        '<url><loc>https://www.subux.dev/2026/POST</loc></url>\n' +
        '<url><loc>https://www.subux.dev/two-pizza-team/</loc></url>',
      'https://www.subux.dev',
    ),
    '<url><loc>https://www.subux.dev/</loc></url>\n' +
      '<url><loc>https://www.subux.dev/2026/POST/</loc></url>\n' +
      '<url><loc>https://www.subux.dev/two-pizza-team/</loc></url>',
  )
})
