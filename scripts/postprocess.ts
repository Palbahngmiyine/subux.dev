import type { Element, ElementContent } from 'hast'
import { toHtml } from 'hast-util-to-html'
import { common, createLowlight } from 'lowlight'

// Site-specific adjustments to the HTML that Subux generates. Each function is
// pure and fails loudly when the Subux markup it depends on is missing, so a
// Subux upgrade that changes that markup stops the build instead of silently
// changing the site.

const FONT_STYLESHEET =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'

const replaceOnce = (
  html: string,
  search: string,
  replacement: string,
  label: string,
): string => {
  const first = html.indexOf(search)
  if (first < 0 || html.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Expected exactly one ${label} in the Subux output`)
  }
  return html.slice(0, first) + replacement + html.slice(first + search.length)
}

// --- Syntax highlighting -----------------------------------------------------

// The same highlighter, grammars, aliases and plain-text names the site used
// with rehype-highlight, so code keeps its token colors.
const lowlight = createLowlight(common)
lowlight.registerAlias({ bash: ['sh', 'shell', 'zsh'], yaml: ['yml'] })
const PLAIN_TEXT = new Set(['text', 'txt', 'plain', 'mermaid', 'mmd'])

const ENTITY = /&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

export const decodeEntities = (text: string): string =>
  text.replace(ENTITY, (_, name: string) => {
    if (name in NAMED_ENTITIES) return NAMED_ENTITIES[name]
    const code = name.startsWith('#x')
      ? Number.parseInt(name.slice(2), 16)
      : Number.parseInt(name.slice(1), 10)
    return String.fromCodePoint(code)
  })

/** Language named by a code element's classes; false when highlighting is off. */
const languageOf = (classes: string[]): string | false | undefined => {
  let name: string | undefined
  for (const value of classes) {
    if (value === 'no-highlight' || value === 'nohighlight') return false
    if (!name && value.startsWith('lang-')) name = value.slice(5)
    if (!name && value.startsWith('language-')) name = value.slice(9)
  }
  return name
}

const CODE_BLOCK = /<pre><code(?: class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g
const SUBUX_TOKEN_TAG = /<span class="hljs-[a-z_]+">|<\/span>/g

/**
 * Re-tokenize fenced code blocks with highlight.js grammars. Subux marks
 * tokens with its own lighter tokenizer; its spans are dropped and the code
 * text is highlighted again.
 */
export const highlightCodeBlocks = (html: string): string =>
  html.replace(
    CODE_BLOCK,
    (_, classAttr: string | undefined, inner: string) => {
      const escaped = inner.replace(SUBUX_TOKEN_TAG, '')
      if (escaped.includes('<')) {
        throw new Error(
          `Unexpected markup inside a code block: ${escaped.slice(0, 80)}`,
        )
      }
      const text = decodeEntities(escaped)
      const classes = decodeEntities(classAttr ?? '')
        .split(/\s+/)
        .filter((name) => name && name !== 'hljs')
      const lang = languageOf(classes)

      let children: ElementContent[] = [{ type: 'text', value: text }]
      if (lang && !PLAIN_TEXT.has(lang)) {
        classes.unshift('hljs')
        if (lowlight.registered(lang)) {
          // lowlight types its result as a root, but emits only spans and text.
          const tokens = lowlight.highlight(lang, text)
            .children as ElementContent[]
          if (tokens.length > 0) children = tokens
        }
      }

      const code: Element = {
        type: 'element',
        tagName: 'code',
        properties: classes.length > 0 ? { className: classes } : {},
        children,
      }
      return toHtml({
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [code],
      })
    },
  )

// --- Images ------------------------------------------------------------------

const SUBUX_LAZY_IMAGE = '<img loading="lazy" decoding="async"'

/**
 * Load article images with the page. Subux defers them until they are scrolled
 * near, and without width and height attributes each late image shifts the
 * text below it.
 */
export const loadImagesEagerly = (html: string): string => {
  const result = html.replaceAll(SUBUX_LAZY_IMAGE, '<img')
  if (/<img\b[^>]*\sloading=/.test(result)) {
    throw new Error('Unexpected lazy image markup in the Subux output')
  }
  return result
}

// --- Document head -----------------------------------------------------------

const SUBUX_THEME_COLOR =
  '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fafafa">' +
  '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#171717">'

const SITE_THEME_COLOR =
  '<meta name="msapplication-TileColor" content="#7fcfff">' +
  '<meta name="msapplication-TileImage" content="/favicons/ms-icon-144x144.png">' +
  '<meta name="theme-color" content="#7fcfff">'

const SUBUX_FONT_LINKS =
  `<link rel="preload" as="style" crossorigin="anonymous" href="${FONT_STYLESHEET}">` +
  `<link rel="stylesheet" crossorigin="anonymous" media="print" onload="try{for(const r of this.sheet.cssRules)if(r.type===5)r.style.fontDisplay='optional'}catch{}this.media='all'" href="${FONT_STYLESHEET}">` +
  `<noscript><link rel="stylesheet" crossorigin="anonymous" href="${FONT_STYLESHEET}"></noscript>`

const SITE_FONT_LINK = `<link rel="stylesheet" href="${FONT_STYLESHEET}">`

/**
 * Keep the site's brand color for browser UI, and load the web font as a
 * regular stylesheet: the theme loads it with `font-display: optional`, which
 * leaves a first visit in the fallback font.
 */
export const restoreHead = (html: string): string =>
  replaceOnce(
    replaceOnce(html, SUBUX_THEME_COLOR, SITE_THEME_COLOR, 'theme-color pair'),
    SUBUX_FONT_LINKS,
    SITE_FONT_LINK,
    'web font link group',
  )

// --- URLs --------------------------------------------------------------------

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Cloudflare Pages serves `dir/index.html` at `/dir/` and redirects `/dir`
 * there, so an article's own URL ends with a slash. Subux writes it without
 * one; fix the canonical link, Open Graph URL and JSON-LD of that page.
 * `pagePath` is the output path of the page, such as `2026/post/index.html`.
 */
export const useTrailingSlashUrl = (
  html: string,
  baseUrl: string,
  pagePath: string,
): string => {
  if (!pagePath.endsWith('/index.html')) return html
  const url = `${baseUrl.replace(/\/$/, '')}/${pagePath.slice(0, -'/index.html'.length)}`
  const canonical = `<link rel="canonical" href="${url}">`
  // Tab pages such as /tech/ share the home page's canonical URL.
  if (!html.includes(canonical)) return html

  let result = replaceOnce(
    html,
    canonical,
    `<link rel="canonical" href="${url}/">`,
    'canonical link',
  )
  result = replaceOnce(
    result,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:url" content="${url}/">`,
    'og:url',
  )
  return replaceOnce(result, `"url":"${url}"`, `"url":"${url}/"`, 'JSON-LD url')
}

/** Give every sitemap location below the site root its trailing slash. */
export const useTrailingSlashSitemap = (
  xml: string,
  baseUrl: string,
): string => {
  const base = escapeRegExp(baseUrl.replace(/\/$/, ''))
  return xml.replace(
    new RegExp(`<loc>(${base}/[^<]*[^</])</loc>`, 'g'),
    '<loc>$1/</loc>',
  )
}
