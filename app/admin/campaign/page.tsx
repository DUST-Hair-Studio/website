"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Mail, Users, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function CampaignPage() {
  const [emailList, setEmailList] = useState('')
  const [subject, setSubject] = useState('Important: Your pricing is changing (but not for you)')
  const [message, setMessage] = useState(`Hi all,

I want to thank you for your business over the years.

As of today, I'm changing my prices for new customers. You will be grandfathered into the current pricing structure, but to get this pricing I need you to please create an account.

I've also launched a new booking system that requires you to login to see your existing customer pricing. With your account, you'll be able to:
• See all your reservations
• Reschedule appointments online
• Cancel appointments if needed
• Access your existing customer pricing

This ensures you keep your current rates while new customers will see the updated pricing.

Thanks for your continued support!

[Your name]`)
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<{total: number; successful: number; failed: number; details: Array<{success: boolean; email: string; error?: string}>} | null>(null)

  const handleSendCampaign = async () => {
    if (!emailList.trim()) {
      toast.error('Please enter email addresses')
      return
    }

    if (!subject.trim()) {
      toast.error('Please enter a subject line')
      return
    }

    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    setIsSending(true)
    setSendResults(null)

    try {
      // Parse email list (comma or newline separated)
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
          subject,
          message,
          campaignName: 'existing_customer_2024'
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

  const handleLoadSampleEmails = () => {
    setEmailList('customer1@example.com\ncustomer2@example.com\ncustomer3@example.com')
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Email Campaign</h1>
          <p className="text-gray-600 mt-2">
            Send the existing customer registration campaign to your email list
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Campaign Setup
            </CardTitle>
            <CardDescription>
              Configure and send your existing customer registration campaign
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSampleEmails}
                >
                  Load Sample
                </Button>
                <span className="text-sm text-gray-500">
                  {emailList.split(/[,\n]/).filter(email => email.trim()).length} emails
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                placeholder="Email message content"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Campaign Preview</h4>
              <p className="text-sm text-blue-800 mb-2">
                This campaign will direct recipients to <code>/register/existing</code> where they&apos;ll automatically be registered as existing customers with grandfathered pricing.
              </p>
              <p className="text-sm text-blue-800">
                The email also highlights the new booking system benefits: viewing reservations, rescheduling, canceling, and accessing existing customer pricing.
              </p>
            </div>

            <Button
              onClick={handleSendCampaign}
              disabled={isSending || !emailList.trim() || !subject.trim() || !message.trim()}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Campaign...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Campaign
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {sendResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Send Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{sendResults.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <CheckCircle className="h-5 w-5" />
                    {sendResults.successful}
                  </div>
                  <div className="text-sm text-gray-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                    <XCircle className="h-5 w-5" />
                    {sendResults.failed}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
              </div>

              {sendResults.failed > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-red-900 mb-2">Failed Emails:</h4>
                  <div className="max-h-32 overflow-y-auto">
                    {sendResults.details
                      .filter((result) => !result.success)
                      .map((result, index: number) => (
                        <div key={index} className="text-sm text-red-700 py-1">
                          {result.email}: {result.error}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
