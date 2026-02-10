"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import dynamic from 'next/dynamic'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const RichTextEditor = dynamic(() => import('@/components/ui/rich-text-editor').then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border border-input bg-background min-h-[240px] flex items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
})
import { Loader2, Mail, Plus, Edit, Trash2, Send, BarChart3, X, Calendar, Users, CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { getActiveCampaigns, type CampaignConfig } from '@/lib/campaign-config'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface SendDetailItem {
  email: string
  success: boolean
  error?: string
}

interface SendHistoryItem {
  id: string
  campaign_id: string
  campaign_name: string
  subject: string
  total_recipients: number
  successful_sends: number
  failed_sends: number
  recipient_emails: string[]
  send_details?: SendDetailItem[] | null
  sent_at: string
}

const CAMPAIGN_VARIABLES = [
  { v: '{business_name}', d: 'Business name' },
  { v: '{business_phone}', d: 'Business phone' },
  { v: '{business_address}', d: 'Business address' },
  { v: '{registration_url}', d: 'Registration link' },
  { v: '{campaign_name}', d: 'Campaign name' },
  { v: '{customer_name}', d: "Customer's name" },
  { v: '{email}', d: "Recipient's email" },
  { v: '{customer_email}', d: "Recipient's email" },
  { v: '{current_date}', d: "Today's date" },
  { v: '{campaign_id}', d: 'Campaign ID' },
  { v: '{your_name}', d: 'Your name' }
]

const PREVIEW_SAMPLE_CAMPAIGN: Record<string, string> = {
  '{business_name}': 'DUST Studio',
  '{business_phone}': '(555) 123-4567',
  '{business_address}': '1942 Riverside Dr, Los Angeles, CA 90039',
  '{registration_url}': 'https://example.com/register',
  '{campaign_name}': 'Summer 2025',
  '{customer_name}': 'Jordan Smith',
  '{email}': 'jordan@example.com',
  '{customer_email}': 'jordan@example.com',
  '{current_date}': 'Monday, February 10, 2025',
  '{campaign_id}': 'summer_2025',
  '{your_name}': 'DUST Studio'
}

function previewCampaignWithSample(text: string): string {
  let out = text
  for (const [variable, value] of Object.entries(PREVIEW_SAMPLE_CAMPAIGN)) {
    out = out.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value)
  }
  return out
}

/** Allowed tags for campaign message preview (safe subset). */
const PREVIEW_ALLOWED_TAGS = /^(p|br|strong|em|u|ul|ol|li|a|div|span)$/i

function sanitizePreviewHtml(html: string): string {
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    if (!PREVIEW_ALLOWED_TAGS.test(tagName)) return ''
    return match.startsWith('</') ? `</${tagName.toLowerCase()}>` : match
  })
}

