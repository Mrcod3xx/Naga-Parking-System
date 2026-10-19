import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Archive,
  Banknote,
  BadgeCheck,
  Check,
  CircleAlert,
  CircleCheck,
  CopyCheck,
  History,
  Lock,
  Printer,
  ReceiptText,
  ScanLine,
  Search,
  ShieldCheck,
} from 'lucide-react'
import ExitLayout from './ExitLayout'
import { Badge, Button, Card, CardHead, cx, IconCircle, Input, Note, Rows, toast } from '../components/ui'
import { match, navigate } from '../lib/router'
import { cancelCheckout, completePayment, getState, lookupTicket, OPERATOR, quoteFor, useNow, useStore } from '../store/store'
import { computeStats, slotLabel, ticketId } from '../store/logic'
import type { Session } from '../store/types'
import { fmtDurationLong, fmtLong, fmtPHP, fmtTime } from '../lib/format'

/* ---------- routing ---------- */

export default function Exit({ path }: { path: string }) {
  const sessions = useStore((s) => s.sessions)
  const checkout = useStore((s) => s.checkout)
  const route = (p: string) => match(p, path)

  let m: Record<string, string> | null
  if ((m = route('/exit/invalid/:id'))) return <Invalid id={m.id} />
  if ((m = route('/exit/:step/:id'))) {
    const session = sessions[m.id]
    if (!session) return <Invalid id={m.id} />
    const step = m.step
    if (step === 'receipt') return session.status === 'completed' ? <Receipt session={session} /> : <Redirect to={`/exit/fee/${session.ticketId}`} />
    if (step === 'paid') return session.status === 'completed' ? <AlreadyPaid session={session} /> : <Redirect to="/exit" />
    if (step === 'closed') return <Closed session={session} />
    if (session.status === 'completed') return <Closed session={session} />
    if (!checkout || checkout.ticketId !== session.ticketId) return <NoCheckout session={session} />
    if (step === 'session') return <Found session={session} />
    if (step === 'fee') return <Fee session={session} />
    if (step === 'payment') return <Payment session={session} />
    if (step === 'duplicate') return <Duplicate session={session} />
  }
  return <Dashboard />
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to), [to])
  return null
}

function scan(query: string) {
  const r = lookupTicket(query)
  const to = { invalid: `/exit/invalid/${encodeURIComponent(r.id || 'blank')}`, paid: `/exit/paid/${r.id}`, duplicate: `/exit/duplicate/${r.id}`, found: `/exit/session/${r.id}` }[r.kind]
  navigate(to)
}

/** Simulated camera read: prefers the latest kiosk ticket, then the demo session. */
function simulatedScanTarget() {
  const s = getState()
  if (s.checkout) return s.checkout.ticketId
  if (s.lastIssued && s.sessions[s.lastIssued]?.status === 'active') return s.lastIssued
  const demo = ticketId(1)
  if (s.sessions[demo]?.status === 'active') return demo
  return Object.values(s.sessions).find((x) => x.status === 'active')?.ticketId ?? demo
}

const flowLinks = (id: string, upTo: number) => {
  const all: Record<number, string> = { 0: '/exit', 1: `/exit/session/${id}`, 2: `/exit/fee/${id}`, 3: `/exit/payment/${id}` }
  return Object.fromEntries(Object.entries(all).filter(([k]) => Number(k) <= upTo))
}

/* ---------- shared bits ---------- */

function useQuote(session: Session) {
  const exitAt = useStore((s) => s.checkout?.exitAt) ?? session.exit ?? Date.now()
  return { exitAt, ...quoteFor(session, exitAt) }
}

function useSlot(id: string) {
  return useStore((s) => s.slots.find((x) => x.id === id))!
}

const snapshotLabel = (t: number, paid = false) => `${fmtTime(t)} · ${paid ? 'Paid snapshot' : 'Checkout snapshot'}`

/* ---------- 1. Dashboard ---------- */

