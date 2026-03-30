import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { Prompt } from '../../../shared/types'

function rowToPrompt(row: Record<string, unknown>, tags: string[]): Prompt {
  return {
    id: row.id as string,
    title: row.title as string,
    template: row.template as string,
    defaults: JSON.parse(row.defaults as string) as Record<string, string>,
    tags,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  }
}

function getTagsForPrompt(db: Database.Database, promptId: string): string[] {
  return (
    db.prepare('SELECT tag FROM prompt_tags WHERE prompt_id = ? ORDER BY tag').all(promptId) as { tag: string }[]
  ).map((r) => r.tag)
}

export function listPrompts(
  db: Database.Database,
  options: { tag?: string; search?: string } = {}
): Prompt[] {
  let sql = 'SELECT * FROM prompts'
  const params: unknown[] = []

  if (options.tag) {
    sql += ' WHERE id IN (SELECT prompt_id FROM prompt_tags WHERE tag = ?)'
    params.push(options.tag)
  }

  if (options.search) {
    const clause = options.tag ? ' AND' : ' WHERE'
    sql += `${clause} (title LIKE ? OR template LIKE ?)`
    const pattern = `%${options.search}%`
    params.push(pattern, pattern)
  }

  sql += ' ORDER BY updated_at DESC'

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map((row) => rowToPrompt(row, getTagsForPrompt(db, row.id as string)))
}

export function getPrompt(db: Database.Database, id: string): Prompt | undefined {
  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return undefined
  return rowToPrompt(row, getTagsForPrompt(db, id))
}

export function createPrompt(
  db: Database.Database,
  input: { title: string; template: string; defaults: Record<string, string>; tags: string[] }
): Prompt {
  const id = randomUUID()
  const now = Date.now()

  const insert = db.transaction(() => {
    db.prepare(
      'INSERT INTO prompts (id, title, template, defaults, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, input.title, input.template, JSON.stringify(input.defaults), now, now)

    for (const tag of input.tags) {
      db.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag) VALUES (?, ?)').run(id, tag)
    }
  })

  insert()
  return rowToPrompt(
    { id, title: input.title, template: input.template, defaults: JSON.stringify(input.defaults), created_at: now, updated_at: now },
    [...input.tags]
  )
}

export function updatePrompt(
  db: Database.Database,
  id: string,
  input: {
    title?: string
    template?: string
    defaults?: Record<string, string>
    tags?: string[]
  }
): Prompt | undefined {
  const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!existing) return undefined

  const now = Date.now()
  const title = input.title ?? (existing.title as string)
  const template = input.template ?? (existing.template as string)
  const defaults = input.defaults !== undefined ? JSON.stringify(input.defaults) : (existing.defaults as string)

  const update = db.transaction(() => {
    db.prepare(
      'UPDATE prompts SET title = ?, template = ?, defaults = ?, updated_at = ? WHERE id = ?'
    ).run(title, template, defaults, now, id)

    if (input.tags !== undefined) {
      db.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').run(id)
      for (const tag of input.tags) {
        db.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag) VALUES (?, ?)').run(id, tag)
      }
    }
  })

  update()
  return rowToPrompt(
    { id, title, template, defaults, created_at: existing.created_at, updated_at: now },
    input.tags ?? getTagsForPrompt(db, id)
  )
}

export function deletePrompt(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM prompts WHERE id = ?').run(id)
}
