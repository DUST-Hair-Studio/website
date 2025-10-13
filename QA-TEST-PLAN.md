# 🧪 QA Test Plan - Client Visit with Real Square POS Payments

## Overview
Testing the admin-initiated payment flow where the client uses Square Reader/Terminal to process in-person payments through the booking system.

## Payment Flow Being Tested
1. ✅ Customer books appointment online (no payment required)
2. ✅ Customer arrives at salon and receives service
3. ✅ Admin opens booking in admin portal
4. ✅ Admin clicks "Pay" button to generate Square payment link
5. ✅ Payment link opens on device
6. ✅ Admin uses Square Reader/Terminal to process customer's card
7. ✅ Payment processes through Square
8. ✅ Booking automatically updates to "paid" status
9. ✅ Payment tracked in both Square and booking system

---

## 🔧 PRE-VISIT SETUP (Do Before Meeting Client)

### 1. Fix the 500 Error (Current Issue)

**Problem:** Payment link generation failing with 500 error

**Likely Causes:**
- Missing `NEXT_PUBLIC_APP_URL` environment variable in Vercel
- Square credentials not properly saved in database
- Production/Sandbox environment mismatch

**Fix Steps:**

#### A. Set Environment Variable in Vercel
```
1. Go to: https://vercel.com/dashboard
2. Select your project: website-sigma-steel-43
3. Settings → Environment Variables
4. Add new variable:
   - Name: NEXT_PUBLIC_APP_URL
   - Value: https://website-sigma-steel-43.vercel.app
   - Environment: Production, Preview, Development (select all)
5. Click "Save"
6. Redeploy the project (Deployments → three dots → Redeploy)
```

#### B. Test Square Configuration
```
Visit: https://website-sigma-steel-43.vercel.app/api/debug/test-square-config

This will show:
✅ Square enabled: true/false
✅ Has access token: true/false  
✅ Token type: Production/Sandbox
✅ Has location ID: true/false
✅ Connection test results
✅ Any configuration issues
```

#### C. Verify Square Settings in Admin Panel
```
1. Go to: https://website-sigma-steel-43.vercel.app/admin
2. Settings → Payments Tab
3. Verify:
   ✅ Square Payment Processing: ENABLED
   ✅ Environment: "Production (Live)" for real money
   ✅ Application ID: Filled in (starts with sq0idp-...)
   ✅ Access Token: Filled in (starts with EAAA...)
   ✅ Location ID: Filled in
4. If any are missing, re-enter and save
```

#### D. Verify Production Credentials Match
```
Square credentials must match the environment:
- If Environment = "Production", use PRODUCTION credentials from Square Dashboard
- If Environment = "Sandbox", use SANDBOX credentials (for testing only)

To get production credentials:
1. Go to: https://developer.squareup.com/apps
2. Select your production app
3. Click "Production" tab (not Sandbox)
4. Copy credentials from there
```

---

## 📱 CLIENT VISIT - TEST PLAN

### What You'll Need:
- [ ] Client's Square Reader or Square Terminal (must be linked to their Square account)
- [ ] Client's iPad/iPhone/Computer with admin portal access
- [ ] Test customer (can be you, friend, or client themselves)
- [ ] Real credit/debit card for testing
- [ ] $5-10 for test transaction (smallest acceptable amount)

### Test Scenario: Complete Service Payment Flow

#### Phase 1: Create Test Booking (5 minutes)

**Option A: Book as Customer (Most Realistic)**
```
1. Go to: https://website-sigma-steel-43.vercel.app/book
2. Select a service (choose cheapest one for testing)
3. Enter test customer info:
   - Name: "Test Customer"
   - Email: your_email@gmail.com (so you get confirmation)
   - Phone: Your phone number
4. Select appointment date/time
5. Complete booking
6. Verify confirmation email received
7. Note the booking ID
```

**Option B: Create from Admin Portal**
```
1. Go to: https://website-sigma-steel-43.vercel.app/admin/bookings
2. Click "New Booking" or "Add Booking"
3. Fill in test customer details
4. Select service and time
5. Save booking
6. Note the booking ID
```

#### Phase 2: Process Payment (10 minutes)

**Step 1: Open Booking in Admin Portal**
```
1. Go to: https://website-sigma-steel-43.vercel.app/admin/bookings
2. Find the test booking you just created
3. Verify it shows:
   - Status: "Confirmed"
   - Payment Status: "Pending"
4. Locate the "Pay" or "Generate Payment Link" button
```

