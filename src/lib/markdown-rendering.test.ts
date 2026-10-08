import assert from 'node:assert/strict'
import { test } from 'node:test'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkWikiLink from 'remark-wiki-link'
import { unified } from 'unified'
import rehypeFootnoteTooltip from './rehype-footnote-tooltip.ts'
import { rehypeSafeUrls } from './rehype-safe-urls.ts'
import { rehypeSyntaxHighlightOptions } from './rehype-syntax-highlight.ts'
import { remarkCallout } from './remark-callout.ts'
import { remarkVideoDirective } from './remark-video-directive.ts'
import { wikiLinkOptions } from './wiki-link.ts'

const render = async (markdown: string) =>
  String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkVideoDirective)
      .use(remarkWikiLink, wikiLinkOptions)
      .use(remarkCallout)
      .use(remarkRehype)
      .use(rehypeHighlight, rehypeSyntaxHighlightOptions)
      .use(rehypeFootnoteTooltip)
      .use(rehypeSafeUrls)
      .use(rehypeStringify)
      .process(markdown),
  )

test('wiki links retain aliases, nested paths and fragment targets', async () => {
  const html = await render(
    '[[Pod Networking|별칭]] [[2026/Pod#dns]] [[already%20encoded]]',
  )
  assert.match(html, /class="internal new" href="\/pod-networking">별칭<\/a>/)
  assert.match(html, /href="\/2026\/pod#dns"/)
  assert.match(html, /href="\/already%20encoded"/)
})

test('wiki links cannot become external hosts through slash or control prefixes', async () => {
  for (const target of [
    '//evil.com',
    '\\evil.com',
    '\t//evil.com',
    '//evil.com/path',
  ]) {
    const html = await render(`[[${target}]]`)
    const href = /href="([^"]+)"/.exec(html)?.[1]
    assert.ok(href, target)
    assert.equal(
      new URL(href, 'https://subux.dev').origin,
      'https://subux.dev',
      target,
    )
  }
  assert.match(
    await render('[External](https://example.com)'),
    /href="https:\/\/example.com"/,
  )
})

test('callouts retain titles, first-paragraph formatting, links and following paragraphs', async () => {
  const html = await render(
    '> [!warning]+ **주의**\n> **본문**과 [링크](/post)입니다.\n>\n> 두 번째 문단',
  )
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

test('callouts support defaults and nested content without admitting raw HTML', async () => {
  const html = await render(
    '> [!unknown]- 제목 <img src=x onerror=alert(1)>\n> Body\n>\n> > [!tip] 내부\n> > [unsafe](javascript:alert%281%29)',
  )
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

test('GFM tables, task lists and strikethrough render as semantic HTML', async () => {
  const html = await render(
    '| Name | Count |\n| :--- | ---: |\n| Pod | 2 |\n\n- [x] Done\n\n~~Removed~~',
  )
  assert.match(html, /<table>/)
  assert.match(html, /<th align="left">Name<\/th>/)
  assert.match(html, /<td align="right">2<\/td>/)
  assert.match(html, /<input type="checkbox" checked disabled>/)
  assert.match(html, /<del>Removed<\/del>/)
})

test('syntax highlighting preserves aliases and leaves text and Mermaid fences untouched', async () => {
  const html = await render(
    '```sh\necho "hello"\n```\n\n```yml\nname: test\n```\n\n```json\n{"ready":true}\n```\n\n```text\nplain <text>\n```\n\n```mermaid\ngraph LR; A --> B\n```',
  )
  assert.match(html, /class="hljs language-sh"/)
  assert.match(html, /class="hljs-string">"hello"<\/span>/)
  assert.match(html, /class="hljs language-yml"/)
  assert.match(html, /class="hljs-attr">name:<\/span>/)
  assert.match(html, /class="hljs language-json"/)
  assert.match(html, /<code class="language-text">plain &#x3C;text>/)
  assert.match(html, /<code class="language-mermaid">graph LR; A --> B/)
})

test('footnotes retain target links and plain-text hover content inside callouts', async () => {
  const html = await render(
    '> [!note] 각주\n> 문장[^1]\n\n[^1]: **설명**과 [링크](/post).',
  )
  assert.match(html, /data-footnote-content="설명과 링크\."/)
  assert.match(html, /href="#user-content-fn-1"/)
  assert.match(html, /id="user-content-fn-1"/)
  assert.match(html, /href="#user-content-fnref-1"/)
})
