# Square POS Payment Integration

## Overview

This booking system uses Square for **in-person payments after service completion**. Customers book appointments online without payment, then pay at the salon using Square POS after their service.

## Payment Workflow

1. **Customer Books Online**
   - Customer selects service, date, and time
   - Booking is created immediately (no payment required)
   - Booking status: `confirmed`
   - Payment status: `pending`

2. **Service Completion**
   - Customer arrives and completes their appointment
   - Stylist provides service

3. **Payment at Salon**
   - Stylist rings up service on Square POS (Terminal/iPad/Phone)
   - **Important:** Add booking ID to transaction note/reference field
   - Customer pays (card, cash, etc.)

4. **Payment Tracking**
   - Option A: Admin manually marks booking as "paid" in dashboard
   - Option B (Future): Automatic sync from Square API

## For Stylists: Taking Payment with Square POS

### Step-by-Step

1. **Open Square POS** on your device
2. **Ring up the service**
   - Add the service item (e.g., "Haircut - $175")
3. **Add booking reference**
   - Tap "Add Note" or "Reference"
   - Enter the **booking ID** (shown in admin dashboard)
   - Example: `Booking: abc-123-def`
4. **Process payment**
   - Customer pays with card or cash
5. **Done!** The transaction is complete

### Why Add Booking ID?

- Helps match Square transactions to bookings
- Makes accounting easier
- Enables future automatic payment sync

## For Admin: Managing Payment Status

### Manually Mark as Paid

1. Go to **Admin → Bookings**
2. Find the completed appointment
3. Click **Edit** or **Mark as Paid**
4. Optional: Add Square transaction ID
5. Save

The booking will update:
- `payment_status`: `pending` → `paid`
- `paid_at`: Current timestamp

## Database Fields

```sql
bookings table:
- payment_status: 'pending' | 'paid' | 'refunded'
- square_transaction_id: VARCHAR(255) -- Square POS transaction ID (optional)
- paid_at: TIMESTAMP -- Auto-set when marked as paid
```

## Future Enhancements (Optional)

### Automatic Payment Sync

Use Square API to automatically sync POS transactions:

1. **Enable Square OAuth** in your app
2. **Subscribe to transaction webhooks** from Square
3. **Match transactions to bookings** using:
   - Transaction amount
   - Transaction time
   - Booking ID in transaction note
4. **Auto-update booking** when match found

See Square API docs: https://developer.squareup.com/docs/payments-api/overview

## Testing

### Sandbox Testing

Your `.env.local` is configured with sandbox credentials:

```env
SQUARE_ACCESS_TOKEN=EAAAl9Ekwe...
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=LQW9NJ0SHDTK1
```

Test the connection:
```
http://localhost:3000/api/test-square
```

### Production Setup

For production, update Vercel environment variables with:
- Production access token
- `SQUARE_ENVIRONMENT=production`
- Your actual location ID

## Square Dashboard

Access your Square account:
- **Production**: https://squareup.com/dashboard
- **Developer/Sandbox**: https://developer.squareup.com/apps

## Support

If you need help with Square POS:
- Square Support: https://squareup.com/help
- Square POS Guide: https://squareup.com/help/us/en/article/5068-getting-started-with-square-point-of-sale

