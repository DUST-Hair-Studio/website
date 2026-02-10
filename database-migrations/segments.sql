-- Segments table for campaign recipient lists
-- Run: psql -d your_database -f database-migrations/segments.sql

CREATE TABLE IF NOT EXISTS segments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('rule_based', 'manual')),
  -- For rule_based: { "customerType": "all" | "loyalty" | "new" }
  rules JSONB,
  -- For manual: array of email strings
  emails TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT segments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_segments_type ON segments(type);
CREATE INDEX IF NOT EXISTS idx_segments_updated_at ON segments(updated_at DESC);

-- Seed default segments (only if they don't exist)
INSERT INTO segments (name, type, rules, updated_at)
SELECT 'All customers', 'rule_based', '{"customerType": "all"}'::jsonb, NOW()
WHERE NOT EXISTS (SELECT 1 FROM segments WHERE name = 'All customers');

INSERT INTO segments (name, type, rules, updated_at)
SELECT 'Loyalty customers', 'rule_based', '{"customerType": "loyalty"}'::jsonb, NOW()
WHERE NOT EXISTS (SELECT 1 FROM segments WHERE name = 'Loyalty customers');

INSERT INTO segments (name, type, rules, updated_at)
SELECT 'New customers', 'rule_based', '{"customerType": "new"}'::jsonb, NOW()
WHERE NOT EXISTS (SELECT 1 FROM segments WHERE name = 'New customers');
