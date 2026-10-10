import type { T } from '../i18n'

export interface Series {
  label: string
  color: string
  pts: [number, number][]
}

const W = 640
const H = 320
const M = { l: 48, r: 14, t: 12, b: 40 }

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

interface Props {
  series: Series[]
  marker: [number, number] | null
  /** mm per displayed x unit. */
  xFactor: number
  xUnit: string
  t: T
}

export default function Chart({ series, marker, xFactor, xUnit, t }: Props) {
  const xMax = Math.max(...series.flatMap((s) => s.pts.map((p) => p[0])))
  const yMax = niceMax(Math.max(...series.flatMap((s) => s.pts.map((p) => p[1])), marker?.[1] ?? 0))
  const X = (x: number) => M.l + (x / xMax) * (W - M.l - M.r)
  const Y = (y: number) => H - M.b - (y / yMax) * (H - M.t - M.b)
  const ticks = (max: number) => Array.from({ length: 6 }, (_, i) => (max * i) / 5)
  const fx = (v: number) => String(Number((v / xFactor).toPrecision(3)))
  const fy = (v: number) => String(Number(v.toPrecision(3)))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t('Current vs trace width')}>
      <rect width={W} height={H} fill="var(--chart-bg)" />
      {ticks(xMax).map((x) => (
        <g key={`x${x}`}>
          <line x1={X(x)} x2={X(x)} y1={M.t} y2={H - M.b} stroke="var(--grid)" />
          <text x={X(x)} y={H - M.b + 15} textAnchor="middle" fill="var(--chart-fg)" fontSize="11">{fx(x)}</text>
        </g>
      ))}
      {ticks(yMax).map((y) => (
        <g key={`y${y}`}>
          <line x1={M.l} x2={W - M.r} y1={Y(y)} y2={Y(y)} stroke="var(--grid)" />
          <text x={M.l - 6} y={Y(y) + 4} textAnchor="end" fill="var(--chart-fg)" fontSize="11">{fy(y)}</text>
        </g>
      ))}
      <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke="var(--grid-strong)" />
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--grid-strong)" />
      <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fill="var(--chart-fg)" fontSize="12">{t('Trace width ({0})', xUnit)}</text>
      <text transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--chart-fg)" fontSize="12">{t('Current (A)')}</text>
      {series.map((s, i) => (
        <g key={s.label}>
          <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} />
          <text x={W - M.r - 4} y={M.t + 14 + i * 14} textAnchor="end" fill={s.color} fontSize="12">{s.label}</text>
        </g>
      ))}
      {marker && marker[0] <= xMax && (
        <g>
          <line x1={X(marker[0])} x2={X(marker[0])} y1={M.t} y2={H - M.b} stroke="var(--ref-line)" strokeDasharray="4 3" />
          <line x1={M.l} x2={W - M.r} y1={Y(marker[1])} y2={Y(marker[1])} stroke="var(--ref-line)" strokeDasharray="4 3" />
          <circle cx={X(marker[0])} cy={Y(marker[1])} r="5" fill="var(--ref-line)" />
          <text x={X(marker[0]) + 8} y={Y(marker[1]) - 8} fill="var(--ref-line)" fontSize="12">{t('Your trace')}</text>
        </g>
      )}
    </svg>
  )
}
