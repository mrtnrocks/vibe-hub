import { useCallback } from 'react'
import { useApp } from '../context/AppContext'

export function useWebview(): { switchApp: (appId: string) => Promise<void> } {
  const { switchApp } = useApp()

  const handleSwitch = useCallback(
    async (appId: string) => {
      await switchApp(appId)
    },
    [switchApp]
  )

  return { switchApp: handleSwitch }
}
