import { useCallback, useEffect, useState } from 'react'
// Shared data-loading hook used by cashier, kitchen, inventory, and owner screens.
import { api } from './services/api.js'

// Loads data from the API. `poll` (milliseconds) refreshes it automatically.
export function useFetch(path, { poll } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (quiet) => {
      if (!quiet) setLoading(true)
      try {
        setData(await api(path))
        setError('')
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [path]
  )

  useEffect(() => {
    load(false)
    if (!poll) return
    const t = setInterval(() => load(true), poll)
    return () => clearInterval(t)
  }, [load, poll])

  return { data, error, loading, reload: () => load(true) }
}
