import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { CustomApp, AppSession } from '../../../shared/types'

// ─── Custom Apps ────────────────────────────────────────────────────────────

function rowToCustomApp(row: Record<string, unknown>): CustomApp {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    icon: (row.icon as string | null) ?? null,
    tags: JSON.parse(row.tags as string) as string[],
    createdAt: row.created_at as number
  }
}

export function listCustomApps(db: Database.Database): CustomApp[] {
  const rows = db
    .prepare('SELECT * FROM custom_apps ORDER BY created_at DESC')
    .all() as Record<string, unknown>[]
  return rows.map(rowToCustomApp)
}

export function getCustomApp(db: Database.Database, id: string): CustomApp | undefined {
  const row = db.prepare('SELECT * FROM custom_apps WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return undefined
  return rowToCustomApp(row)
}

export function createCustomApp(
  db: Database.Database,
  input: { name: string; url: string; icon?: string; tags: string[] }
): CustomApp {
  const id = randomUUID()
  const now = Date.now()

  try {
    db.prepare(
      'INSERT INTO custom_apps (id, name, url, icon, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, input.name, input.url, input.icon ?? null, JSON.stringify(input.tags), now)
  } catch (err) {
    throw err
  }

  return {
    id,
    name: input.name,
    url: input.url,
    icon: input.icon ?? null,
    tags: [...input.tags],
    createdAt: now
  }
}

export function deleteCustomApp(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM custom_apps WHERE id = ?').run(id)
}

// ─── App Sessions ────────────────────────────────────────────────────────────

function rowToAppSession(row: Record<string, unknown>): AppSession {
  return {
    appId: row.app_id as string,
    affiliateSessionsRemaining: row.affiliate_sessions_remaining as number,
    firstOpenedAt: row.first_opened_at as number,
    keepAlive: (row.keep_alive as number) === 1
  }
}

export function getAppSession(db: Database.Database, appId: string): AppSession | undefined {
  const row = db.prepare('SELECT * FROM app_sessions WHERE app_id = ?').get(appId) as
    | Record<string, unknown>
    | undefined
  if (!row) return undefined
  return rowToAppSession(row)
}

export function upsertAppSession(
  db: Database.Database,
  appId: string
): AppSession {
  const existing = db.prepare('SELECT * FROM app_sessions WHERE app_id = ?').get(appId) as
    | Record<string, unknown>
    | undefined

  if (existing) return rowToAppSession(existing)

  const now = Date.now()
  db.prepare(
    'INSERT INTO app_sessions (app_id, affiliate_sessions_remaining, first_opened_at, keep_alive) VALUES (?, 3, ?, 0)'
  ).run(appId, now)

  return {
    appId,
    affiliateSessionsRemaining: 3,
    firstOpenedAt: now,
    keepAlive: false
  }
}

export function decrementAffiliateSession(db: Database.Database, appId: string): void {
  db.prepare(
    'UPDATE app_sessions SET affiliate_sessions_remaining = MAX(0, affiliate_sessions_remaining - 1) WHERE app_id = ?'
  ).run(appId)
}

export function setKeepAlive(db: Database.Database, appId: string, keepAlive: boolean): void {
  db.prepare('UPDATE app_sessions SET keep_alive = ? WHERE app_id = ?').run(
    keepAlive ? 1 : 0,
    appId
  )
}
