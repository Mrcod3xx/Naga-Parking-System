import { useState, type ReactNode } from 'react'
import AdminLayout from './AdminLayout'
import { Badge, Button, Card, CardHead, cx, toast } from '../components/ui'
import { updateSettings, useNow, useStore } from '../store/store'
import { blocks } from '../store/logic'
import { fmtDay, fmtTime } from '../lib/format'

function Tile({ label, value, note, tone, children }: { label: string; value?: ReactNode; note: string; tone?: 'ok' | 'muted'; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="text-[11px] text-muted">{label}</div>
      {children ?? <div className={cx('mt-2 text-[26px] leading-tight', tone === 'ok' && 'text-ok', tone === 'muted' && 'text-muted')}>{value}</div>}
      <div className="mt-2 text-[11px] leading-snug text-muted">{note}</div>
    </div>
  )
}

function Section({ title, sub, tiles, listTitle, items }: { title: string; sub: string; tiles: ReactNode; listTitle: string; items: string[] }) {
  return (
    <Card className="p-5">
      <CardHead title={title} sub={sub} />
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{tiles}</div>
      <div className="mt-5 text-[13px]">{listTitle}</div>
      <ul className="mt-3 space-y-2 text-xs text-muted">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
            {i}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function SettingsPage() {
  const t = useNow()
  const slots = useStore((s) => s.slots)
  const settings = useStore((s) => s.settings)
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState<number | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const bl = blocks(slots)
  return (
    <AdminLayout active="settings" title="Administrator · Settings" sub={`${fmtDay(t)} · ${fmtTime(t)} · Naga City People's Mall · Asia/Manila`} right={<Badge className="py-2">Demo workspace</Badge>}>
      <div className="space-y-5">
        <Section
          title="Facility settings"
          sub="Operational defaults for Naga City People's Mall"
          tiles={
            <>
              <Tile label="Facility" value="People's Mall" note={`Naga Smart Park · ${slots.length} spaces`} />
              <Tile label="Timezone" value="Asia/Manila" note="UTC+08:00 · fixed" />
              <Tile label="Blocks" value={bl.length} note={bl.map((b) => b.id).join(' · ')} />
              <Tile label="Receipt printers" value={draft.receiptPrinters} note="Entrance kiosk + exit scanner" />
            </>
          }
          listTitle="Facility rules"
          items={[
            'QR parking system only — no entrance attendant, no plate collection, no plate scanning.',
            'QR identifies the unique session and retrieves entry timestamp, assigned slot, rate version, and payment status from stored session data.',
            'Assignment is atomic: valid, available, category-compatible, and never duplicated. Issued ticket occupies the space until payment is confirmed.',
            'Payment must be explicitly confirmed before the session can close. A paid ticket cannot be charged twice.',
            'Rate policy version is frozen at entry. Admin edits apply only to new sessions, and attendants cannot edit fees arbitrarily.',
          ]}
        />
        <Section
          title="Entrance kiosk"
          sub="Self-service touchscreen configuration"
          tiles={
            <>
              <Tile label="Receipt printer" value="Thermal" note="80 mm roll · demo printer" />
              <Tile label="Welcome reset" note="Idle timeout after ticket issuance">
                <div className="mt-2 flex items-center gap-2">
                  {[10, 15, 30].map((s) => (
                    <button key={s} onClick={() => setDraft({ ...draft, welcomeResetSec: s })} className={cx('tabular cursor-pointer rounded-md px-2.5 py-1.5 text-sm transition', draft.welcomeResetSec === s ? 'bg-brand text-white' : 'bg-canvas text-body hover:bg-brand-50')}>
                      {s}s
                    </button>
                  ))}
                </div>
              </Tile>
              <Tile label="Auto welcome" note="Return to the welcome screen on idle">
                <button
                  role="switch"
                  aria-checked={draft.autoWelcome}
                  onClick={() => setDraft({ ...draft, autoWelcome: !draft.autoWelcome })}
                  className="mt-2 flex cursor-pointer items-center gap-3 text-[22px]"
                >
                  <span className={cx('relative h-6 w-11 rounded-full transition', draft.autoWelcome ? 'bg-ok' : 'bg-slate-300')}>
                    <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]', draft.autoWelcome ? 'left-[22px]' : 'left-0.5')} />
                  </span>
                  <span className={draft.autoWelcome ? 'text-ok' : 'text-muted'}>{draft.autoWelcome ? 'Enabled' : 'Disabled'}</span>
                </button>
              </Tile>
              <Tile label="Status" value="Demo" tone="ok" note="Local demonstration · no real backend" />
            </>
          }
          listTitle="Entrance behavior"
          items={['Only category-compatible available spaces are shown to the user.', 'Assignment is claimed immediately after selection and becomes occupied when the ticket is issued.', 'If the user cancels or the kiosk resets, the claimed slot is released back to the available pool.']}
        />
        <Section
          title="Exit scanner"
          sub="Payment confirmation and release workflow"
          tiles={
            <>
              <Tile label="Receipt printer" value="Thermal" note="80 mm roll · exit lane printer" />
              <Tile label="Payment confirmation" value="Explicit" note="Payment must be confirmed before release" />
              <Tile label="Release behavior" value="Paid only" note="Slot released after payment confirmation" />
              <Tile label="Status" value="Demo" tone="ok" note="Local demonstration · no real backend" />
            </>
          }
          listTitle="Exit behavior"
          items={['Exit scanner reads the QR code and checks the stored session for payment status.', 'If payment is confirmed, the session is closed, the slot is released, and the receipt is printed.', 'If payment is not confirmed, the exit workflow remains blocked until payment is resolved.']}
        />
        <Section
          title="Role controls"
          sub="Access levels for administrators and attendants"
          tiles={
            <>
              <Tile label="Administrator" value="Full access" note="Settings, rates, reports, and session review" />
              <Tile label="Attendant" value="Exit only" note="Validate sessions, confirm payment, print receipts" />
              <Tile label="Rate editing" value="Admin only" note="Attendants cannot change fees or create arbitrary charges" />
              <Tile label="Session override" value="Disabled" tone="ok" note="No manual fee editing or duplicate charging" />
            </>
          }
          listTitle="Access rules"
          items={['Administrators manage facility settings, rate policies, and account access.', 'Attendants can monitor active sessions, validate payment status, and assist users without editing fees.', 'Session overrides are disabled to prevent manual fee changes and duplicate charges.']}
        />
        <Section
          title="Session data and QR security"
          sub="Principles for stored session data and QR validation"
          tiles={
            <>
              <Tile label="Stored data source" value="Session record" note="Entry timestamp, slot, rate version, and payment status" />
              <Tile label="QR validation" value="Stored session" note="QR reads session ID and checks stored record" />
              <Tile label="Duplicate protection" value="Enabled" tone="ok" note="No duplicate assignments or duplicate charges" />
              <Tile label="Receipt data" value="Printed only" note="Printed receipt is a user-facing copy of the stored session" />
            </>
          }
          listTitle="Security principles"
          items={[
            'The QR code identifies the unique session and retrieves data from the stored session record, not from printed receipt data.',
            'Assignment is atomic: one session, one slot, one rate version, and one payment status.',
            'Payment confirmation is required before the session can close and the slot can be released.',
            'A paid ticket cannot be charged twice, and duplicate assignments are prevented by the stored session record.',
          ]}
        />
        <Card className="p-5">
          <CardHead title="Save controls" sub="Review and apply changes to facility settings" />
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile label="Save status" value={dirty ? 'Unsaved' : saved ? 'Applied' : 'Up to date'} tone="ok" note={dirty ? 'Changes ready for review' : 'No pending changes'} />
            <Tile label="Last updated" value={saved ? fmtTime(saved) : '—'} note={saved ? fmtDay(saved) : 'No changes this session'} />
            <Tile label="Apply to" value="Kiosk" note="Takes effect on the next kiosk visit" />
            <Tile label="Backend" value="Local" tone="muted" note="Stored in this browser only" />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="muted" size="md" disabled={!dirty} onClick={() => setDraft(settings)}>
              Discard
            </Button>
            <Button
              size="md"
              disabled={!dirty}
              onClick={() => {
                updateSettings(draft)
                setSaved(t)
                toast('Settings applied', 'ok')
              }}
            >
              Apply changes
            </Button>
          </div>
          <p className="mt-4 text-[11px] text-muted">This demo stores data locally in your browser. No backend connection is established.</p>
        </Card>
      </div>
    </AdminLayout>
  )
}
