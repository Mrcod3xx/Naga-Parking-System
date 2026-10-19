import { useMemo, useState } from 'react'
import { Download, FileText, Printer, Search } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { download } from './OverviewPages'
import { ActivityTable, Stat } from './widgets'
import { Badge, Button, Card, CardHead, cx, Rows, Select, toast } from '../components/ui'
import { useNow, useStore } from '../store/store'
import { computeStats, slotLabel, parseSlotId } from '../store/logic'
import { CATEGORIES, type Category } from '../store/types'
import { fmtDay, fmtDayShort, fmtDurationShort, fmtPHP, fmtTime } from '../lib/format'

const PAGE = 10

export default function TransactionsPage({ params }: { params: URLSearchParams }) {
  const state = useStore((s) => s)
  const t = useNow()
  const stats = computeStats(state)
  const focus = params.get('ticket')
  const [q, setQ] = useState(focus ?? '')
  const [cat, setCat] = useState<'all' | Category>('all')
  const [method, setMethod] = useState<'all' | 'Cash' | 'Digital'>('all')
  const [att, setAtt] = useState('all')
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<string | null>(focus ? (state.transactions.find((x) => x.ticketId === focus)?.id ?? null) : null)
  const attendants = [...new Set(state.transactions.map((x) => x.attendant))]
  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase()
    return state.transactions.filter(
      (x) => (!needle || x.ticketId.includes(needle) || x.id.includes(needle)) && (cat === 'all' || x.category === cat) && (method === 'all' || x.method === method) && (att === 'all' || x.attendant === att),
    )
  }, [state.transactions, q, cat, method, att])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const p = Math.min(page, pages - 1)
  const view = rows.slice(p * PAGE, p * PAGE + PAGE)
  const tx = state.transactions.find((x) => x.id === sel) ?? rows[0] ?? state.transactions[0]
  const reset = () => setPage(0)

  const exportCsv = () => {
    download(`nsp-transactions-${fmtDayShort(t).replace(/ /g, '-')}.csv`, [
      ['Transaction ID', 'Ticket ID', 'Category', 'Slot', 'Entry', 'Exit', 'Minutes', 'Amount (PHP)', 'Method', 'Tender', 'Change', 'Attendant'],
      ...rows.map((x) => [x.id, x.ticketId, x.category, x.slotId, fmtTime(x.entry), fmtTime(x.exit), x.minutes, x.amount, x.method, x.tender, x.change, x.attendant]),
    ])
    toast(`Exported ${rows.length} transactions`, 'ok')
  }

  return (
    <AdminLayout active="transactions" title="Transaction history" sub={`${fmtDay(t)} · ${fmtTime(t)} · Completed paid tickets only`} right={<Badge tone="ok" className="py-2">{stats.exited} completed today</Badge>}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Completed today" value={stats.exited} note={fmtDay(t)} />
        <Stat label="Revenue today" value={fmtPHP(stats.revenue)} tone="ok" note="Cash + digital" />
        <Stat label="Cash paid" value={stats.cash} note={`${Math.round((stats.cash / Math.max(1, stats.exited)) * 100)}% of completed`} />
        <Stat label="Digital paid" value={stats.digital} tone="ok" note={`${Math.round((stats.digital / Math.max(1, stats.exited)) * 100)}% of completed`} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="h-fit min-w-0 p-5">
          <CardHead title="Completed transactions" sub="Search by ticket or transaction ID. Completed paid tickets cannot be charged twice." />
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  reset()
                }}
                placeholder="Search ticket / transaction ID"
                className="h-11 w-full rounded-lg border border-line bg-white pr-3 pl-10 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/15"
              />
            </label>
            <Select label="Category" className="w-[150px]" value={cat} onChange={(v) => (setCat(v), reset())} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            <Select label="Method" className="w-[140px]" value={method} onChange={(v) => (setMethod(v), reset())} options={[{ value: 'all', label: 'All methods' }, { value: 'Cash', label: 'Cash' }, { value: 'Digital', label: 'Digital' }]} />
            <Select label="Attendant" className="w-[160px]" value={att} onChange={(v) => (setAtt(v), reset())} options={[{ value: 'all', label: 'All attendants' }, ...attendants.map((a) => ({ value: a, label: a }))]} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">{rows.length} completed transactions</span>
            <div className="flex gap-2.5">
              <Button variant="secondary" size="md" icon={Download} onClick={exportCsv}>
                Export CSV
              </Button>
              <Button size="md" icon={Download} onClick={() => window.print()}>
                Export PDF
              </Button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[860px] text-left text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="bg-canvas text-[11px] text-muted">
                <tr>
                  {['Ticket ID', 'Vehicle category', 'Entry time', 'Exit time', 'Duration', 'Amount paid', 'Payment status', 'Attendant'].map((h) => (
                    <th key={h} className="px-3 py-3.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.map((x) => (
                  <tr key={x.id} onClick={() => setSel(x.id)} className={cx('cursor-pointer border-t border-line transition hover:bg-canvas', tx?.id === x.id && 'bg-brand-50/60 hover:bg-brand-50/60')}>
                    <td className="tabular px-3 py-4">{x.ticketId}</td>
                    <td className="px-3">{x.category}</td>
                    <td className="tabular px-3">{fmtTime(x.entry)}</td>
                    <td className="tabular px-3">{fmtTime(x.exit)}</td>
                    <td className="tabular px-3">{fmtDurationShort(x.minutes)}</td>
                    <td className="tabular px-3">{fmtPHP(x.amount)}</td>
                    <td className="px-3">
                      <Badge tone="ok">Paid · {x.method}</Badge>
                    </td>
                    <td className="px-3">{x.attendant}</td>
                  </tr>
                ))}
                {!view.length && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-muted">
                      No transactions match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>
              Page {p + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={p === 0} onClick={() => setPage(p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
        {tx && (
          <Card className="h-fit min-w-0 p-5">
            <CardHead title="Transaction detail" sub={tx.id === state.transactions[0]?.id ? 'Most recent completed transaction' : 'Selected completed transaction'} />
            <Badge tone="ok" className="mt-4 py-1.5">
              Paid · Completed
            </Badge>
            <Rows
              size="sm"
              labelWidth="w-[112px]"
              className="mt-5"
              rows={[
                ['Ticket ID', <span className="tabular">{tx.ticketId}</span>],
                ['Transaction ID', <span className="tabular break-all">{tx.id}</span>],
                ['Vehicle category', tx.category],
                ['Entry time', `${fmtDayShort(tx.entry)} · ${fmtTime(tx.entry)}`],
                ['Exit time', `${fmtDayShort(tx.exit)} · ${fmtTime(tx.exit)}`],
                ['Total duration', fmtDurationShort(tx.minutes)],
                ['Amount paid', fmtPHP(tx.amount, true)],
                ['Payment method', tx.method],
                ['Tender', fmtPHP(tx.tender)],
                ['Change', fmtPHP(tx.change)],
                ['Attendant', tx.attendant],
                ['Slot', slotLabel(parseSlotId(tx.slotId))],
                ['Status', 'Paid · Completed · Slot released'],
              ]}
            />
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" size="sm" icon={Printer} className="min-w-0 flex-1" onClick={() => toast(`Reprinted receipt ${tx.id.slice(-4)} · no new charge`)}>
                Reprint
              </Button>
              <Button variant="soft" size="sm" icon={FileText} className="min-w-0 flex-1" onClick={() => (window.location.hash = `/exit/paid/${tx.ticketId}`)}>
                View record
              </Button>
            </div>
            <div className="mt-5 rounded-xl border border-line bg-canvas p-3">
              <div className="text-[13px]">Receipt preview</div>
              <div className="mt-3 space-y-1.5 rounded-lg border border-line bg-white p-3 text-[10px] text-muted">
                <div className="text-ink">Naga Smart Park</div>
                <div>
                  {fmtDayShort(tx.exit)} · {fmtTime(tx.exit)}
                </div>
                {[
                  ['Ticket ID', tx.ticketId],
                  ['Transaction', tx.id.slice(-9)],
                  ['Slot', tx.slotId],
                  ['Entry', fmtTime(tx.entry)],
                  ['Exit', fmtTime(tx.exit)],
                  ['Duration', fmtDurationShort(tx.minutes)],
                  ['Amount paid', fmtPHP(tx.amount, true)],
                  ['Payment method', tx.method],
                  ['Attendant', tx.attendant],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span>{k}</span>
                    <span className="tabular text-ink">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="text-ok">Paid · Completed</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
      <div className="mt-5">
        <ActivityTable events={state.activity} />
      </div>
    </AdminLayout>
  )
}
