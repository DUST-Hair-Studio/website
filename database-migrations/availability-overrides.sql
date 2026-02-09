-- One-time availability overrides: open specific dates that are normally closed
-- (e.g. open Wednesday when you usually work Thu–Sun)
CREATE TABLE IF NOT EXISTS availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  open_time TEXT NOT NULL DEFAULT '11:00',
  close_time TEXT NOT NULL DEFAULT '21:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying overrides by date range
CREATE INDEX IF NOT EXISTS idx_availability_overrides_date ON availability_overrides(date);