**Step 2: Generate Payment Link**
```
1. Click "Pay" or "Generate Payment Link" button
2. Watch browser console for errors (F12 → Console tab)
3. Expected result: New tab opens with Square payment page
4. If 500 error: See troubleshooting section below
```

**Step 3: Process Payment with Square Reader**
```
1. On the Square payment page that opened:
   - Verify service name is correct
   - Verify price is correct
   - Verify it says "Pay with Card"

2. Have Square Reader ready and connected:
   - Turn on Square Reader/Terminal
   - Ensure it's connected to client's Square account
   - Ensure it's connected to same device (Bluetooth/WiFi)

3. On payment page, click "Pay with Card" or "Continue"
   
4. When prompted, use Square Reader:
   - Insert/tap customer's card on Square Reader
   - Follow prompts on Reader screen
   - Customer enters PIN if required
   
5. Wait for payment confirmation:
   - Square Reader will beep/show confirmation
   - Payment page will show success message
   - Page may redirect back to booking system
```

**Step 4: Verify Payment Recorded**
```
1. Go back to: https://website-sigma-steel-43.vercel.app/admin/bookings
2. Refresh the page
3. Find the test booking
4. Verify it now shows:
   ✅ Payment Status: "Paid"
   ✅ Paid At: [timestamp]
   ✅ Square Order ID: [populated]
   ✅ Payment URL: [populated]
```

**Step 5: Verify in Square Dashboard**
```
1. Go to: https://squareup.com/dashboard
2. Navigate to "Transactions" or "Sales"
3. Find the test transaction (should be at the top)
4. Verify:
   ✅ Amount matches booking
   ✅ Description includes service name
   ✅ Transaction successful
   ✅ Money deposited to account
```

#### Phase 3: Test Edge Cases (Optional - 10 minutes)

**Test 1: Payment Link Can Be Reused**
```
1. Close the payment tab
2. Click "Generate Payment Link" again
3. Verify: Link still works or new link generated
```

**Test 2: Booking Updates in Real-Time**
```
1. Have booking page open in one tab
2. Process payment in another tab
3. Refresh booking page
4. Verify status updated
```

**Test 3: Customer Receives Updated Email** (If configured)
```
1. After payment completes
2. Check email inbox
3. Should receive payment confirmation/receipt
```

---

## 🚨 TROUBLESHOOTING GUIDE

### Issue: 500 Error When Generating Payment Link

**Check 1: Browser Console**
```
1. Press F12 to open Developer Tools
2. Go to Console tab
3. Click "Generate Payment Link" again
4. Look for error messages in red
5. Take screenshot and check below
```

**Common Errors & Solutions:**

**Error: "Square location ID is not configured"**
```
Solution:
1. Go to Admin → Settings → Payments
2. Add Square Location ID
3. To find Location ID:
   - Go to https://squareup.com/dashboard
   - Click Locations
   - Copy location ID
4. Save settings
5. Try again
```

**Error: "Failed to generate payment link" with 401/403**
```
Solution: Invalid Square credentials
1. Go to Admin → Settings → Payments
2. Re-enter Square Access Token
3. Verify you're using PRODUCTION token (starts with EAAA)
4. Verify token is for correct Square account
5. Save and try again
```

**Error: Network error or CORS**
```
Solution: Environment variable missing
1. Check: https://website-sigma-steel-43.vercel.app/api/debug/test-square-config
2. If shows "NEXT_PUBLIC_APP_URL: NOT SET"
3. Add environment variable in Vercel (see Pre-Visit Setup)
4. Redeploy project
```

**Error: "Invalid redirect URL"**
```
Solution: Domain not whitelisted in Square
1. Go to https://developer.squareup.com/apps
2. Select your application
3. Go to OAuth settings
4. Add redirect URL: https://website-sigma-steel-43.vercel.app/booking/confirmation
5. Save
6. Try again
```

### Issue: Payment Processes But Booking Doesn't Update

**This means webhooks aren't set up (optional for POS flow)**

**Quick Fix: Manual Update**
```
1. Note the Square transaction ID from Square Dashboard
2. In admin booking page, click "Edit" on booking
3. Manually change Payment Status to "Paid"
4. Add Square Transaction ID (optional)
5. Save
```

**Proper Fix: Set Up Webhooks** (for automatic updates)
```
See: SETUP-SQUARE-WEBHOOKS.md
Note: This is optional for POS flow since admin can manually mark as paid
```