function isMessageHtml(message: string): boolean {
  return /<[a-z][\s\S]*>/i.test((message || '').trim())
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignConfig | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<{total: number; successful: number; failed: number; details: Array<{success: boolean; email: string; error?: string}>} | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Campaign details panel state
  const [detailsCampaign, setDetailsCampaign] = useState<CampaignConfig | null>(null)
  const [campaignHistory, setCampaignHistory] = useState<SendHistoryItem[]>([])
  const [loadingCampaignHistory, setLoadingCampaignHistory] = useState(false)
  
  const [newCampaign, setNewCampaign] = useState({
    id: '',
    name: '',
    description: '',
    registrationUrl: '',
    customerType: 'both' as 'new' | 'loyalty' | 'both', // default for API; only set when sending
    subject: '',
    message: '',
    buttonText: ''
  })
  const [segments, setSegments] = useState<Array<{ id: string; name: string; type: string; contactCount: number }>>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [loadingSegments, setLoadingSegments] = useState(false)

  // Drill-down modal for sent/failed details
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [drillDownData, setDrillDownData] = useState<{
    details: SendDetailItem[]
    campaign: CampaignConfig
    label?: string
  } | null>(null)

  const fetchCampaignHistory = useCallback(async (campaignId: string) => {
    setLoadingCampaignHistory(true)
    try {
      const response = await fetch(`/api/admin/campaign-history?campaignId=${campaignId}`)
      if (response.ok) {
        const data = await response.json()
        setCampaignHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching campaign history:', error)
    } finally {
      setLoadingCampaignHistory(false)
    }
  }, [])

  const openCampaignDetails = (campaign: CampaignConfig) => {
    setDetailsCampaign(campaign)
    fetchCampaignHistory(campaign.id)
  }

  const closeCampaignDetails = () => {
    setDetailsCampaign(null)
    setCampaignHistory([])
  }

  // Calculate aggregate stats for a campaign
  const getCampaignStats = (history: SendHistoryItem[]) => {
    return history.reduce((acc, send) => ({
      totalSends: acc.totalSends + 1,
      totalRecipients: acc.totalRecipients + send.total_recipients,
      successfulSends: acc.successfulSends + send.successful_sends,
      failedSends: acc.failedSends + send.failed_sends
    }), { totalSends: 0, totalRecipients: 0, successfulSends: 0, failedSends: 0 })
  }

  useEffect(() => {
    const fetchCampaigns = async () => {
      const updatedCampaigns = await getActiveCampaigns()
      setCampaigns(updatedCampaigns)
    }
    fetchCampaigns()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingSegments(true)
    fetch('/api/admin/segments')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.segments) setSegments(data.segments)
      })
      .catch(() => { if (!cancelled) setSegments([]) })
      .finally(() => { if (!cancelled) setLoadingSegments(false) })
    return () => { cancelled = true }
  }, [selectedCampaign])

  const handleSendCampaign = async (campaign: CampaignConfig) => {
    if (!selectedSegmentId) {
      toast.error('Please select a segment.')
      return
    }

    let emails: string[]
    try {
      const res = await fetch(`/api/admin/segments/${selectedSegmentId}/contacts`)
      if (!res.ok) throw new Error('Failed to load segment contacts')
      const data = await res.json()
      emails = data.emails || []
    } catch {
      toast.error('Failed to load segment contacts')
      return
    }

    if (emails.length === 0) {
      toast.error('This segment has no contacts.')
      return
    }

    setIsSending(true)
    setSendResults(null)

    try {
      const response = await fetch('/api/admin/send-campaign-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailList: emails,
          subject: campaign.emailTemplate.subject,
          message: campaign.emailTemplate.message,
          campaignName: campaign.id,
          registrationUrl: campaign.registrationUrl,
          buttonText: campaign.buttonText ?? ''
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const msg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to send campaign')
        throw new Error(msg)
      }

      if (response.status === 202 && data.jobId) {
        setIsSending(false)
        toast.success(data.message || 'Campaign queued. Sending in background.')
        const pollJob = async () => {
          const res = await fetch(`/api/admin/campaign-send-job/${data.jobId}`)
          const job = await res.json().catch(() => null)
          if (!job) return
          if (job.status === 'completed' && job.result) {
            setSendResults(job.result)
            toast.success(`Campaign sent to ${job.result.total || 0} recipients via Broadcasts`)
            if (detailsCampaign && detailsCampaign.id === campaign.id) fetchCampaignHistory(campaign.id)
          } else if (job.status === 'failed') {
            toast.error(job.errorMessage || 'Campaign send failed')
          } else {
            setTimeout(pollJob, 2000)
          }
        }
        pollJob()
        return
      }

      setSendResults(data.results)
      toast.success(data.message || `Campaign sent to ${data.results?.total || 0} recipients via Broadcasts`)
      if (detailsCampaign && detailsCampaign.id === campaign.id) {
        fetchCampaignHistory(campaign.id)
      }
    } catch (error) {
      console.error('Error sending campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send campaign')
    } finally {
      setIsSending(false)
    }
  }

  const handleResendToFailed = async (campaign: CampaignConfig, failedEmails: string[]) => {
    if (failedEmails.length === 0) return
    setIsSending(true)
    setDrillDownOpen(false)
    setDrillDownData(null)
    try {
      const response = await fetch('/api/admin/send-campaign-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailList: failedEmails,
          subject: campaign.emailTemplate.subject,
          message: campaign.emailTemplate.message,
          campaignName: campaign.id,
          registrationUrl: campaign.registrationUrl,
          buttonText: campaign.buttonText ?? ''
        })
      })
      const data = await response.json()
      if (!response.ok) {
        const msg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to resend')
        throw new Error(msg)
      }
      if (response.status === 202 && data.jobId) {
        setIsSending(false)
        toast.success(data.message || 'Resend queued. Sending in background.')
        const pollJob = async () => {
          const res = await fetch(`/api/admin/campaign-send-job/${data.jobId}`)
          const job = await res.json().catch(() => null)
          if (!job) return
          if (job.status === 'completed' && job.result) {
            setSendResults(job.result)
            toast.success(`Resend complete: ${job.result.total || 0} sent via Broadcasts`)
            if (detailsCampaign && detailsCampaign.id === campaign.id) fetchCampaignHistory(campaign.id)
          } else if (job.status === 'failed') {
            toast.error(job.errorMessage || 'Resend failed')
          } else {
            setTimeout(pollJob, 2000)
          }
        }
        pollJob()
        return
      }
      setSendResults(data.results)
      toast.success(data.message || `Resend complete: ${data.results?.total || 0} sent via Broadcasts`)
      if (detailsCampaign && detailsCampaign.id === campaign.id) {
        fetchCampaignHistory(campaign.id)
      }
    } catch (error) {
      console.error('Error resending to failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to resend')
    } finally {
      setIsSending(false)
    }
  }

  const handleCreateCampaign = async () => {
    if (!newCampaign.id || !newCampaign.name || !newCampaign.subject || !newCampaign.message) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      // Check if this is an update (campaign already exists) or create
      const isUpdate = campaigns.some(c => c.id === newCampaign.id)
      
      const payload = {
        id: newCampaign.id,
        name: newCampaign.name,
        description: newCampaign.description,
        registrationUrl: newCampaign.registrationUrl,
        customerType: newCampaign.customerType,
        subject: newCampaign.subject,
        message: newCampaign.message,
        buttonText: newCampaign.buttonText
      }
      
      const response = await fetch(isUpdate ? `/api/admin/campaigns/${newCampaign.id}` : '/api/admin/campaigns', {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Campaign API error response:', error)
        throw new Error(error.details || error.error || `Failed to ${isUpdate ? 'update' : 'create'} campaign`)
      }

      toast.success(`Campaign ${isUpdate ? 'updated' : 'created'} successfully!`)
      setShowCreateForm(false)
      setSelectedCampaign(null)
      setNewCampaign({
        id: '',
        name: '',
        description: '',
        registrationUrl: '',
        customerType: 'loyalty',
        subject: '',
        message: '',
        buttonText: ''
      })
      // Refresh campaigns list
      const updatedCampaigns = await getActiveCampaigns()
      setCampaigns(updatedCampaigns)
    } catch (error) {
      console.error('Error creating/updating campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create/update campaign')
    }
  }

  const handleNewCampaignClick = () => {
    setSelectedCampaign(null) // Close any selected campaign
    setShowCreateForm(true)
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete campaign')
      }

      toast.success('Campaign deleted successfully!')
      // Refresh campaigns list
      const updatedCampaigns = await getActiveCampaigns()
      setCampaigns(updatedCampaigns)
      setSelectedCampaign(null) // Close any selected campaign
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete campaign')
    }
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">Campaign Management</h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
              Manage and send email campaigns to your customers
            </p>
          </div>
          <Button onClick={handleNewCampaignClick} className="w-full sm:w-auto shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Campaign List */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="relative min-w-0">
              <CardHeader className="pb-2 sm:pb-6">
                <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                  <span className="font-semibold text-base sm:text-lg truncate pr-2" title={campaign.name}>
                    {campaign.name}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCampaignDetails(campaign)}
                      title="View stats & history"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaign(campaign)
                        setShowCreateForm(false)
                      }}
                      title="Send campaign"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewCampaign({
                          id: campaign.id,
                          name: campaign.name,
                          description: campaign.description || '',
                          registrationUrl: campaign.registrationUrl || '',
                          customerType: campaign.customerType || 'loyalty',
                          subject: campaign.emailTemplate?.subject || '',
                          message: campaign.emailTemplate?.message || '',
                          buttonText: campaign.buttonText ?? ''
                        })
                        setShowCreateForm(true)
                        setSelectedCampaign(null)
                      }}
                      title="Edit campaign"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>{campaign.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 sm:pt-0">
                <div className="space-y-2 text-sm min-w-0">
                  <div className="break-all"><strong>URL:</strong> {campaign.registrationUrl}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><strong>Status:</strong>
                    <span className={`inline-flex px-2 py-1 rounded text-xs ${
                      campaign.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign Sender */}
        {selectedCampaign && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                <Mail className="h-5 w-5 shrink-0" />
                <span className="wrap-break-word">Send Campaign: {selectedCampaign.name}</span>
              </CardTitle>
              <CardDescription>
                {selectedCampaign.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Recipients</Label>
                <Select
                  value={selectedSegmentId ?? ''}
                  onValueChange={(v) => setSelectedSegmentId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingSegments ? (
                      <SelectItem value="_loading" disabled>Loading segments…</SelectItem>
                    ) : segments.length === 0 ? (
                      <SelectItem value="_empty" disabled>No segments yet</SelectItem>
                    ) : (
                      segments.map((seg) => (
                        <SelectItem key={seg.id} value={seg.id}>
                          {seg.name} ({seg.contactCount} contacts)
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Create and manage segments in <Link href="/admin/segments" className="underline hover:no-underline">Segments</Link>. Campaigns are sent via Resend Broadcasts (no daily limit).
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Email preview</Label>
                <p className="text-xs text-gray-500">This is what will be sent. To change it, edit the campaign first.</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden min-h-[160px] flex flex-col">
                  <div className="border-b border-gray-200 bg-white px-3 py-2 shrink-0">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Subject</div>
                    <div className="text-sm font-medium text-gray-900 wrap-break-word">
                      {previewCampaignWithSample(selectedCampaign.emailTemplate.subject)}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 bg-white flex-1 overflow-auto">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Message</div>
                    {isMessageHtml(selectedCampaign.emailTemplate.message) ? (
                      <div
                        className="text-sm text-gray-800 font-sans [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2"
                        dangerouslySetInnerHTML={{
                          __html: sanitizePreviewHtml(previewCampaignWithSample(selectedCampaign.emailTemplate.message)),
                        }}
                      />
                    ) : (
                      <div className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                        {previewCampaignWithSample(selectedCampaign.emailTemplate.message)}
                      </div>
                    )}
                  </div>
                  {selectedCampaign.registrationUrl && selectedCampaign.buttonText && (
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
                      Button: &quot;{selectedCampaign.buttonText}&quot;
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => handleSendCampaign(selectedCampaign)}
                disabled={
                  isSending ||
                  !selectedSegmentId ||
                  loadingSegments ||
                  (segments.find((s) => s.id === selectedSegmentId)?.contactCount ?? 0) === 0
                }
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Campaign...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Campaign
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Campaign Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {campaigns.some(c => c.id === newCampaign.id) ? 'Edit Campaign' : 'Create New Campaign'}
              </CardTitle>
              <CardDescription>
                {campaigns.some(c => c.id === newCampaign.id) 
                  ? 'Edit your email campaign configuration'
                  : 'Create a new email campaign configuration'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaignId">Campaign ID</Label>
                  <Input
                    id="campaignId"
                    value={newCampaign.id}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g., summer_2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaignName">Campaign Name</Label>
                  <Input
                    id="campaignName"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Summer 2024 Campaign"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this campaign..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject line"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Available variables</Label>
                <p className="text-xs text-gray-500">Click to copy, then paste into subject or message.</p>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  {CAMPAIGN_VARIABLES.map(({ v, d }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(v)
                        toast.success(`Copied ${v}`)
                      }}
                      className="px-2 py-1.5 rounded text-xs font-mono bg-white border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0"
                      title={`${d} — click to copy`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="message">Email Message</Label>
                  <RichTextEditor
                    value={newCampaign.message}
                    onChange={(html) => setNewCampaign(prev => ({ ...prev, message: html }))}
                    placeholder="Email message content"
                    minHeight="240px"
                    editorKey={newCampaign.id || 'create'}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label className="text-sm font-medium">Email preview</Label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden min-h-[200px] flex flex-col">
                    <div className="border-b border-gray-200 bg-white px-3 py-2 shrink-0">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Subject</div>
                      <div className="text-sm font-medium text-gray-900 wrap-break-word">
                        {newCampaign.subject ? previewCampaignWithSample(newCampaign.subject) : '(No subject)'}
                      </div>
                    </div>
                    <div className="p-3 sm:p-4 bg-white flex-1 overflow-auto">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Message</div>
                      {newCampaign.message ? (
                        isMessageHtml(newCampaign.message) ? (
                          <div
                            className="text-sm text-gray-800 font-sans [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2"
                            dangerouslySetInnerHTML={{
                              __html: sanitizePreviewHtml(previewCampaignWithSample(newCampaign.message)),
                            }}
                          />
                        ) : (
                          <div className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                            {previewCampaignWithSample(newCampaign.message)}
                          </div>
                        )
                      ) : (
                        <div className="text-sm text-gray-500 font-sans">(No message yet)</div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Preview uses sample data.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registrationUrl">Button URL</Label>
                  <Input
                    id="registrationUrl"
                    value={newCampaign.registrationUrl}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, registrationUrl: e.target.value }))}
                    placeholder="/register/existing"
                  />
                  <p className="text-xs text-gray-500">Link the button goes to (e.g., /register/existing)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buttonText">Button Text</Label>
                  <Input
                    id="buttonText"
                    value={newCampaign.buttonText}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, buttonText: e.target.value }))}
                    placeholder="Create Your Account"
                  />
                  <p className="text-xs text-gray-500">Text displayed on the button</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateCampaign}>
                  {campaigns.some(c => c.id === newCampaign.id) ? 'Update Campaign' : 'Create Campaign'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateForm(false)
                    setSelectedCampaign(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Send Results */}
        {sendResults && selectedCampaign && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Send Results</CardTitle>
              <CardDescription>
                {sendResults.details && sendResults.details.length > 0
                  ? 'Click Successful or Failed to view details and resend to failed recipients.'
                  : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{sendResults.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (sendResults.details && selectedCampaign) {
                      setDrillDownData({
                        details: sendResults.details.map((d) => ({ email: d.email, success: d.success, error: d.error })),
                        campaign: selectedCampaign,
                        label: 'Latest send'
                      })
                      setDrillDownOpen(true)
                    }
                  }}
                  className={`text-center rounded-lg p-2 -m-2 transition-colors ${
                    sendResults.details ? 'hover:bg-gray-50 cursor-pointer' : ''
                  }`}
                >
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <CheckCircle className="h-5 w-5" />
                    {sendResults.successful}
                  </div>
                  <div className="text-sm text-gray-600">Successful</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sendResults.details && selectedCampaign) {
                      setDrillDownData({
                        details: sendResults.details.map((d) => ({ email: d.email, success: d.success, error: d.error })),
                        campaign: selectedCampaign,
                        label: 'Latest send'
                      })
                      setDrillDownOpen(true)
                    }
                  }}
                  className={`text-center rounded-lg p-2 -m-2 transition-colors ${
                    sendResults.details ? 'hover:bg-gray-50 cursor-pointer' : ''
                  }`}
                >
                  <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                    <XCircle className="h-5 w-5" />
                    {sendResults.failed}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Campaign Details Slide-out Panel */}
      {detailsCampaign && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeCampaignDetails}
          />
          
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-start gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold wrap-break-word">{detailsCampaign.name}</h2>
                <p className="text-gray-600 text-sm mt-1 wrap-break-word">{detailsCampaign.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeCampaignDetails}
                className="h-8 w-8 p-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
              {/* Campaign Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                    <Mail className="h-4 w-4" />
                    Subject
                  </div>
                  <div className="font-semibold truncate" title={detailsCampaign.emailTemplate.subject}>
                    {detailsCampaign.emailTemplate.subject}
                  </div>
                </div>
              </div>

              {/* Stats Summary */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Campaign Statistics</h3>
                {loadingCampaignHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : campaignHistory.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <p className="text-gray-500">This campaign hasn&apos;t been sent yet.</p>
                    <Button 
                      className="mt-4"
                      onClick={() => {
                        closeCampaignDetails()
                        setSelectedCampaign(detailsCampaign)
                      }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Campaign
                    </Button>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const stats = getCampaignStats(campaignHistory)
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">{stats.totalSends}</div>
                            <div className="text-xs text-blue-700">Times Sent</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-purple-600">{stats.totalRecipients}</div>
                            <div className="text-xs text-purple-700">Total Recipients</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-green-600">{stats.successfulSends}</div>
                            <div className="text-xs text-green-700">Delivered</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-red-600">{stats.failedSends}</div>
                            <div className="text-xs text-red-700">Failed</div>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* Send History */}
              {campaignHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Send History</h3>
                  <p className="text-xs text-gray-500 mb-2">
                    Click a send with failures to view details and resend to failed recipients.
                  </p>
                  <div className="space-y-3">
                    {campaignHistory.map((send) => {
                      const hasDetails = send.send_details && Array.isArray(send.send_details) && send.send_details.length > 0
                      const canDrillDown = (send.failed_sends > 0 || send.successful_sends > 0) && hasDetails
                      return (
                        <button
                          key={send.id}
                          type="button"
                          onClick={() => {
                            if (canDrillDown && detailsCampaign) {
                              setDrillDownData({
                                details: send.send_details as SendDetailItem[],
                                campaign: detailsCampaign,
                                label: new Date(send.sent_at).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })
                              })
                              setDrillDownOpen(true)
                            }
                          }}
                          className={`w-full text-left border rounded-lg p-4 transition-colors ${
                            canDrillDown
                              ? 'hover:bg-gray-50 cursor-pointer'
                              : 'cursor-default'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="h-4 w-4" />
                              {new Date(send.sent_at).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </div>
                            {canDrillDown && (
                              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-4 w-4 text-gray-400 shrink-0" />
                              <span className="text-sm"><strong>{send.total_recipients}</strong> recipients</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                              <span className="text-sm text-green-700"><strong>{send.successful_sends}</strong> sent</span>
                            </div>
                            {send.failed_sends > 0 && (
                              <div className="flex items-center gap-1.5">
                                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                <span className="text-sm text-red-700"><strong>{send.failed_sends}</strong> failed</span>
                              </div>
                            )}
                          </div>
                          {!hasDetails && send.failed_sends > 0 && (
                            <p className="mt-2 text-xs text-amber-600">
                              Per-recipient details not stored for this send. Run the migration in database-migrations/campaign-send-history-send-details.sql for future sends.
                            </p>
                          )}
                          {send.subject !== detailsCampaign.emailTemplate.subject && (
                            <div className="mt-2 text-xs text-gray-500">
                              Subject: {send.subject}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="border-t pt-4 sm:pt-6">
                <h3 className="font-semibold text-base sm:text-lg mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      closeCampaignDetails()
                      setSelectedCampaign(detailsCampaign)
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Campaign
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      closeCampaignDetails()
                      setNewCampaign({
                        id: detailsCampaign.id,
                        name: detailsCampaign.name,
                        description: detailsCampaign.description || '',
                        registrationUrl: detailsCampaign.registrationUrl || '',
                        customerType: detailsCampaign.customerType || 'loyalty',
                        subject: detailsCampaign.emailTemplate?.subject || '',
                        message: detailsCampaign.emailTemplate?.message || '',
                        buttonText: detailsCampaign.buttonText ?? ''
                      })
                      setShowCreateForm(true)
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Campaign
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drill-down modal: sent/failed details and resend */}
      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Send Details{drillDownData?.label ? ` — ${drillDownData.label}` : ''}</DialogTitle>
            <DialogDescription>
              View which emails succeeded or failed and resend to failed recipients.
            </DialogDescription>
          </DialogHeader>
          {drillDownData && (
            <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
              {drillDownData.details.filter((d) => !d.success).length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Failed ({drillDownData.details.filter((d) => !d.success).length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto rounded border border-red-100 bg-red-50/50 p-3 space-y-2">
                    {drillDownData.details
                      .filter((d) => !d.success)
                      .map((d, i) => (
                        <div key={i} className="text-sm">
                          <div className="font-mono text-red-900 break-all">{d.email}</div>
                          {d.error && (
                            <div className="text-xs text-red-600 mt-0.5">{d.error}</div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {drillDownData.details.filter((d) => d.success).length > 0 && (
                <div>
                  <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Delivered ({drillDownData.details.filter((d) => d.success).length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded border border-green-100 bg-green-50/50 p-3 space-y-1">
                    {drillDownData.details
                      .filter((d) => d.success)
                      .map((d, i) => (
                        <div key={i} className="text-sm font-mono text-green-900 break-all">
                          {d.email}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {drillDownData && drillDownData.details.filter((d) => !d.success).length > 0 && (
              <Button
                onClick={() =>
                  handleResendToFailed(
                    drillDownData!.campaign,
                    drillDownData!.details.filter((d) => !d.success).map((d) => d.email)
                  )
                }
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Resend to {drillDownData!.details.filter((d) => !d.success).length} failed
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDrillDownOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
