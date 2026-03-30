import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initDb } from '../../electron/db/connection'
import {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt
} from '../../electron/db/queries/prompts'

let db: Database.Database

beforeEach(() => {
  db = initDb(':memory:')
})

describe('createPrompt', () => {
  it('inserts a prompt and returns it with correct fields', () => {
    const p = createPrompt(db, {
      title: 'My Prompt',
      template: 'Hello {{name}}',
      defaults: { name: 'World' },
      tags: ['general']
    })

    expect(p.id).toBeTypeOf('string')
    expect(p.title).toBe('My Prompt')
    expect(p.template).toBe('Hello {{name}}')
    expect(p.defaults).toEqual({ name: 'World' })
    expect(p.tags).toEqual(['general'])
    expect(p.createdAt).toBeTypeOf('number')
    expect(p.updatedAt).toBe(p.createdAt)
  })

  it('stores and retrieves empty defaults', () => {
    const p = createPrompt(db, { title: 'T', template: 'tpl', defaults: {}, tags: [] })
    expect(p.defaults).toEqual({})
    expect(p.tags).toEqual([])
  })
})

describe('getPrompt', () => {
  it('returns undefined for unknown id', () => {
    expect(getPrompt(db, 'nonexistent')).toBeUndefined()
  })

  it('returns the prompt for a known id', () => {
    const created = createPrompt(db, { title: 'A', template: 'B', defaults: {}, tags: ['x'] })
    const found = getPrompt(db, created.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(created.id)
    expect(found!.tags).toEqual(['x'])
  })
})

describe('listPrompts', () => {
  it('returns empty array when no prompts', () => {
    expect(listPrompts(db)).toEqual([])
  })

  it('returns all prompts when no filter', () => {
    createPrompt(db, { title: 'A', template: 'a', defaults: {}, tags: ['foo'] })
    createPrompt(db, { title: 'B', template: 'b', defaults: {}, tags: ['bar'] })
    expect(listPrompts(db)).toHaveLength(2)
  })

  it('filters by tag', () => {
    createPrompt(db, { title: 'A', template: 'a', defaults: {}, tags: ['foo'] })
    createPrompt(db, { title: 'B', template: 'b', defaults: {}, tags: ['bar'] })
    const results = listPrompts(db, { tag: 'foo' })
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('A')
  })

  it('filters by search (title match)', () => {
    createPrompt(db, { title: 'Build component', template: 'a', defaults: {}, tags: [] })
    createPrompt(db, { title: 'Write tests', template: 'b', defaults: {}, tags: [] })
    const results = listPrompts(db, { search: 'component' })
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Build component')
  })

  it('filters by search (template match)', () => {
    createPrompt(db, { title: 'A', template: 'Hello {{name}}', defaults: {}, tags: [] })
    createPrompt(db, { title: 'B', template: 'Goodbye', defaults: {}, tags: [] })
    const results = listPrompts(db, { search: 'Hello' })
    expect(results).toHaveLength(1)
  })

  it('filters by both tag and search', () => {
    createPrompt(db, { title: 'Build UI', template: 'ui', defaults: {}, tags: ['frontend'] })
    createPrompt(db, { title: 'Build API', template: 'api', defaults: {}, tags: ['backend'] })
    createPrompt(db, { title: 'Test UI', template: 'test', defaults: {}, tags: ['frontend'] })
    const results = listPrompts(db, { tag: 'frontend', search: 'Build' })
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Build UI')
  })
})

describe('updatePrompt', () => {
  it('returns undefined for unknown id', () => {
    expect(updatePrompt(db, 'bad-id', { title: 'X' })).toBeUndefined()
  })

  it('updates title only', () => {
    const p = createPrompt(db, { title: 'Old', template: 'tpl', defaults: {}, tags: [] })
    const updated = updatePrompt(db, p.id, { title: 'New' })
    expect(updated!.title).toBe('New')
    expect(updated!.template).toBe('tpl')
  })

  it('updates tags', () => {
    const p = createPrompt(db, { title: 'P', template: 't', defaults: {}, tags: ['a', 'b'] })
    const updated = updatePrompt(db, p.id, { tags: ['c'] })
    expect(updated!.tags).toEqual(['c'])
  })

  it('updates defaults', () => {
    const p = createPrompt(db, { title: 'P', template: 't', defaults: { x: '1' }, tags: [] })
    const updated = updatePrompt(db, p.id, { defaults: { x: '2', y: '3' } })
    expect(updated!.defaults).toEqual({ x: '2', y: '3' })
  })

  it('bumps updatedAt', async () => {
    const p = createPrompt(db, { title: 'P', template: 't', defaults: {}, tags: [] })
    await new Promise((r) => setTimeout(r, 5))
    const updated = updatePrompt(db, p.id, { title: 'Q' })
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(p.updatedAt)
  })
})

describe('deletePrompt', () => {
  it('removes the prompt', () => {
    const p = createPrompt(db, { title: 'Del', template: 't', defaults: {}, tags: ['x'] })
    deletePrompt(db, p.id)
    expect(getPrompt(db, p.id)).toBeUndefined()
  })

  it('cascades to prompt_tags', () => {
    const p = createPrompt(db, { title: 'P', template: 't', defaults: {}, tags: ['a', 'b'] })
    deletePrompt(db, p.id)
    const tags = db.prepare('SELECT * FROM prompt_tags WHERE prompt_id = ?').all(p.id)
    expect(tags).toHaveLength(0)
  })

  it('is a no-op for unknown id', () => {
    expect(() => deletePrompt(db, 'nonexistent')).not.toThrow()
  })
})
