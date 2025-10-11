# Square Webhook Setup Guide

## The Problem
Your payments are completing in Square but the payment status in your admin dashboard still shows "pending" because Square isn't automatically notifying your server when payments are completed.

## The Solution
Set up Square webhooks to automatically update payment status when customers complete payments.

## Step 1: Get Your Webhook URL

### For Development (Local Testing)
1. Install ngrok: `npm install -g ngrok`
2. Run: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Your webhook URL will be: `https://abc123.ngrok.io/api/webhooks/square`

### For Production
Your webhook URL will be: `https://yourdomain.com/api/webhooks/square`

## Step 2: Configure Square Webhooks

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Navigate to **"Webhooks"** in the left sidebar
4. Click **"Add Endpoint"**
5. Enter your webhook URL:
   - Development: `https://your-ngrok-url.ngrok.io/api/webhooks/square`
   - Production: `https://yourdomain.com/api/webhooks/square`
6. Subscribe to these events:
   - ✅ `payment.created`
   - ✅ `payment.updated`
7. Click **"Save"**

## Step 3: Get Webhook Signature Key

1. After saving the webhook, click on it
2. Copy the **"Webhook Signature Key"**
3. Add it to your environment variables:
   ```bash
   SQUARE_WEBHOOK_SIGNATURE_KEY=your_signature_key_here
   ```

## Step 4: Test the Webhook

1. Generate a payment link for a booking
2. Complete the payment in Square sandbox
3. Check your server logs - you should see:
   ```
   Square webhook received: {...}
   Processing payment xyz with status: COMPLETED
   Payment completed for booking abc, status updated to paid
   ```
4. Refresh your admin dashboard - payment status should now show "paid"

## Troubleshooting

### Webhook Not Receiving Events
- Check that your webhook URL is accessible from the internet
- Verify the URL is correct (no typos)
- Make sure you're subscribed to the right events

### Payments Still Showing as Pending
- Check server logs for webhook processing errors
- Verify the booking ID is being stored correctly in Square metadata
- Ensure your database connection is working

### Development Testing
- Use Square sandbox environment for testing
- Test with small amounts (e.g., $0.01)
- Check both payment.created and payment.updated events

## What Happens After Setup

1. **Customer Books**: Creates booking with `payment_status: 'pending'`
2. **Admin Generates Payment Link**: Square payment page created
3. **Customer Pays**: Completes payment on Square
4. **Square Sends Webhook**: Automatically notifies your server
5. **Payment Status Updates**: Booking automatically shows `payment_status: 'paid'`
6. **Admin Dashboard**: Shows updated status immediately

No manual intervention needed - everything is automatic!
