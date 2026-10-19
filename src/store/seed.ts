import type { ActivityEvent, Attendant, Category, RateConfig, Session, Slot, State, Transaction } from './types'
import { CATEGORIES as CATS } from './types'
import { at, calcFee, DAY_START, slotShort, ticketId, txnId } from './logic'
import { fmtPHP } from '../lib/format'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const RATES: RateConfig = {
  version: 'v2026.10.16',
  effective: DAY_START,
  grace: 0,
  categories: {
    Motorcycle: { initial: 20, initialMin: 60, incrementMin: 60, additional: 10 },
    Car: { initial: 40, initialMin: 60, incrementMin: 60, additional: 20 },
    Van: { initial: 50, initialMin: 60, incrementMin: 60, additional: 25 },
    Other: { initial: 60, initialMin: 60, incrementMin: 60, additional: 30 },
  },
  history: [
    { version: 'v2026.10.16', effective: DAY_START, by: 'City parking administrator' },
    { version: 'v2026.09.01', effective: DAY_START - 45 * 86400000, by: 'City parking administrator' },
  ],
}

function buildSlots(): Slot[] {
  const slots: Slot[] = []
  const add = (block: string, n: number, category: Category) =>
    slots.push({ id: `${block}${String(n).padStart(2, '0')}`, block, number: n, category, status: 'available', reason: 'Eligible for assignment' })
  for (let n = 1; n <= 20; n++) add('A', n, 'Motorcycle')
  for (let n = 1; n <= 20; n++) add('B', n, 'Car')
  for (let n = 1; n <= 20; n++) add('C', n, n <= 10 ? 'Van' : 'Other')
  return slots
}

const ATTENDANTS: Attendant[] = [
  { id: 'ATT-001', name: 'Maria Santos', email: 'maria.santos@nsp.gov', lane: 'Lane A', status: 'Active', lastAccess: at(22, 15) },
  { id: 'ATT-002', name: 'Joel Reyes', email: 'joel.reyes@nsp.gov', lane: 'Lane B', status: 'On break', lastAccess: at(21, 58) },
  { id: 'ATT-003', name: 'Ana Cruz', email: 'ana.cruz@nsp.gov', lane: 'Lane A', status: 'Offline', lastAccess: at(20, 42) },
  { id: 'ATT-004', name: 'Mark Dela Cruz', email: 'mark.dela.cruz@nsp.gov', lane: 'Lane B', status: 'Pending' },
]

