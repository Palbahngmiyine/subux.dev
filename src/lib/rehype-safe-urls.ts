import type { Plugin } from 'unified'

type HtmlNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HtmlNode[]
}

const isSafeUrl = (value: unknown, allowContact: boolean): boolean => {
  if (typeof value !== 'string') return false

  try {
    // URL uses the same whitespace/control-character normalization as browsers,
    // so obfuscated javascript: schemes cannot bypass the protocol allowlist.
    const { protocol } = new URL(value, 'https://markdown.invalid/')
    return (
      protocol === 'https:' ||
      protocol === 'http:' ||
      (allowContact && (protocol === 'mailto:' || protocol === 'tel:'))
    )
  } catch {
    return false
  }
}

const filterUrls = (node: HtmlNode): void => {
  if (node.type === 'element' && node.properties) {
    for (const property of ['href', 'src', 'poster']) {
      if (
        property in node.properties &&
        !isSafeUrl(
          node.properties[property],
          property === 'href' && node.tagName === 'a',
        )
      ) {
        delete node.properties[property]
      }
    }
  }

  for (const child of node.children ?? []) filterUrls(child)
}

// Operate on generated HAST URLs only, preserving callout classes, footnote
// attributes, syntax highlighting and video controls in the Markdown output.
export const rehypeSafeUrls: Plugin = () => (tree) => {
  filterUrls(tree as HtmlNode)
}
