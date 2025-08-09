export function formatFrontmatterDate(value: unknown): string | null {
  if (value == null) return null

  let dateValue: Date
  if (value instanceof Date) {
    dateValue = value
  } else if (typeof value === 'number') {
    dateValue = new Date(value)
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    dateValue = new Date(trimmed)
    if (Number.isNaN(dateValue.getTime())) return trimmed
  } else {
    return null
  }

  if (Number.isNaN(dateValue.getTime())) return null

  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
