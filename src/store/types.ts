export type Category = 'Motorcycle' | 'Car' | 'Van' | 'Other'
export const CATEGORIES: Category[] = ['Motorcycle', 'Car', 'Van', 'Other']

export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'unavailable' | 'claimed'

export interface Slot {
  id: string // e.g. A02
  block: string
  number: number
  category: Category
  status: SlotStatus
  reason: string
  ticketId?: string
}

export interface Payment {
  amount: number
  method: 'Cash' | 'Digital'
  tender: number
  change: number
  attendant: string
  paidAt: number
  transactionId: string
}

export interface Session {
  ticketId: string
  category: Category
  slotId: string
  entry: number
  rateVersion: string
  rate: Rate
  grace: number
  status: 'active' | 'completed'
  exit?: number
  payment?: Payment
}

export interface Transaction {
  id: string
  ticketId: string
  category: Category
  slotId: string
  entry: number
  exit: number
  minutes: number
  amount: number
  method: 'Cash' | 'Digital'
  tender: number
  change: number
  attendant: string
}

export interface ActivityEvent {
  id: string
  at: number
  event: string
  ref: string
  result: string
}

export interface Rate {
  initial: number
  initialMin: number
  incrementMin: number
  additional: number
}

export interface RateConfig {
  version: string
  effective: number
  grace: number
  categories: Record<Category, Rate>
  history: { version: string; effective: number; by: string }[]
}

export type AttendantStatus = 'Active' | 'On break' | 'Offline' | 'Pending'

export interface Attendant {
  id: string
  name: string
  email: string
  lane: 'Lane A' | 'Lane B'
  status: AttendantStatus
  lastAccess?: number
}

export interface Checkout {
  ticketId: string
  openedAt: number
  exitAt: number
  terminal: string
  attendant: string
}

export interface KioskClaim {
  slotId: string
  ticketId: string
  category: Category
  at: number
}

export interface Settings {
  welcomeResetSec: number
  autoWelcome: boolean
  receiptPrinters: number
}

export interface State {
  slots: Slot[]
  sessions: Record<string, Session>
  transactions: Transaction[] // newest first
  activity: ActivityEvent[] // newest first
  rates: RateConfig
  attendants: Attendant[]
  nextTicket: number
  nextTxn: number
  checkout: Checkout | null
  lastCompleted: string | null
  lastIssued: string | null
  claim: KioskClaim | null
  settings: Settings
}
