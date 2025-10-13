# 🚀 Pre-Visit Checklist - Fix Payment Link Error

**Goal:** Get payment link generation working BEFORE visiting client

**Time Needed:** 15-30 minutes

---

## Step 1: Add Missing Environment Variable in Vercel ⚠️ CRITICAL

This is the #1 cause of the 500 error.

```
1. Go to: https://vercel.com/
2. Sign in and select your project
3. Click "Settings" tab
4. Click "Environment Variables" in left sidebar
5. Check if "NEXT_PUBLIC_APP_URL" exists
   
   If it DOESN'T exist:
   - Click "Add New"
   - Key: NEXT_PUBLIC_APP_URL
   - Value: https://website-sigma-steel-43.vercel.app
   - Environments: Check all three (Production, Preview, Development)
   - Click "Save"
   
6. After adding, you MUST redeploy:
   - Go to "Deployments" tab
   - Click three dots on latest deployment
   - Click "Redeploy"
   - Wait for deployment to complete (2-3 minutes)
```

**Why this is needed:** Square payment links need a redirect URL. Without this variable, the system doesn't know where to send customers after payment.

**📝 Note for Production Launch:** 
When you're ready to launch on https://www.dusthairstudio.com (the actual domain from the website), you'll need to:
- Update this variable to: https://www.dusthairstudio.com
- Update Square Developer Dashboard redirect URLs
- See LAUNCH_CHECKLIST section "Production Domain Switch" for full steps
- For NOW, use the soft launch URL above for testing

---

## Step 2: Test Square Configuration

Visit this URL in your browser:
```
https://website-sigma-steel-43.vercel.app/api/debug/test-square-config
```

**What you should see:**
```json
{
  "square_enabled": true,
  "square_environment": "production",
  "has_access_token": true,
  "access_token_prefix": "EAAA...",
  "has_location_id": true,
  "location_id_prefix": "LQW9NJ...",
  "next_public_app_url": "https://website-sigma-steel-43.vercel.app",
  "issues": [
    "✅ All basic configuration checks passed",
    "✅ Successfully connected to Square API (production)",
    "✅ Location ID is valid"
  ]
}
```

**If you see any ❌ or ⚠️ issues, follow the fixes below.**

---

## Step 3: Fix Common Issues

### Issue: `❌ Square is disabled in settings`

**Fix:**
```
1. Go to: https://website-sigma-steel-43.vercel.app/admin/settings
2. Click "Payments" tab
3. Toggle ON "Square Payment Processing"
4. Click "Save Payment Settings"
5. Refresh diagnostic page
```

---

### Issue: `❌ Square Access Token is not set`

**Fix:**
```
1. Go to: https://developer.squareup.com/apps
2. Sign in with client's Square account
3. Select the application
4. Click "Production" tab (NOT Sandbox)
5. Copy "Access Token" (starts with EAAA...)
6. Go to: https://website-sigma-steel-43.vercel.app/admin/settings
7. Click "Payments" tab
8. Paste token in "Square Access Token" field
9. Click "Save Payment Settings"
10. Refresh diagnostic page
```

---

### Issue: `❌ Square Location ID is not set`

**Fix:**
```
Option A: Get from diagnostic page
- Look for "Available locations:" in the issues list
- Copy one of the location IDs shown

Option B: Get from Square Dashboard
1. Go to: https://squareup.com/dashboard
2. Click "Locations" in sidebar
3. Select the location
4. Copy the Location ID

Then:
1. Go to: https://website-sigma-steel-43.vercel.app/admin/settings
2. Click "Payments" tab
3. Paste in "Square Location ID" field
4. Click "Save Payment Settings"
5. Refresh diagnostic page
```

---

### Issue: `⚠️ Production token detected but environment is set to sandbox`

**Fix:**
```
1. Go to: https://website-sigma-steel-43.vercel.app/admin/settings
2. Click "Payments" tab
3. Change "Square Environment" dropdown to "Production (Live)"
4. Click "Save Payment Settings"
5. Refresh diagnostic page
```

---

### Issue: `⚠️ NEXT_PUBLIC_APP_URL environment variable is not set`

**Fix:** Go back to Step 1 and add the environment variable

---

