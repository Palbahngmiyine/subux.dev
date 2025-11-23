import matter, { type GrayMatterFile } from 'gray-matter'

const BOM = '\ufeff'
const FRONTMATTER_BLOCK = /^---\s*\r?\n([\s\S]*?)\r?\n---/
const KEY_VALUE_LINE = /^(\s*)([A-Za-z0-9_.@-]+):(.*)$/
const AMBIGUOUS_COLON = /:(\s|$)/

const VALUE_PREFIXES_TO_SKIP = new Set([
  "'",
  '"',
  '`',
  '|',
  '>',
  '{',
  '[',
  '&',
  '*',
  '!',
])

const shouldSkipQuoting = (value: string): boolean => {
  if (value.length === 0) {
    return true
  }

  const first = value[0]
  return VALUE_PREFIXES_TO_SKIP.has(first)
}

const escapeForYaml = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const quoteLineIfNeeded = (line: string): string => {
  const match = KEY_VALUE_LINE.exec(line)
  if (!match) {
    return line
  }

  const [, indent, key, remainder] = match
  if (key.length === 0) {
    return line
  }

  const commentIndex = remainder.indexOf(' #')
  const mainPart =
    commentIndex >= 0 ? remainder.slice(0, commentIndex) : remainder
  const comment = commentIndex >= 0 ? remainder.slice(commentIndex) : ''

  const trimmedValue = mainPart.trim()
  if (
    trimmedValue.length === 0 ||
    shouldSkipQuoting(trimmedValue) ||
    !AMBIGUOUS_COLON.test(trimmedValue)
  ) {
    return line
  }

  const whitespaceMatch = mainPart.match(/^\s*/)?.[0] ?? ''
  const spacing = whitespaceMatch.length > 0 ? whitespaceMatch : ' '
  const escaped = escapeForYaml(trimmedValue)

  return `${indent}${key}:${spacing}"${escaped}"${comment}`
}

const normalizeFrontmatterColons = (raw: string): string => {
  const hasBom = raw.startsWith(BOM)
  const input = hasBom ? raw.slice(1) : raw
  const match = input.match(FRONTMATTER_BLOCK)
  if (!match) {
    return raw
  }

  const [, block] = match
  const lines = block.split(/\r?\n/)
  let mutated = false
  const normalizedLines = lines.map((line) => {
    const next = quoteLineIfNeeded(line)
    if (next !== line) {
      mutated = true
    }
    return next
  })

  if (!mutated) {
    return raw
  }

  const newline = block.includes('\r\n') ? '\r\n' : '\n'
  const normalizedBlock = `---${newline}${normalizedLines.join(newline)}${newline}---`
  const replaced = input.replace(FRONTMATTER_BLOCK, normalizedBlock)
  return hasBom ? `${BOM}${replaced}` : replaced
}

export const parseMarkdown = (raw: string): GrayMatterFile<string> => {
  const normalized = normalizeFrontmatterColons(raw)
  return matter(normalized)
}
