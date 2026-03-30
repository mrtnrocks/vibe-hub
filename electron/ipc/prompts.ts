import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import type { IpcResult, Prompt } from '../../shared/types'
import {
  IPC_PROMPT_LIST,
  IPC_PROMPT_GET,
  IPC_PROMPT_CREATE,
  IPC_PROMPT_UPDATE,
  IPC_PROMPT_DELETE
} from '../../shared/constants'
import {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt
} from '../db/queries/prompts'

export function registerPromptHandlers(db: Database.Database): void {
  ipcMain.handle(
    IPC_PROMPT_LIST,
    (_event, filters: { tag?: string; search?: string } = {}): IpcResult<Prompt[]> => {
      try {
        return { ok: true, data: listPrompts(db, filters) }
      } catch (err) {
        console.error('[ipc:prompts] list failed:', err)
        return { ok: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(IPC_PROMPT_GET, (_event, { id }: { id: string }): IpcResult<Prompt> => {
    try {
      const prompt = getPrompt(db, id)
      if (!prompt) return { ok: false, error: 'Prompt not found' }
      return { ok: true, data: prompt }
    } catch (err) {
      console.error('[ipc:prompts] get failed:', err)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_PROMPT_CREATE,
    (
      _event,
      input: { title: string; template: string; defaults: Record<string, string>; tags: string[] }
    ): IpcResult<Prompt> => {
      try {
        return { ok: true, data: createPrompt(db, input) }
      } catch (err) {
        console.error('[ipc:prompts] create failed:', err)
        return { ok: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    IPC_PROMPT_UPDATE,
    (
      _event,
      {
        id,
        ...input
      }: {
        id: string
        title?: string
        template?: string
        defaults?: Record<string, string>
        tags?: string[]
      }
    ): IpcResult<Prompt> => {
      try {
        const prompt = updatePrompt(db, id, input)
        if (!prompt) return { ok: false, error: 'Prompt not found' }
        return { ok: true, data: prompt }
      } catch (err) {
        console.error('[ipc:prompts] update failed:', err)
        return { ok: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(IPC_PROMPT_DELETE, (_event, { id }: { id: string }): void => {
    try {
      deletePrompt(db, id)
    } catch (err) {
      console.error('[ipc:prompts] delete failed:', err)
    }
  })
}
