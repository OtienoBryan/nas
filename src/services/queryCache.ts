// App-wide cache for page data: pages paint cached data immediately, then refresh in the background.
const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

export function getCachedQuery<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCachedQuery<T>(key: string, data: T): void {
  cache.set(key, data)
}

// Fetch and cache; callers asking for the same key at the same time share one request.
export function fetchQuery<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending
  const promise = fetcher()
    .then(data => {
      cache.set(key, data)
      return data
    })
    .finally(() => { inflight.delete(key) })
  inflight.set(key, promise)
  return promise
}

// Warm the cache without surfacing errors (e.g. on hover or from the dashboard).
export function prefetchQuery<T>(key: string, fetcher: () => Promise<T>): void {
  fetchQuery(key, fetcher).catch(() => {})
}

export function clearQueryCache(): void {
  cache.clear()
  inflight.clear()
}

// Drop one cached entry so the next read refetches (after a write that changes it)
export function invalidateQuery(key: string): void {
  cache.delete(key)
}
