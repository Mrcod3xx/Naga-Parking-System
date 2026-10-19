import { useState, type ReactNode } from 'react'
import { Bell, ChartNoAxesCombined, History, LayoutDashboard, Map, Menu, ParkingSquare, CircleDollarSign, Settings, Ticket, Users, X } from 'lucide-react'
import { Badge, cx, Logo } from '../components/ui'
import { navigate } from '../lib/router'
import { useNow, useStore } from '../store/store'
import { fmtDayShort, fmtTime } from '../lib/format'
import { blocks } from '../store/logic'

export const ADMIN_NAV = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { key: 'map', label: 'Parking Map', href: '/admin/map', icon: Map },
  { key: 'slots', label: 'Parking Slot Management', href: '/admin/slots', icon: ParkingSquare },
  { key: 'sessions', label: 'Active Parking Sessions', href: '/admin/sessions', icon: Ticket },
  { key: 'rates', label: 'Parking Rates', href: '/admin/rates', icon: CircleDollarSign },
  { key: 'transactions', label: 'Transaction History', href: '/admin/transactions', icon: History },
  { key: 'reports', label: 'Reports and Analytics', href: '/admin/reports', icon: ChartNoAxesCombined },
  { key: 'attendants', label: 'Attendant Accounts', href: '/admin/attendants', icon: Users },
  { key: 'settings', label: 'Settings', href: '/admin/settings', icon: Settings },
] as const

export type AdminKey = (typeof ADMIN_NAV)[number]['key']

export default function AdminLayout({ active, title, sub, right, crumb = 'Parking operations', children }: { active: AdminKey; title: ReactNode; sub: ReactNode; right?: ReactNode; crumb?: string; children: ReactNode }) {
  const t = useNow()
  const [open, setOpen] = useState(false)
  const slots = useStore((s) => s.slots)
  const blockCount = blocks(slots).length
  return (
    <div className="flex min-h-screen bg-canvas">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col overflow-y-auto bg-navy px-[18px] pt-[34px] pb-6 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div>
            <div className="text-lg leading-tight">Naga Smart Park</div>
            <div className="text-[11px] tracking-[0.02em] text-slate-300 uppercase">Naga City People's Mall</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-8 mb-2.5 text-[11px] tracking-[0.04em] text-slate-400 uppercase">Administration</div>
        <nav className="space-y-1">
          {ADMIN_NAV.map(({ key, label, href, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setOpen(false)
                navigate(href)
              }}
              className={cx(
                'flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[13px] whitespace-nowrap transition',
                active === key ? 'bg-brand text-white' : 'text-slate-200 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={1.6} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-10 rounded-xl bg-navy-700 px-4 py-5">
          <div className="text-xs tracking-[0.04em] text-slate-300 uppercase">Facility</div>
          <div className="mt-3 text-sm">People's Mall</div>
          <div className="mt-3 text-xs text-slate-300">
            {slots.length} spaces · {blockCount} blocks
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs text-brand">
            <span className="size-1.5 rounded-full bg-brand" />
            Demo workspace
          </span>
        </div>
        <div className="mt-9">
          <div className="text-sm">City parking administrator</div>
          <div className="mt-1.5 text-xs text-slate-300">Authorized management access</div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 border-b border-line/60 bg-white/95 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="grid size-9 place-items-center rounded-md hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <span className="text-[13px] text-muted">Naga City / {crumb}</span>
          </div>
          <div className="flex items-center gap-5">
            <Badge tone="neutral" upper className="hidden py-1.5 md:inline-flex">
              Demo data
            </Badge>
            <span className="tabular hidden text-[13px] sm:block">
              {fmtDayShort(t)} · {fmtTime(t)} PHT
            </span>
            <Bell className="size-5 text-muted" strokeWidth={1.6} />
            <div className="grid size-9 place-items-center rounded-full bg-brand-50 text-xs text-brand">AD</div>
          </div>
        </header>
        <main className="px-5 pt-10 pb-8 lg:px-8">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[30px] leading-tight tracking-[-0.01em]">{title}</h1>
              <p className="mt-2 text-sm text-muted">{sub}</p>
            </div>
            {right}
          </div>
          <div className="animate-fade-up">{children}</div>
          <footer className="mt-8 flex justify-between text-[11px] text-muted">
            <span>Naga Smart Park · Civic parking operations</span>
            <span>Demo workspace · Asia/Manila</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
