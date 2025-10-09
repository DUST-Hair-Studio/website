"use client"

import { useState, useEffect, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Bell, Plus, Edit, Trash2, Send, Clock, CheckCircle, XCircle, Mail, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface ReminderTemplate {
  id: string
  name: string
  type: 'confirmation' | 'reminder' | 'followup' | 'cancellation' | 'reschedule' | 'custom'
  subject: string
  message: string
  hours_before: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ReminderHistory {
  id: string
  booking_id: string
  customer_name: string
  customer_email: string
  template_id: string
  template_name: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  scheduled_for: string
  sent_at?: string
  error_message?: string
  created_at: string
}

const REMINDER_TYPES = [
  { value: 'confirmation', label: 'Confirmation', description: 'Sent immediately after booking' },
  { value: 'reminder', label: 'Reminder', description: 'Sent before appointment' },
  { value: 'followup', label: 'Follow-up', description: 'Sent after appointment' },
  { value: 'cancellation', label: 'Cancellation', description: 'Sent when booking is cancelled' },
  { value: 'reschedule', label: 'Reschedule', description: 'Sent when booking is rescheduled' },
  { value: 'custom', label: 'Custom', description: 'Custom reminder template' }
]

const HOURS_OPTIONS = [
  { value: '0', label: 'Immediately' },
  { value: '1', label: '1 hour before' },
  { value: '2', label: '2 hours before' },
  { value: '4', label: '4 hours before' },
  { value: '12', label: '12 hours before' },
  { value: '24', label: '24 hours before' },
  { value: '48', label: '48 hours before' },
  { value: '72', label: '72 hours before' }
]

const TEMPLATE_VARIABLES = [
  { variable: '{customer_name}', description: 'Customer\'s full name' },
  { variable: '{appointment_date}', description: 'Appointment date (e.g., January 15, 2024)' },
  { variable: '{appointment_time}', description: 'Appointment time (e.g., 2:00 PM)' },
  { variable: '{appointment_datetime}', description: 'Full date and time' },
  { variable: '{old_appointment_date}', description: 'Previous appointment date (reschedule only)' },
  { variable: '{old_appointment_time}', description: 'Previous appointment time (reschedule only)' },
  { variable: '{service_name}', description: 'Name of the booked service' },
  { variable: '{business_name}', description: 'Your business name' },
  { variable: '{business_phone}', description: 'Your business phone number' },
  { variable: '{business_address}', description: 'Your business address' },
  { variable: '{booking_id}', description: 'Unique booking reference' }
]

function AdminRemindersContent() {
  const [activeTab, setActiveTab] = useState('templates')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Templates state
  const [templates, setTemplates] = useState<ReminderTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  
  // History state
  const [reminderHistory, setReminderHistory] = useState<ReminderHistory[]>([])
  
  // Accordion state
  const [variablesExpanded, setVariablesExpanded] = useState(false)
  
  // Form state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'reminder' as 'confirmation' | 'reminder' | 'followup' | 'custom',
    subject: '',
    message: '',
    hours_before: 24,
    is_active: true
  })

  // Fetch templates and history
  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch templates
      const templatesResponse = await fetch('/api/admin/reminders/templates')
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json()
        setTemplates(templatesData.templates || [])
      }
      
      // Fetch reminder history
      const historyResponse = await fetch('/api/admin/reminders/history')
      if (historyResponse.ok) {
        const historyData = await historyResponse.json()
        setReminderHistory(historyData.history || [])
      }
    } catch (error) {
      console.error('Error fetching reminders data:', error)
      toast.error('Failed to load reminders data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Create new template
  const createTemplate = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/admin/reminders/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm)
      })

      if (response.ok) {
        toast.success('Template created successfully')
        setShowTemplateForm(false)
        setTemplateForm({
          name: '',
          type: 'reminder',
          subject: '',
          message: '',
          hours_before: 24,
          is_active: true
        })
        fetchData()
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.details || errorData.error || 'Failed to create template'
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error('Failed to create template')
    } finally {
      setSaving(false)
    }
  }

  // Update template
  const updateTemplate = async () => {
    if (!editingTemplate) return

    try {
      setSaving(true)
      const response = await fetch(`/api/admin/reminders/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm)
      })

      if (response.ok) {
        toast.success('Template updated successfully')
        setEditingTemplate(null)
        setShowTemplateForm(false)
        setTemplateForm({
          name: '',
          type: 'reminder',
          subject: '',
          message: '',
          hours_before: 24,
          is_active: true
        })
        fetchData()
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.details || errorData.error || 'Failed to update template'
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error updating template:', error)
      toast.error('Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  // Delete template
  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await fetch(`/api/admin/reminders/templates/${templateId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Template deleted successfully')
        fetchData()
      } else {
        throw new Error('Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  // Toggle template active status
  const toggleTemplateStatus = async (templateId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/reminders/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      })

      if (response.ok) {
        toast.success(`Template ${isActive ? 'activated' : 'deactivated'}`)
        fetchData()
      } else {
        throw new Error('Failed to update template status')
      }
    } catch (error) {
      console.error('Error updating template status:', error)
      toast.error('Failed to update template status')
    }
  }

  // Start editing template
  const startEditing = (template: ReminderTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      type: template.type,
      subject: template.subject,
      message: template.message,
      hours_before: template.hours_before,
      is_active: template.is_active
    })
    setShowTemplateForm(true)
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingTemplate(null)
    setShowTemplateForm(false)
    setTemplateForm({
      name: '',
      type: 'reminder',
      subject: '',
      message: '',
      hours_before: 24,
      is_active: true
    })
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>
      case 'delivered':
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }


  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Appointment Reminders</h1>
        <p className="text-gray-600">Manage reminder templates and track reminder history</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="templates">
            Templates
          </TabsTrigger>
          <TabsTrigger value="history">
            History
          </TabsTrigger>
          <TabsTrigger value="settings">
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Reminder Templates</h2>
            <Button onClick={() => setShowTemplateForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>

          {/* Template Form Modal */}
          <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="template_name">Template Name</Label>
                    <Input
                      id="template_name"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., 24-Hour Reminder"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template_type">Template Type</Label>
                    <Select
                      value={templateForm.type}
                      onValueChange={(value: string) => setTemplateForm(prev => ({ ...prev, type: value as 'confirmation' | 'reminder' | 'followup' | 'custom' }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value} className="whitespace-normal">
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-sm text-gray-500">{type.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template_subject">Email Subject</Label>
                    <Input
                      id="template_subject"
                      value={templateForm.subject}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="e.g., Reminder: Your appointment tomorrow"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hours_before">Send</Label>
                    <Select
                      value={templateForm.hours_before.toString()}
                      onValueChange={(value) => setTemplateForm(prev => ({ ...prev, hours_before: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template_message">Message Template</Label>
                  <Textarea
                    id="template_message"
                    value={templateForm.message}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Hi {customer_name}, this is a reminder about your appointment on {appointment_date} at {appointment_time}..."
                    rows={6}
                  />
                  <p className="text-sm text-gray-600">
                    Use variables like {`{customer_name}`}, {`{appointment_date}`}, {`{appointment_time}`}, etc.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="template_active"
                    checked={templateForm.is_active}
                    onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="template_active">Active</Label>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={editingTemplate ? updateTemplate : createTemplate}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Button>
                  <Button variant="outline" onClick={cancelEditing}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Available Variables */}
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setVariablesExpanded(!variablesExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle>Available Variables</CardTitle>
                {variablesExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {variablesExpanded && (
              <CardContent className="p-6 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TEMPLATE_VARIABLES.map((variable, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">{variable.variable}</code>
                      <span className="text-sm text-gray-600">{variable.description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Templates List */}
          <div className="space-y-4">
            {templates.map((template) => (
              <Card key={template.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  {/* Mobile Layout */}
                  <div className="block sm:hidden">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{template.name}</h3>
                        <Badge 
                          className={`mt-1 ${
                            template.type === 'confirmation' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            template.type === 'followup' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            template.type === 'reminder' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                            'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {template.type}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={(checked) => toggleTemplateStatus(template.id, checked)}
                          className="data-[state=checked]:bg-green-500"
                        />
                        <span className="text-sm text-gray-600">
                          {template.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subject:</span>
                        <span className="text-gray-900 font-medium">{template.subject}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Timing:</span>
                        <span className="text-gray-900">
                          {template.hours_before === 0 ? 'Immediately' : `${template.hours_before} hours before`}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {template.message}
                    </p>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs flex-1"
                        onClick={() => startEditing(template)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs flex-1 text-red-600 hover:text-red-700"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold">{template.name}</h3>
                        <Badge 
                          className={
                            template.type === 'confirmation' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                            template.type === 'followup' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            template.type === 'reminder' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                            'bg-gray-100 text-gray-800 border-gray-200'
                          }
                        >
                          {template.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Subject:</strong> {template.subject}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Timing:</strong> {template.hours_before === 0 ? 'Immediately' : `${template.hours_before} hours before`}
                      </p>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {template.message}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={(checked) => toggleTemplateStatus(template.id, checked)}
                          className="data-[state=checked]:bg-green-500"
                        />
                        <span className="text-sm text-gray-600">
                          {template.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(template)}
                        className="hover:bg-gray-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Reminder History</h2>
            <Button onClick={fetchData} variant="outline">
              Refresh
            </Button>
          </div>

          {reminderHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Reminders Sent Yet</h3>
              <p className="text-gray-600 text-center max-w-md">
                Reminder history will appear here once you start sending automated reminders to your customers.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                <p>• Confirmation emails are sent immediately after booking</p>
                <p>• Reminder emails are sent based on your template settings</p>
                <p>• Follow-up emails are sent after appointments</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {reminderHistory.map((reminder) => (
                <Card key={reminder.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    {/* Mobile Layout */}
                    <div className="block sm:hidden">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{reminder.customer_name}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            {getStatusBadge(reminder.status)}
                            <Badge variant="outline" className="text-xs">{reminder.template_name}</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Email:</span>
                          <span className="text-gray-900 font-medium">{reminder.customer_email}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Scheduled:</span>
                          <span className="text-gray-900">{new Date(reminder.scheduled_for).toLocaleString()}</span>
                        </div>
                        {reminder.sent_at && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Sent:</span>
                            <span className="text-gray-900">{new Date(reminder.sent_at).toLocaleString()}</span>
                          </div>
                        )}
                        {reminder.error_message && (
                          <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600">
                            <strong>Error:</strong> {reminder.error_message}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold">{reminder.customer_name}</h3>
                            {getStatusBadge(reminder.status)}
                            <Badge variant="outline">{reminder.template_name}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            <strong>Email:</strong> {reminder.customer_email}
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Scheduled for:</strong> {new Date(reminder.scheduled_for).toLocaleString()}
                          </p>
                          {reminder.sent_at && (
                            <p className="text-sm text-gray-600">
                              <strong>Sent at:</strong> {new Date(reminder.sent_at).toLocaleString()}
                            </p>
                          )}
                          {reminder.error_message && (
                            <p className="text-sm text-red-600">
                              <strong>Error:</strong> {reminder.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Reminder Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="reminders_enabled">Enable Reminders</Label>
                    <p className="text-sm text-gray-600">Send automated appointment reminders</p>
                  </div>
                  <Switch id="reminders_enabled" defaultChecked />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">How Reminders Work</h4>
                  <p className="text-sm text-blue-800">
                    Each reminder template has its own timing (e.g., 24 hours before, immediately after booking). 
                    The system will automatically send reminders based on each template&apos;s specific schedule.
                  </p>
                </div>
                <Button>
                  <Send className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AdminRemindersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <AdminRemindersContent />
    </Suspense>
  )
}
