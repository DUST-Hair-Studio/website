-- Campaigns table for storing campaign configurations
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  registration_url VARCHAR(500),
  customer_type VARCHAR(20) NOT NULL DEFAULT 'loyalty', -- 'new', 'loyalty', 'both'
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  button_text VARCHAR(100) DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active 
ON campaigns(is_active);

-- Index for customer type filtering
CREATE INDEX IF NOT EXISTS idx_campaigns_customer_type 
ON campaigns(customer_type);



