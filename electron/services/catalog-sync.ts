import { readFileSync } from 'fs'
import { join } from 'path'
import type { CatalogApp } from '../../shared/types'

const REMOTE_CATALOG_URL =
  'https://raw.githubusercontent.com/mrtnrocks/vibe-hub/main/catalog.json'
const FETCH_TIMEOUT_MS = 5000

function loadBundledCatalog(): CatalogApp[] {
  const catalogPath = join(__dirname, '../../resources/default-catalog.json')
  const raw = readFileSync(catalogPath, 'utf-8')
  return JSON.parse(raw) as CatalogApp[]
}

export async function syncCatalog(): Promise<CatalogApp[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(REMOTE_CATALOG_URL, { signal: controller.signal })
    clearTimeout(timer)

    if (!response.ok) {
      return loadBundledCatalog()
    }

    const data = await response.json()
    if (!Array.isArray(data)) {
      return loadBundledCatalog()
    }

    return data as CatalogApp[]
  } catch {
    clearTimeout(timer)
    return loadBundledCatalog()
  }
}
