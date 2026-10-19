import { useState } from 'react'
import { ArrowLeft, CircleAlert, Lock, Plus, Ticket } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { FilterBar, useSlotFilters } from './OverviewPages'
import { Badge, Button, Card, CardHead, cx, Input, Modal, Note, Rows, Select, toast } from '../components/ui'
import { navigate } from '../lib/router'
import { addSlots, updateSlot, useNow, useStore } from '../store/store'
import { blocks, categoryLocation } from '../store/logic'
import { CATEGORIES, type Category, type SlotStatus } from '../store/types'
import { fmtDurationLong, fmtLong, pad2 } from '../lib/format'

const STATUS_TEXT: Record<SlotStatus, string> = {
  available: 'text-ok',
  occupied: 'text-bad',
  reserved: 'text-warn',
  unavailable: 'text-body',
  claimed: 'text-warn',
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const PAGE = 12

export function SlotsPage() {
  const slots = useStore((s) => s.slots)
  const { f, setF, test } = useSlotFilters()
  const [page, setPage] = useState(0)
  const [modal, setModal] = useState<'slot' | 'block' | null>(null)
  const rows = slots.filter(test).sort((a, b) => a.block.localeCompare(b.block) || a.number - b.number)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const p = Math.min(page, pages - 1)
  const view = rows.slice(p * PAGE, p * PAGE + PAGE)
  return (
    <AdminLayout
      active="slots"
      title="Parking Slot Management"
      sub="Configure blocks, vehicle categories and assignment eligibility."
      right={
        <div className="flex gap-3">
          <Button variant="secondary" icon={Plus} onClick={() => setModal('block')}>
            Add block
          </Button>
          <Button icon={Plus} onClick={() => setModal('slot')}>
            Add slot
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {CATEGORIES.map((c) => {
          const n = slots.filter((s) => s.category === c).length
          return (
            <Card key={c} className="px-6 py-7">
              <div className="text-[13px] text-muted">{categoryLocation(slots, c)}</div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-xl">{c}</span>
                <span className="tabular text-xs text-muted">{n} spaces</span>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="mt-6">
        <FilterBar
          f={f}
          setF={(v) => {
            setF(v)
            setPage(0)
          }}
          slots={slots}
          placeholder="Search block, slot or ticket"
        />
      </div>
      <Card className="mt-6 p-6">
        <CardHead title="Parking spaces" sub={`${slots.length} configured spaces · ${rows.length} shown with current filters`} />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                {['Block', 'Slot', 'Category', 'Status', 'Active ticket', 'Reason / safeguard', 'Action'].map((h) => (
                  <th key={h} className="px-3.5 py-3.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="px-3.5 py-[18px]">{s.block}</td>
                  <td className="tabular px-3.5">{pad2(s.number)}</td>
                  <td className="px-3.5">{s.category}</td>
                  <td className={cx('px-3.5', STATUS_TEXT[s.status])}>{cap(s.status)}</td>
                  <td className="tabular px-3.5">{s.ticketId ?? '—'}</td>
                  <td className="px-3.5">{s.reason}</td>
                  <td className="px-3.5">
                    {s.status === 'occupied' || s.status === 'claimed' ? (
                      <button className="cursor-pointer text-ink hover:text-brand" onClick={() => navigate(`/admin/slots/${s.id}`)}>
                        View
                      </button>
                    ) : (
                      <button className="cursor-pointer text-brand hover:underline" onClick={() => navigate(`/admin/slots/${s.id}`)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!view.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No spaces match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted">
            Showing {rows.length ? p * PAGE + 1 : 0}–{p * PAGE + view.length} of {rows.length} spaces
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="md" disabled={p === 0} onClick={() => setPage(p - 1)}>
              Previous
            </Button>
            {Array.from({ length: pages }, (_, i) => (
              <Button key={i} size="md" variant={i === p ? 'primary' : 'secondary'} className="w-10 px-0" onClick={() => setPage(i)}>
                {i + 1}
              </Button>
            ))}
            <Button variant="secondary" size="md" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>
      <Note className="mt-6" title="Safe assignment is enforced per space">
        Block + slot must be unique. Claim available, compatible slots atomically; active-session association prevents duplicate assignment. Reserved and unavailable slots require a reason and cannot be issued by the kiosk.
      </Note>
      <AddModal mode={modal} onClose={() => setModal(null)} />
    </AdminLayout>
  )
}

function AddModal({ mode, onClose }: { mode: 'slot' | 'block' | null; onClose: () => void }) {
  const slots = useStore((s) => s.slots)
  const existing = blocks(slots).map((b) => b.id)
  const nextLetter = String.fromCharCode(Math.max(...existing.map((b) => b.charCodeAt(0))) + 1)
  const [block, setBlock] = useState(existing[0])
  const [newBlock, setNewBlock] = useState(nextLetter)
  const [cat, setCat] = useState<Category>('Car')
  const [count, setCount] = useState('1')
  const n = Math.max(1, Math.min(40, parseInt(count, 10) || 0))
  const target = mode === 'block' ? newBlock.trim().toUpperCase() : block
  const clash = mode === 'block' && existing.includes(target)
  const invalid = !/^[A-Z]$/.test(target) || clash
  const submit = () => {
    if (invalid) return
    const added = addSlots(target, cat, mode === 'block' ? Math.max(n, 1) : n)
    toast(`${added.length} space${added.length === 1 ? '' : 's'} added to Block ${target}`, 'ok')
    onClose()
  }
  return (
    <Modal
      open={!!mode}
      onClose={onClose}
      title={mode === 'block' ? 'Add block' : 'Add slot'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} disabled={invalid}>
            {mode === 'block' ? 'Create block' : 'Add space'}
          </Button>
        </>
      }
    >
      {mode === 'block' ? (
        <Input label="Block letter" maxLength={1} value={newBlock} onChange={(e) => setNewBlock(e.target.value.toUpperCase())} hint={clash ? `Block ${target} already exists.` : 'A single unique letter.'} />
      ) : (
        <div>
          <span className="mb-2 block text-[13px]">Block</span>
          <Select label="Block" value={block} onChange={setBlock} options={existing.map((b) => ({ value: b, label: `Block ${b}` }))} />
        </div>
      )}
      <div>
        <span className="mb-2 block text-[13px]">Supported vehicle category</span>
        <Select label="Category" value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      </div>
      <Input label={mode === 'block' ? 'Number of spaces' : 'Spaces to add'} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} hint="New spaces are numbered after the highest existing slot and start as available." />
    </Modal>
  )
}

export function EditSlotPage({ id }: { id: string }) {
  const state = useStore((s) => s)
  const t = useNow()
  const slot = state.slots.find((s) => s.id === id)
  const [status, setStatus] = useState<SlotStatus>(slot?.status ?? 'available')
  const [cat, setCat] = useState<Category>(slot?.category ?? 'Car')
  const [reason, setReason] = useState(slot?.status === 'available' ? '' : (slot?.reason ?? ''))
  if (!slot) {
    return (
      <AdminLayout active="slots" title="Slot not found" sub={`No space with ID ${id}.`}>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/admin/slots')}>
          Back to spaces
        </Button>
      </AdminLayout>
    )
  }
  const locked = slot.status === 'occupied' || slot.status === 'claimed'
  const session = slot.ticketId ? state.sessions[slot.ticketId] : undefined
  const needsReason = status === 'reserved' || status === 'unavailable'
  const dirty = status !== slot.status || cat !== slot.category || (needsReason && reason !== slot.reason)
  const canSave = !locked && dirty && (!needsReason || reason.trim().length >= 3)
  const save = () => {
    if (updateSlot(slot.id, { status, category: cat, reason: needsReason ? reason.trim() : 'Eligible for assignment' })) {
      toast(`${slot.id} saved · ${cap(status)}`, 'ok')
      navigate('/admin/slots')
    }
  }
  const options: SlotStatus[] = ['available', 'occupied', 'reserved', 'unavailable']
  return (
    <AdminLayout
      active="slots"
      title={`Edit slot · Block ${slot.id}`}
      sub={`Parking Slot Management / Block ${slot.block} / Slot ${pad2(slot.number)}`}
      right={
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/admin/slots')}>
          Back to spaces
        </Button>
      }
    >
      {locked && (
        <Note tone="warn" icon={CircleAlert} title="Active-session lock · Changes restricted" className="mb-6">
          {slot.id} is {slot.status === 'claimed' ? 'being claimed by the entrance kiosk' : 'occupied by an active parking session'}. Status, block, slot and vehicle category cannot be changed until the session is completed through confirmed payment. A dropdown never frees an active bay.
        </Note>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="Space identity" />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input label="Block" value={slot.block} locked />
              <Input label="Slot number" value={pad2(slot.number)} locked />
            </div>
            <div className="mt-5">
              {locked ? (
                <Input label="Supported vehicle category" value={slot.category} locked />
              ) : (
                <>
                  <span className="mb-2 block text-[13px]">Supported vehicle category</span>
                  <Select label="Category" value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
                </>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs text-muted">
              <Badge tone="ok" className="py-1.5">
                {slot.block} + {pad2(slot.number)} is unique
              </Badge>
              Existing record retained · no duplicate bay
            </div>
          </Card>
          <Card className="p-6">
            <CardHead title="Space status" sub={locked ? 'Current status is locked while an active ticket is associated.' : 'Reserved and unavailable spaces are excluded from kiosk assignment.'} />
            <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {options.map((o) => {
                const isCur = status === o
                const disabled = locked ? o !== slot.status : o === 'occupied'
                const tone = { available: 'border-ok bg-ok-50 text-ok', occupied: 'border-bad bg-bad-50 text-bad', reserved: 'border-warn bg-warn-50 text-warn', unavailable: 'border-slate-500 bg-slate-100 text-ink', claimed: '' }[o]
                return (
                  <button
                    key={o}
                    disabled={disabled}
                    onClick={() => setStatus(o)}
                    className={cx('rounded-md border px-3 py-3 text-left transition', isCur ? tone : 'border-line bg-canvas text-muted', disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-brand/50')}
                  >
                    <div className="text-sm">{cap(o)}</div>
                    <div className="mt-1.5 text-[11px] opacity-80">{isCur ? (locked ? 'Selected · Locked' : 'Selected') : disabled ? (o === 'occupied' ? 'Set by ticket issuance' : 'Unavailable while active') : 'Select'}</div>
                  </button>
                )
              })}
            </div>
            <div className="mt-6">
              {locked ? (
                <Input label="Operational reason / notes" value="Active ticket association · automatic occupancy" locked />
              ) : (
                <Input
                  label="Operational reason / notes"
                  value={needsReason ? reason : 'Eligible for assignment'}
                  disabled={!needsReason}
                  placeholder={needsReason ? 'e.g. Surface maintenance' : ''}
                  onChange={(e) => setReason(e.target.value)}
                  hint={needsReason && reason.trim().length < 3 ? 'A reason is required for reserved or unavailable spaces.' : undefined}
                />
              )}
            </div>
            <p className="mt-5 text-[13px] text-muted">When no session is active, Reserved or Unavailable requires a reason. Category and block changes are validated before saving.</p>
            <div className="mt-6 flex flex-col items-start gap-5">
              <Button icon={locked ? Lock : undefined} disabled={!canSave} className="uppercase" onClick={save}>
                {locked ? 'Save changes · Locked' : 'Save changes'}
              </Button>
              <Button variant="secondary" size="md" onClick={() => navigate('/admin/slots')}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
        <div>
          {session ? (
            <Card className="p-6">
              <CardHead title="Linked active session" />
              <Badge className="mt-5 py-1.5">{state.checkout?.ticketId === session.ticketId ? 'Checkout open · Unpaid' : 'Active · Unpaid'}</Badge>
              <div className="tabular mt-5 text-xl">{session.ticketId}</div>
              <Rows
                labelWidth="w-[150px]"
                className="mt-5"
                rows={[
                  ['Category', session.category],
                  ['Entry time', fmtLong(session.entry)],
                  ['Elapsed', fmtDurationLong(Math.floor((t - session.entry) / 60000))],
                  ['Occupied bay', slot.id],
                ]}
              />
              <Button icon={Ticket} className="mt-6 w-full" onClick={() => navigate(`/admin/sessions?ticket=${session.ticketId}`)}>
                View session
              </Button>
              <Note className="mt-5" title="Release through checkout only">
                Confirmed exit payment closes this session and makes the space available in one completion step.
              </Note>
            </Card>
          ) : (
            <Card className="p-6">
              <CardHead title="Assignment eligibility" />
              <Badge tone={slot.status === 'available' ? 'ok' : 'warn'} className="mt-5 py-1.5">
                {slot.status === 'available' ? 'Assignable by kiosk' : 'Excluded from kiosk'}
              </Badge>
              <Rows labelWidth="w-[150px]" className="mt-5" rows={[['Current status', cap(slot.status)], ['Reason', slot.reason], ['Linked session', 'None']]} />
              <Note className="mt-5" title="No active session">
                This space can be edited. Changes apply immediately to self-service assignment.
              </Note>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
