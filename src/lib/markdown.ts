import { parseDocument } from 'yaml'

const BOM = '\ufeff'
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

export interface MarkdownFile {
  content: string
  data: Record<string, unknown>
}

export const parseMarkdown = (raw: string): MarkdownFile => {
  const input = raw.startsWith(BOM) ? raw.slice(1) : raw
  const opening = /^---([^\r\n]*)\r?\n/.exec(input)
  if (!opening) return { content: input, data: {} }

  const language = opening[1].trim().toLowerCase()
  if (language && language !== 'yaml' && language !== 'yml') {
    throw new Error('Only YAML frontmatter is supported')
  }

  const remainder = input.slice(opening[0].length)
  const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(remainder)
  if (!closing) throw new Error('Unclosed YAML frontmatter')

  const frontmatter = remainder.slice(0, closing.index)
  const normalized = frontmatter
    .split(/\r?\n/)
    .map(quoteLineIfNeeded)
    .join('\n')
  const document = parseDocument(normalized, {
    schema: 'core',
    customTags: ['timestamp'],
    stringKeys: true,
  })
  // Reject unknown tags as well as invalid YAML instead of silently treating
  // executable-language tags as strings.
  if (document.errors.length || document.warnings.length) {
    throw document.errors[0] ?? document.warnings[0]
  }

  // Frontmatter needs no aliases; disabling them also rejects cyclic metadata
  // and prevents alias expansion from consuming unbounded resources.
  const data: unknown = document.toJS({ maxAliasCount: 0 }) ?? {}
  if (typeof data !== 'object' || Array.isArray(data) || data instanceof Date) {
    throw new Error('YAML frontmatter must be a mapping')
  }

  return {
    content: remainder.slice(closing.index + closing[0].length),
    data: data as Record<string, unknown>,
  }
}
