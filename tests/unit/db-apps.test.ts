import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { initDb } from '../../electron/db/connection'
import {
  listCustomApps,
  getCustomApp,
  createCustomApp,
  deleteCustomApp,
  getAppSession,
  upsertAppSession,
  decrementAffiliateSession,
  setKeepAlive
} from '../../electron/db/queries/apps'

let db: Database.Database

beforeEach(() => {
  db = initDb(':memory:')
})

// ─── Custom Apps ──────────────────────────────────────────────────────────────

describe('createCustomApp', () => {
  it('inserts and returns a custom app', () => {
    const app = createCustomApp(db, {
      name: 'My App',
      url: 'https://example.com',
      tags: ['ai-chat']
    })
    expect(app.id).toBeTypeOf('string')
    expect(app.name).toBe('My App')
    expect(app.url).toBe('https://example.com')
    expect(app.icon).toBeNull()
    expect(app.tags).toEqual(['ai-chat'])
    expect(app.createdAt).toBeTypeOf('number')
  })

  it('stores icon when provided', () => {
    const app = createCustomApp(db, {
      name: 'App',
      url: 'https://example.com',
      icon: 'data:image/png;base64,abc',
      tags: []
    })
    expect(app.icon).toBe('data:image/png;base64,abc')
  })

  it('stores empty tags array', () => {
    const app = createCustomApp(db, { name: 'A', url: 'https://a.com', tags: [] })
    expect(app.tags).toEqual([])
  })
})

describe('getCustomApp', () => {
  it('returns undefined for unknown id', () => {
    expect(getCustomApp(db, 'nope')).toBeUndefined()
  })

  it('returns the app for a known id', () => {
    const created = createCustomApp(db, { name: 'N', url: 'https://n.com', tags: ['x'] })
    const found = getCustomApp(db, created.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(created.id)
    expect(found!.tags).toEqual(['x'])
  })
})

describe('listCustomApps', () => {
  it('returns empty array when none exist', () => {
    expect(listCustomApps(db)).toEqual([])
  })

  it('returns all custom apps', () => {
    createCustomApp(db, { name: 'A', url: 'https://a.com', tags: [] })
    createCustomApp(db, { name: 'B', url: 'https://b.com', tags: [] })
    expect(listCustomApps(db)).toHaveLength(2)
  })
})

describe('deleteCustomApp', () => {
  it('removes the app', () => {
    const app = createCustomApp(db, { name: 'A', url: 'https://a.com', tags: [] })
    deleteCustomApp(db, app.id)
    expect(getCustomApp(db, app.id)).toBeUndefined()
  })

  it('is a no-op for unknown id', () => {
    expect(() => deleteCustomApp(db, 'nonexistent')).not.toThrow()
  })
})

// ─── App Sessions ─────────────────────────────────────────────────────────────

describe('upsertAppSession', () => {
  it('creates a new session with defaults', () => {
    const session = upsertAppSession(db, 'bolt')
    expect(session.appId).toBe('bolt')
    expect(session.affiliateSessionsRemaining).toBe(3)
    expect(session.keepAlive).toBe(false)
    expect(session.firstOpenedAt).toBeTypeOf('number')
  })

  it('returns existing session without overwriting', () => {
    const first = upsertAppSession(db, 'bolt')
    decrementAffiliateSession(db, 'bolt')
    const second = upsertAppSession(db, 'bolt')
    // Should return existing — firstOpenedAt unchanged, sessions not reset
    expect(second.firstOpenedAt).toBe(first.firstOpenedAt)
    expect(second.affiliateSessionsRemaining).toBe(2)
  })
})

describe('getAppSession', () => {
  it('returns undefined for unknown appId', () => {
    expect(getAppSession(db, 'unknown')).toBeUndefined()
  })

  it('returns session after upsert', () => {
    upsertAppSession(db, 'v0')
    const session = getAppSession(db, 'v0')
    expect(session).toBeDefined()
    expect(session!.appId).toBe('v0')
  })
})

describe('decrementAffiliateSession', () => {
  it('decrements from 3 to 2', () => {
    upsertAppSession(db, 'app')
    decrementAffiliateSession(db, 'app')
    expect(getAppSession(db, 'app')!.affiliateSessionsRemaining).toBe(2)
  })

  it('does not go below 0', () => {
    upsertAppSession(db, 'app')
    decrementAffiliateSession(db, 'app')
    decrementAffiliateSession(db, 'app')
    decrementAffiliateSession(db, 'app')
    decrementAffiliateSession(db, 'app') // 4th call
    expect(getAppSession(db, 'app')!.affiliateSessionsRemaining).toBe(0)
  })
})

describe('setKeepAlive', () => {
  it('sets keep_alive to true', () => {
    upsertAppSession(db, 'app')
    setKeepAlive(db, 'app', true)
    expect(getAppSession(db, 'app')!.keepAlive).toBe(true)
  })

  it('sets keep_alive back to false', () => {
    upsertAppSession(db, 'app')
    setKeepAlive(db, 'app', true)
    setKeepAlive(db, 'app', false)
    expect(getAppSession(db, 'app')!.keepAlive).toBe(false)
  })
})
