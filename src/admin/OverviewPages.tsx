import { useMemo, useState } from 'react'
import { ParkingSquare, Search, Ticket, CircleAlert } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { ActivityTable, CheckoutPanel, FacilityMap, Overview, Stat, StatGrid } from './widgets'
import { Badge, Button, Card, CardHead, cx, Note, Rows, Select } from '../components/ui'
import { navigate } from '../lib/router'
import { quoteFor, useNow, useStore } from '../store/store'
import { blockLabel, blocks, computeStats, slotLabel } from '../store/logic'
import { CATEGORIES, type Category, type Slot, type SlotStatus } from '../store/types'
import { fmtDay, fmtDayShort, fmtDurationLong, fmtDurationShort, fmtLong, fmtPHP, fmtTime } from '../lib/format'

function LiveBadge() {
  const t = useNow()
  const checkout = useStore((s) => s.checkout)
  return checkout ? (
    <Badge tone="warn" className="py-2">
      Checkout open · {checkout.ticketId.slice(-4)}
    </Badge>
  ) : (
    <Badge tone="ok" className="py-2">
      Live snapshot · {fmtTime(t)}
    </Badge>
  )
}

export function DashboardPage() {
  const state = useStore((s) => s)
  const t = useNow()
  return (
    <AdminLayout active="dashboard" title="Parking operations overview" sub={`${fmtDay(t)} · ${fmtTime(t)} · ${state.checkout ? 'Checkout in progress' : 'Live facility snapshot'}`} right={<LiveBadge />}>
      <Overview state={state} />
      <div className="mt-5">
        <ActivityTable events={state.activity} />
      </div>
    </AdminLayout>
  )
}

