"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Mail, Plus, Edit, Trash2, Eye, Send } from 'lucide-react'
import { toast } from 'sonner'
import { getActiveCampaigns, type CampaignConfig } from '@/lib/campaign-config'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignConfig | null>(null)
  const [emailList, setEmailList] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<{total: number; successful: number; failed: number; details: Array<{success: boolean; email: string; error?: string}>} | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCampaign, setNewCampaign] = useState({
    id: '',
    name: '',
    description: '',
    registrationUrl: '',
    customerType: 'existing' as 'new' | 'existing' | 'both',
    subject: '',
    message: ''
  })

  useEffect(() => {
    const fetchCampaigns = async () => {
      const updatedCampaigns = await getActiveCampaigns()
      setCampaigns(updatedCampaigns)
    }
    fetchCampaigns()
  }, [])

  const handleSendCampaign = async (campaign: CampaignConfig) => {
    if (!emailList.trim()) {
      toast.error('Please enter email addresses')
      return
    }

    setIsSending(true)
    setSendResults(null)

    try {
      // Parse email list
      const emails = emailList
        .split(/[,\n]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@'))

      if (emails.length === 0) {
        toast.error('No valid email addresses found')
        return
      }

      const response = await fetch('/api/admin/send-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailList: emails,
          subject: campaign.emailTemplate.subject,
          message: emailMessage || campaign.emailTemplate.message,
          campaignName: campaign.id,
          registrationUrl: campaign.registrationUrl
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send campaign')
      }

      setSendResults(data.results)
      toast.success(`Campaign sent! ${data.results.successful} successful, ${data.results.failed} failed`)
    } catch (error) {
      console.error('Error sending campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send campaign')
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
      
      const response = await fetch(isUpdate ? `/api/admin/campaigns/${newCampaign.id}` : '/api/admin/campaigns', {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: newCampaign.id,
          name: newCampaign.name,
          description: newCampaign.description,
          registrationUrl: newCampaign.registrationUrl,
          customerType: newCampaign.customerType,
          subject: newCampaign.subject,
          message: newCampaign.message
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isUpdate ? 'update' : 'create'} campaign`)
      }

      toast.success(`Campaign ${isUpdate ? 'updated' : 'created'} successfully!`)
      setShowCreateForm(false)
      setSelectedCampaign(null)
      setNewCampaign({
        id: '',
        name: '',
        description: '',
        registrationUrl: '',
        customerType: 'existing',
        subject: '',
        message: ''
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
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Campaign Management</h1>
            <p className="text-gray-600 mt-2">
              Manage and send email campaigns to your customers
            </p>
          </div>
          <Button onClick={handleNewCampaignClick}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Campaign List */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="relative">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {campaign.name}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaign(campaign)
                        setShowCreateForm(false) // Close create form when selecting campaign
                      }}
                    >
                      <Eye className="h-4 w-4" />
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
                          customerType: campaign.customerType || 'existing',
                          subject: campaign.emailTemplate?.subject || '',
                          message: campaign.emailTemplate?.message || ''
                        })
                        setShowCreateForm(true)
                        setSelectedCampaign(null)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendCampaign(campaign)}
                      disabled={isSending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>{campaign.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div><strong>Type:</strong> {campaign.customerType}</div>
                  <div><strong>URL:</strong> {campaign.registrationUrl}</div>
                  <div><strong>Status:</strong> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Send Campaign: {selectedCampaign.name}
              </CardTitle>
              <CardDescription>
                {selectedCampaign.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="emailList">Email List</Label>
                <Textarea
                  id="emailList"
                  placeholder="Enter email addresses (one per line or comma separated)"
                  value={emailList}
                  onChange={(e) => setEmailList(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
                <div className="text-sm text-gray-500">
                  {emailList.split(/[,\n]/).filter(email => email.trim()).length} emails
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailMessage">Email Message</Label>
                <Textarea
                  id="emailMessage"
                  value={emailMessage || selectedCampaign.emailTemplate.message}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={12}
                  placeholder="Enter your email message here..."
                />
                <p className="text-sm text-gray-500">
                  This is the message that will be sent to all recipients. You can edit it here or use the campaign default.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Campaign Preview</h4>
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Subject:</strong> {selectedCampaign.emailTemplate.subject}
                </p>
                <p className="text-sm text-blue-800">
                  Recipients will be directed to <code>{selectedCampaign.registrationUrl}</code> and registered as <strong>{selectedCampaign.customerType}</strong> customers.
                </p>
              </div>

              {/* Available Variables for Campaign */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Available Variables</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{business_name}'}</code>
                      <span className="text-gray-600">Your business name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{business_phone}'}</code>
                      <span className="text-gray-600">Your business phone</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{business_address}'}</code>
                      <span className="text-gray-600">Your business address</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{registration_url}'}</code>
                      <span className="text-gray-600">Campaign registration link</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{campaign_name}'}</code>
                      <span className="text-gray-600">Campaign name</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{customer_name}'}</code>
                      <span className="text-gray-600">Customer&apos;s full name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{customer_email}'}</code>
                      <span className="text-gray-600">Customer&apos;s email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{current_date}'}</code>
                      <span className="text-gray-600">Today&apos;s date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{campaign_id}'}</code>
                      <span className="text-gray-600">Campaign ID</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{your_name}'}</code>
                      <span className="text-gray-600">Your name (from settings)</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use these variables in your email subject and message. They will be automatically replaced with actual values when sent.
                </p>
              </div>

              <Button
                onClick={() => handleSendCampaign(selectedCampaign)}
                disabled={isSending || !emailList.trim()}
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registrationUrl">Registration URL</Label>
                  <Input
                    id="registrationUrl"
                    value={newCampaign.registrationUrl}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, registrationUrl: e.target.value }))}
                    placeholder="/register/special"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerType">Customer Type</Label>
                  <Select
                    value={newCampaign.customerType}
                    onValueChange={(value: 'new' | 'existing' | 'both') => 
                      setNewCampaign(prev => ({ ...prev, customerType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New Customers</SelectItem>
                      <SelectItem value="existing">Existing Customers</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                <Label htmlFor="message">Email Message</Label>
                <Textarea
                  id="message"
                  value={newCampaign.message}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, message: e.target.value }))}
                  rows={8}
                  placeholder="Email message content"
                />
              </div>

              {/* Available Variables */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Available Variables</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{business_name}'}</code>
                      <span className="text-gray-600">Your business name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{business_phone}'}</code>
                      <span className="text-gray-600">Your business phone</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{business_address}'}</code>
                      <span className="text-gray-600">Your business address</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{registration_url}'}</code>
                      <span className="text-gray-600">Campaign registration link</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{campaign_name}'}</code>
                      <span className="text-gray-600">Campaign name</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{customer_name}'}</code>
                      <span className="text-gray-600">Customer&apos;s full name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{customer_email}'}</code>
                      <span className="text-gray-600">Customer&apos;s email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{current_date}'}</code>
                      <span className="text-gray-600">Today&apos;s date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{campaign_id}'}</code>
                      <span className="text-gray-600">Campaign ID</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-200 px-2 py-1 rounded text-xs">{'{your_name}'}</code>
                      <span className="text-gray-600">Your name (from settings)</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use these variables in your email subject and message. They will be automatically replaced with actual values when sent.
                </p>
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
        {sendResults && (
          <Card>
            <CardHeader>
              <CardTitle>Send Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{sendResults.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{sendResults.successful}</div>
                  <div className="text-sm text-gray-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{sendResults.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
