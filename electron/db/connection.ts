import Database from 'better-sqlite3'

const MIGRATION = `
  CREATE TABLE IF NOT EXISTS prompts (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL,
    template   TEXT    NOT NULL,
    defaults   TEXT    NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prompt_tags (
    prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    tag       TEXT NOT NULL,
    PRIMARY KEY (prompt_id, tag)
  );

  CREATE TABLE IF NOT EXISTS custom_apps (
    id         TEXT    PRIMARY KEY,
    name       TEXT    NOT NULL,
    url        TEXT    NOT NULL,
    icon       TEXT,
    tags       TEXT    NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_sessions (
    app_id                      TEXT    PRIMARY KEY,
    affiliate_sessions_remaining INTEGER NOT NULL DEFAULT 3,
    first_opened_at             INTEGER NOT NULL,
    keep_alive                  INTEGER NOT NULL DEFAULT 0
  );

  PRAGMA foreign_keys = ON;
`

export function initDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(MIGRATION)
  return db
}