export function ReportsPage() {
  const state = useStore((s) => s)
  const t = useNow()
  const stats = computeStats(state)
  const byCat = CATEGORIES.map((c) => {
    const txs = state.transactions.filter((x) => x.category === c)
    return {
      c,
      count: txs.length,
      revenue: txs.reduce((n, x) => n + x.amount, 0),
      avg: txs.length ? Math.round(txs.reduce((n, x) => n + x.minutes, 0) / txs.length) : 0,
    }
  })
  const maxRev = Math.max(...byCat.map((b) => b.revenue), 1)
  const byAtt = Object.entries(
    state.transactions.reduce<Record<string, { n: number; rev: number }>>((acc, x) => {
      acc[x.attendant] ??= { n: 0, rev: 0 }
      acc[x.attendant].n++
      acc[x.attendant].rev += x.amount
      return acc
    }, {}),
  ).sort((a, b) => b[1].rev - a[1].rev)
  const avgTicket = stats.exited ? stats.revenue / stats.exited : 0
  const exportCsv = () => {
    const rows = [['Category', 'Completed', 'Revenue (PHP)', 'Average minutes'], ...byCat.map((b) => [b.c, b.count, b.revenue, b.avg])]
    download(`nsp-report-${fmtDayShort(t).replace(/ /g, '-')}.csv`, rows)
  }
  return (
    <AdminLayout
      active="reports"
      title="Reports and analytics"
      sub={`${fmtDay(t)} · ${fmtTime(t)} · Daily operations report`}
      right={
        <div className="flex items-center gap-3">
          <LiveBadge />
          <Button variant="secondary" size="md" onClick={exportCsv}>
            Export report
          </Button>
        </div>
      }
    >
      <Overview state={state} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_320px]">
        <Card className="p-5">
          <CardHead title="Revenue by category" sub="Confirmed payments today" />
          <ul className="mt-5 space-y-4">
            {byCat.map((b) => (
              <li key={b.c}>
                <div className="flex justify-between text-[13px]">
                  <span>{b.c}</span>
                  <span className="tabular">{fmtPHP(b.revenue)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(b.revenue / maxRev) * 100}%` }} />
                </div>
                <div className="tabular mt-1.5 text-[11px] text-muted">
                  {b.count} sessions · avg {fmtDurationShort(b.avg)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <CardHead title="Attendant collections" sub="Exit lane payments today" />
          <table className="mt-5 w-full text-left text-[13px]">
            <thead className="text-[11px] text-muted">
              <tr>
                <th className="pb-3 font-normal">Attendant</th>
                <th className="pb-3 font-normal">Payments</th>
                <th className="pb-3 text-right font-normal">Collected</th>
              </tr>
            </thead>
            <tbody>
              {byAtt.map(([name, v]) => (
                <tr key={name} className="border-t border-line">
                  <td className="py-3.5">{name}</td>
                  <td className="tabular">{v.n}</td>
                  <td className="tabular text-right">{fmtPHP(v.rev)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="grid content-start gap-3">
          <Stat label="Average ticket" value={fmtPHP(Math.round(avgTicket))} note="Revenue ÷ completed sessions" />
          <Stat label="Payment mix" value={`${stats.cash} / ${stats.digital}`} note="Cash / digital confirmed" />
          <Stat label="Turnover" value={`${(stats.exited / stats.total).toFixed(1)}×`} note="Completed sessions per space" />
        </div>
      </div>
      <div className="mt-5">
        <ActivityTable events={state.activity} />
      </div>
    </AdminLayout>
  )
}

export function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/* ---------------- Map ---------------- */

export type Filters = { q: string; block: string; cat: 'all' | Category; status: 'all' | SlotStatus }
export function useSlotFilters() {
  const [f, setF] = useState<Filters>({ q: '', block: 'all', cat: 'all', status: 'all' })
  const test = (s: Slot) => {
    const q = f.q.trim().toUpperCase().replace(/\s|BLOCK|SLOT|—|-/g, '')
    if (q && !s.id.includes(q) && !(s.ticketId ?? '').includes(f.q.trim().toUpperCase())) return false
    if (f.block !== 'all' && s.block !== f.block) return false
    if (f.cat !== 'all' && s.category !== f.cat) return false
    if (f.status !== 'all' && s.status !== f.status) return false
    return true
  }
  return { f, setF, test, active: !!f.q || f.block !== 'all' || f.cat !== 'all' || f.status !== 'all' }
}

export function FilterBar({ f, setF, slots, placeholder }: { f: Filters; setF: (f: Filters) => void; slots: Slot[]; placeholder: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder={placeholder} className="h-11 w-full rounded-lg border border-line bg-white pr-3 pl-10 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/15" />
      </label>
      <Select label="Block" className="w-[140px]" value={f.block} onChange={(v) => setF({ ...f, block: v })} options={[{ value: 'all', label: 'All blocks' }, ...blocks(slots).map((b) => ({ value: b.id, label: `Block ${b.id}` }))]} />
      <Select label="Category" className="w-[160px]" value={f.cat} onChange={(v) => setF({ ...f, cat: v })} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
      <Select
        label="Status"
        className="w-[150px]"
        value={f.status}
        onChange={(v) => setF({ ...f, status: v })}
        options={[
          { value: 'all', label: 'All statuses' },
          { value: 'available', label: 'Available' },
          { value: 'occupied', label: 'Occupied' },
          { value: 'reserved', label: 'Reserved' },
          { value: 'unavailable', label: 'Unavailable' },
        ]}
      />
    </div>
  )
}

const STATUS_BADGE: Record<SlotStatus, { tone: 'ok' | 'bad' | 'warn' | 'neutral'; label: string }> = {
  available: { tone: 'ok', label: 'Available · Eligible' },
  occupied: { tone: 'bad', label: 'Occupied · Active session' },
  reserved: { tone: 'warn', label: 'Reserved · Excluded' },
  unavailable: { tone: 'neutral', label: 'Unavailable · Out of service' },
  claimed: { tone: 'warn', label: 'Claimed · Ticket issuing' },
}

export function MapPage({ params }: { params: URLSearchParams }) {
  const state = useStore((s) => s)
  const t = useNow()
  const [sel, setSel] = useState(params.get('slot') ?? 'A02')
  const { f, setF, test, active } = useSlotFilters()
  const slot = state.slots.find((s) => s.id === sel) ?? state.slots[0]
  const session = slot.ticketId ? state.sessions[slot.ticketId] : undefined
  const elapsed = session ? Math.floor((t - session.entry) / 60000) : 0
  const sb = STATUS_BADGE[slot.status]
  return (
    <AdminLayout
      active="map"
      title="Parking map"
      sub={`${state.slots.length} spaces across ${blocks(state.slots).length} blocks · ${fmtTime(t)}`}
      right={
        <Button variant="secondary" icon={ParkingSquare} onClick={() => navigate('/admin/slots')}>
          Manage spaces
        </Button>
      }
    >
      <FilterBar f={f} setF={setF} slots={state.slots} placeholder="Find block or slot, e.g. B07" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_330px]">
        <Card className="p-6">
          <CardHead title="Facility layout" sub={active ? `${state.slots.filter(test).length} spaces match the filters` : 'Select a bay to review its category, state and linked session.'} />
          <div className="mt-5">
            <FacilityMap slots={state.slots} selected={slot.id} onSelect={(s) => setSel(s.id)} dim={active ? (s) => !test(s) : undefined} />
          </div>
          <Note className="mt-6" title="Assignment eligibility">
            Only available spaces in the matching vehicle category can be claimed. Reserved and unavailable spaces are never assignable.
          </Note>
        </Card>
        <div className="space-y-5">
          <Card className="p-6">
            <CardHead title={slotLabel(slot)} />
            <Badge tone={sb.tone} className="mt-4 py-1.5">
              {sb.label}
            </Badge>
            <div className="tabular mt-6 text-[44px] leading-none text-brand">{slot.id}</div>
            <Rows
              labelWidth="w-[150px]"
              className="mt-7"
              rows={
                session
                  ? [
                      ['Category', slot.category],
                      ['Ticket ID', <span className="tabular">{session.ticketId}</span>],
                      ['Entry time', fmtLong(session.entry)],
                      ['Elapsed', fmtDurationLong(elapsed)],
                      ['Payment', state.checkout?.ticketId === session.ticketId ? 'Checkout open · unpaid' : 'Unpaid'],
                    ]
                  : [
                      ['Category', slot.category],
                      ['Status', slot.status[0].toUpperCase() + slot.status.slice(1)],
                      ['Reason', slot.reason || '—'],
                      ['Self-service', slot.status === 'available' ? 'Assignable' : 'Excluded'],
                    ]
              }
            />
            {session && (
              <Button icon={Ticket} className="mt-6 w-full" onClick={() => navigate(`/admin/sessions?ticket=${session.ticketId}`)}>
                View active session
              </Button>
            )}
            <Button variant="secondary" className={cx('w-full', session ? 'mt-5' : 'mt-6')} onClick={() => navigate(`/admin/slots/${slot.id}`)}>
              Edit slot settings
            </Button>
          </Card>
          {slot.status === 'occupied' && (
            <Note tone="warn" icon={CircleAlert} title="Active-session lock">
              An occupied bay cannot be freed or recategorized manually. Complete its session through confirmed exit payment.
            </Note>
          )}
        </div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {blocks(state.slots).map((b) => {
          const c = (st: SlotStatus) => b.slots.filter((s) => s.status === st).length
          return (
            <Card key={b.id} className="p-6">
              <div className="text-lg">Block {b.id}</div>
              <div className="mt-5 text-[15px]">
                {b.slots.length} spaces · {blockLabel(b.slots)}
              </div>
              <div className="tabular mt-4 text-[13px] text-muted">
                {c('occupied') + c('claimed')} occupied / {c('available')} available / {c('reserved')} reserved / {c('unavailable')} unavailable
              </div>
            </Card>
          )
        })}
      </div>
    </AdminLayout>
  )
}

/* ---------------- Active sessions ---------------- */

export function SessionsPage({ params }: { params: URLSearchParams }) {
  const state = useStore((s) => s)
  const t = useNow()
  const stats = computeStats(state)
  const focus = params.get('ticket')
  const [q, setQ] = useState(focus ?? '')
  const [cat, setCat] = useState<'all' | Category>('all')
  const [stat, setStat] = useState<'all' | 'open' | 'parked'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const rows = useMemo(
    () =>
      Object.values(state.sessions)
        .filter((s) => s.status === 'active')
        .filter((s) => !q.trim() || s.ticketId.includes(q.trim().toUpperCase()) || s.slotId.includes(q.trim().toUpperCase()))
        .filter((s) => cat === 'all' || s.category === cat)
        .filter((s) => stat === 'all' || (stat === 'open') === (state.checkout?.ticketId === s.ticketId))
        .sort((a, b) => (sort === 'newest' ? b.entry - a.entry : a.entry - b.entry)),
    [state, q, cat, stat, sort],
  )
  return (
    <AdminLayout active="sessions" title="Active parking sessions" sub={`${fmtDay(t)} · ${fmtTime(t)} · Issued tickets not yet completed`} right={<LiveBadge />}>
      <StatGrid stats={stats} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_264px]">
        <Card className="min-w-0 p-5">
          <CardHead title="Active sessions" sub={`${stats.active} active sessions · elapsed time and fee accrue live`} />
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticket ID or slot" className="h-11 w-full rounded-lg border border-line bg-white pr-3 pl-10 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/15" />
            </label>
            <Select label="Category" className="w-[160px]" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <Select
              label="Status"
              className="w-[170px]"
              value={stat}
              onChange={setStat}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'parked', label: 'Parked' },
                { value: 'open', label: 'Checkout open' },
              ]}
            />
            <Select
              label="Sort"
              className="w-[160px]"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'newest', label: 'Newest entry' },
                { value: 'oldest', label: 'Longest parked' },
              ]}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{stats.active} active</Badge>
            <Badge tone="ok">{stats.available} available</Badge>
            <Badge tone="warn">{stats.reserved} reserved</Badge>
            <Badge tone="neutral">{stats.unavailable} unavailable</Badge>
          </div>
          <div className="mt-5 max-h-[620px] overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[880px] text-left text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="sticky top-0 bg-canvas text-[11px] text-muted">
                <tr>
                  {['Ticket ID', 'Vehicle category', 'Assigned parking slot', 'Entry date & time', 'Elapsed', 'Fee so far', 'Session status'].map((h) => (
                    <th key={h} className="px-3 py-3.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const quote = quoteFor(s, t)
                  const open = state.checkout?.ticketId === s.ticketId
                  const slot = state.slots.find((x) => x.id === s.slotId)!
                  return (
                    <tr key={s.ticketId} className={cx('border-t border-line bg-white', s.ticketId === focus && 'bg-brand-50/60')}>
                      <td className="tabular px-3 py-4">{s.ticketId}</td>
                      <td className="px-3">{s.category}</td>
                      <td className="px-3">
                        <button className="cursor-pointer text-brand hover:underline" onClick={() => navigate(`/admin/map?slot=${s.slotId}`)}>
                          {slotLabel(slot)}
                        </button>
                      </td>
                      <td className="tabular px-3">
                        {fmtDayShort(s.entry)} · {fmtTime(s.entry)}
                      </td>
                      <td className="tabular px-3">{fmtDurationShort(quote.minutes)}</td>
                      <td className="tabular px-3">{fmtPHP(quote.total)}</td>
                      <td className="px-3">
                        <Badge tone={open ? 'brand' : 'warn'} className="w-[120px]">
                          {open ? 'Checkout open' : 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted">
                      No active sessions match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted">Showing {rows.length} of {stats.active} active sessions · Fees are previews; the exit terminal freezes the exit time at scan.</p>
        </Card>
        <div className="grid content-start gap-5">
          <CheckoutPanel />
          <Card className="p-5">
            <CardHead title="Session rules" />
            <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
              <li>One ticket, one session, one occupied bay.</li>
              <li>Sessions close only through confirmed exit payment.</li>
              <li>Rate version is frozen at entry for each session.</li>
            </ul>
          </Card>
        </div>
      </div>
      <Card className="mt-5 p-5">
        <CardHead title="Facility parking map" sub="Occupied bays are linked to the sessions above" />
        <div className="mt-5">
          <FacilityMap slots={state.slots} onSelect={(s) => navigate(`/admin/map?slot=${s.id}`)} />
        </div>
      </Card>
    </AdminLayout>
  )
}
