-- One-time: rename customer type "existing" to "loyalty" everywhere
-- Run after deploying code that uses "loyalty" instead of "existing"

-- Segments: rule_based segments with customerType "existing"
UPDATE segments
SET rules = jsonb_set(rules, '{customerType}', '"loyalty"')
WHERE type = 'rule_based'
  AND rules->>'customerType' = 'existing';

-- Campaigns
UPDATE campaigns
SET customer_type = 'loyalty'
WHERE customer_type = 'existing';

-- Bookings (historical customer_type_at_booking)
UPDATE bookings
SET customer_type_at_booking = 'loyalty'
WHERE customer_type_at_booking = 'existing';
