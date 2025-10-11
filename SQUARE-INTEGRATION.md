# Square Payment Integration Setup

This document outlines the Square payment integration for DUST Hair Studio.

## Overview

The Square integration enables:
- Payment link generation for bookings
- Automatic payment status tracking via webhooks
- Payment confirmation and receipt handling
- Integration with the booking system

## Environment Variables

Add these to your `.env.local` for development:

```bash
# Square Payment Configuration
SQUARE_APPLICATION_ID=your_sandbox_app_id
SQUARE_ACCESS_TOKEN=your_sandbox_access_token
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=your_square_location_id
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: For webhook signature verification
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_signature_key
```

### How to Get Your Square Credentials

1. **Application ID & Access Token:**
   - Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
   - Select your application
   - Navigate to "Credentials"
   - Copy the Sandbox Application ID and Access Token

2. **Location ID:**
   - In the Square Dashboard, go to "Locations"
   - Copy your location ID
   - Or use the Square API Explorer to list locations

3. **Webhook Signature Key:**
   - After setting up webhooks (see below), copy the signature key
   - This is used to verify webhook authenticity

## Files Created

### 1. `lib/square.ts`
The Square client configuration file. Initializes the Square SDK with your credentials.

### 2. `lib/square-payment.ts`
Payment utilities including:
- `createPaymentLink()` - Generate payment links for bookings
- `getPaymentDetails()` - Retrieve payment information
- `getOrderDetails()` - Retrieve order information
- `refundPayment()` - Process refunds if needed

### 3. `app/api/webhooks/square/route.ts`
Webhook endpoint that handles Square payment events:
- `payment.created` - When a payment is initiated
- `payment.updated` - When payment status changes

## Database Schema

Run the migration in `database-migrations/square-payment-fields.sql` to add:
- `square_payment_url` - Payment page URL
- `square_order_id` - Square order ID
- `square_payment_link_id` - Payment link ID
- `square_payment_id` - Completed payment ID
- `paid_at` - Payment completion timestamp

The migration also includes:
- Indexes for performance
- Automatic `paid_at` timestamp trigger

## Webhook Setup

### Development (ngrok or similar)
For testing webhooks locally:
1. Install ngrok: `npm install -g ngrok`
2. Run: `ngrok http 3000`
3. Use the ngrok URL in Square Dashboard: `https://your-ngrok-url.ngrok.io/api/webhooks/square`

### Production
1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Navigate to "Webhooks"
4. Click "Add Endpoint"
5. Add webhook URL: `https://yourdomain.com/api/webhooks/square`
6. Subscribe to these events:
   - `payment.created`
   - `payment.updated`
7. Save and copy the Webhook Signature Key
8. Add `SQUARE_WEBHOOK_SIGNATURE_KEY` to Vercel environment variables

## Usage Example

### Creating a Payment Link for a Booking

```typescript
import { createPaymentLink } from '@/lib/square-payment';

// In your booking creation flow
const paymentResult = await createPaymentLink({
  bookingId: booking.id,
  serviceName: service.name,
  price: booking.price_charged, // in cents
  customerEmail: customer.email,
  customerPhone: customer.phone,
  customerName: customer.name,
  appointmentDate: booking.booking_date,
});

// Update booking with payment info
await supabase
  .from('bookings')
  .update({
    square_payment_url: paymentResult.paymentUrl,
    square_order_id: paymentResult.orderId,
    square_payment_link_id: paymentResult.paymentLinkId,
  })
  .eq('id', booking.id);

// Send email with payment link to customer
await sendBookingConfirmation({
  ...booking,
  paymentUrl: paymentResult.paymentUrl,
});
```

### Checking Payment Status

```typescript
import { getPaymentDetails } from '@/lib/square-payment';

// Retrieve payment status
const payment = await getPaymentDetails(paymentId);

if (payment.status === 'COMPLETED') {
  // Payment successful
  console.log('Payment completed!');
} else if (payment.status === 'PENDING') {
  // Waiting for payment
  console.log('Payment pending');
}
```

### Processing a Refund

```typescript
import { refundPayment } from '@/lib/square-payment';

// Refund a booking payment
await refundPayment(
  booking.square_payment_id,
  {
    amount: BigInt(booking.price_charged),
    currency: 'USD'
  },
  'Customer cancellation'
);

// Update booking status
await supabase
  .from('bookings')
  .update({
    payment_status: 'refunded',
    status: 'cancelled'
  })
  .eq('id', booking.id);
```

## Payment Flow

1. **Customer Books Appointment**
   - Booking is created with `payment_status: 'pending'`
   - Payment link is generated via Square
   - Email sent with calendar invite + payment link

2. **Customer Pays**
   - Customer clicks payment link
   - Completes payment on Square hosted page
   - Square redirects to: `/appointments/[id]?payment=success`

3. **Webhook Updates Status**
   - Square sends webhook to your server
   - Booking status updated to `payment_status: 'paid'`
   - `paid_at` timestamp recorded
   - Booking status changed to `confirmed`

4. **Admin Dashboard**
   - View payment status for all bookings
   - Resend payment links if needed
   - Process refunds for cancellations

## Testing Checklist

### Sandbox Testing
- [ ] Create test booking
- [ ] Verify payment link generated
- [ ] Complete payment in sandbox
- [ ] Verify webhook received
- [ ] Confirm booking status updated to 'paid'
- [ ] Test refund functionality

### Production Testing
- [ ] Switch to production credentials
- [ ] Update webhook URL to production domain
- [ ] Create real test booking with small amount
- [ ] Complete actual payment
- [ ] Verify email delivery
- [ ] Verify admin dashboard shows correct status
- [ ] Test customer payment page redirect

## Security Considerations

1. **Environment Variables**: Never commit credentials to git
2. **Webhook Verification**: Implement signature verification in production
3. **HTTPS Only**: Always use HTTPS in production for webhook URLs
4. **Error Handling**: Log errors but don't expose sensitive data to users

## Troubleshooting

### Payment Link Creation Fails
- Check `SQUARE_LOCATION_ID` is set correctly
- Verify access token has correct permissions
- Ensure amount is in cents (multiply by 100)

### Webhook Not Receiving Events
- Verify webhook URL is publicly accessible
- Check webhook subscription in Square Dashboard
- Look for errors in Square webhook logs
- Use ngrok for local testing

### Payment Status Not Updating
- Check webhook endpoint logs
- Verify booking ID is in order metadata
- Ensure Supabase connection is working
- Check for database permission issues

## Next Steps

1. **Integrate with Booking Flow**: Update your booking creation API to generate payment links
2. **Update Email Templates**: Include payment links in confirmation emails
3. **Admin Dashboard**: Add payment status badges and resend link functionality
4. **Customer Portal**: Show payment status in customer appointment view
5. **Refund Handling**: Implement refund UI for admin cancellations

## Resources

- [Square Developer Documentation](https://developer.squareup.com/docs)
- [Square Node.js SDK](https://github.com/square/square-nodejs-sdk)
- [Square Webhooks Guide](https://developer.squareup.com/docs/webhooks/overview)
- [Square Payment Links API](https://developer.squareup.com/docs/checkout-api/payment-links)

