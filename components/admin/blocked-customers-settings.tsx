'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Ban, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'

interface CustomerOption {
  id: string
  name: string
  email: string
  phone: string
}

interface BlockedCustomer {
  customer_id: string
  reason: string | null
  blocked_by: string | null
  blocked_at: string
  customers: { name: string; email: string; phone: string } | null
}

const MAX_RESULTS = 8

// Settings > Customers: block customers from booking new appointments online
export function BlockedCustomersSettings() {
  const [blocked, setBlocked] = useState<BlockedCustomer[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CustomerOption | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [unblockTarget, setUnblockTarget] = useState<BlockedCustomer | null>(null)

  const fetchBlocked = async () => {
    const response = await fetch('/api/admin/blocked-customers')
    if (!response.ok) throw new Error('Failed to load blocked customers')
    const data = await response.json()
    setBlocked(data.blocked || [])
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [, customersResponse] = await Promise.all([fetchBlocked(), fetch('/api/admin/customers')])
        if (!customersResponse.ok) throw new Error('Failed to load customers')
        const data = await customersResponse.json()
        setCustomers(data.customers || [])
      } catch (error) {
        console.error('Error loading blocked customers:', error)
        toast.error('Failed to load customers')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const blockedIds = useMemo(() => new Set(blocked.map(b => b.customer_id)), [blocked])

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    const digits = term.replace(/\D/g, '')
    return customers
      .filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        (digits.length >= 3 && c.phone?.replace(/\D/g, '').includes(digits))
      )
      .slice(0, MAX_RESULTS)
  }, [customers, search])

  const handleBlock = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/blocked-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selected.id, reason }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to block customer')
      toast.success(`${selected.name} can no longer book online`)
      setSelected(null)
      setReason('')
      setSearch('')
      await fetchBlocked()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to block customer')
    } finally {
      setSaving(false)
    }
  }

  const handleUnblock = async () => {
    if (!unblockTarget) return
    const name = unblockTarget.customers?.name || 'Customer'
    try {
      const response = await fetch(`/api/admin/blocked-customers/${unblockTarget.customer_id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to unblock customer')
      toast.success(`${name} can book online again`)
      await fetchBlocked()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unblock customer')
    } finally {
      setUnblockTarget(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Blocked Customers
          </CardTitle>
          <p className="text-sm text-gray-600">
            Blocked customers aren&apos;t told they&apos;re blocked. When they book or reschedule online, every date shows as fully
            booked, and waitlist requests are accepted but never notified. They can still view and cancel existing
            appointments, and you can still book for them from the admin.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Block a customer */}
          <div className="space-y-3">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3 p-3 border border-black">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{selected.name}</div>
                    <div className="text-sm text-gray-500 break-all">{selected.email}</div>
                    <div className="text-sm text-gray-500">{selected.phone}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)} title="Choose a different customer">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor="block-reason">Reason (optional, only visible to admins)</Label>
                  <Textarea
                    id="block-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Repeated no-shows"
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <Button onClick={handleBlock} disabled={saving} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                  Block from Booking
                </Button>
              </>
            ) : (
              <>
                <Label htmlFor="block-search">Block a customer</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="block-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={loading ? 'Loading customers…' : 'Search by name, email, or phone…'}
                    disabled={loading}
                    className="pl-9"
                  />
                </div>
                {search.trim() && (
                  <div className="border border-gray-200 divide-y divide-gray-200">
                    {results.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">No customers match &ldquo;{search.trim()}&rdquo;</p>
                    ) : (
                      results.map(customer => {
                        const alreadyBlocked = blockedIds.has(customer.id)
                        return (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => setSelected(customer)}
                            disabled={alreadyBlocked}
                            className="w-full text-left p-3 hover:bg-gray-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className={`font-medium ${alreadyBlocked ? 'text-gray-400' : 'text-gray-900'}`}>{customer.name}</div>
                                <div className="text-sm text-gray-500 truncate">{customer.email} · {customer.phone}</div>
                              </div>
                              {alreadyBlocked && <span className="text-xs text-red-600 shrink-0">Blocked</span>}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Currently blocked */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Currently blocked ({blocked.length})</h3>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : blocked.length === 0 ? (
              <p className="text-sm text-gray-500">No customers are blocked.</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {blocked.map(entry => (
                  <div key={entry.customer_id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{entry.customers?.name || 'Unknown customer'}</div>
                      <div className="text-sm text-gray-500 break-all">{entry.customers?.email}</div>
                      {entry.reason && <p className="text-sm text-gray-700 mt-1">{entry.reason}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        Blocked {formatDate(entry.blocked_at)}{entry.blocked_by ? ` by ${entry.blocked_by}` : ''}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setUnblockTarget(entry)} className="shrink-0">
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!unblockTarget} onOpenChange={(open) => { if (!open) setUnblockTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock {unblockTarget?.customers?.name || 'customer'}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be able to book appointments and join the waitlist online again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblock}>Unblock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