export function buildSeed(): State {
  const rand = rng(20261016)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const slots = buildSlots()
  const byId = new Map(slots.map((s) => [s.id, s]))
  const sessions: Record<string, Session> = {}
  const rate = (c: Category) => RATES.categories[c]

  const mkSession = (n: number, slotId: string, entry: number): Session => {
    const slot = byId.get(slotId)!
    const s: Session = {
      ticketId: ticketId(n),
      category: slot.category,
      slotId,
      entry,
      rateVersion: RATES.version,
      rate: rate(slot.category),
      grace: RATES.grace,
      status: 'active',
    }
    sessions[s.ticketId] = s
    return s
  }

  // Slot states mirror the 10:15 PM "before payment" facility snapshot.
  const occupiedIds = [
    ...Array.from({ length: 12 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 14 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 11 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
  ]
  byId.get('A13')!.status = 'reserved'
  byId.get('A13')!.reason = 'Facility service hold'
  byId.get('B15')!.status = 'reserved'
  byId.get('B15')!.reason = 'Authorized facility hold'
  byId.get('C12')!.status = 'unavailable'
  byId.get('C12')!.reason = 'Surface maintenance'

  const fixedActive: Record<string, { n: number; entry: number }> = {
    A02: { n: 1, entry: at(20, 30) },
    A01: { n: 21, entry: at(18, 4) },
    B01: { n: 42, entry: at(19, 12) },
    C10: { n: 57, entry: at(19, 48) },
    C11: { n: 71, entry: at(20, 6) },
  }
  const fixedCompleted = [7, 8, 12]
  const used = new Set<number>([...Object.values(fixedActive).map((f) => f.n), ...fixedCompleted])
  const pool = Array.from({ length: 126 }, (_, i) => i + 1).filter((n) => !used.has(n))

  for (const id of occupiedIds) {
    const slot = byId.get(id)!
    let n: number
    let entry: number
    if (fixedActive[id]) {
      n = fixedActive[id].n
      entry = fixedActive[id].entry
    } else {
      n = pool.splice(Math.floor(rand() * pool.length), 1)[0]
      entry = at(15, 0) + Math.floor(rand() * 430) * 60000
    }
    const s = mkSession(n, id, entry)
    slot.status = 'occupied'
    slot.ticketId = s.ticketId
    slot.reason = 'Active-session lock'
  }

  // Completed (paid) sessions for earlier in the day.
  const names = ['Maria Santos', 'Joel Reyes', 'Ana Cruz']
  const completedRaw: { n: number; slotId: string; entry: number; exit: number; method: 'Cash' | 'Digital'; attendant: string }[] = [
    { n: 7, slotId: 'A05', entry: at(20, 15), exit: at(22, 1), method: 'Cash', attendant: 'Maria Santos' },
    { n: 12, slotId: 'C04', entry: at(21, 0), exit: at(22, 6), method: 'Digital', attendant: 'Joel Reyes' },
    { n: 8, slotId: 'B08', entry: at(20, 42), exit: at(22, 12), method: 'Cash', attendant: 'Joel Reyes' },
  ]
  const catWeights: [Category, number][] = [['Motorcycle', 0.36], ['Car', 0.4], ['Van', 0.12], ['Other', 0.12]]
  pool.forEach((n, i) => {
    const r = rand()
    let acc = 0
    let cat: Category = 'Car'
    for (const [c, w] of catWeights) {
      acc += w
      if (r <= acc) {
        cat = c
        break
      }
    }
    const candidates = slots.filter((s) => s.category === cat)
    const entry = at(8, 0) + Math.floor(rand() * 720) * 60000
    const dur = 18 + Math.floor(rand() * 190)
    const exit = Math.min(entry + dur * 60000, at(21, 55))
    completedRaw.push({
      n,
      slotId: pick(candidates).id,
      entry,
      exit: Math.max(exit, entry + 12 * 60000),
      method: i % 13 < 7 ? 'Digital' : 'Cash',
      attendant: pick(names),
    })
  })

  // Lengthen some earlier stays so today's confirmed revenue matches the PHP 8,950 design snapshot.
  const REVENUE_TARGET = 8950
  const feeOf = (c: (typeof completedRaw)[number]) => calcFee(rate(byId.get(c.slotId)!.category), Math.floor((c.exit - c.entry) / 60000)).total
  const extendable = completedRaw.slice(3)
  const addHour = (cat: Category) => {
    const c = extendable.find((x) => byId.get(x.slotId)!.category === cat && x.entry - 60 * 60000 >= at(6, 0))
    if (c) c.entry -= 60 * 60000
    return !!c
  }
  const dropHour = (cat: Category) => {
    const c = extendable.find((x) => byId.get(x.slotId)!.category === cat && x.exit - x.entry > 125 * 60000)
    if (c) c.entry += 60 * 60000
    return !!c
  }
  let guard = 0
  let remaining = REVENUE_TARGET - completedRaw.reduce((n, c) => n + feeOf(c), 0)
  while (remaining > 0 && guard++ < 2000) {
    const order: Category[] = remaining >= 30 ? [pick(CATS), 'Car', 'Motorcycle'] : remaining >= 25 && remaining !== 30 ? ['Van'] : remaining >= 20 ? ['Car', 'Motorcycle'] : ['Motorcycle']
    if (remaining === 5) {
      addHour('Van')
      dropHour('Car')
    } else if (remaining === 15) {
      addHour('Van')
      dropHour('Motorcycle')
    } else {
      // Rotate start point so extensions spread across the day.
      extendable.push(extendable.shift()!)
      order.some((c) => addHour(c))
    }
    remaining = REVENUE_TARGET - completedRaw.reduce((n, c) => n + feeOf(c), 0)
  }

  completedRaw.sort((a, b) => a.exit - b.exit)
  const transactions: Transaction[] = completedRaw.map((c, i) => {
    const slot = byId.get(c.slotId)!
    const minutes = Math.floor((c.exit - c.entry) / 60000)
    const amount = calcFee(rate(slot.category), minutes).total
    const tender = c.method === 'Cash' ? Math.ceil(amount / 50) * 50 + (rand() < 0.35 ? 50 : 0) : amount
    const t: Transaction = {
      id: txnId(i + 1),
      ticketId: ticketId(c.n),
      category: slot.category,
      slotId: c.slotId,
      entry: c.entry,
      exit: c.exit,
      minutes,
      amount,
      method: c.method,
      tender,
      change: tender - amount,
      attendant: c.attendant,
    }
    sessions[t.ticketId] = {
      ticketId: t.ticketId,
      category: t.category,
      slotId: t.slotId,
      entry: t.entry,
      exit: t.exit,
      rateVersion: RATES.version,
      rate: rate(t.category),
      grace: 0,
      status: 'completed',
      payment: { amount, method: c.method, tender, change: t.change, attendant: c.attendant, paidAt: c.exit, transactionId: t.id },
    }
    return t
  })
  transactions.reverse()

  const activity: ActivityEvent[] = []
  transactions.slice(0, 8).forEach((t) =>
    activity.push({
      id: `ev-${t.id}`,
      at: t.exit,
      event: t.method === 'Cash' ? 'Parking session completed' : 'Digital payment confirmed',
      ref: t.ticketId,
      result: `${fmtPHP(t.amount)} · ${t.slotId} released`,
    }),
  )
  activity.push({ id: 'ev-c12', at: at(22, 8), event: 'Slot marked unavailable', ref: 'Block C — Slot 12', result: 'Maintenance · no assignment' })
  Object.values(sessions)
    .filter((s) => s.status === 'active' && s.entry > at(21, 20))
    .forEach((s) => {
      const slot = byId.get(s.slotId)!
      activity.push({ id: `ev-in-${s.ticketId}`, at: s.entry, event: 'Ticket issued', ref: s.ticketId, result: `${s.category} · ${slotShort(slot)} occupied` })
    })
  activity.sort((a, b) => b.at - a.at)

  return {
    slots,
    sessions,
    transactions,
    activity,
    rates: RATES,
    attendants: ATTENDANTS,
    nextTicket: 127,
    nextTxn: transactions.length + 1,
    checkout: null,
    lastCompleted: null,
    lastIssued: null,
    claim: null,
    settings: { welcomeResetSec: 15, autoWelcome: true, receiptPrinters: 2 },
  }
}
