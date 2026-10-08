import assert from 'node:assert/strict'
import { test } from 'node:test'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import rehypeFootnoteTooltip from './rehype-footnote-tooltip.ts'
import { rehypeSafeUrls } from './rehype-safe-urls.ts'
import { remarkVideoDirective } from './remark-video-directive.ts'

const render = async (markdown: string) =>
  String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkVideoDirective)
      .use(remarkRehype)
      .use(rehypeFootnoteTooltip)
      .use(rehypeSafeUrls)
      .use(rehypeStringify)
      .process(markdown),
  )

test('removes executable and data URLs including browser-normalized obfuscations', async () => {
  for (const url of [
    'javascript:alert%281%29',
    'JAVASCRIPT:alert%281%29',
    'data:text/html,unsafe',
    'vbscript:msgbox%281%29',
    'file:///etc/passwd',
  ]) {
    const html = await render(`[link](${url})\n\n![image](${url})`)
    assert.equal(html, '<p><a>link</a></p>\n<p><img alt="image"></p>', url)
  }
})

test('Markdown-encoded control characters remain inert relative paths', async () => {
  const html = await render('[link](java&#x09;script:alert%281%29)')
  assert.equal(html, '<p><a href="java%09script:alert%281%29">link</a></p>')
  assert.equal(
    new URL('java%09script:alert%281%29', 'https://example.com').protocol,
    'https:',
  )
})

test('preserves relative, fragment, network, HTTP and contact links', async () => {
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
    const html = await render(`[link](${url})`)
    assert.equal(html, `<p><a href="${url}">link</a></p>`, url)
  }
})

test('preserves existing MP4 videos and rejects unsafe video sources', async () => {
  const safe = await render(
    '::video{src="https://cdn.example.com/demo.mp4" title="시연 영상"}',
  )
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
  for (const url of [
    'javascript:alert(1)',
    'java&#x09;script:alert(1)',
    'java\tscript:alert(1)',
    'java&#x0a;script:alert(1)',
    '  JAVASCRIPT:alert(1)',
    'data:text/html,unsafe',
    'mailto:x@y.z',
  ]) {
    const unsafe = await render(`::video{src="${url}"}`)
    assert.ok(!unsafe.includes(' src='), url)
  }
})

test('preserves footnote targets, tooltips and Markdown formatting', async () => {
  const html = await render('**Text**[^1]\n\n[^1]: Note with [link](/post).')
  assert.match(html, /<strong>Text<\/strong>/)
  assert.match(html, /data-footnote-content="Note with link\./)
  assert.match(html, /href="#user-content-fn-1"/)
  assert.match(html, /id="user-content-fn-1"/)
  assert.match(html, /href="\/post"/)
})
