/**
 * Extracts unique {{variable}} names from a template, in order of first appearance.
 * Trims whitespace inside braces. Ignores malformed patterns (nested braces).
 */
export function parseVariables(template: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const re = /\{\{([^{}]+)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    const name = m[1].trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
}

/**
 * Replaces {{variable}} placeholders in template with values from the map.
 * Unmatched placeholders are left as-is.
 */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([^{}]+)\}\}/g, (match, raw: string) => {
    const name = raw.trim()
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match
  })
}
