-- Campaign send history table
CREATE TABLE IF NOT EXISTS campaign_send_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id VARCHAR(100) NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  successful_sends INTEGER NOT NULL DEFAULT 0,
  failed_sends INTEGER NOT NULL DEFAULT 0,
  recipient_emails TEXT[], -- Array of emails sent to
  sent_by uuid, -- Admin user who sent it
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT campaign_send_history_pkey PRIMARY KEY (id)
);

-- Index for fetching history by campaign
CREATE INDEX IF NOT EXISTS idx_campaign_send_history_campaign_id ON campaign_send_history(campaign_id);

-- Index for fetching recent history
CREATE INDEX IF NOT EXISTS idx_campaign_send_history_sent_at ON campaign_send_history(sent_at DESC);
