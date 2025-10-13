# Square Payment Production Fix

## 🔧 Problem Identified

Your Square payment link generation was failing in production with a 500 error while working perfectly in local development. The root cause was:

**Vercel Edge Runtime vs Node.js Runtime**
- The Square SDK requires Node.js APIs (like `crypto`, `https`, etc.)
- Vercel was likely defaulting to Edge Runtime for your API routes in production
- Edge Runtime has limited Node.js API support, causing the Square SDK import to fail silently
- This explains why NO logs appeared - the error happened during module import, before your logging code could execute

## ✅ Changes Made

### 1. Added Runtime Configuration to Square API Routes

Added `export const runtime = 'nodejs';` to force Node.js runtime:

- ✅ `/app/api/bookings/generate-payment-link/route.ts`
- ✅ `/app/api/debug/test-square-config/route.ts`
- ✅ `/app/api/webhooks/square/route.ts`

### 2. Enhanced Error Handling

Added better error handling in `/lib/square.ts` to catch import failures and provide clear error messages.

## 🚀 Deployment Steps

### Step 1: Commit and Push Changes

```bash
cd /Users/cjbritz/Documents/dust_hair
git add -A
git commit -m "Fix: Force Node.js runtime for Square SDK compatibility in production"
git push origin main
```

### Step 2: Wait for Vercel Deployment

- Go to your Vercel dashboard
- Watch for the deployment to complete (usually 1-2 minutes)
- Note the deployment URL

### Step 3: Test the Configuration Endpoint

First, verify your Square config is still good:

```bash
curl https://your-vercel-url.vercel.app/api/debug/test-square-config
```

You should see:
```json
{
  "square_enabled": true,
  "square_environment": "production",
  "has_access_token": true,
  "access_token_prefix": "EAAAl4...",
  "access_token_length": 64,
  "has_location_id": true,
  "location_id_prefix": "LQW9NJ0S...",
  "issues": ["✅ All required Square settings are configured", "✅ Access token format looks correct", "✅ Production environment with production token"]
}
```

### Step 4: Test Payment Link Generation

1. Go to your admin portal: `https://your-vercel-url.vercel.app/admin/bookings`
2. Find a booking with "pending" payment status
3. Click "Generate Payment Link"
4. **Check for success!**

### Step 5: Monitor Vercel Function Logs

If it still fails (unlikely), check Vercel Function Logs:

1. Go to Vercel Dashboard → Your Project
2. Click "Functions" or "Logs" tab
3. Filter for `/api/bookings/generate-payment-link`
4. Look for error messages - now you should see detailed logs

## 🧪 Testing Checklist

- [ ] Configuration endpoint returns valid Square settings
- [ ] Payment link generation works in admin portal
- [ ] Generated payment links are accessible (Square hosted page loads)
- [ ] Payment completion triggers webhook correctly
- [ ] Booking status updates after payment

## 🔍 How to Verify It's Working

### Success Indicators:

1. **No 500 error** when clicking "Generate Payment Link"
2. **Success toast** appears with message
3. **Payment URL appears** in the booking row
4. **Console logs appear** in Vercel Function Logs (not just silence)
5. **Square payment page loads** when you open the generated link

### What You Should See in Vercel Logs:

```
🔍 [PAYMENT LINK] Starting payment link generation...
🔍 [PAYMENT LINK] Request body: { bookingId: '...', serviceName: '...', price: 5000 }
🔍 [PAYMENT LINK] All fields present, calling createPaymentLink...
🔍 Creating payment link for booking: ...
🔍 Square settings from database: { square_enabled: true, has_access_token: true, ... }
🔍 Using Square Location ID: LQW9NJ0S...
🔍 Creating Square client with: { environment: 'production', ... }
✅ Payment link created successfully: https://square.link/...
✅ [PAYMENT LINK] Payment link created successfully
```

## 🚨 If It Still Doesn't Work

### Possible Additional Issues:

1. **Database Settings**
   - Verify production Supabase has Square settings configured
   - Run: `SELECT * FROM settings WHERE key LIKE 'square%';` in Supabase SQL Editor

2. **Environment Variables**
   - Verify `NEXT_PUBLIC_APP_URL` is set in Vercel
   - Should be: `https://your-actual-domain.vercel.app`

3. **Square Account Status**
   - Verify your Square production account is active
   - Check if the access token has proper permissions
   - Go to Square Developer Dashboard → Your Application → Production

4. **Network/Firewall Issues**
   - Vercel functions need to reach Square API servers
   - Check Vercel's status page if issues persist

## 📊 What Changed Technically

### Before:
```typescript
export async function POST(request: NextRequest) {
  // This might run in Edge Runtime in production
  // Square SDK import fails silently
}
```

### After:
```typescript
export const runtime = 'nodejs'; // Force Node.js runtime

export async function POST(request: NextRequest) {
  // Now guaranteed to run in Node.js runtime
  // Square SDK works correctly
}
```

### Why This Matters:

- **Edge Runtime**: Fast, globally distributed, but limited Node.js APIs
- **Node.js Runtime**: Full Node.js API support, required for Square SDK
- **Next.js Default**: May choose Edge Runtime for some routes in production for performance
- **Our Fix**: Explicitly force Node.js runtime for Square-dependent routes

## 🎯 Next Steps After Confirmation

Once this works:

1. **Remove Debug Logging** (optional)
   - The extensive console.log statements can be reduced if desired
   - Keep key logs for monitoring

2. **Enable Webhook Signature Verification**
   - Uncomment crypto validation in `/app/api/webhooks/square/route.ts`
   - Get webhook signature key from Square Dashboard
   - Add `SQUARE_WEBHOOK_SIGNATURE_KEY` to Vercel environment variables

3. **Set Up Webhook in Square Dashboard**
   - Follow: `/SETUP-SQUARE-WEBHOOKS.md`
   - Add webhook URL: `https://your-domain.vercel.app/api/webhooks/square`
   - Enable: `payment.created`, `payment.updated` events

4. **Monitor Production Usage**
   - Check Vercel Function logs regularly
   - Monitor for any Square API errors
   - Track payment completion rates

## 📝 Additional Notes

- The runtime configuration is per-route, so other API routes remain unaffected
- This fix doesn't impact local development (already worked there)
- No changes needed to Square settings or configuration
- No database schema changes required

## 🤝 Support

If you encounter any issues after deployment:

1. Check Vercel Function Logs (not browser console)
2. Verify the test endpoint still works
3. Check Square Developer Dashboard for API status
4. Review Supabase logs for database connection issues

---

**Last Updated:** October 13, 2025
**Issue:** Square Payment Link 500 Error in Production
**Resolution:** Force Node.js runtime for Square SDK compatibility

