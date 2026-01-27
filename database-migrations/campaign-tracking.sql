-- Campaign tracking table for flexible campaign system
CREATE TABLE IF NOT EXISTS campaign_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  campaign_id VARCHAR(100) NOT NULL, -- Campaign ID from config
  campaign_name VARCHAR(100) NOT NULL, -- Descriptive name from config
  registration_url VARCHAR(500),
  is_existing_customer BOOLEAN NOT NULL, -- Explicitly set based on campaign config
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for campaign analytics
CREATE INDEX IF NOT EXISTS idx_campaign_registrations_campaign_id 
ON campaign_registrations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_registrations_email 
ON campaign_registrations(email);

-- Add campaign tracking to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS campaign_source VARCHAR(100),
ADD COLUMN IF NOT EXISTS campaign_registered_at TIMESTAMP WITH TIME ZONE;

-- Index for campaign analytics on customers
CREATE INDEX IF NOT EXISTS idx_customers_campaign_source 
ON customers(campaign_source);
