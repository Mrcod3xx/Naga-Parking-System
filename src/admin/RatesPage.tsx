import { useState } from 'react'
import AdminLayout from './AdminLayout'
import { Badge, Button, Card, CardHead, cx, Rows, Select, toast } from '../components/ui'
import { saveRates, useStore } from '../store/store'
import { calcFee, categoryLocation, counts } from '../store/logic'
import { CATEGORIES, type Category, type Rate } from '../store/types'
import { fmtDay, fmtDayShort, fmtDurationShort } from '../lib/format'

const FIELDS: { key: keyof Rate; label: string; unit: 'PHP' | 'min' }[] = [
  { key: 'initial', label: 'Initial parking fee', unit: 'PHP' },
  { key: 'initialMin', label: 'Initial duration', unit: 'min' },
  { key: 'incrementMin', label: 'Additional increment', unit: 'min' },
  { key: 'additional', label: 'Additional rate', unit: 'PHP' },
]

export default function RatesPage() {
  const rates = useStore((s) => s.rates)
  const slots = useStore((s) => s.slots)
  const [draft, setDraft] = useState<Record<Category, Rate>>(rates.categories)
  const [grace, setGrace] = useState(rates.grace)
  const [cat, setCat] = useState<Category>('Motorcycle')
  const [minutes, setMinutes] = useState(105)
  const dirty = JSON.stringify(draft) !== JSON.stringify(rates.categories) || grace !== rates.grace
  const invalid = CATEGORIES.some((c) => FIELDS.some((f) => !(draft[c][f.key] >= (f.unit === 'min' ? 1 : 0))))
  const c = counts(slots)
  const r = draft[cat]
  const q = calcFee(r, minutes, grace)

  const setField = (c: Category, k: keyof Rate, v: string) => setDraft((d) => ({ ...d, [c]: { ...d[c], [k]: v === '' ? NaN : Number(v) } }))

  return (
    <AdminLayout active="rates" title="Parking rate management" sub="Configure motorcycle, car, van, and other rates. Exit fees are calculated from stored timestamps and cannot be overridden by attendants." right={<Badge className="py-2">Admin-only editing</Badge>}>
      <Card className="p-6">
        <CardHead title="Rate configuration" sub="DEMO EXAMPLES — not official LGU prices. Edits affect new sessions only. Saved rate version is used at entry." />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ['Rate version', rates.version + (dirty ? ' · draft' : '')],
            ['Effective date', fmtDay(rates.effective)],
            ['Timezone', 'Asia/Manila'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] text-muted">{k}</div>
              <div className="mt-1.5 text-sm">{v}</div>
            </div>
          ))}
          <label>
            <div className="text-[11px] text-muted">Grace period (min)</div>
            <input type="number" min={0} value={grace} onChange={(e) => setGrace(Math.max(0, Number(e.target.value)))} className="tabular mt-1 h-8 w-24 rounded-md border border-line px-2 text-sm outline-none focus:border-brand" />
          </label>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CATEGORIES.map((c) => (
            <div key={c} className="rounded-xl border border-line p-4">
              <div className="text-base">{c}</div>
              <div className="mt-1 text-[11px] text-muted">{categoryLocation(slots, c)} · Demo example</div>
              <div className="mt-4 space-y-2.5">
                {FIELDS.map((f) => {
                  const changed = draft[c][f.key] !== rates.categories[c][f.key]
                  return (
                    <label key={f.key} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="text-muted">{f.label}</span>
                      <span className={cx('flex items-center gap-1 rounded-md border px-2 transition focus-within:border-brand', changed ? 'border-brand/50 bg-brand-50' : 'border-transparent hover:border-line')}>
                        <span className="text-[11px] text-muted">{f.unit === 'PHP' ? 'PHP' : ''}</span>
                        <input
                          type="number"
                          min={0}
                          value={Number.isNaN(draft[c][f.key]) ? '' : draft[c][f.key]}
                          onChange={(e) => setField(c, f.key, e.target.value)}
                          className="tabular h-7 w-12 bg-transparent text-right outline-none"
                          aria-label={`${c} ${f.label}`}
                        />
                        <span className="text-[11px] text-muted">{f.unit === 'min' ? 'min' : ''}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-line p-4">
          <div className="text-base">Special parking rules</div>
          <Rows
            size="sm"
            labelWidth="w-[200px]"
            className="mt-4"
            rows={[
              ['Reserved slots', `${c.reserved} slot${c.reserved === 1 ? '' : 's'} excluded from self-service assignment`],
              ['Unavailable slots', `${c.unavailable} slot${c.unavailable === 1 ? '' : 's'} excluded from assignment`],
              ['Attendant override', 'Exit fee must use configured rate and stored timestamps'],
              ['Session rounding', 'Partial increments round up to the next full increment'],
            ]}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">{invalid ? 'Every rate needs a valid number. Durations must be at least 1 minute.' : 'Saved rate version is used at entry. Edits affect new sessions only.'}</p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              disabled={!dirty}
              onClick={() => {
                setDraft(rates.categories)
                setGrace(rates.grace)
              }}
            >
              Discard
            </Button>
            <Button
              size="md"
              disabled={!dirty || invalid}
              onClick={() => {
                const v = saveRates(draft, grace)
                toast(`Rate version ${v} saved · new sessions only`, 'ok')
              }}
            >
              Save rate version
            </Button>
          </div>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card className="p-6">
          <CardHead
            title="Rate preview"
            sub="Try a category and duration against the current draft"
            right={<Select label="Preview category" className="w-[160px]" value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />}
          />
          <label className="mt-6 block">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Parking duration</span>
              <span className="tabular">{fmtDurationShort(minutes)}</span>
            </div>
            <input type="range" min={5} max={480} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-3 w-full accent-[var(--color-brand)]" />
          </label>
          <dl className="mt-5 space-y-3 text-[13px]">
            {[
              ['Category', cat],
              ['Initial parking fee', `PHP ${r.initial}`],
              ['Additional time', `${q.extraMin} min`],
              ['Rounded to next increment', `${q.increments} increment${q.increments === 1 ? '' : 's'} of ${r.incrementMin} min`],
              ['Additional fee', `PHP ${q.additional}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-3 text-base">
              <dt>Total exit fee</dt>
              <dd className="tabular">PHP {Number.isNaN(q.total) ? '—' : q.total}</dd>
            </div>
          </dl>
          <div className="mt-5 rounded-lg bg-canvas px-4 py-3 text-[13px] text-muted">
            Calculation: PHP {r.initial} initial + PHP {q.additional} additional = PHP {q.total}. Attendants cannot change this fee arbitrarily.
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <CardHead title="Access rules" sub="Who can edit and who can only view rates." />
            <Rows
              size="sm"
              labelWidth="w-[96px]"
              className="mt-5"
              rows={[
                ['Administrator', 'Edit rates · save version'],
                ['Attendant', 'Read-only · no fee override'],
                ['Exit fee', 'Uses stored timestamps'],
                ['Partial time', 'Round up to next increment'],
              ]}
            />
          </Card>
          <Card className="p-6">
            <CardHead title="Version history" sub="Saved rate versions are used at entry." />
            <ul className="mt-5 space-y-4 text-[13px]">
              {rates.history.map((h, i) => (
                <li key={h.version} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="tabular">{h.version}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {fmtDayShort(h.effective)} · {h.by}
                    </div>
                  </div>
                  <Badge tone={i === 0 ? 'ok' : 'neutral'}>{i === 0 ? 'Current' : 'Archived'}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
