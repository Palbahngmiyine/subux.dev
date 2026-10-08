import type { Plugin } from 'unified'

type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
  data?: Record<string, unknown>
}

const calloutTypes = new Set([
  'note',
  'abstract',
  'summary',
  'tldr',
  'info',
  'todo',
  'tip',
  'hint',
  'important',
  'success',
  'check',
  'done',
  'question',
  'help',
  'faq',
  'warning',
  'attention',
  'caution',
  'failure',
  'missing',
  'fail',
  'danger',
  'error',
  'bug',
  'example',
  'quote',
  'cite',
])

const splitFirstLine = (
  nodes: MarkdownNode[],
): {
  before: MarkdownNode[]
  after: MarkdownNode[]
  found: boolean
} => {
  const before: MarkdownNode[] = []
  for (const [index, node] of nodes.entries()) {
    if (node.type === 'break') {
      return { before, after: nodes.slice(index + 1), found: true }
    }
    if (node.type === 'text' && node.value?.includes('\n')) {
      const end = node.value.indexOf('\n')
      if (end > 0) before.push({ ...node, value: node.value.slice(0, end) })
      const after = nodes.slice(index + 1)
      if (end + 1 < node.value.length) {
        after.unshift({ ...node, value: node.value.slice(end + 1) })
      }
      return { before, after, found: true }
    }
    if (node.children) {
      const split = splitFirstLine(node.children)
      if (split.found) {
        if (split.before.length)
          before.push({ ...node, children: split.before })
        const after = nodes.slice(index + 1)
        if (split.after.length)
          after.unshift({ ...node, children: split.after })
        return { before, after, found: true }
      }
    }
    before.push(node)
  }
  return { before, after: [], found: false }
}

const transformCallouts = (node: MarkdownNode): void => {
  // Visit authored nodes before adding wrappers, including nested callouts.
  for (const child of node.children ?? []) transformCallouts(child)
  if (node.type !== 'blockquote') return

  const paragraph = node.children?.[0]
  const first = paragraph?.children?.[0]
  if (paragraph?.type !== 'paragraph' || first?.type !== 'text') return
  const marker = /^\[!(\w+)\]([+-]?)[ \t]*/.exec(first.value ?? '')
  if (!marker) return

  const requestedType = marker[1].toLowerCase()
  const type = calloutTypes.has(requestedType) ? requestedType : 'note'
  const { before: title, after: body } = splitFirstLine([
    { ...first, value: (first.value ?? '').slice(marker[0].length) },
    ...paragraph.children!.slice(1),
  ])
  const content = [
    ...(body.length ? [{ ...paragraph, children: body }] : []),
    ...node.children!.slice(1),
  ]
  node.data = {
    ...node.data,
    hProperties: {
      className: [`callout-${type}`],
      'data-callout': type,
      'data-expandable': String(Boolean(marker[2])),
      'data-expanded': String(marker[2] === '+'),
    },
  }
  node.children = [
    {
      type: 'paragraph',
      data: { hName: 'div', hProperties: { className: ['callout-title'] } },
      children: [
        {
          type: 'paragraph',
          data: {
            hName: 'div',
            hProperties: { className: ['callout-title-text'] },
          },
          children: title,
        },
      ],
    },
    {
      type: 'blockquote',
      data: { hName: 'div', hProperties: { className: ['callout-content'] } },
      children: content,
    },
  ]
}

// Keep Markdown nodes rather than interpolating article text into raw HTML.
export const remarkCallout: Plugin = () => (tree) => {
  transformCallouts(tree as MarkdownNode)
}
