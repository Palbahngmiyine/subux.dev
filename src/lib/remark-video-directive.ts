import type { Plugin } from 'unified'

type MarkdownNode = {
  type?: string
  name?: string
  attributes?: Record<string, unknown>
  children?: MarkdownNode[]
  data?: Record<string, unknown>
}

const visitTree = (
  node: MarkdownNode,
  visitor: (current: MarkdownNode) => void,
): void => {
  visitor(node)

  if (!Array.isArray(node.children)) {
    return
  }

  for (const child of node.children) {
    visitTree(child, visitor)
  }
}

export const remarkVideoDirective: Plugin = () => {
  return (tree) => {
    visitTree(tree as MarkdownNode, (node) => {
      if (node.type !== 'leafDirective' || node.name !== 'video') {
        return
      }

      const src =
        typeof node.attributes?.src === 'string' ? node.attributes.src : ''
      const title =
        typeof node.attributes?.title === 'string'
          ? node.attributes.title
          : undefined

      if (!src) {
        return
      }

      node.data = {
        ...node.data,
        hName: 'video',
        hProperties: {
          className: ['article-video'],
          controls: true,
          muted: true,
          playsInline: true,
          preload: 'metadata',
          src,
          ...(title ? { 'aria-label': title } : {}),
        },
      }
    })
  }
}