function Dashboard() {
  const state = useStore((s) => s)
  const stats = computeStats(state)
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const timer = useRef<number>(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const doScan = () => {
    setScanning(true)
    timer.current = window.setTimeout(() => scan(simulatedScanTarget()), 1300)
  }
  const demoChips = [
    state.lastIssued && state.sessions[state.lastIssued] ? { id: state.lastIssued, label: 'Latest kiosk ticket' } : null,
    { id: ticketId(1), label: state.sessions[ticketId(1)]?.status === 'completed' ? 'Paid ticket' : 'Active ticket' },
    { id: ticketId(999), label: 'Unknown ticket' },
  ].filter(Boolean) as { id: string; label: string }[]

  return (
    <ExitLayout stage={0} title="Ready for the next vehicle" sub="Scan a parking ticket to retrieve its stored session.">
      <div className="grid gap-7 lg:grid-cols-[1fr_464px]">
        <Card className="p-6">
          <CardHead title="QR Scanner" sub="Position the printed QR ticket inside the guide." />
          <div className="relative mt-7 flex h-[310px] flex-col items-center justify-center overflow-hidden rounded-xl bg-navy">
            <div className="relative grid size-52 place-items-center rounded-2xl border-[3px] border-sky-300/80">
              <ScanLine className="size-16 text-sky-200/80" strokeWidth={1} />
              {scanning && <div className="absolute inset-x-3 top-2 h-0.5 rounded bg-sky-300 shadow-[0_0_12px_2px_rgba(125,211,252,0.7)] [animation:scanline_1.2s_ease-in-out_infinite]" />}
            </div>
            <p className="mt-6 text-sm text-slate-200">{scanning ? 'Reading QR ticket…' : 'Camera preview · Simulated scanner'}</p>
          </div>
          <Button size="xl" icon={ScanLine} className="mt-5 w-full" onClick={doScan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan QR ticket'}
          </Button>
          <form
            className="mt-7"
            onSubmit={(e) => {
              e.preventDefault()
              if (query.trim()) scan(query)
            }}
          >
            <label htmlFor="ticket" className="text-[13px] text-ink">
              Or enter TICKET ID
            </label>
            <div className="mt-2.5 flex gap-3">
              <input
                id="ticket"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="NSP-YYYYMMDD-0000"
                className="tabular h-12 min-w-0 flex-1 rounded-lg border border-line bg-white px-3.5 text-sm outline-none placeholder:text-body focus:border-brand focus:ring-3 focus:ring-brand/15"
              />
              <Button variant="secondary" size="lg" icon={Search} type="submit" disabled={!query.trim()} className="w-[140px]">
                Find ticket
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              Demo tickets:
              {demoChips.map((c) => (
                <button key={c.id + c.label} type="button" onClick={() => setQuery(c.id)} className="tabular cursor-pointer rounded-md bg-slate-100 px-2 py-1 text-body hover:bg-brand-50 hover:text-brand">
                  {c.id.slice(-4)} <span className="text-muted">· {c.label}</span>
                </button>
              ))}
            </div>
          </form>
        </Card>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Card className="px-4 py-6">
              <div className="text-xs text-muted">Revenue today</div>
              <div className="tabular mt-3 text-[32px] leading-none text-ok">{fmtPHP(stats.revenue)}</div>
              <div className="mt-5 text-[11px] text-muted">{stats.exited} confirmed transactions</div>
            </Card>
            <Card className="px-4 py-6">
              <div className="text-xs text-muted">Active sessions</div>
              <div className="tabular mt-3 text-[32px] leading-none">{stats.active}</div>
              <div className="mt-5 text-[11px] text-muted">{stats.available} spaces available</div>
            </Card>
          </div>
          <Card className="p-6">
            <CardHead title="Checkout checklist" />
            <ul className="mt-6 space-y-6">
              {[
                [ScanLine, 'Scan ticket', 'Retrieve the active session.'],
                [ReceiptText, 'Review fee', 'Use the saved rate version.'],
                [Banknote, 'Receive payment', 'Confirm cash before completion.'],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof ScanLine
                return (
                  <li key={t as string} className="flex gap-4">
                    <I className="size-5 text-brand" strokeWidth={1.6} />
                    <div>
                      <div className="text-[15px]">{t as string}</div>
                      <div className="mt-1 text-[13px] text-muted">{d as string}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
          <Badge className="py-1.5">Exit-only account · No fee overrides</Badge>
        </div>
      </div>
      <Card className="mt-7 p-6">
        <CardHead title="Recent completed transactions" sub="Today's confirmed payments · Latest first" />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                {['Transaction', 'Ticket', 'Category / space', 'Paid at', 'Amount', 'Status'].map((h) => (
                  <th key={h} className="px-3.5 py-3.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.transactions.slice(0, 3).map((t) => (
                <tr key={t.id} className="border-b border-line">
                  <td className="tabular px-3.5 py-5">…{t.id.slice(-4)}</td>
                  <td className="tabular px-3.5">{t.ticketId}</td>
                  <td className="px-3.5">
                    {t.category} · {t.slotId}
                  </td>
                  <td className="tabular px-3.5">{fmtTime(t.exit)}</td>
                  <td className="tabular px-3.5">{fmtPHP(t.amount)}</td>
                  <td className="px-3.5 text-ok">Paid</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </ExitLayout>
  )
}

/* ---------- 2. Ticket found ---------- */

function Found({ session }: { session: Session }) {
  const q = useQuote(session)
  const slot = useSlot(session.slotId)
  return (
    <ExitLayout stage={1} links={flowLinks(session.ticketId, 0)} title="Ticket found. Session is active." sub="Verify the parking session before reviewing the calculated fee." snapshotLabel={snapshotLabel(q.exitAt)}>
      <div className="grid gap-7 lg:grid-cols-[1fr_440px]">
        <Card className="p-6">
          <CardHead title="Parking session" sub="Retrieved from stored session data • QR identifies the session only" />
          <div className="mt-5 flex items-center justify-between border-b border-line pb-5">
            <span className="tabular text-xl">{session.ticketId}</span>
            <Badge className="py-1.5">Active · Valid</Badge>
          </div>
          <Rows
            className="mt-6"
            rows={[
              ['Vehicle category', session.category],
              ['Parking location', slotLabel(slot)],
              ['Entry timestamp', fmtLong(session.entry)],
              ['Exit timestamp', fmtLong(q.exitAt)],
              ['Parking duration', fmtDurationLong(q.minutes)],
              ['Rate version', `${session.rateVersion} · saved at entry`],
            ]}
          />
          <Note className="mt-6" title="Calculation snapshot">
            Exit time is frozen at {fmtTime(q.exitAt)}, Asia/Manila. Fees and payment status are read from the stored session.
          </Note>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="Ready for fee review" />
            <div className="mt-5">
              <IconCircle icon={ShieldCheck} />
            </div>
            <div className="mt-6 text-[28px]">Valid active session</div>
            <Rows
              className="mt-5"
              rows={[
                ['Session status', 'Active · Not paid'],
                ['Assigned bay', `${slot.id} · Occupied`],
                ['Checkout lock', `Open on ${OPERATOR.terminal}`],
              ]}
            />
            <Button icon={ArrowRight} className="mt-6 w-full uppercase" onClick={() => navigate(`/exit/fee/${session.ticketId}`)}>
              Proceed to fee review
            </Button>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              onClick={() => {
                cancelCheckout()
                navigate('/exit')
              }}
            >
              Scan another ticket
            </Button>
          </Card>
          <Note title="Scanning does not complete checkout">
            No payment has been recorded. The session remains active and {slot.id} stays occupied until payment is received and confirmed.
          </Note>
        </div>
      </div>
      <Card className="mt-7 p-6">
        <CardHead title="Validation checks" />
        <div className="mt-5 grid gap-4 text-[15px] sm:grid-cols-2 lg:grid-cols-4">
          {['Session ID recognized', 'Active session retrieved', 'Saved rate version located', 'No completed payment'].map((c) => (
            <span key={c} className="flex items-center gap-3">
              <CircleCheck className="size-5 text-ok" strokeWidth={1.6} />
              {c}
            </span>
          ))}
        </div>
      </Card>
    </ExitLayout>
  )
}

/* ---------- 3. Fee ---------- */

function Fee({ session }: { session: Session }) {
  const q = useQuote(session)
  const slot = useSlot(session.slotId)
  const r = session.rate
  const initialEnd = session.entry + r.initialMin * 60000
  return (
    <ExitLayout stage={2} links={flowLinks(session.ticketId, 1)} title="Automatic parking fee" sub={`Read-only calculation · Exit timestamp frozen at ${fmtLong(q.exitAt)}.`} snapshotLabel={snapshotLabel(q.exitAt)}>
      <div className="grid gap-7 lg:grid-cols-[1fr_430px]">
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="Session & rate source" />
            <Rows
              className="mt-5"
              rows={[
                ['Ticket ID', <span className="tabular">{session.ticketId}</span>],
                ['Category / location', `${session.category} · ${slotLabel(slot)}`],
                ['Entry timestamp', fmtLong(session.entry)],
                ['Exit timestamp', fmtLong(q.exitAt)],
                ['Duration', fmtDurationLong(q.minutes)],
              ]}
            />
            <Badge className="mt-5 py-1.5">Saved rate · {session.rateVersion}</Badge>
            <p className="mt-5 text-[13px] text-muted">Saved to this session at entry. Attendant cannot edit rates or override the fee.</p>
          </Card>
          <Card className="p-6">
            <CardHead title="Fee breakdown" sub={`${session.category} · Initial ${r.initialMin / 60 === 1 ? '1 hour' : `${r.initialMin} min`} + additional started ${r.incrementMin}-minute increments`} />
            <div className="mt-5 flex justify-between border-b border-line pb-5">
              <div>
                <div className="text-[15px]">Initial fee · first {r.initialMin === 60 ? 'hour' : `${r.initialMin} min`}</div>
                <div className="mt-1.5 text-[13px] text-muted">
                  {fmtTime(session.entry)}–{fmtTime(Math.min(initialEnd, q.exitAt))} · {r.initialMin} minutes included
                </div>
              </div>
              <span className="tabular text-[15px]">{fmtPHP(q.initial, true)}</span>
            </div>
            <div className="mt-5 flex justify-between">
              <div>
                <div className="text-[15px]">Additional {q.extraMin} minutes</div>
                <div className="mt-1.5 text-[13px] text-muted">
                  {q.extraMin > 0 ? `${fmtTime(initialEnd)}–${fmtTime(q.exitAt)} → ${q.increments} started ${r.incrementMin}-minute increment${q.increments === 1 ? '' : 's'}` : 'Within the initial period'}
                </div>
              </div>
              <span className="tabular text-[15px]">{fmtPHP(q.additional, true)}</span>
            </div>
            <Rows
              className="mt-6"
              rows={[
                ['Grace period', `${session.grace} minutes`],
                ['Calculation', `PHP ${r.initial} + (${q.increments} × PHP ${r.additional}) = PHP ${q.total}`],
              ]}
            />
          </Card>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl bg-navy px-8 py-8 text-white">
            <div className="text-sm tracking-[0.02em] text-slate-300 uppercase">Total amount due</div>
            <div className="tabular mt-6 text-[52px] leading-none">{fmtPHP(q.total, true)}</div>
            <div className="mt-8 text-[15px] text-slate-300">No taxes or surcharges.</div>
            <Badge tone="warn" className="mt-4 py-1.5">
              Unpaid · {slot.id} remains occupied
            </Badge>
          </div>
          <Button icon={Banknote} className="w-full uppercase" onClick={() => navigate(`/exit/payment/${session.ticketId}`)}>
            Confirm payment
          </Button>
          <div>
            <Button icon={Lock} className="w-full uppercase" disabled>
              Print receipt
            </Button>
            <p className="mt-4 text-xs text-muted">Receipt unlocks only after payment is received and finally confirmed.</p>
          </div>
          <Button
            variant="secondary"
            className="w-full uppercase"
            onClick={() => {
              cancelCheckout()
              toast('Checkout closed · No charge recorded')
              navigate('/exit')
            }}
          >
            Cancel transaction
          </Button>
          <Note title="Cancel only closes this checkout">No charge, no session completion and no slot release. The parking session stays active.</Note>
        </div>
      </div>
    </ExitLayout>
  )
}

/* ---------- 4. Payment ---------- */

function Payment({ session }: { session: Session }) {
  const q = useQuote(session)
  const slot = useSlot(session.slotId)
  const [cash, setCash] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const tender = parseFloat(cash)
  const valid = !isNaN(tender) && tender >= q.total
  const change = valid ? tender - q.total : 0
  const quick = [q.total, Math.ceil(q.total / 50) * 50, Math.ceil(q.total / 100) * 100, 500].filter((v, i, a) => a.indexOf(v) === i)

  useEffect(() => setConfirmed(false), [cash])

  const complete = () => {
    const tx = completePayment(session.ticketId, tender)
    if (tx) {
      toast(`${fmtPHP(tx.amount, true)} recorded · ${slot.id} released`, 'ok')
      navigate(`/exit/receipt/${session.ticketId}`)
    }
  }

  return (
    <ExitLayout stage={3} links={flowLinks(session.ticketId, 2)} title="Confirm payment received" sub="Count the cash and confirm receipt before completing the parking session." snapshotLabel={snapshotLabel(q.exitAt)}>
      <div className="grid gap-7 lg:grid-cols-[1fr_450px]">
        <Card className="p-6">
          <CardHead title="Cash payment" sub="Payment method · Cash" />
          <div className="mt-5 flex items-center justify-between rounded-xl bg-brand-50 px-6 py-8 text-brand">
            <span className="text-lg">Amount due</span>
            <span className="tabular text-[42px] leading-none">{fmtPHP(q.total, true)}</span>
          </div>
          <Input
            className="mt-6"
            label="Cash received (PHP)"
            inputMode="decimal"
            placeholder="0.00"
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ''))}
            autoFocus
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {quick.map((v) => (
              <button key={v} onClick={() => setCash(v.toFixed(2))} className="tabular cursor-pointer rounded-md border border-line bg-white px-3 py-1.5 text-xs text-body hover:border-brand hover:text-brand">
                {v === q.total ? 'Exact' : `PHP ${v}`}
              </button>
            ))}
          </div>
          {cash && !valid && <p className="mt-2 text-xs text-bad">Cash received must cover the amount due.</p>}
          <Input className="mt-5" label="Change to return (PHP)" value={valid ? change.toFixed(2) : '—'} locked />
          <Rows className="mt-6" rows={[['Fee calculation', `PHP ${q.initial} initial + PHP ${q.additional} additional`]]} />
          <label className={cx('mt-6 flex items-center gap-4 rounded-xl px-5 py-5 text-[15px] transition', valid ? 'cursor-pointer bg-ok-50 text-ok' : 'cursor-not-allowed bg-slate-100 text-muted')}>
            <input type="checkbox" className="peer sr-only" disabled={!valid} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span className={cx('grid size-[26px] shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:outline-2 peer-focus-visible:outline-brand', confirmed ? 'border-ok bg-ok text-white' : 'border-current bg-white')}>
              {confirmed && <Check className="size-4" strokeWidth={2.5} />}
            </span>
            {valid ? `I received ${fmtPHP(tender, true)} cash and will return ${fmtPHP(change, true)} change.` : 'Enter the cash received to confirm.'}
          </label>
          <p className="mt-5 text-[13px] text-muted">{confirmed ? 'Confirmation selected. Final action is still required.' : 'Confirm the cash count, then complete the session.'}</p>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="Review before completion" />
            <Badge tone="warn" className="mt-5 py-1.5">
              Not yet completed
            </Badge>
            <Rows
              className="mt-5 border-b border-line pb-6"
              rows={[
                ['Ticket ID', <span className="tabular">{session.ticketId}</span>],
                ['Category', session.category],
                ['Location', slotLabel(slot)],
                ['Duration', fmtDurationLong(q.minutes)],
                ['Attendant', OPERATOR.name],
              ]}
            />
            <p className="mt-6 text-sm leading-relaxed text-muted">Final confirmation records the payment once, marks the ticket paid, completes the session and releases {slot.id}.</p>
            <Button variant="success" icon={Check} className="mt-5 w-full uppercase" disabled={!valid || !confirmed} onClick={complete}>
              Confirm received & complete
            </Button>
            <Button variant="secondary" className="mt-5 w-full" onClick={() => navigate(`/exit/fee/${session.ticketId}`)}>
              Back to fee review
            </Button>
          </Card>
          <Note title="One payment per session">Repeated scans cannot create a second payment. The stored completion state prevents double charging.</Note>
        </div>
      </div>
    </ExitLayout>
  )
}

/* ---------- 5. Receipt ---------- */

export function ReceiptSlip({ session }: { session: Session }) {
  const slot = useSlot(session.slotId)
  const p = session.payment!
  const exit = session.exit!
  const minutes = Math.floor((exit - session.entry) / 60000)
  const q = quoteFor(session, exit)
  const d = new Date(p.paidAt)
  const short = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric' }).format(d)
  const label = 'text-xs tracking-[0.02em] text-muted uppercase'
  return (
    <Card className="px-7 py-8">
      <div className="text-center">
        <div className="text-2xl">Naga Smart Park</div>
        <div className="mt-3 text-[13px]">Naga City People's Mall</div>
        <div className="mt-3 text-xs text-muted">
          PAYMENT RECEIPT · {short} · {fmtTime(p.paidAt)}
        </div>
        <Badge tone="ok" upper className="mt-3 py-1.5">
          Paid · {p.method}
        </Badge>
      </div>
      <div className="mt-3 space-y-3.5 border-t border-line pt-5 text-sm">
        <div className={label}>Ticket ID</div>
        <div className="tabular text-base">{session.ticketId}</div>
        <Rows size="sm" labelWidth="w-[175px]" className="text-sm" rows={[['Category', session.category], ['Location', slotLabel(slot)]]} />
        <div className={label}>Entry</div>
        <div>{fmtLong(session.entry)}</div>
        <div className={label}>Exit</div>
        <div>{fmtLong(exit)}</div>
        <Rows size="sm" labelWidth="w-[175px]" className="text-sm" rows={[['Duration', fmtDurationLong(minutes)]]} />
      </div>
      <div className="mt-4 space-y-3 border-t border-line pt-5">
        <Rows
          size="sm"
          labelWidth="w-[175px]"
          className="text-sm"
          rows={[
            [`Initial · ${session.rate.initialMin / 60} hour`, fmtPHP(q.initial, true)],
            [`Extra · ${q.increments} × ${session.rate.incrementMin} min`, fmtPHP(q.additional, true)],
          ]}
        />
        <div className="flex items-end justify-between pt-1">
          <span className="text-xl uppercase">Total paid</span>
          <span className="tabular text-2xl">{fmtPHP(p.amount, true)}</span>
        </div>
      </div>
      <div className="mt-4 space-y-3 border-t border-line pt-5 text-sm">
        <Rows
          size="sm"
          labelWidth="w-[175px]"
          className="text-sm"
          rows={[
            [p.method === 'Cash' ? 'Cash received' : 'Digital payment', fmtPHP(p.tender, true)],
            ['Change', fmtPHP(p.change, true)],
            ['Attendant', p.attendant],
          ]}
        />
        <div className={label}>Transaction</div>
        <div className="tabular">{p.transactionId}</div>
        <div className="text-center text-[11px] text-muted">
          {session.rateVersion} · Demo rates, not official LGU rates · Asia/Manila
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-5 text-center text-[13px]">Payment Successful. Thank you for parking with Naga Smart Park!</div>
    </Card>
  )
}

function Receipt({ session }: { session: Session }) {
  const state = useStore((s) => s)
  const stats = computeStats(state)
  const slot = useSlot(session.slotId)
  const p = session.payment!
  const fresh = state.lastCompleted === session.ticketId
  return (
    <ExitLayout stage={4} links={{ 0: '/exit' }} title="Payment completed" sub="Payment Successful. Thank you for parking with Naga Smart Park!" snapshot="ok" snapshotLabel={snapshotLabel(p.paidAt, true)}>
      <div className="grid gap-7 lg:grid-cols-[450px_1fr]">
        <ReceiptSlip session={session} />
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="Checkout completed" />
            <div className="mt-5">
              <IconCircle icon={CircleCheck} />
            </div>
            <div className="mt-6 text-[28px]">Paid. Released. Ready for exit.</div>
            <Rows
              className="mt-5"
              rows={[
                ['Session', 'Completed · cannot be charged again'],
                [`Space ${slot.id}`, `${slot.status === 'available' ? 'Available' : 'Reassigned'} · released at ${fmtTime(session.exit!)}`],
                ['Payment', `${fmtPHP(p.amount, true)} confirmed · ${p.method}`],
              ]}
            />
            <Button icon={Printer} className="mt-6 w-full uppercase" onClick={() => toast('Receipt sent to exit lane printer')}>
              Print receipt
            </Button>
            <Button variant="secondary" icon={ScanLine} className="mt-5 w-full uppercase" onClick={() => navigate('/exit')}>
              Next scan
            </Button>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-ok-50 px-6 py-7 text-ok">
              <div className="tabular text-[32px] leading-none">{stats.available}</div>
              <div className="mt-4 text-sm">Spaces available{fresh ? ' · +1' : ''}</div>
            </div>
            <div className="rounded-2xl bg-brand-50 px-6 py-7 text-brand">
              <div className="tabular text-[32px] leading-none">{fmtPHP(stats.revenue)}</div>
              <div className="mt-4 text-sm">Today's revenue{fresh ? ` · +${p.amount}` : ''}</div>
            </div>
          </div>
          <Note tone="ok" icon={CircleCheck} title="Receipt reprints do not create a payment">
            This transaction is immutable in checkout. A repeated ticket scan opens the paid record, not a new charge.
          </Note>
        </div>
      </div>
    </ExitLayout>
  )
}

/* ---------- Error & guard states ---------- */

function Invalid({ id }: { id: string }) {
  const [query, setQuery] = useState(id === 'blank' ? '' : id)
  return (
    <ExitLayout stage={1} links={{ 0: '/exit' }} title="Ticket not recognized" sub="No matching stored session was found for this QR or ticket ID.">
      <div className="grid gap-7 lg:grid-cols-[1fr_430px]">
        <Card className="p-6">
          <CardHead title="Unrecognized session" />
          <div className="mt-5">
            <IconCircle icon={ScanLine} tone="bad" />
          </div>
          <Badge tone="bad" upper className="mt-6 py-1.5">
            Invalid ticket
          </Badge>
          <div className="mt-6 text-[30px] leading-tight">We couldn't find this parking session.</div>
          <p className="mt-6 text-base text-muted">Check that the ticket belongs to Naga Smart Park. A printed value alone cannot authorize a session or fee.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (query.trim()) scan(query)
            }}
          >
            <Input className="mt-5" label="TICKET ID" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="NSP-YYYYMMDD-0000" />
            <Note tone="bad" icon={CircleAlert} title="No charges recorded" className="mt-5">
              No session was opened, no payment was created and no parking space was released.
            </Note>
            <div className="mt-5 flex flex-wrap gap-3.5">
              <Button type="button" icon={ScanLine} className="uppercase" onClick={() => navigate('/exit')}>
                Scan QR ticket
              </Button>
              <Button variant="secondary" icon={Search} type="submit" disabled={!query.trim()}>
                Look up ticket ID
              </Button>
            </div>
          </form>
        </Card>
        <Card className="h-fit p-6">
          <CardHead title="Help the driver" />
          <ol className="mt-5 space-y-6">
            {[
              ['Try scanning again', 'Flatten the ticket and keep the full QR inside the camera guide.'],
              ['Enter the ticket ID', 'Use only the printed NSP ticket ID. No vehicle plate lookup.'],
              ['Request authorized assistance', 'If the session remains unknown, follow facility exception policy.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3.5">
                <Badge className="h-fit py-1.5">{i + 1}</Badge>
                <div>
                  <div className="text-[15px]">{t}</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted">{d}</div>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate('/exit')}>
            Back to exit dashboard
          </Button>
        </Card>
      </div>
      <Note className="mt-7" title="Payment stages remain locked">
        A valid active session is required before Parking Fee, Payment Confirmation and Receipt become available.
      </Note>
    </ExitLayout>
  )
}

function Duplicate({ session }: { session: Session }) {
  const q = useQuote(session)
  const slot = useSlot(session.slotId)
  const checkout = useStore((s) => s.checkout)!
  return (
    <ExitLayout stage={1} links={flowLinks(session.ticketId, 0)} title="This session is already open" sub="Duplicate scan detected in the current checkout. No new transaction was created." snapshotLabel={snapshotLabel(q.exitAt)}>
      <div className="grid gap-7 lg:grid-cols-[1fr_430px]">
        <Card className="p-6">
          <CardHead title="Continue the existing checkout" />
          <div className="mt-5">
            <IconCircle icon={CopyCheck} tone="warn" />
          </div>
          <Badge tone="warn" upper className="mt-6 py-1.5">
            Duplicate scan · Still active
          </Badge>
          <div className="mt-6 text-[30px]">One session, one checkout.</div>
          <p className="mt-6 text-[15px] text-muted">The same active ticket is already under fee review at {checkout.terminal}. Return to that checkout instead of starting another.</p>
          <Rows
            className="mt-5"
            rows={[
              ['Ticket ID', <span className="tabular">{session.ticketId}</span>],
              ['Location', `${session.category} · ${slotLabel(slot)}`],
              ['Entry', fmtLong(session.entry)],
              ['Existing review', `Opened ${fmtTime(checkout.openedAt)} · ${checkout.attendant}`],
              ['Current payment', `Unpaid · ${fmtPHP(q.total, true)} due`],
            ]}
          />
          <Button icon={ArrowRight} className="mt-6 w-full uppercase" onClick={() => navigate(`/exit/fee/${session.ticketId}`)}>
            Return to existing fee review
          </Button>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="What stays unchanged" />
            <Rows
              className="mt-5"
              rows={[
                ['Session status', 'Active'],
                [`Space ${slot.id}`, 'Occupied'],
                ['Payments created', '0'],
                ['Additional charge', 'None'],
              ]}
            />
            <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate('/exit')}>
              Back to scanner
            </Button>
          </Card>
          <Note tone="warn" title="Not an already-paid ticket">
            This is an active, unpaid session. The duplicate refers to this checkout being open, not a completed payment.
          </Note>
          <Note title="Payment still requires confirmation">Returning to review does not receive cash or complete the session.</Note>
        </div>
      </div>
    </ExitLayout>
  )
}

function AlreadyPaid({ session }: { session: Session }) {
  const slot = useSlot(session.slotId)
  const p = session.payment!
  return (
    <ExitLayout stage={4} links={{ 0: '/exit' }} title="This ticket has already been paid" sub="Payment protection · Display the historical payment instead of charging again." snapshot="ok" snapshotLabel={snapshotLabel(p.paidAt, true)}>
      <div className="grid gap-7 lg:grid-cols-[1fr_450px]">
        <Card className="h-fit p-6">
          <CardHead title="Existing confirmed payment" />
          <div className="mt-5">
            <IconCircle icon={BadgeCheck} />
          </div>
          <Badge tone="ok" upper className="mt-6 py-1.5">
            Already paid · Do not charge
          </Badge>
          <div className="tabular mt-6 text-[44px] leading-none">{fmtPHP(p.amount, true)} paid</div>
          <Rows
            className="mt-8"
            rows={[
              ['Ticket ID', <span className="tabular">{session.ticketId}</span>],
              ['Transaction', <span className="tabular">{p.transactionId}</span>],
              ['Paid timestamp', fmtLong(p.paidAt)],
              ['Payment details', p.method === 'Cash' ? `Cash ${fmtPHP(p.tender, true)} · Change ${fmtPHP(p.change, true)}` : `Digital ${fmtPHP(p.tender, true)}`],
              ['Attendant', p.attendant],
              ['Session / space', `Completed · ${slot.id} released`],
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="Receipt access only" />
            <p className="mt-5 text-[15px] leading-relaxed text-muted">The stored payment record is final. Receipt reprinting refers to the original transaction and cannot charge the session again.</p>
            <Button icon={Printer} className="mt-6 w-full uppercase" onClick={() => toast(`Reprinted receipt for ${p.transactionId}`)}>
              Reprint receipt
            </Button>
            <Button variant="secondary" icon={ScanLine} className="mt-5 w-full uppercase" onClick={() => navigate('/exit')}>
              Scan another ticket
            </Button>
          </Card>
          <Note tone="ok" icon={CircleCheck} title="No charge action available">
            This state is shown when a paid ticket is scanned again. It is not the duplicate-active-checkout warning.
          </Note>
          <Card className="p-6">
            <CardHead title="Original parking details" />
            <Rows
              className="mt-5"
              rows={[
                ['Vehicle', session.category],
                ['Original space', slotLabel(slot)],
                ['Entry', fmtLong(session.entry)],
                ['Duration', fmtDurationLong(Math.floor((session.exit! - session.entry) / 60000))],
              ]}
            />
          </Card>
        </div>
      </div>
    </ExitLayout>
  )
}

function Closed({ session }: { session: Session }) {
  const slot = useSlot(session.slotId)
  const p = session.payment!
  return (
    <ExitLayout stage={4} links={{ 0: '/exit' }} title="Completed sessions cannot be reopened" sub="An attempt to continue a historical session is blocked. Review history or scan a new ticket." snapshot="ok" snapshotLabel={snapshotLabel(p.paidAt, true)}>
      <div className="grid gap-7 lg:grid-cols-[1fr_450px]">
        <Card className="h-fit p-6">
          <CardHead title="Historical session · Read only" />
          <div className="mt-5">
            <IconCircle icon={Archive} tone="neutral" />
          </div>
          <Badge tone="neutral" upper className="mt-6 py-1.5">
            Completed · Archived
          </Badge>
          <div className="mt-6 text-[30px]">This parking visit has ended.</div>
          <Rows
            className="mt-6"
            rows={[
              ['Ticket ID', <span className="tabular">{session.ticketId}</span>],
              ['Vehicle / location', `${session.category} · ${slotLabel(slot)}`],
              ['Entry timestamp', fmtLong(session.entry)],
              ['Completed at', fmtLong(session.exit!)],
              ['Payment status', `Paid · ${fmtPHP(p.amount, true)}`],
              ['Transaction', <span className="tabular">{p.transactionId}</span>],
              ['Slot release', `${slot.id} released · ${fmtTime(session.exit!)}`],
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Note title="Reopen request blocked">This is a lifecycle guard on an ended session, not a duplicate active scan. Its payment is already settled and its space has been released.</Note>
          <Card className="p-6">
            <CardHead title="Available next steps" />
            <p className="mt-5 text-[15px] leading-relaxed text-muted">Historical review does not reserve the former space. A future parking visit needs a new entrance session and ticket.</p>
            <Button icon={History} className="mt-6 w-full uppercase" onClick={() => navigate(`/admin/transactions?ticket=${session.ticketId}`)}>
              Review session history
            </Button>
            <Button variant="secondary" icon={ScanLine} className="mt-5 w-full uppercase" onClick={() => navigate('/exit')}>
              Scan another ticket
            </Button>
            <p className="mt-5 text-[13px] text-muted">No reopen or payment controls are available for a completed session.</p>
          </Card>
        </div>
      </div>
    </ExitLayout>
  )
}

/** Active session reached by URL without an open checkout on this terminal. */
function NoCheckout({ session }: { session: Session }) {
  return (
    <ExitLayout stage={1} links={{ 0: '/exit' }} title="No open checkout for this ticket" sub="Scan the ticket to open a checkout on this terminal.">
      <Card className="max-w-2xl p-6">
        <CardHead title={<span className="tabular">{session.ticketId}</span>} sub={`${session.category} · Slot ${session.slotId} · Entered ${fmtTime(session.entry)}`} />
        <p className="mt-5 text-[15px] text-muted">Checkout stages only open after a scan. Nothing has been charged and the space stays occupied.</p>
        <Button icon={ScanLine} className="mt-6 uppercase" onClick={() => scan(session.ticketId)}>
          Scan this ticket
        </Button>
      </Card>
    </ExitLayout>
  )
}

