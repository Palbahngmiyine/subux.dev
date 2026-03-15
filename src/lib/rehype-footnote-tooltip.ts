interface HastText {
  type: 'text'
  value: string
}

interface HastElement {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children: HastNode[]
}

interface HastRoot {
  type: 'root'
  children: HastNode[]
}

type HastNode = HastText | HastElement | { type: string; [k: string]: unknown }

const extractText = (node: HastElement): string => {
  let text = ''
  for (const child of node.children) {
    if (child.type === 'text') {
      text += child.value
    } else if (child.type === 'element') {
      const el = child as HastElement
      if (el.properties?.dataFootnoteBackref === undefined) {
        text += extractText(el)
      }
    }
  }
  return text
}

const findSection = (node: HastElement | HastRoot): HastElement | null => {
  for (const child of node.children) {
    if (child.type !== 'element') continue
    const el = child as HastElement
    if (el.properties?.dataFootnotes !== undefined) return el
    const found = findSection(el)
    if (found) return found
  }
  return null
}

const collectContents = (section: HastElement): Map<string, string> => {
  const map = new Map<string, string>()
  for (const child of section.children) {
    if (child.type !== 'element') continue
    const ol = child as HastElement
    if (ol.tagName !== 'ol') continue
    for (const li of ol.children) {
      if (li.type !== 'element') continue
      const liEl = li as HastElement
      if (liEl.tagName !== 'li' || !liEl.properties?.id) continue
      const text = extractText(liEl).trim()
      if (text.length > 0) {
        map.set(String(liEl.properties.id), text)
      }
    }
  }
  return map
}

const attachTooltips = (
  node: HastElement | HastRoot,
  contents: Map<string, string>,
): void => {
  for (const child of node.children) {
    if (child.type !== 'element') continue
    const el = child as HastElement
    if (el.tagName === 'sup') {
      for (const a of el.children) {
        if (a.type !== 'element') continue
        const aEl = a as HastElement
        if (
          aEl.tagName === 'a' &&
          aEl.properties?.dataFootnoteRef !== undefined
        ) {
          const id = String(aEl.properties.href ?? '').replace(/^#/, '')
          const text = contents.get(id)
          if (text) {
            el.properties = el.properties ?? {}
            el.properties.dataFootnoteContent = text
          }
        }
      }
    }
    attachTooltips(el, contents)
  }
}

export default function rehypeFootnoteTooltip() {
  return (tree: HastRoot) => {
    const section = findSection(tree)
    if (!section) return

    const contents = collectContents(section)
    if (contents.size > 0) {
      attachTooltips(tree, contents)
    }
  }
}
