import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchQuery, getCachedQuery, setCachedQuery } from '../services/queryCache'

// Stale-while-revalidate: returns cached data instantly (no spinner) and refreshes in the background.
export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>) {
  const cached = getCachedQuery<T>(key)
  const [data, setData] = useState<T | undefined>(cached)
  const [loading, setLoading] = useState(cached === undefined)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      setData(await fetchQuery(key, () => fetcherRef.current()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [key])

  useEffect(() => {
    setData(getCachedQuery<T>(key))
    setLoading(getCachedQuery<T>(key) === undefined)
    refetch()
  }, [key, refetch])

  // Update the cache and the screen together (optimistic edits)
  const mutate = useCallback((updater: (current: T | undefined) => T) => {
    setData(current => {
      const next = updater(current)
      setCachedQuery(key, next)
      return next
    })
  }, [key])

  return { data, loading, refreshing, error, refetch, mutate }
}
