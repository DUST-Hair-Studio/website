export interface CampaignConfig {
  id: string
  name: string
  description: string
  registrationUrl: string
  customerType: 'new' | 'existing' | 'both'
  isActive: boolean
  emailTemplate: {
    subject: string
    message: string
    htmlTemplate?: string
  }
  tracking: {
    sourceField: string
    registeredAtField: string
  }
  createdAt: string
  updatedAt: string
}

export const CAMPAIGNS: Record<string, CampaignConfig> = {
  'existing_customer_2025': {
    id: 'existing_customer_2025',
    name: 'Existing Customer Registration 2025',
    description: 'Campaign to convert existing customers to registered users with grandfathered pricing',
    registrationUrl: '/register/existing',
    customerType: 'existing',
    isActive: true,
    emailTemplate: {
      subject: 'Important: Your pricing is changing (but not for you)',
      message: `Hi all,

I want to thank you for your business over the years.

As of today, I'm changing my prices for new customers. You will be grandfathered into the current pricing structure, but to get this pricing I need you to please create an account.

I've also launched a new booking system that requires you to login to see your existing customer pricing. With your account, you'll be able to:
• See all your reservations
• Reschedule appointments online
• Cancel appointments if needed
• Access your existing customer pricing

This ensures you keep your current rates while new customers will see the updated pricing.

Thanks for your continued support!

[Your name]`
    },
    tracking: {
      sourceField: 'campaign_source',
      registeredAtField: 'campaign_registered_at'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
}

export function getCampaignConfig(campaignId: string): CampaignConfig | null {
  return CAMPAIGNS[campaignId] || null
}

export async function getActiveCampaigns(): Promise<CampaignConfig[]> {
  try {
    const response = await fetch('/api/admin/campaigns')
    if (response.ok) {
      const data = await response.json()
      return data.campaigns || []
    }
  } catch (error) {
    console.error('Error fetching campaigns from database:', error)
  }
  
  // Fallback to static campaigns if database fails
  return Object.values(CAMPAIGNS).filter(campaign => campaign.isActive)
}

export function getCampaignByRegistrationUrl(url: string): CampaignConfig | null {
  return Object.values(CAMPAIGNS).find(campaign => campaign.registrationUrl === url) || null
}
