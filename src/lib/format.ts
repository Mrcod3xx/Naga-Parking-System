const TZ = 'Asia/Manila'

export const fmtTime = (t: number) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(t)

/** October 16, 2026, 8:30 PM */
export const fmtLong = (t: number) =>
  `${new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric' }).format(t)}, ${fmtTime(t)}`

/** 16 October 2026 */
export const fmtDay = (t: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(t)

/** 16 Oct 2026 */
export const fmtDayShort = (t: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(t)

export const fmtPHP = (n: number, decimals = false) =>
  `PHP ${n.toLocaleString('en-US', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })}`

export const minutesBetween = (a: number, b: number) => Math.max(0, Math.floor((b - a) / 60000))

/** 1 hour 45 minutes */
export function fmtDurationLong(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const parts: string[] = []
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`)
  if (m || !h) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  return parts.join(' ')
}

/** 1h 45m */
export function fmtDurationShort(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export const pad2 = (n: number) => String(n).padStart(2, '0')

export function ordinal(n: number) {
  const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
  if (n <= 10) return words[n - 1]
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
