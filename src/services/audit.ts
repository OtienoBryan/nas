// UI audit trail: records saves/logins and exports, and posts them to POST /api/v1/audit/ui-events.
// Events are kept on this device until the server accepts them, so nothing is lost while the endpoint rejects the token.

export interface AuditEvent {
  eventId: string
  action: string
  source: string
  screen: string
  entityType: string
  entityId: string
  outcome: string
  occurredAtUtc: string
  details: Record<string, unknown>
}

export interface AuditEntry {
  event: AuditEvent
  status: 'queued' | 'sent' | 'dropped'
}

export interface AuditStatus {
  queued: number
  sent: number
  dropped: number
  lastError: string
  lastAttemptAt: string
  lastSentAt: string
}

const ENDPOINT = `${(import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? ''}/api/v1/audit/ui-events`
const STORAGE_KEY = 'auditEntries'
const MAX_ENTRIES = 300 // queued + recent history kept on this device
const BATCH = 50
const FLUSH_MS = 10_000
const BACKOFF_MS = 60_000 // after a rejection, retry less often

let entries: AuditEntry[] = load()
let status: AuditStatus = { queued: 0, sent: 0, dropped: 0, lastError: '', lastAttemptAt: '', lastSentAt: '' }
let flushing = false
let blockedUntil = 0
let timer: number | undefined
const listeners = new Set<() => void>()

function load(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuditEntry[]) : []
  } catch {
    return []
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch { /* storage unavailable: events stay in memory only */ }
}

function recount() {
  status = {
    ...status,
    queued: entries.filter(e => e.status === 'queued').length,
    sent: entries.filter(e => e.status === 'sent').length,
    dropped: entries.filter(e => e.status === 'dropped').length,
  }
}

function emit() {
  recount()
  persist()
  listeners.forEach(l => l())
}

export function subscribeAudit(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getAuditEntries = () => entries
export const getAuditStatus = () => status

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

export function recordAuditEvent(e: Partial<Omit<AuditEvent, 'eventId' | 'occurredAtUtc' | 'source'>> & { action: string }): void {
  const event: AuditEvent = {
    eventId: uuid(),
    action: e.action,
    source: 'admin-portal',
    screen: e.screen ?? window.location.pathname,
    entityType: e.entityType ?? '',
    entityId: e.entityId ?? '',
    outcome: e.outcome ?? 'success',
    occurredAtUtc: new Date().toISOString(),
    details: e.details ?? {},
  }
  entries = [{ event, status: 'queued' as const }, ...entries]
  // Trim the oldest history first; never drop events that are still waiting to be sent
  if (entries.length > MAX_ENTRIES) {
    const keep = entries.filter(x => x.status === 'queued')
    const rest = entries.filter(x => x.status !== 'queued').slice(0, Math.max(0, MAX_ENTRIES - keep.length))
    entries = [...keep, ...rest].sort((a, b) => b.event.occurredAtUtc.localeCompare(a.event.occurredAtUtc))
  }
  emit()
  if (status.queued >= BATCH) void flushAudit()
}

// Post waiting events in batches. Returns when the queue is empty, the server rejects them, or the network fails.
export async function flushAudit(force = false, keepalive = false): Promise<void> {
  if (flushing) return
  if (!force && Date.now() < blockedUntil) return
  const token = localStorage.getItem('adminToken')
  if (!token) return
  flushing = true
  try {
    for (;;) {
      const batch = entries.filter(x => x.status === 'queued').slice(-BATCH).reverse() // oldest first
      if (batch.length === 0) break
      status = { ...status, lastAttemptAt: new Date().toISOString() }
      let res: Response
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          keepalive,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ events: batch.map(b => b.event) }),
        })
      } catch {
        status = { ...status, lastError: 'Network error: events kept and will be retried' }
        blockedUntil = Date.now() + BACKOFF_MS
        emit()
        return
      }

      const ids = new Set(batch.map(b => b.event.eventId))
      if (res.ok) {
        entries = entries.map(x => (ids.has(x.event.eventId) ? { ...x, status: 'sent' as const } : x))
        status = { ...status, lastError: '', lastSentAt: new Date().toISOString() }
        emit()
        continue
      }

      // Rejected. Auth problems keep the events queued; a validation error drops the batch so it can't block the rest.
      const hint = res.headers.get('WWW-Authenticate')?.match(/error_description="([^"]+)"/)?.[1]
      let message = `Server rejected the events (HTTP ${res.status})${hint ? `: ${hint}` : ''}`
      if (res.status === 400) {
        try { message = `Server rejected the events (HTTP 400): ${(await res.json()).message ?? 'validation failed'}` } catch { /* no body */ }
        entries = entries.map(x => (ids.has(x.event.eventId) ? { ...x, status: 'dropped' as const } : x))
      } else if (res.status === 401 || res.status === 403) {
        // Token is dead: drop it so we stop retrying with it. A fresh login will resume flushing.
        localStorage.removeItem('adminToken')
      } else {
        blockedUntil = Date.now() + BACKOFF_MS
      }
      status = { ...status, lastError: message }
      emit()
      if (res.status !== 400) return
    }
  } finally {
    flushing = false
  }
}

export function clearSentAudit(): void {
  entries = entries.filter(x => x.status === 'queued')
  emit()
}

// ---- Automatic capture ----
const noop = (): void => undefined
let started = false
export function startAuditTracking(): () => void {
  if (started) return noop
  started = true
  recount()
  listeners.forEach(l => l())

  timer = window.setInterval((): void => { void flushAudit() }, FLUSH_MS)
  const onHide = () => { if (document.visibilityState === 'hidden') void flushAudit(true, true) }
  document.addEventListener('visibilitychange', onHide)
  void flushAudit()

  return () => {
    started = false
    document.removeEventListener('visibilitychange', onHide)
    if (timer) window.clearInterval(timer)
  }
}

// Turn an API write into a readable audit event (no request bodies are ever recorded)
export function auditWrite(method: string, endpoint: string, outcome: 'success' | 'failure', status?: number, message?: string): void {
  const path = endpoint.split('?')[0]
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  const parts = path.split('/').filter(Boolean)
  const entityId = parts.find(isUuid) ?? ''
  const template = '/' + parts.map(p => (isUuid(p) ? ':id' : p)).join('/')

  let action = 'data_changed'
  let entityType = parts[0] ?? ''
  if (path === '/auth/portal/login' || path === '/auth/login') { action = 'login'; entityType = 'auth' }
  else if (path === '/auth/logout') { action = 'logout'; entityType = 'auth' }
  else if (path === '/auth/change-password') { action = 'password_changed'; entityType = 'auth' }

  recordAuditEvent({
    action,
    entityType,
    entityId,
    outcome,
    details: { operation: `${method} ${template}`, ...(status ? { httpStatus: status } : {}), ...(outcome === 'failure' && message ? { error: message.slice(0, 200) } : {}) },
  })
}
