'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowUpRight, Check, ChevronDown, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'

type FilterPeriod = 'all' | 'today' | '7d' | '30d' | '90d' | '12mo' | 'ytd'

const FILTER_OPTIONS: Array<{ value: FilterPeriod; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12mo', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
]

function filterLabel(p: FilterPeriod): string {
  return FILTER_OPTIONS.find(o => o.value === p)?.label ?? 'All time'
}

function comparisonLabel(p: FilterPeriod): string {
  switch (p) {
    case '7d':
      return 'vs prior 7 days'
    case '30d':
      return 'vs prior 30 days'
    case '90d':
      return 'vs prior 90 days'
    case '12mo':
      return 'vs prior 12 months'
    case 'ytd':
      return 'vs same period last year'
    default:
      return ''
  }
}

interface DeltaKpi {
  current: number
  prior?: number
  pctChange?: number | null
}

interface NewVsLoyaltySummary {
  newRevenue: number
  loyaltyRevenue: number
  newCount: number
  loyaltyCount: number
  newCustomers: number
  loyaltyCustomers: number
  newAvgTicket: number
  loyaltyAvgTicket: number
}

interface ReportData {
  filter: FilterPeriod
  hasComparison: boolean
  windows: {
    current: { start: string | null; endExclusive: string }
    prior: { start: string; endExclusive: string } | null
    future: { start: string; endExclusive: string }
  }
  kpis: {
    revenue: DeltaKpi
    volume: DeltaKpi
    avgTicket: DeltaKpi
    newVsLoyalty: {
      current: NewVsLoyaltySummary
      prior: NewVsLoyaltySummary | null
    }
    cancellationRate: DeltaKpi
    utilization: DeltaKpi & { currentAvailableMinutes: number; currentBookedMinutes: number }
    retention: {
      current: { rate: number; retained: number; total: number }
      prior: { rate: number; retained: number; total: number } | null
      pctChange: number | null
    }
    outstanding: DeltaKpi
    projected: { revenue: number; count: number; days: number }
  }
  categories: {
    current: Array<{ category: string; revenue: number; volume: number }>
    prior: Array<{ category: string; revenue: number; volume: number }> | null
  }
  topServices: Array<{ name: string; revenue: number; volume: number }>
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

function formatHours(minutes: number): string {
  const h = minutes / 60
  return `${h.toFixed(1)}h`
}

function formatDateLabel(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function inclusiveEnd(endExclusive: string): string {
  return new Date(new Date(endExclusive).getTime() - 86400000).toISOString().slice(0, 10)
}

function DeltaPill({ pctChange, invert = false }: { pctChange: number | null; invert?: boolean }) {
  if (pctChange === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
        <Minus className="h-3 w-3" /> n/a
      </span>
    )
  }
  const positive = pctChange >= 0
  const isGood = invert ? !positive : positive
  const Icon = positive ? TrendingUp : TrendingDown
  const color = isGood ? 'text-emerald-600' : 'text-red-600'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pctChange).toFixed(1)}%
    </span>
  )
}

