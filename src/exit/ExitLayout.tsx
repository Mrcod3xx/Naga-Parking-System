import type { ReactNode } from 'react'
import { CircleCheck, CircleDot, Lock } from 'lucide-react'
import { Badge, cx, Logo, type Tone } from '../components/ui'
import { navigate } from '../lib/router'
import { OPERATOR, useNow } from '../store/store'
import { fmtDay, fmtTime } from '../lib/format'

const TABS = ['Exit Dashboard', 'QR Scanner', 'Parking Fee', 'Payment Confirmation', 'Receipt']

export default function ExitLayout({
  stage,
  links = {},
  title,
  sub,
  snapshot = 'brand',
  snapshotLabel,
  children,
}: {
  stage: number
  links?: Partial<Record<number, string>>
  title: ReactNode
  sub: ReactNode
  snapshot?: Tone
  snapshotLabel?: string
  children: ReactNode
}) {
  const t = useNow()
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <div className="text-lg leading-tight">Naga Smart Park</div>
              <div className="text-[11px] tracking-[0.02em] text-muted uppercase">Naga City People's Mall</div>
            </div>
          </div>
          <Badge upper className="hidden py-1.5 sm:inline-flex">
            Exit operations
          </Badge>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-ok-50 text-[15px] text-ok">MS</div>
            <div className="hidden sm:block">
              <div className="text-sm">{OPERATOR.name}</div>
              <div className="text-xs text-muted">Exit attendant · {OPERATOR.terminal}</div>
            </div>
          </div>
        </div>
      </header>
      <nav className="bg-navy">
        <div className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-4 lg:px-8">
          {TABS.map((label, i) => {
            const done = i < stage
            const cur = i === stage
            const href = links[i]
            const Icon = done ? CircleCheck : cur ? CircleDot : Lock
            const clickable = !!href && !cur
            return (
              <button
                key={label}
                disabled={!clickable}
                onClick={() => href && navigate(href)}
                className={cx(
                  'flex h-[66px] shrink-0 items-center gap-2.5 rounded-md px-3 text-sm whitespace-nowrap transition',
                  cur ? 'text-white' : done ? 'text-slate-300' : 'text-slate-500',
                  clickable ? 'cursor-pointer hover:text-white' : 'cursor-default',
                )}
              >
                <Icon className={cx('size-[18px]', cur && 'text-sky-300')} strokeWidth={1.6} />
                {label}
              </button>
            )
          })}
          <span className="ml-auto hidden shrink-0 pl-6 text-xs text-slate-300 xl:block">Later stages unlock after review</span>
        </div>
      </nav>
      <main className="mx-auto max-w-[1440px] px-6 pt-11 pb-10 lg:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[32px] leading-tight tracking-[-0.01em] text-ink">{title}</h1>
            <p className="mt-2 text-[15px] text-muted">{sub}</p>
          </div>
          <Badge tone={snapshot} className="py-2">
            {snapshotLabel ?? `${fmtTime(t)} · Live terminal`}
          </Badge>
        </div>
        <div className="animate-fade-up">{children}</div>
        <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-line pt-9 text-xs text-muted">
          <span>Stored session data is authoritative · Fees cannot be overridden</span>
          <span>
            {fmtDay(t)} · Asia/Manila · Demo terminal
          </span>
        </footer>
      </main>
    </div>
  )
}
