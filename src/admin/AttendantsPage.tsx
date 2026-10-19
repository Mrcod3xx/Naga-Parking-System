import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { Stat } from './widgets'
import { Badge, Button, Card, CardHead, Input, Modal, Rows, Select, toast, type Tone } from '../components/ui'
import { addAttendant, updateAttendant, useNow, useStore } from '../store/store'
import type { Attendant, AttendantStatus } from '../store/types'
import { fmtDay, fmtPHP, fmtTime } from '../lib/format'

const TONE: Record<AttendantStatus, Tone> = { Active: 'ok', 'On break': 'brand', Offline: 'neutral', Pending: 'brand' }
const initials = (n: string) =>
  n
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

export default function AttendantsPage() {
  const attendants = useStore((s) => s.attendants)
  const transactions = useStore((s) => s.transactions)
  const t = useNow()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState<Attendant | null>(null)
  const list = attendants.filter((a) => !q.trim() || `${a.name} ${a.email} ${a.id}`.toLowerCase().includes(q.trim().toLowerCase()))
  const active = attendants.find((a) => a.status === 'Active')
  const lanes = new Set(attendants.filter((a) => a.status === 'Active' || a.status === 'On break').map((a) => a.lane))
  const recentPaid = transactions.filter((x) => t - x.exit < 60 * 60000).length
  const lastTx = transactions[0]
  const activeLast = active ? transactions.find((x) => x.attendant === active.name) : undefined
  return (
    <AdminLayout active="attendants" crumb="Attendant operations" title="Attendant accounts" sub={`${fmtDay(t)} · ${fmtTime(t)} · Exit-only staff management`} right={<Badge className="py-2">Exit-only accounts</Badge>}>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Active exit attendants" value={attendants.filter((a) => a.status !== 'Pending').length} note={`${attendants.filter((a) => a.status === 'Active').length} currently signed in`} />
        <Stat label="Exit lanes covered" value={`${lanes.size} / 2`} tone="ok" note={[...lanes].sort().join(' and ') + ' assigned'} />
        <Stat label="Recent paid sessions" value={recentPaid} note="Last 60 minutes" />
        <Stat label="Last receipt printed" value={lastTx ? fmtTime(lastTx.exit) : '—'} tone="ok" note={lastTx?.id ?? '—'} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_292px]">
        <Card className="h-fit p-6">
          <CardHead title="Staff table" sub="Exit-only attendants · no entrance attendants assigned" />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <label className="relative w-full max-w-[312px]">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" className="h-10 w-full rounded-lg border border-line bg-canvas pr-3 pl-10 text-sm outline-none placeholder:text-muted focus:border-brand focus:bg-white" />
            </label>
            <Button size="md" icon={Plus} onClick={() => setAdding(true)}>
              Add account
            </Button>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="bg-canvas text-[11px] text-muted">
                <tr>
                  {['Attendant', 'Role', 'Status', 'Exit lane', 'Last access', 'Actions'].map((h) => (
                    <th key={h} className="px-3.5 py-3.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b border-line">
                    <td className="px-3.5 py-3.5">
                      <div className="text-sm">{a.name}</div>
                      <div className="mt-1 text-[11px] text-muted">{a.email}</div>
                    </td>
                    <td className="px-3.5">Exit attendant</td>
                    <td className="px-3.5">
                      <Badge tone={TONE[a.status]} className="py-1.5">
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-3.5">{a.lane}</td>
                    <td className="tabular px-3.5">{a.lastAccess ? fmtTime(a.lastAccess) : '—'}</td>
                    <td className="px-3.5">
                      <Button variant="soft" size="sm" onClick={() => setManaging(a)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          {active && (
            <Card className="p-6">
              <CardHead title="Active attendant" sub={`Currently signed in at ${active.lane}`} />
              <div className="mt-5 flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand">{initials(active.name)}</div>
                <div>
                  <div className="text-base">{active.name}</div>
                  <div className="text-xs text-muted">{active.email}</div>
                </div>
              </div>
              <Badge tone="ok" className="mt-4 py-1.5">
                Active · {active.lane}
              </Badge>
              <Rows
                size="sm"
                labelWidth="w-[110px]"
                className="mt-5"
                rows={[
                  ['Last session', <span className="tabular break-all">{activeLast?.ticketId ?? '—'}</span>],
                  ['Last payment', activeLast ? fmtPHP(activeLast.amount, true) : '—'],
                  ['Last receipt', activeLast ? `Printed at ${fmtTime(activeLast.exit)}` : '—'],
                  ['Last access', active.lastAccess ? `${fmtTime(active.lastAccess)} · Exit terminal` : '—'],
                ]}
              />
            </Card>
          )}
          <Card className="p-6">
            <CardHead title="Recent activity" sub="Latest exit actions by staff" />
            <ul className="mt-5 space-y-3">
              {transactions.slice(0, 3).map((x) => (
                <li key={x.id} className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-3">
                  <div className="grid size-8 place-items-center rounded-full bg-brand-50 text-[11px] text-brand">{initials(x.attendant)}</div>
                  <div className="flex-1">
                    <div className="text-[13px]">{x.attendant}</div>
                    <div className="text-[11px] text-muted">
                      {fmtTime(x.exit)} · {attendants.find((a) => a.name === x.attendant)?.lane}
                    </div>
                  </div>
                  <span className="text-xs text-ok">Paid</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <Card className="mt-6 p-6">
        <CardHead title="Role permissions" sub="Exit attendants can review session details, confirm received payments, and print receipts. They cannot change rates or override fees." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            ['Exit attendant', 'bg-ok', ['Scan QR or enter ticket ID', 'Review session details', 'Confirm received payment', 'Print and reprint receipts']],
            ['Restricted actions', 'bg-bad', ['Change configured parking rates', 'Arbitrarily override calculated fees', 'Charge paid tickets again', 'Manage entrance access or plate records']],
          ].map(([title, dot, items]) => (
            <div key={title as string} className="rounded-xl bg-canvas p-5">
              <div className="text-base">{title as string}</div>
              <ul className="mt-4 space-y-3 text-[13px]">
                {(items as string[]).map((i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className={`size-1.5 rounded-full ${dot}`} />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      <AddAttendant open={adding} onClose={() => setAdding(false)} />
      <ManageAttendant key={managing?.id ?? 'none'} a={managing} onClose={() => setManaging(null)} />
    </AdminLayout>
  )
}

function AddAttendant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [lane, setLane] = useState<'Lane A' | 'Lane B'>('Lane A')
  const valid = name.trim().length > 2 && /^\S+@\S+\.\S+$/.test(email)
  const close = () => {
    setName('')
    setEmail('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title="Add exit attendant"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={close}>
            Cancel
          </Button>
          <Button
            size="md"
            disabled={!valid}
            onClick={() => {
              addAttendant({ name: name.trim(), email: email.trim(), lane })
              toast(`Invitation sent to ${email.trim()}`, 'ok')
              close()
            }}
          >
            Create account
          </Button>
        </>
      }
    >
      <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Liza Bautista" autoFocus />
      <Input label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@nsp.gov" />
      <div>
        <span className="mb-2 block text-[13px]">Exit lane</span>
        <Select label="Exit lane" value={lane} onChange={setLane} options={[{ value: 'Lane A', label: 'Lane A' }, { value: 'Lane B', label: 'Lane B' }]} />
      </div>
      <p className="text-xs text-muted">New accounts start as Pending with exit-only permissions. Rate editing and fee overrides are never granted.</p>
    </Modal>
  )
}

function ManageAttendant({ a, onClose }: { a: Attendant | null; onClose: () => void }) {
  const [status, setStatus] = useState<AttendantStatus>(a?.status ?? 'Active')
  const [lane, setLane] = useState<'Lane A' | 'Lane B'>(a?.lane ?? 'Lane A')
  return (
    <Modal
      open={!!a}
      onClose={onClose}
      title={a ? `Manage ${a.name}` : ''}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            onClick={() => {
              if (a) {
                updateAttendant(a.id, { status, lane })
                toast(`${a.name} updated · ${status} · ${lane}`, 'ok')
              }
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div>
        <span className="mb-2 block text-[13px]">Status</span>
        <Select label="Status" value={status} onChange={setStatus} options={(['Active', 'On break', 'Offline', 'Pending'] as AttendantStatus[]).map((s) => ({ value: s, label: s }))} />
      </div>
      <div>
        <span className="mb-2 block text-[13px]">Exit lane</span>
        <Select label="Exit lane" value={lane} onChange={setLane} options={[{ value: 'Lane A', label: 'Lane A' }, { value: 'Lane B', label: 'Lane B' }]} />
      </div>
      <p className="text-xs text-muted">Role is fixed to Exit attendant. Permissions cannot include rate editing or fee overrides.</p>
    </Modal>
  )
}