function KpiCard({
  label,
  value,
  subValue,
  pctChange,
  invert,
  href,
}: {
  label: string
  value: string
  subValue?: string
  pctChange?: number | null
  invert?: boolean
  href?: string
}) {
  const card = (
    <Card
      className={`group relative rounded-lg border-black shadow-none py-0 ${
        href ? 'cursor-pointer transition-all hover:bg-neutral-50 hover:shadow-md' : ''
      }`}
    >
      {href && (
        <span
          aria-hidden
          className="absolute top-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 transition-colors group-hover:border-black group-hover:bg-black group-hover:text-white"
        >
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      )}
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
            {label}
          </span>
          {pctChange !== undefined && (
            <span className={href ? 'mr-8' : ''}>
              <DeltaPill pctChange={pctChange} invert={invert} />
            </span>
          )}
        </div>
        <div className="text-2xl font-semibold text-black">{value}</div>
        {subValue && <div className="text-xs text-neutral-500 mt-1">{subValue}</div>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{card}</Link> : card
}

function FilterDropdown({
  filter,
  onChange,
}: {
  filter: FilterPeriod
  onChange: (p: FilterPeriod) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-black bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-black hover:bg-neutral-100 focus:outline-none">
        {filterLabel(filter)}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-md border-black min-w-[180px]">
        {FILTER_OPTIONS.map(o => {
          const active = o.value === filter
          return (
            <DropdownMenuItem
              key={o.value}
              onClick={() => onChange(o.value)}
              className="text-xs uppercase tracking-[0.1em] cursor-pointer gap-2"
            >
              <Check
                className={`h-3.5 w-3.5 ${active ? 'opacity-100' : 'opacity-0'}`}
                strokeWidth={2}
              />
              {o.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function AdminReportsPage() {
  const [filter, setFilter] = useState<FilterPeriod>('all')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/admin/reports?period=${filter}`)
        if (!res.ok) throw new Error('Failed to load reports')
        const json = (await res.json()) as ReportData
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [filter])

  const subtitle = (() => {
    if (!data) return filterLabel(filter)
    if (filter === 'all') return 'All time'
    if (filter === 'today') {
      const start = data.windows.current.start
      return start ? `Today (${formatDateLabel(start)})` : 'Today'
    }
    const start = data.windows.current.start
    if (!start) return filterLabel(filter)
    return `${filterLabel(filter)} (${formatDateLabel(start)} – ${formatDateLabel(inclusiveEnd(data.windows.current.endExclusive))})`
  })()

  const showCompare = data?.hasComparison ?? false
  const compareText = showCompare ? comparisonLabel(filter) : ''

  return (
    <div className="container mx-auto py-4 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
          <p className="text-gray-600 mt-1 text-sm">
            <span>{subtitle}</span>
            {compareText && <span className="ml-1 text-neutral-500">{compareText}</span>}
          </p>
        </div>
        <FilterDropdown filter={filter} onChange={setFilter} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      )}

      {error && !loading && (
        <Card className="rounded-lg border-red-300 bg-red-50">
          <CardContent className="px-5 py-4 text-sm text-red-800">{error}</CardContent>
        </Card>
      )}

      {data && !loading && !error && (
        <div className="space-y-6">
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="Revenue"
              value={formatCurrency(data.kpis.revenue.current)}
              subValue={
                showCompare && data.kpis.revenue.prior !== undefined
                  ? `${formatCurrency(data.kpis.revenue.prior)} prior`
                  : undefined
              }
              pctChange={showCompare ? data.kpis.revenue.pctChange : undefined}
              href={`/admin/reports/details?period=${filter}&paymentStatus=paid`}
            />
            <KpiCard
              label="Bookings"
              value={data.kpis.volume.current.toLocaleString()}
              subValue={
                showCompare && data.kpis.volume.prior !== undefined
                  ? `${data.kpis.volume.prior.toLocaleString()} prior`
                  : undefined
              }
              pctChange={showCompare ? data.kpis.volume.pctChange : undefined}
            />
            <KpiCard
              label="Avg Ticket"
              value={formatCurrency(data.kpis.avgTicket.current)}
              subValue={
                showCompare && data.kpis.avgTicket.prior !== undefined
                  ? `${formatCurrency(data.kpis.avgTicket.prior)} prior`
                  : undefined
              }
              pctChange={showCompare ? data.kpis.avgTicket.pctChange : undefined}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              label="Capacity Utilization"
              value={formatPct(data.kpis.utilization.current)}
              subValue={`${formatHours(data.kpis.utilization.currentBookedMinutes)} of ${formatHours(
                data.kpis.utilization.currentAvailableMinutes
              )} booked`}
              pctChange={showCompare ? data.kpis.utilization.pctChange : undefined}
            />
            <KpiCard
              label="Outstanding Revenue"
              value={formatCurrency(data.kpis.outstanding.current)}
              subValue={
                showCompare && data.kpis.outstanding.prior !== undefined
                  ? `Unpaid invoices · ${formatCurrency(data.kpis.outstanding.prior)} prior`
                  : 'Unpaid invoices'
              }
              pctChange={showCompare ? data.kpis.outstanding.pctChange : undefined}
              invert
              href={`/admin/reports/details?period=${filter}&paymentStatus=pending&status=pending,confirmed,completed`}
            />
            <KpiCard
              label={`Projected (next ${data.kpis.projected.days} days)`}
              value={formatCurrency(data.kpis.projected.revenue)}
              subValue={`${data.kpis.projected.count.toLocaleString()} bookings`}
              href={`/admin/reports/details?direction=future&status=pending,confirmed`}
            />
          </div>

          {/* New vs Loyalty */}
          <Card className="rounded-lg border-black shadow-none py-0">
            <CardContent className="px-5 py-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
                  New vs Loyalty
                </span>
                <span className="flex items-center gap-4 text-[11px] uppercase tracking-[0.1em] text-neutral-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-green-500" /> New
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-indigo-500" /> Loyalty
                  </span>
                </span>
              </div>
              {(() => {
                const c = data.kpis.newVsLoyalty.current
                const p = data.kpis.newVsLoyalty.prior
                return (
                  <div className="space-y-5">
                    <SplitBarRow
                      label="Customers"
                      newValue={c.newCustomers}
                      loyaltyValue={c.loyaltyCustomers}
                      priorNewValue={p?.newCustomers}
                      priorLoyaltyValue={p?.loyaltyCustomers}
                      format={v => v.toLocaleString()}
                    />
                    <SplitBarRow
                      label="Bookings"
                      newValue={c.newCount}
                      loyaltyValue={c.loyaltyCount}
                      priorNewValue={p?.newCount}
                      priorLoyaltyValue={p?.loyaltyCount}
                      format={v => v.toLocaleString()}
                    />
                    <SplitBarRow
                      label="Revenue"
                      newValue={c.newRevenue}
                      loyaltyValue={c.loyaltyRevenue}
                      priorNewValue={p?.newRevenue}
                      priorLoyaltyValue={p?.loyaltyRevenue}
                      format={formatCurrency}
                    />
                    <div className="border-t border-neutral-200 pt-4">
                      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600 mb-2">
                        Avg Ticket
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="h-2 w-2 bg-green-500" />
                            <span className="text-xs font-medium uppercase tracking-[0.1em]">
                              New
                            </span>
                          </div>
                          <div className="text-lg font-semibold">
                            {formatCurrency(c.newAvgTicket)}
                          </div>
                          {p && (
                            <div className="text-xs text-neutral-500">
                              {formatCurrency(p.newAvgTicket)} prior
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="h-2 w-2 bg-indigo-500" />
                            <span className="text-xs font-medium uppercase tracking-[0.1em]">
                              Loyalty
                            </span>
                          </div>
                          <div className="text-lg font-semibold">
                            {formatCurrency(c.loyaltyAvgTicket)}
                          </div>
                          {p && (
                            <div className="text-xs text-neutral-500">
                              {formatCurrency(p.loyaltyAvgTicket)} prior
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Revenue by Category and Top Services */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="rounded-lg border-black shadow-none py-0">
              <CardContent className="px-5 py-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600 mb-3">
                  Revenue by Category
                </div>
                {data.categories.current.length === 0 ? (
                  <div className="text-sm text-neutral-500 py-4">No service categories defined.</div>
                ) : (
                  <CategoryPie
                    rows={data.categories.current}
                    priorRows={data.categories.prior}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-lg border-black shadow-none py-0">
              <CardContent className="px-5 py-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600 mb-3">
                  Top Services
                </div>
                {data.topServices.length === 0 ? (
                  <div className="text-sm text-neutral-500 py-4">No completed bookings.</div>
                ) : (
                  <ul className="divide-y divide-neutral-200">
                    {data.topServices.map(s => (
                      <li key={s.name} className="flex items-center justify-between py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.name}</div>
                          <div className="text-xs text-neutral-500">
                            {s.volume.toLocaleString()} bookings
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums">
                          {formatCurrency(s.revenue)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function SplitBarRow({
  label,
  newValue,
  loyaltyValue,
  priorNewValue,
  priorLoyaltyValue,
  format,
}: {
  label: string
  newValue: number
  loyaltyValue: number
  priorNewValue?: number
  priorLoyaltyValue?: number
  format: (v: number) => string
}) {
  const total = newValue + loyaltyValue
  const newPct = total > 0 ? (newValue / total) * 100 : 0
  const loyaltyPct = total > 0 ? (loyaltyValue / total) * 100 : 0
  const priorTotal =
    priorNewValue !== undefined && priorLoyaltyValue !== undefined
      ? priorNewValue + priorLoyaltyValue
      : null
  const priorNewPct =
    priorTotal !== null && priorTotal > 0 ? ((priorNewValue as number) / priorTotal) * 100 : null
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
          {label}
        </span>
        {priorNewPct !== null && (
          <span className="text-[11px] text-neutral-400">
            prior split {formatPct(priorNewPct, 0)} / {formatPct(100 - priorNewPct, 0)}
          </span>
        )}
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-black mb-1.5">
        <div
          className="bg-green-500"
          style={{ width: `${newPct}%` }}
          title={`New: ${formatPct(newPct)}`}
        />
        <div
          className="bg-indigo-500"
          style={{ width: `${loyaltyPct}%` }}
          title={`Loyalty: ${formatPct(loyaltyPct)}`}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>
          <span className="font-semibold tabular-nums">{format(newValue)}</span>
          <span className="text-neutral-500 ml-1.5">{formatPct(newPct, 0)}</span>
        </span>
        <span className="text-right">
          <span className="text-neutral-500 mr-1.5">{formatPct(loyaltyPct, 0)}</span>
          <span className="font-semibold tabular-nums">{format(loyaltyValue)}</span>
        </span>
      </div>
    </div>
  )
}

const CATEGORY_COLORS = [
  '#111111',
  '#6366F1',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#8B5CF6',
  '#EC4899',
  '#84CC16',
  '#64748B',
]

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
) {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle)
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle)
  const startInner = polarToCartesian(cx, cy, rInner, startAngle)
  const endInner = polarToCartesian(cx, cy, rInner, endAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function CategoryPie({
  rows,
  priorRows,
}: {
  rows: Array<{ category: string; revenue: number; volume: number }>
  priorRows: Array<{ category: string; revenue: number; volume: number }> | null
}) {
  const priorMap = priorRows ? new Map(priorRows.map(r => [r.category, r.revenue])) : null
  const colored = rows.map((r, i) => ({
    ...r,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }))
  const total = colored.reduce((s, r) => s + r.revenue, 0)
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const rOuter = 80
  const rInner = 48

  let cumulative = 0
  const slices = colored
    .filter(r => r.revenue > 0)
    .map(r => {
      const fraction = r.revenue / total
      const startAngle = (cumulative / total) * 360
      const endAngle = startAngle + fraction * 360
      cumulative += r.revenue
      return { ...r, startAngle, endAngle, fraction }
    })

  return (
    <div className="flex flex-col sm:flex-row gap-5 items-start">
      <div className="shrink-0 mx-auto sm:mx-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={(rOuter + rInner) / 2}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={rOuter - rInner}
            />
          )}
          {slices.length === 1 && (
            <circle
              cx={cx}
              cy={cy}
              r={(rOuter + rInner) / 2}
              fill="none"
              stroke={slices[0].color}
              strokeWidth={rOuter - rInner}
            />
          )}
          {slices.length > 1 &&
            slices.map(s => (
              <path
                key={s.category}
                d={arcPath(cx, cy, rOuter, rInner, s.startAngle, s.endAngle)}
                fill={s.color}
              />
            ))}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-neutral-500"
            style={{ fontSize: 10, letterSpacing: '0.08em' }}
          >
            TOTAL
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            className="fill-black"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            {formatCurrency(total)}
          </text>
        </svg>
      </div>
      <ul className="flex-1 min-w-0 w-full space-y-2">
        {colored.map(r => {
          const prior = priorMap?.get(r.category) ?? 0
          const change =
            priorMap === null
              ? null
              : prior === 0
                ? r.revenue === 0
                  ? 0
                  : null
                : ((r.revenue - prior) / prior) * 100
          const pct = total > 0 ? (r.revenue / total) * 100 : 0
          return (
            <li key={r.category} className="flex items-center gap-3 text-sm">
              <span
                className="h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="flex-1 min-w-0 truncate font-medium">{r.category}</span>
              <span className="tabular-nums text-neutral-500 text-xs w-12 text-right">
                {pct.toFixed(0)}%
              </span>
              <span className="tabular-nums font-semibold w-20 text-right">
                {formatCurrency(r.revenue)}
              </span>
              {priorMap !== null && (
                <span className="w-14 text-right">
                  <DeltaPill pctChange={change} />
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
