"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Edit, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SegmentRules {
  customerType?: string
  lastBookedWithinDays?: number | null
  hasNeverBooked?: boolean | null
  hasEmail?: boolean | null
}

interface Segment {
  id: string
  name: string
  type: 'rule_based' | 'manual'
  rules?: SegmentRules | null
  emails?: string[] | null
  contactCount: number
  created_at: string
  updated_at: string
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'rule_based' as 'rule_based' | 'manual',
    customerType: 'all' as string,
    lastBookedWithinDays: '' as string,
    hasNeverBooked: false,
    hasEmail: true,
    emailsText: ''
  })
  const [saving, setSaving] = useState(false)

  const fetchSegments = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/segments')
      if (res.ok) {
        const data = await res.json()
        setSegments(data.segments || [])
      }
    } catch (err) {
      console.error('Error fetching segments:', err)
      toast.error('Failed to load segments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSegments()
  }, [])

  const openCreateForm = () => {
    setEditingSegment(null)
    setFormData({
      name: '',
      type: 'rule_based',
      customerType: 'all',
      lastBookedWithinDays: '',
      hasNeverBooked: false,
      hasEmail: true,
      emailsText: ''
    })
    setShowForm(true)
  }

  const openEditForm = (seg: Segment) => {
    setEditingSegment(seg)
    const r = seg.rules
    setFormData({
      name: seg.name,
      type: seg.type,
      customerType: (r?.customerType === 'existing' ? 'loyalty' : r?.customerType) || 'all',
      lastBookedWithinDays: r?.lastBookedWithinDays != null ? String(r.lastBookedWithinDays) : '',
      hasNeverBooked: r?.hasNeverBooked ?? false,
      hasEmail: r?.hasEmail !== false,
      emailsText: seg.type === 'manual' ? (seg.emails || []).join('\n') : ''
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a segment name')
      return
    }
    setSaving(true)
    try {
      const rules: SegmentRules = { customerType: formData.customerType }
      if (formData.hasNeverBooked) rules.hasNeverBooked = true
      else if (formData.lastBookedWithinDays.trim()) {
        const n = parseInt(formData.lastBookedWithinDays, 10)
        if (n >= 1 && n <= 3650) rules.lastBookedWithinDays = n
      }
      if (!formData.hasEmail) rules.hasEmail = false

      const payload =
        formData.type === 'rule_based'
          ? { name: formData.name.trim(), type: 'rule_based', rules }
          : {
              name: formData.name.trim(),
              type: 'manual',
              emails: formData.emailsText
                .split(/[\n,]/)
                .map((e) => e.trim())
                .filter((e) => e && e.includes('@'))
            }

      const url = editingSegment ? `/api/admin/segments/${editingSegment.id}` : '/api/admin/segments'
      const method = editingSegment ? 'PATCH' : 'POST'
      const body = editingSegment
        ? formData.type === 'manual'
          ? { name: payload.name, emails: (payload as { emails: string[] }).emails }
          : { name: payload.name, rules: (payload as { rules: SegmentRules }).rules }
        : payload

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      toast.success(editingSegment ? 'Segment updated' : 'Segment created')
      setShowForm(false)
      fetchSegments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save segment')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (seg: Segment) => {
    if (!confirm(`Delete segment "${seg.name}"?`)) return
    try {
      const res = await fetch(`/api/admin/segments/${seg.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Segment deleted')
      fetchSegments()
      if (editingSegment?.id === seg.id) setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const typeLabel = (seg: Segment) => {
    if (seg.type === 'manual') return 'Manual list'
    const r = seg.rules
    const parts: string[] = []
    const ct = r?.customerType || 'all'
    if (ct === 'loyalty' || ct === 'existing') parts.push('Loyalty')
    else if (ct === 'new') parts.push('New')
    else parts.push('All')
    if (r?.lastBookedWithinDays) parts.push(`booked in last ${r.lastBookedWithinDays} days`)
    if (r?.hasNeverBooked) parts.push('never booked')
    if (r?.hasEmail === false) parts.push('no email')
    return parts.join(', ') + ' customers'
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Segments</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Create and manage recipient lists for email campaigns
            </p>
          </div>
          <Button onClick={openCreateForm} className="w-full sm:w-auto shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            New Segment
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading segments…</div>
        ) : segments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 mb-4">No segments yet. Create one to get started.</p>
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create Segment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {segments.map((seg) => (
              <Card key={seg.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate" title={seg.name}>{seg.name}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEditForm(seg)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(seg)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>{typeLabel(seg)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{seg.contactCount}</span>
                    <span>contacts</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSegment ? 'Edit Segment' : 'New Segment'}</DialogTitle>
            <DialogDescription>
              Segments can be rule-based (from customers) or a manual list of emails.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="seg-name">Name</Label>
              <Input
                id="seg-name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Loyalty customers"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v: 'rule_based' | 'manual') =>
                  setFormData((p) => ({ ...p, type: v }))
                }
                disabled={!!editingSegment}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rule_based">Rule-based (from customers)</SelectItem>
                  <SelectItem value="manual">Manual list</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.type === 'rule_based' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Include customers who match all selected rules (AND).</p>
                <div>
                  <Label>Customer type</Label>
                  <Select
                    value={formData.customerType}
                    onValueChange={(v) => setFormData((p) => ({ ...p, customerType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      <SelectItem value="loyalty">Loyalty customers</SelectItem>
                      <SelectItem value="new">New customers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasNeverBooked"
                    checked={formData.hasNeverBooked}
                    onChange={(e) => setFormData((p) => ({ ...p, hasNeverBooked: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="hasNeverBooked" className="font-normal cursor-pointer">
                    Has never booked
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastBookedDays">Has booked in last X days (optional)</Label>
                  <Input
                    id="lastBookedDays"
                    type="number"
                    min={1}
                    max={3650}
                    placeholder="e.g. 90"
                    value={formData.lastBookedWithinDays}
                    onChange={(e) => setFormData((p) => ({ ...p, lastBookedWithinDays: e.target.value }))}
                    disabled={formData.hasNeverBooked}
                  />
                  <p className="text-xs text-gray-500">
                    {formData.hasNeverBooked
                      ? 'Disabled when "Has never booked" is checked.'
                      : 'Leave empty to skip. Customers must have at least one booking within this period.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasEmail"
                    checked={formData.hasEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, hasEmail: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="hasEmail" className="font-normal cursor-pointer">
                    Has valid email (required for campaigns)
                  </Label>
                </div>
              </div>
            )}
            {formData.type === 'manual' && (
              <div>
                <Label>Email addresses (one per line or comma-separated)</Label>
                <Textarea
                  value={formData.emailsText}
                  onChange={(e) => setFormData((p) => ({ ...p, emailsText: e.target.value }))}
                  placeholder="email@example.com&#10;another@example.com"
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.emailsText
                    .split(/[\n,]/)
                    .filter((e) => e.trim() && e.includes('@')).length}{' '}
                  valid address(es)
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingSegment ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
