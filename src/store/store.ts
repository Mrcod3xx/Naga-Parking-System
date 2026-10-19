import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Attendant, Category, Rate, Session, Settings, Slot, SlotStatus, State, Transaction } from './types'
import { buildSeed } from './seed'
import { calcFee, DEMO_START, minutesOf, normalizeTicket, slotShort, ticketId, txnId } from './logic'
import { fmtPHP } from '../lib/format'

const KEY = 'nsp-demo-state-v1'
const CLOCK_KEY = 'nsp-demo-clock-v1'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    /* ignore corrupt storage */
  }
  return buildSeed()
}

let realStart = Number(localStorage.getItem(CLOCK_KEY)) || Date.now()
localStorage.setItem(CLOCK_KEY, String(realStart))

/** Demo clock: starts at 16 Oct 2026, 10:15 PM and advances in real time. */
export const now = () => DEMO_START + (Date.now() - realStart)

let state: State = load()
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage full or unavailable */
  }
  listeners.forEach((l) => l())
}

export const getState = () => state

export function useStore<T>(select: (s: State) => T): T {
  return select(useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => state))
}

export function useNow(intervalMs = 10000) {
  const [t, setT] = useState(now)
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return t
}

const uid = () => Math.random().toString(36).slice(2, 10)

function log(s: State, event: string, ref: string, result: string): State {
  return { ...s, activity: [{ id: uid(), at: now(), event, ref, result }, ...s.activity].slice(0, 60) }
}

