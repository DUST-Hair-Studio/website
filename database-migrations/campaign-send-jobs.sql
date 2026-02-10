-- Background jobs for campaign broadcasts (processed by Inngest)
CREATE TABLE IF NOT EXISTS campaign_send_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  sent_by uuid NOT NULL,
  campaign_id VARCHAR(100) NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT,
  registration_url VARCHAR(500),
  button_text VARCHAR(100),
  email_list JSONB NOT NULL, -- ["a@x.com", "b@y.com"]
  result JSONB, -- { total, successful, failed, broadcastId } on completion
  error_message TEXT, -- on failure
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT campaign_send_jobs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_send_jobs_status ON campaign_send_jobs(status);
CREATE INDEX IF NOT EXISTS idx_campaign_send_jobs_created_at ON campaign_send_jobs(created_at DESC);