### Issue: Square Reader Not Connecting

**Solution:**
```
1. Restart Square Reader
2. Ensure Bluetooth is on
3. Re-pair Reader with device
4. Verify Reader is charged
5. Make sure you're using Square's official app/reader
```

### Issue: Payment Link Shows Wrong Amount

**Solution:**
```
1. Check service pricing in Admin → Services
2. Verify booking has correct price_charged
3. If wrong, edit booking and update price
4. Generate new payment link
```

---

## ✅ SUCCESS CRITERIA

By the end of testing, you should have:

- [ ] Successfully created a test booking
- [ ] Generated a payment link from admin portal without errors
- [ ] Processed a real payment using Square Reader/Terminal
- [ ] Booking status automatically updated to "Paid"
- [ ] Payment visible in Square Dashboard
- [ ] Money deposited to client's Square account
- [ ] Client understands how to repeat this process
- [ ] Client has Square Reader/Terminal set up and working

---

## 📋 POST-TEST CHECKLIST

### If Everything Worked:
```
1. ✅ Delete test booking (or mark as test)
2. ✅ Verify test payment settles in Square account
3. ✅ Train client on the process:
   - How to find booking in admin portal
   - How to generate payment link
   - How to use Square Reader
   - How to verify payment completed
4. ✅ Document any issues encountered
5. ✅ Switch to production environment if still in sandbox
```

### If Issues Encountered:
```
1. Document exact error messages (screenshots)
2. Check: https://website-sigma-steel-43.vercel.app/api/debug/test-square-config
3. Verify all settings in Admin → Settings → Payments
4. Test again after fixes
5. If still failing, collect:
   - Browser console errors
   - Network tab errors (F12 → Network)
   - Diagnostic endpoint results
   - Screenshots of Square settings
```

---

## 🎓 CLIENT TRAINING GUIDE

### Daily Payment Process (What Client Will Do)

**For Each Customer After Service:**

1. **Open Admin Portal**
   ```
   Go to: https://website-sigma-steel-43.vercel.app/admin/bookings
   ```

2. **Find Customer's Booking**
   ```
   - Use search bar to find customer name
   - Or filter by today's date
   - Click on booking to open details
   ```

3. **Generate Payment Link**
   ```
   - Click "Pay" button (or "Generate Payment Link")
   - New tab will open with Square payment page
   ```

4. **Process Payment**
   ```
   - Ensure Square Reader is on and connected
   - Click "Pay with Card" on payment page
   - Have customer insert/tap card on Square Reader
   - Wait for confirmation beep
   ```

5. **Verify Payment**
   ```
   - Payment page shows success
   - Go back to bookings page
   - Refresh page
   - Booking should show "Paid" status
   ```

6. **Done!**
   ```
   - Customer payment is recorded
   - Money deposited to Square account
   - Booking system updated automatically
   ```

### Tips for Client:
- Keep Square Reader charged
- Keep device connected to WiFi for payment processing
- If payment link button doesn't work, check Settings → Payments
- Payment takes 1-2 business days to settle in bank account
- Can view all transactions in Square Dashboard

---

## 🔗 USEFUL LINKS

### For Testing:
- Diagnostic Tool: `/api/debug/test-square-config`
- Admin Portal: `https://website-sigma-steel-43.vercel.app/admin`
- Customer Booking: `https://website-sigma-steel-43.vercel.app/book`
- Square Dashboard: `https://squareup.com/dashboard`

### For Setup:
- Vercel Dashboard: `https://vercel.com/dashboard`
- Square Developer: `https://developer.squareup.com/apps`
- Project Docs: `SQUARE-INTEGRATION.md`, `SETUP-SQUARE-WEBHOOKS.md`

---

## 📝 NOTES SECTION (Fill in during testing)

**Date of Test:** _____________

**Client Name:** _____________

**Square Reader Model:** _____________

**Test Results:**
```
Booking Creation: [ ] Pass [ ] Fail
Payment Link Generation: [ ] Pass [ ] Fail
Square Reader Connection: [ ] Pass [ ] Fail
Payment Processing: [ ] Pass [ ] Fail
Booking Status Update: [ ] Pass [ ] Fail
Square Dashboard Update: [ ] Pass [ ] Fail
```

**Issues Encountered:**
```
1. 
2.
3.
```

**Client Feedback:**
```
Ease of Use (1-10): _____
Speed of Process: _____
Concerns/Questions:


```

**Action Items:**
```
[ ] 
[ ]
[ ]
```

