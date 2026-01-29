# Square POS Payment Integration - Scaling Considerations

## Overview

This document describes how the Square Point of Sale (POS) payment flow works and identifies a potential scaling issue that should be addressed as the business grows.

## Current Implementation

### How It Works

1. **Admin clicks "Pay Now (POS)"** on a booking
   - Server generates a Square POS deep link URL (`square-commerce-v1://payment/create?data=...`)
   - The callback URL is set to: `https://dusthair.vercel.app/api/webhooks/square`
   - **Important:** Square requires the callback URL to match **exactly** what's configured in Square Developer Dashboard (no query parameters allowed)
   - Server stores a "pending POS" record in the `settings` table:
     ```json
     {
       "key": "pos_pending_booking",
       "value": {
         "bookingId": "uuid",
         "amountCents": 10000,
         "at": "2026-01-28T21:30:00Z"
       }
     }
     ```

2. **Customer completes payment in Square app**
   - Square processes the payment
   - Square redirects to our callback URL: `https://dusthair.vercel.app/api/webhooks/square?data={transaction_data}`
   - Note: Square does **not** include our booking ID in the redirect

3. **Our webhook receives the callback**
   - Reads the `pos_pending_booking` setting
   - Validates:
     - Amount matches the transaction amount
     - Timestamp is within last 15 minutes
   - Updates the matching booking to "paid"
   - Clears the pending record

### Why This Approach?

- **Square's limitation:** The callback URL must match exactly what's in Square Dashboard (no query params)
- **No Square Order created:** We don't create a Square Order via API before opening POS (simpler flow)
- **No booking ID in callback:** Square doesn't include our booking ID in the redirect

## ⚠️ Scaling Issue

### The Problem

**Current limitation:** Only **one** pending POS booking can be tracked at a time.

If two staff members click "Pay Now (POS)" for different bookings with the **same amount** within a 15-minute window:

1. First click stores: `{ bookingId: "A", amountCents: 10000, at: "..." }`
2. Second click **overwrites** it: `{ bookingId: "B", amountCents: 10000, at: "..." }`
3. When the first payment completes, the callback might match booking B instead of booking A
4. Result: Wrong booking gets marked as paid

### When This Becomes a Problem

- **Low risk scenarios:**
  - Single staff member processing payments one at a time
  - Different amounts (no collision)
  - Payments completed quickly (< 1 minute apart)

- **High risk scenarios:**
  - Multiple staff members processing payments simultaneously
  - Multiple bookings with identical prices
  - Busy periods (multiple POS flows active at once)
  - Slow payment processing (customer takes time to pay)

## Solutions for Scaling

### Option 1: Create Square Orders (Recommended for Scale)

**How it works:**
1. When "Pay Now (POS)" is clicked, create a Square Order via API
2. Store the `order_id` on the booking record
3. Pass the `order_id` to Square POS (if supported) or include it in notes
4. When payment completes, Square webhook includes `order_id`
5. Match booking by `square_order_id` field

**Pros:**
- ✅ Multiple concurrent POS flows supported
- ✅ More reliable matching (order_id is unique)
- ✅ Better integration with Square's system
- ✅ Payments are properly catalogued in Square with order context

**Cons:**
- ❌ More complex implementation
- ❌ Requires Square Orders API integration
- ❌ Additional API call per POS initiation

**Implementation:**
- Use Square Orders API: `POST /v2/orders`
- Store `order_id` in `bookings.square_order_id`
- Update webhook to match by `payment.order_id`

### Option 2: Database Table for Pending POS

**How it works:**
1. Create a `pos_pending_payments` table:
   ```sql
   CREATE TABLE pos_pending_payments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     booking_id UUID REFERENCES bookings(id),
     amount_cents INTEGER NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     expires_at TIMESTAMPTZ NOT NULL
   );
   ```
2. When "Pay Now (POS)" is clicked, insert a row
3. When callback arrives, query by amount + time window
4. Delete the row after matching

**Pros:**
- ✅ Supports multiple concurrent flows
- ✅ Simpler than Square Orders API
- ✅ No external API dependency

**Cons:**
- ❌ Still has collision risk if same amount + same time window
- ❌ Requires database migration
- ❌ Need cleanup job for expired rows

**Implementation:**
- Replace `settings` table usage with `pos_pending_payments` table
- Query: `WHERE amount_cents = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`
- Add cleanup cron job to delete expired rows

### Option 3: Include Unique Token in Notes

**How it works:**
1. Generate a unique token (UUID) when "Pay Now (POS)" is clicked
2. Store token → booking_id mapping in database
3. Include token in Square POS notes: `"Booking: Service - Customer (Token: abc123)"`
4. When callback arrives, extract token from transaction notes
5. Look up booking by token

**Pros:**
- ✅ Supports multiple concurrent flows
- ✅ No external API calls
- ✅ Simple implementation

**Cons:**
- ❌ Relies on Square including notes in callback (may not be reliable)
- ❌ Token visible in Square app (not ideal UX)
- ❌ Requires parsing notes field

**Implementation:**
- Create `pos_tokens` table: `token UUID PRIMARY KEY, booking_id UUID, expires_at TIMESTAMPTZ`
- Include token in POS notes
- Parse notes in callback to extract token

## Recommendation

**For current scale (single staff, low volume):**
- Current implementation is fine
- Monitor for any payment mismatches

**For scaling (multiple staff, high volume):**
- **Implement Option 1 (Square Orders API)** - Most robust and aligns with Square's best practices
- This provides the best long-term solution and proper payment cataloging

## Monitoring

Add logging to detect when the scaling issue occurs:

```typescript
// In webhook callback
if (pendingRow && pending.amountCents === amountCents && pendingAt > fifteenMinutesAgo) {
  // Check if there are other bookings with same amount in pending state
  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('price_charged', amountCents)
    .eq('payment_status', 'pending')
    .gt('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
  
  if (count && count > 1) {
    console.warn('⚠️ Multiple pending bookings with same amount - potential collision risk');
  }
}
```

## Related Files

- `/app/api/bookings/create-pos-order/route.ts` - Generates POS URL and stores pending booking
- `/app/api/webhooks/square/route.ts` - Handles callback and matches booking
- Square Dashboard: Point of Sale API → Web Callback URL configuration

## References

- [Square Point of Sale API Documentation](https://developer.squareup.com/docs/pos-api)
- [Square Orders API Documentation](https://developer.squareup.com/reference/square/orders-api)
- [Square Webhooks Documentation](https://developer.squareup.com/docs/webhooks/overview)