function patchSlot(slots: Slot[], id: string, patch: Partial<Slot>) {
  return slots.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

/* ---------------- Entrance kiosk ---------------- */

export function availableFor(cat: Category, s: State = state) {
  return s.slots.filter((x) => x.category === cat && x.status === 'available')
}

/** Atomically claims the nearest compatible available space for the kiosk. */
export function claimSlot(cat: Category) {
  let s = releaseClaimState(state)
  const slot = availableFor(cat, s).sort((a, b) => a.block.localeCompare(b.block) || a.number - b.number)[0]
  if (!slot) {
    set(s)
    return null
  }
  const claim = { slotId: slot.id, ticketId: ticketId(s.nextTicket), category: cat, at: now() }
  s = { ...s, claim, slots: patchSlot(s.slots, slot.id, { status: 'claimed', reason: 'Kiosk claim · issuing ticket' }) }
  set(s)
  return claim
}

function releaseClaimState(s: State): State {
  if (!s.claim) return s
  return {
    ...s,
    claim: null,
    slots: patchSlot(s.slots, s.claim.slotId, { status: 'available', reason: 'Eligible for assignment' }),
  }
}

export function releaseClaim() {
  if (state.claim) set(releaseClaimState(state))
}

export function issueTicket(): Session | null {
  const c = state.claim
  if (!c) return null
  const slot = state.slots.find((x) => x.id === c.slotId)!
  const session: Session = {
    ticketId: c.ticketId,
    category: c.category,
    slotId: c.slotId,
    entry: c.at,
    rateVersion: state.rates.version,
    rate: state.rates.categories[c.category],
    grace: state.rates.grace,
    status: 'active',
  }
  let s: State = {
    ...state,
    claim: null,
    lastIssued: session.ticketId,
    nextTicket: state.nextTicket + 1,
    sessions: { ...state.sessions, [session.ticketId]: session },
    slots: patchSlot(state.slots, c.slotId, { status: 'occupied', ticketId: session.ticketId, reason: 'Active-session lock' }),
  }
  s = log(s, 'Ticket issued', session.ticketId, `${session.category} · ${slotShort(slot)} occupied`)
  set(s)
  return session
}

/* ---------------- Exit terminal ---------------- */

export const OPERATOR = { name: 'Maria Santos', terminal: 'Terminal 01', lane: 'Lane A' as const }

export type LookupResult = { kind: 'invalid' | 'paid' | 'duplicate' | 'found'; id: string }

export function lookupTicket(query: string): LookupResult {
  const id = normalizeTicket(query)
  const session = state.sessions[id]
  if (!session) {
    set(log(state, 'Invalid ticket scanned', id || '—', 'No session · no charge'))
    return { kind: 'invalid', id }
  }
  if (session.status === 'completed') return { kind: 'paid', id }
  if (state.checkout?.ticketId === id) return { kind: 'duplicate', id }
  const t = now()
  let s: State = {
    ...state,
    checkout: { ticketId: id, openedAt: t, exitAt: t, terminal: OPERATOR.terminal, attendant: OPERATOR.name },
  }
  s = log(s, 'Checkout under review', id, `Active · ${session.slotId} occupied`)
  set(s)
  return { kind: 'found', id }
}

export function cancelCheckout() {
  const c = state.checkout
  if (!c) return
  set(log({ ...state, checkout: null }, 'Checkout cancelled', c.ticketId, 'No charge · session stays active'))
}

export function quoteFor(session: Session, exitAt: number) {
  const minutes = minutesOf(session.entry, exitAt)
  return { minutes, ...calcFee(session.rate, minutes, session.grace) }
}

export function completePayment(id: string, tender: number, method: 'Cash' | 'Digital' = 'Cash') {
  const session = state.sessions[id]
  const c = state.checkout
  if (!session || session.status !== 'active' || !c || c.ticketId !== id) return null
  const q = quoteFor(session, c.exitAt)
  if (tender < q.total) return null
  const tx: Transaction = {
    id: txnId(state.nextTxn),
    ticketId: id,
    category: session.category,
    slotId: session.slotId,
    entry: session.entry,
    exit: c.exitAt,
    minutes: q.minutes,
    amount: q.total,
    method,
    tender,
    change: tender - q.total,
    attendant: c.attendant,
  }
  const done: Session = {
    ...session,
    status: 'completed',
    exit: c.exitAt,
    payment: { amount: q.total, method, tender, change: tx.change, attendant: c.attendant, paidAt: now(), transactionId: tx.id },
  }
  let s: State = {
    ...state,
    checkout: null,
    lastCompleted: id,
    nextTxn: state.nextTxn + 1,
    transactions: [tx, ...state.transactions],
    sessions: { ...state.sessions, [id]: done },
    slots: patchSlot(state.slots, session.slotId, { status: 'available', ticketId: undefined, reason: 'Eligible for assignment' }),
    attendants: state.attendants.map((a) => (a.name === c.attendant ? { ...a, lastAccess: now() } : a)),
  }
  s = log(s, `${method} payment confirmed`, id, `${fmtPHP(q.total)} · ${session.slotId} released`)
  set(s)
  return tx
}

/* ---------------- Administration ---------------- */

export function updateSlot(id: string, patch: { status: SlotStatus; category: Category; reason: string }) {
  const slot = state.slots.find((x) => x.id === id)
  if (!slot || slot.status === 'occupied' || slot.status === 'claimed') return false
  let s: State = { ...state, slots: patchSlot(state.slots, id, patch) }
  const label = { available: 'Slot made available', reserved: 'Slot reserved', unavailable: 'Slot marked unavailable' } as Record<string, string>
  s = log(s, label[patch.status] ?? 'Slot updated', `Block ${slot.block} — Slot ${String(slot.number).padStart(2, '0')}`, patch.reason || patch.category)
  set(s)
  return true
}

export function addSlots(block: string, category: Category, count: number) {
  const b = block.trim().toUpperCase()
  const existing = state.slots.filter((x) => x.block === b)
  const start = existing.reduce((m, x) => Math.max(m, x.number), 0)
  const added: Slot[] = Array.from({ length: count }, (_, i) => {
    const n = start + i + 1
    return { id: `${b}${String(n).padStart(2, '0')}`, block: b, number: n, category, status: 'available', reason: 'Eligible for assignment' }
  })
  set(log({ ...state, slots: [...state.slots, ...added] }, existing.length ? 'Slots added' : 'Block added', `Block ${b}`, `${count} ${category} space${count === 1 ? '' : 's'}`))
  return added
}

export function saveRates(categories: Record<Category, Rate>, grace: number) {
  const base = state.rates.version.split('.r')[0]
  const rev = state.rates.history.filter((h) => h.version.startsWith(base)).length + 1
  const version = `${base}.r${rev}`
  const t = now()
  set(
    log(
      {
        ...state,
        rates: {
          ...state.rates,
          version,
          effective: t,
          grace,
          categories,
          history: [{ version, effective: t, by: 'City parking administrator' }, ...state.rates.history],
        },
      },
      'Rate version saved',
      version,
      'Applies to new sessions only',
    ),
  )
  return version
}

export function addAttendant(a: Omit<Attendant, 'id' | 'status'>) {
  const id = `ATT-${String(state.attendants.length + 1).padStart(3, '0')}`
  set(log({ ...state, attendants: [...state.attendants, { ...a, id, status: 'Pending' }] }, 'Attendant account created', a.name, `Exit attendant · ${a.lane}`))
}

export function updateAttendant(id: string, patch: Partial<Attendant>) {
  set({ ...state, attendants: state.attendants.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
}

export function updateSettings(patch: Partial<Settings>) {
  set({ ...state, settings: { ...state.settings, ...patch } })
}

export function resetDemo() {
  realStart = Date.now()
  localStorage.setItem(CLOCK_KEY, String(realStart))
  set(buildSeed())
}
