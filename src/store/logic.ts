import type { Category, Rate, RateConfig, Slot, State } from './types'
import { pad2 } from '../lib/format'

/** 16 October 2026, 10:15 PM Asia/Manila (UTC+8). */
export const DEMO_START = Date.UTC(2026, 9, 16, 14, 15, 0)
/** Midnight of the demo day in Asia/Manila. */
export const DAY_START = Date.UTC(2026, 9, 15, 16, 0, 0)
export const at = (h: number, m: number) => DAY_START + (h * 60 + m) * 60000

export const DATE_CODE = '20261016'
export const ticketId = (n: number) => `NSP-${DATE_CODE}-${String(n).padStart(4, '0')}`
export const txnId = (n: number) => `NSP-TXN-${DATE_CODE}-${String(n).padStart(4, '0')}`
export const TOTAL_TODAY_TARGET = 126

export function calcFee(rate: Rate, minutes: number, grace = 0) {
  const extraMin = Math.max(0, minutes - rate.initialMin - grace)
  const increments = extraMin > 0 ? Math.ceil(extraMin / rate.incrementMin) : 0
  return {
    initial: rate.initial,
    extraMin,
    increments,
    additional: increments * rate.additional,
    total: rate.initial + increments * rate.additional,
  }
}

export function feeFor(rates: RateConfig, category: Category, minutes: number) {
  return calcFee(rates.categories[category], minutes, rates.grace)
}

export const slotLabel = (s: Pick<Slot, 'block' | 'number'>) => `Block ${s.block} — Slot ${pad2(s.number)}`
export const slotShort = (s: Pick<Slot, 'block' | 'number'>) => `${s.block}${pad2(s.number)}`

export function parseSlotId(id: string) {
  return { block: id.slice(0, 1), number: parseInt(id.slice(1), 10) }
}

export function blocks(slots: Slot[]) {
  const map = new Map<string, Slot[]>()
  for (const s of slots) {
    if (!map.has(s.block)) map.set(s.block, [])
    map.get(s.block)!.push(s)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, list]) => ({ id, slots: list.sort((a, b) => a.number - b.number) }))
}

/** "Motorcycle" or "Van 01–10 / Other 11–20" */
export function blockLabel(list: Slot[]) {
  const runs: { cat: Category; from: number; to: number }[] = []
  for (const s of list) {
    const last = runs[runs.length - 1]
    if (last && last.cat === s.category) last.to = s.number
    else runs.push({ cat: s.category, from: s.number, to: s.number })
  }
  if (runs.length === 1) return runs[0].cat
  return runs.map((r) => `${r.cat} ${pad2(r.from)}–${pad2(r.to)}`).join(' / ')
}

/** Where a category lives, e.g. "Block A" or "Block C · 01–10". */
export function categoryLocation(slots: Slot[], cat: Category) {
  const parts: string[] = []
  for (const b of blocks(slots)) {
    const mine = b.slots.filter((s) => s.category === cat)
    if (!mine.length) continue
    if (mine.length === b.slots.length) parts.push(`Block ${b.id}`)
    else parts.push(`Block ${b.id} · ${pad2(mine[0].number)}–${pad2(mine[mine.length - 1].number)}`)
  }
  return parts.join(', ') || 'Not configured'
}

export function counts(slots: Slot[]) {
  const c = { total: slots.length, available: 0, occupied: 0, reserved: 0, unavailable: 0, claimed: 0 }
  for (const s of slots) c[s.status]++
  return c
}

export function computeStats(state: State) {
  const c = counts(state.slots)
  const sessions = Object.values(state.sessions)
  const active = sessions.filter((s) => s.status === 'active').length
  const revenue = state.transactions.reduce((sum, t) => sum + t.amount, 0)
  const cash = state.transactions.filter((t) => t.method === 'Cash').length
  return {
    ...c,
    occupancy: c.total ? ((c.occupied + c.claimed) / c.total) * 100 : 0,
    active,
    entered: sessions.length,
    exited: state.transactions.length,
    revenue,
    cash,
    digital: state.transactions.length - cash,
    blockCount: blocks(state.slots).length,
  }
}

const GUIDE: Record<string, string> = {
  A: 'turn left into Block A',
  B: 'continue straight to Block B',
  C: 'turn right into Block C',
}
export function directions(slot: Slot) {
  const way = GUIDE[slot.block] ?? `follow signs to Block ${slot.block}`
  return { way, bay: slot.number }
}

export function normalizeTicket(input: string) {
  const v = input.trim().toUpperCase()
  if (/^\d{1,4}$/.test(v)) return ticketId(parseInt(v, 10))
  return v
}

export const minutesOf = (entry: number, exit: number) => Math.max(0, Math.floor((exit - entry) / 60000))