### Issue: `❌ Failed to connect to Square API`

**Possible causes:**

1. **Invalid Access Token**
   - Token expired or revoked
   - Using token from wrong Square account
   - Fix: Generate new token from Square Developer Dashboard

2. **Wrong Environment**
   - Using production token with sandbox setting (or vice versa)
   - Fix: Match environment to token type

3. **Token Permissions**
   - Token doesn't have required permissions
   - Fix: In Square Developer Dashboard, check token has:
     - `PAYMENTS_READ`
     - `PAYMENTS_WRITE`
     - `ORDERS_READ`
     - `ORDERS_WRITE`

---

## Step 4: Test Payment Link Generation

```
1. Go to: https://website-sigma-steel-43.vercel.app/admin/bookings
2. Find any existing booking (or create a test booking)
3. Press F12 to open Developer Tools
4. Go to "Console" tab
5. Click "Pay" or "Generate Payment Link" button on a booking

Expected result:
- No errors in console
- New tab opens with Square payment page
- Payment page shows correct service and price

If still getting 500 error:
- Check console for error details
- Copy error message
- Check Network tab for failed request
- Look at Response section for more details
```

---

## Step 5: Create Test Booking (Optional)

If you don't have any bookings yet:

```
1. Go to: https://website-sigma-steel-43.vercel.app/book
2. Select any service
3. Enter test customer info:
   - Name: Test Customer
   - Email: your_email@gmail.com
   - Phone: Your phone number
4. Select any available date/time
5. Complete booking
6. Go to admin bookings page
7. Find the test booking
8. Try generating payment link
```

---

## ✅ Pre-Visit Success Checklist

Before visiting client, confirm:

- [ ] `NEXT_PUBLIC_APP_URL` environment variable is set in Vercel
- [ ] Vercel project has been redeployed after adding variable
- [ ] Diagnostic endpoint shows all ✅ checks passing
- [ ] Square is enabled in admin settings
- [ ] Square Environment is set to "Production (Live)"
- [ ] Square Access Token is saved (production token)
- [ ] Square Location ID is saved
- [ ] Test payment link generates without 500 error
- [ ] Payment link opens Square payment page successfully
- [ ] Payment page shows correct service name and price

---

## 🆘 If Still Not Working

**Collect this information:**

1. **Screenshot of diagnostic endpoint:**
   ```
   https://website-sigma-steel-43.vercel.app/api/debug/test-square-config
   ```

2. **Browser console error:**
   - F12 → Console tab
   - Click payment link button
   - Screenshot any red errors

3. **Network request details:**
   - F12 → Network tab
   - Click payment link button
   - Find failed request (red)
   - Click it
   - Go to "Response" tab
   - Copy error message

4. **Vercel environment variables:**
   - Screenshot of Vercel → Settings → Environment Variables
   - (Hide sensitive values, just show which ones are set)

5. **Admin settings:**
   - Screenshot of Admin → Settings → Payments tab
   - (Hide tokens, just show if fields are filled)

**Then:**
- Search error message online
- Check Square Developer Dashboard for API errors
- Verify Square account is in good standing
- Check if there are any Square service outages

---

## 🎯 Quick Reference

**URLs You'll Need:**
- Admin Portal: `https://website-sigma-steel-43.vercel.app/admin`
- Admin Settings: `https://website-sigma-steel-43.vercel.app/admin/settings`
- Diagnostic Tool: `https://website-sigma-steel-43.vercel.app/api/debug/test-square-config`
- Vercel Dashboard: `https://vercel.com/dashboard`
- Square Developer: `https://developer.squareup.com/apps`
- Square Dashboard: `https://squareup.com/dashboard`

**What You Need from Square:**
- Production Access Token (starts with EAAA)
- Application ID (starts with sq0idp)
- Location ID
- Environment: Production

**Common Error Codes:**
- `500`: Internal server error (usually config issue)
- `401`: Invalid credentials
- `403`: Missing permissions
- `404`: Resource not found

---

## Next Steps After This Checklist

Once everything above is ✅ working:
1. Read `QA-TEST-PLAN.md` for the full client visit test plan
2. Bring Square Reader/Terminal to client visit
3. Test with real money (small amount like $5)
4. Train client on the process

