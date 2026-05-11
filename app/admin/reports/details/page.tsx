'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Check, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'

type FilterPeriod = 'all' | 'today' | '7d' | '30d' | '90d' | '12mo' | 'ytd'
type Direction = 'past' | 'future'

const PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'void', 'cancelled'] as const
const BULK_SETTABLE_PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'void'] as const
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const
type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
type BookingStatus = (typeof BOOKING_STATUSES)[number]

const FILTER_OPTIONS: Array<{ value: FilterPeriod; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12mo', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
]

function periodLabel(p: FilterPeriod): string {
  return FILTER_OPTIONS.find(o => o.value === p)?.label ?? 'All time'
}

interface DetailsResponse {
  filters: {
    period: FilterPeriod
    direction: Direction
    paymentStatus: PaymentStatus[]
    status: BookingStatus[]
    dateStart: string | null
    dateEndExclusive: string
  }
  summary: {
    count: number
    revenue: number
    paidCount: number
    totalAmount: number
    avgTicket: number
  }
  bookings: Array<{
    id: string
    booking_date: string
    booking_time: string
    duration_minutes: number
    price_charged: number
    payment_status: PaymentStatus
    status: BookingStatus
    paid_at: string | null
    customer_name: string
    customer_email: string
    service_name: string
    service_category: string | null
  }>
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatTime(time: string): string {
  if (!time) return ''
  const m12 = time.match(/^(\d{1,2}):(\d{2})/)
  if (!m12) return time
  let h = parseInt(m12[1], 10)
  const min = m12[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

function StatusBadge({ value, kind }: { value: PaymentStatus | BookingStatus; kind: 'payment' | 'booking' }) {
  const styles: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-800',
    pending: kind === 'payment' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-800',
    refunded: 'bg-rose-100 text-rose-800',
    void: 'bg-zinc-200 text-zinc-700',
    confirmed: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-slate-100 text-slate-600',
  }
  const cls = styles[value] || 'bg-neutral-100 text-neutral-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-[0.06em] ${cls}`}>
      {value}
    </span>
  )
}

function PeriodDropdown({
  period,
  onChange,
  disabled,
}: {
  period: FilterPeriod
  onChange: (p: FilterPeriod) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md border border-black bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-black hover:bg-neutral-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {periodLabel(period)}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-md border-black min-w-[180px]">
        {FILTER_OPTIONS.map(o => {
          const active = o.value === period
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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] border transition-colors ${
        active
          ? 'border-black bg-black text-white'
          : 'border-neutral-300 bg-white text-neutral-600 hover:border-black hover:text-black'
      }`}
    >
      {label}
    </button>
  )
}

function buildQuery(params: {
  period: FilterPeriod
  direction: Direction
  paymentStatus: PaymentStatus[]
  status: BookingStatus[]
}): string {
  const sp = new URLSearchParams()
  sp.set('period', params.period)
  if (params.direction === 'future') sp.set('direction', 'future')
  if (params.paymentStatus.length < PAYMENT_STATUSES.length) {
    sp.set('paymentStatus', params.paymentStatus.join(','))
  }
  if (params.status.length < BOOKING_STATUSES.length) {
    sp.set('status', params.status.join(','))
  }
  return sp.toString()
}

function DetailsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialPeriod = (searchParams.get('period') as FilterPeriod) || 'all'
  const initialDirection: Direction = searchParams.get('direction') === 'future' ? 'future' : 'past'
  const paymentParam = searchParams.get('paymentStatus')
  const statusParam = searchParams.get('status')
  const initialPayment = paymentParam
    ? paymentParam.split(',').filter((s): s is PaymentStatus => (PAYMENT_STATUSES as readonly string[]).includes(s))
    : Array.from(PAYMENT_STATUSES)
  const initialStatus = statusParam
    ? statusParam.split(',').filter((s): s is BookingStatus => (BOOKING_STATUSES as readonly string[]).includes(s))
    : Array.from(BOOKING_STATUSES)

  const [period, setPeriod] = useState<FilterPeriod>(initialPeriod)
  const [direction, setDirection] = useState<Direction>(initialDirection)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus[]>(initialPayment)
  const [status, setStatus] = useState<BookingStatus[]>(initialStatus)

  const [data, setData] = useState<DetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [search, setSearch] = useState('')

  // Sync state to URL when filters change
  useEffect(() => {
    const qs = buildQuery({ period, direction, paymentStatus, status })
    router.replace(`/admin/reports/details?${qs}`, { scroll: false })
  }, [period, direction, paymentStatus, status, router])

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [period, direction, paymentStatus, status])

  // Fetch data when filters change
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const qs = buildQuery({ period, direction, paymentStatus, status })
        const res = await fetch(`/api/admin/reports/details?${qs}`)
        if (!res.ok) throw new Error('Failed to load details')
        const json = (await res.json()) as DetailsResponse
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
  }, [period, direction, paymentStatus, status, refetchToken])

  const filteredBookings = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.bookings
    return data.bookings.filter(
      b =>
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_email.toLowerCase().includes(q) ||
        b.service_name.toLowerCase().includes(q)
    )
  }, [data, search])

  const filteredSummary = useMemo(() => {
    if (!data) return null
    if (!search.trim()) return data.summary
    const revenue = filteredBookings
      .filter(r => r.payment_status === 'paid')
      .reduce((s, r) => s + (r.price_charged || 0), 0)
    const paidCount = filteredBookings.filter(r => r.payment_status === 'paid').length
    const totalAmount = filteredBookings.reduce((s, r) => s + (r.price_charged || 0), 0)
    return {
      count: filteredBookings.length,
      revenue,
      paidCount,
      totalAmount,
      avgTicket: paidCount > 0 ? revenue / paidCount : 0,
    }
  }, [data, search, filteredBookings])

  const visibleIds = useMemo(() => filteredBookings.map(b => b.id), [filteredBookings])
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id))
  const someSelected = !allSelected && selectedIds.size > 0

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleIds))
    }
  }
  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const bulkUpdate = async (updates: { payment_status?: PaymentStatus; status?: BookingStatus }) => {
    if (selectedIds.size === 0) return
    const action = updates.payment_status
      ? `mark payment as ${updates.payment_status}`
      : `set status to ${updates.status}`
    const n = selectedIds.size
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} for ${n} booking${n === 1 ? '' : 's'}?`)) return

    try {
      setBulkUpdating(true)
      const res = await fetch('/api/admin/bookings/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), ...updates }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update')

      const skipped = (json.skipped || []) as Array<{ id: string; reason: string }>
      if (skipped.length > 0) {
        toast.success(`Updated ${json.updated}. Skipped ${skipped.length} (${skipped[0].reason}).`)
      } else {
        toast.success(`Updated ${json.updated} booking${json.updated === 1 ? '' : 's'}`)
      }

      setSelectedIds(new Set())
      setRefetchToken(t => t + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setBulkUpdating(false)
    }
  }

  const togglePayment = (s: PaymentStatus) => {
    setPaymentStatus(prev => {
      const has = prev.includes(s)
      if (has && prev.length === 1) return prev // keep at least one selected
      return has ? prev.filter(x => x !== s) : [...prev, s]
    })
  }
  const toggleStatus = (s: BookingStatus) => {
    setStatus(prev => {
      const has = prev.includes(s)
      if (has && prev.length === 1) return prev
      return has ? prev.filter(x => x !== s) : [...prev, s]
    })
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 max-w-7xl">
      <div className="mb-4">
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-neutral-600 hover:text-black"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to Reports
        </Link>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Bookings Detail</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Range
            </span>
            <div className="inline-flex overflow-hidden rounded-md border border-black">
              <button
                type="button"
                onClick={() => setDirection('past')}
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] ${
                  direction === 'past' ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'
                }`}
              >
                Past
              </button>
              <button
                type="button"
                onClick={() => setDirection('future')}
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] ${
                  direction === 'future' ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'
                }`}
              >
                Future
              </button>
            </div>
          </div>

          {direction === 'past' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Period
              </span>
              <PeriodDropdown period={period} onChange={setPeriod} />
            </div>
          )}
          {direction === 'future' && (
            <span className="text-xs text-neutral-500">Next 30 days</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 mr-1">
            Payment
          </span>
          {PAYMENT_STATUSES.map(s => (
            <FilterChip
              key={s}
              label={s}
              active={paymentStatus.includes(s)}
              onClick={() => togglePayment(s)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 mr-1">
            Status
          </span>
          {BOOKING_STATUSES.map(s => (
            <FilterChip
              key={s}
              label={s}
              active={status.includes(s)}
              onClick={() => toggleStatus(s)}
            />
          ))}
        </div>

        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
            strokeWidth={2}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer name, email, or service…"
            className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-9 text-sm placeholder:text-neutral-400 focus:border-black focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-black"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      {data && !loading && filteredSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="rounded-lg border-black shadow-none py-0">
            <CardContent className="px-5 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600 mb-2">
                Bookings
              </div>
              <div className="text-2xl font-semibold">{filteredSummary.count.toLocaleString()}</div>
              {search.trim() && (
                <div className="text-xs text-neutral-500 mt-1">
                  of {data.summary.count.toLocaleString()} total
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-lg border-black shadow-none py-0">
            <CardContent className="px-5 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600 mb-2">
                Revenue (paid)
              </div>
              <div className="text-2xl font-semibold">{formatCurrency(filteredSummary.revenue)}</div>
              <div className="text-xs text-neutral-500 mt-1">
                {filteredSummary.paidCount.toLocaleString()} paid
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-black shadow-none py-0">
            <CardContent className="px-5 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600 mb-2">
                Total amount
              </div>
              <div className="text-2xl font-semibold">{formatCurrency(filteredSummary.totalAmount)}</div>
              <div className="text-xs text-neutral-500 mt-1">
                {search.trim() ? 'filtered rows' : 'all rows'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {data && !loading && !error && selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 border border-black bg-black px-4 py-3 text-white">
          <span className="text-xs font-medium uppercase tracking-[0.1em]">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={bulkUpdating}
                className="inline-flex items-center gap-2 border border-white/40 bg-transparent px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] hover:bg-white/10 disabled:opacity-50"
              >
                Set payment
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-md border-black min-w-[160px]">
                {BULK_SETTABLE_PAYMENT_STATUSES.map(p => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => bulkUpdate({ payment_status: p })}
                    className="text-xs uppercase tracking-[0.1em] cursor-pointer"
                  >
                    Mark {p}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={bulkUpdating}
                className="inline-flex items-center gap-2 border border-white/40 bg-transparent px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] hover:bg-white/10 disabled:opacity-50"
              >
                Set status
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-md border-black min-w-[160px]">
                {BOOKING_STATUSES.map(s => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => bulkUpdate({ status: s })}
                    className="text-xs uppercase tracking-[0.1em] cursor-pointer"
                  >
                    Mark {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {bulkUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-white/70 hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Clear
          </button>
        </div>
      )}

      {data && !loading && !error && (
        <Card className="rounded-lg border-black shadow-none py-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-black">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      ref={el => {
                        if (el) el.indeterminate = someSelected
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer accent-black"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-600">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-600">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-600">
                    Service
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-600">
                    Amount
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-600">
                    Payment
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-neutral-500">
                      {search.trim()
                        ? `No bookings match "${search}".`
                        : 'No bookings match these filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map(b => {
                    const isSelected = selectedIds.has(b.id)
                    return (
                      <tr
                        key={b.id}
                        className={`border-b border-neutral-200 hover:bg-neutral-50 ${
                          isSelected ? 'bg-neutral-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select booking ${b.id}`}
                            checked={isSelected}
                            onChange={() => toggleRow(b.id)}
                            className="h-4 w-4 cursor-pointer accent-black"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{formatDate(b.booking_date)}</div>
                          <div className="text-xs text-neutral-500">{formatTime(b.booking_time)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-[200px]">{b.customer_name}</div>
                          {b.customer_email && (
                            <div className="text-xs text-neutral-500 truncate max-w-[200px]">
                              {b.customer_email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-[220px]">{b.service_name}</div>
                          {b.service_category && (
                            <div className="text-xs text-neutral-500">{b.service_category}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {formatCurrency(b.price_charged || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={b.payment_status} kind="payment" />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={b.status} kind="booking" />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default function ReportsDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      }
    >
      <DetailsContent />
    </Suspense>
  )
}
