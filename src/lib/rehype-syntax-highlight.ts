import type { Options as RehypeHighlightOptions } from 'rehype-highlight'

export const rehypeSyntaxHighlightOptions = {
  aliases: {
    bash: ['sh', 'shell', 'zsh'],
    yaml: ['yml'],
  },
  plainText: ['text', 'txt', 'plain', 'mermaid', 'mmd'],
} satisfies RehypeHighlightOptions
