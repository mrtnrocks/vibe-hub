import { describe, it, expect } from 'vitest'
import { parseVariables, interpolate } from '../../src/lib/variables'

describe('parseVariables', () => {
  it('returns empty array for template with no placeholders', () => {
    expect(parseVariables('Hello world')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseVariables('')).toEqual([])
  })

  it('extracts a single variable', () => {
    expect(parseVariables('Hello {{name}}')).toEqual(['name'])
  })

  it('extracts multiple variables in order of first appearance', () => {
    expect(parseVariables('{{greeting}} {{name}}, you are {{age}} years old')).toEqual([
      'greeting',
      'name',
      'age'
    ])
  })

  it('deduplicates repeated variables', () => {
    expect(parseVariables('{{x}} and {{x}} again')).toEqual(['x'])
  })

  it('trims whitespace inside braces', () => {
    expect(parseVariables('{{ name }} and {{ age }}')).toEqual(['name', 'age'])
  })

  it('extracts variable from {{{x}}} — inner {{x}} still matches', () => {
    // {{{x}}} contains {{x}} starting at offset 1, so x is captured
    expect(parseVariables('{{{x}}}')).toEqual(['x'])
  })

  it('handles adjacent placeholders', () => {
    expect(parseVariables('{{a}}{{b}}')).toEqual(['a', 'b'])
  })

  it('handles placeholder at start and end of string', () => {
    expect(parseVariables('{{start}} middle {{end}}')).toEqual(['start', 'end'])
  })

  it('ignores empty braces {{}}', () => {
    expect(parseVariables('before {{}} after')).toEqual([])
  })

  it('handles variable with underscores and numbers', () => {
    expect(parseVariables('{{user_name_2}}')).toEqual(['user_name_2'])
  })
})

describe('interpolate', () => {
  it('replaces a single placeholder', () => {
    expect(interpolate('Hello {{name}}', { name: 'Alice' })).toBe('Hello Alice')
  })

  it('replaces multiple different placeholders', () => {
    expect(interpolate('{{a}} and {{b}}', { a: '1', b: '2' })).toBe('1 and 2')
  })

  it('replaces a repeated placeholder with the same value each time', () => {
    expect(interpolate('{{x}} {{x}}', { x: 'hi' })).toBe('hi hi')
  })

  it('leaves unmatched placeholders unchanged', () => {
    expect(interpolate('Hello {{name}}', {})).toBe('Hello {{name}}')
  })

  it('leaves unmatched placeholder while replacing matched one', () => {
    expect(interpolate('{{a}} {{b}}', { a: 'hello' })).toBe('hello {{b}}')
  })

  it('handles empty template', () => {
    expect(interpolate('', { name: 'x' })).toBe('')
  })

  it('handles empty string replacement value', () => {
    expect(interpolate('{{x}}', { x: '' })).toBe('')
  })

  it('handles values containing special regex replacement characters ($)', () => {
    expect(interpolate('{{x}}', { x: 'a$1b' })).toBe('a$1b')
  })

  it('handles values containing dollar signs', () => {
    expect(interpolate('Cost: {{price}}', { price: '$9.99' })).toBe('Cost: $9.99')
  })

  it('trims whitespace in placeholder names when matching', () => {
    expect(interpolate('{{ name }}', { name: 'Bob' })).toBe('Bob')
  })

  it('handles template with no placeholders', () => {
    expect(interpolate('No variables here', { name: 'x' })).toBe('No variables here')
  })

  it('handles multiline templates', () => {
    const result = interpolate('Line 1: {{a}}\nLine 2: {{b}}', { a: 'foo', b: 'bar' })
    expect(result).toBe('Line 1: foo\nLine 2: bar')
  })
})
