# Manual Waitlist Availability Check Button

## Overview

Added a "Check Availability Now" button to the admin waitlist page that manually triggers the availability checker. This is useful for:
- Testing the waitlist notification system
- Immediate availability checks after making schedule changes
- Manual intervention when needed (without waiting for the daily cron)

## Location

**Admin Waitlist Page**: `/admin/waitlist`

The button appears in the top-right corner of the page header, next to the "Waitlist Management" title.

## How It Works

1. **Click "Check Availability Now"**
   - Button shows spinner and "Checking..." text
   - Toast notification: "Checking for available slots..."

2. **System performs availability check**
   - Fetches all pending waitlist requests
   - Checks business hours, bookings, and Google Calendar blocks
   - Finds available time slots for each request
   - Sends notification emails for available slots

3. **Results displayed**
   - Success toast: "Availability check complete! Processed X request(s), notified Y customer(s)."
   - Page automatically refreshes to show updated statuses
   - Any notified requests will now show status "Notified"

## Button States

### Normal State:
```
🔔 Check Availability Now
```
- Black button with bell icon
- Clickable

### Loading State:
```
⏳ Checking...
```
- Button disabled
- Spinning loader icon
- Prevents multiple simultaneous checks

## Use Cases

### 1. Testing Waitlist Flow
```
1. Create a waitlist request (as customer)
2. Make sure tomorrow is available (no bookings/blocks)
3. Go to /admin/waitlist
4. Click "Check Availability Now"
5. Verify customer receives notification email
6. Check status changes to "Notified"
```

### 2. After Schedule Changes
```
Scenario: Admin removes a Google Calendar block

1. Admin removes blocked time from Google Calendar
2. Go to /admin/waitlist
3. Click "Check Availability Now"
4. Customers on waitlist get notified immediately
   (instead of waiting until 2 AM cron run)
```

### 3. After Creating Availability
```
Scenario: Admin cancels a booking

1. Admin cancels booking from /admin/bookings
   → Automatically triggers waitlist check
2. OR go to /admin/waitlist
3. Click "Check Availability Now" for double-check
4. Confirms notifications were sent
```

### 4. Troubleshooting
```
Scenario: Customer claims they never got notification

1. Check /admin/waitlist for their request
2. Verify status is "Pending" (not expired)
3. Confirm availability exists for their date range
4. Click "Check Availability Now"
5. Watch for success message
6. Check if customer receives email this time
```

## Response Messages

### Success Cases:

**No pending requests:**
```
✅ Availability check complete! 
   Processed 0 request(s), notified 0 customer(s).
```

**Found availability:**
```
✅ Availability check complete! 
   Processed 3 request(s), notified 2 customer(s).
```
(Means: 3 waitlist requests were checked, 2 had availability and were notified)

**No availability found:**
```
✅ Availability check complete! 
   Processed 3 request(s), notified 0 customer(s).
```
(Means: 3 requests were checked, but no slots were available for any of them)

### Error Cases:

**API Error:**
```
❌ Failed to check availability
```
- Check console logs for details
- Verify API endpoint is running
- Check server logs for errors

**Network Error:**
```
❌ Failed to check availability
```
- Check internet connection
- Verify dev server is running

## Technical Details

### API Endpoint Called:
```
GET /api/cron/check-waitlist-availability
```

### Response Format:
```json
{
  "success": true,
  "message": "Waitlist check completed",
  "processed": 3,
  "notified": 2
}
```

### What Happens After Click:
1. Sets `checkingAvailability` state to `true`
2. Makes API call to cron endpoint
3. Cron endpoint:
   - Fetches all pending waitlist requests
   - For each request:
     - Checks availability in date range
     - Sends notification email if slots found
     - Updates status to "notified"
4. Returns results
5. Shows success toast
6. Refreshes waitlist table
7. Sets `checkingAvailability` back to `false`

## Differences from Automatic Cron

| Feature | Manual Button | Automatic Cron |
|---------|--------------|----------------|
| **Trigger** | Admin clicks button | Scheduled (2 AM daily) |
| **Use Case** | Testing, immediate check | Regular automated checks |
| **Access** | Admin panel only | Vercel cron (or localhost) |
| **Response** | Shows toast notification | Silent (logs only) |
| **Refresh** | Auto-refreshes UI | N/A (no UI) |

Both use the **exact same endpoint** and logic, so results are identical.

## Limitations

- Button only appears in admin panel (customers can't trigger it)
- No rate limiting (could be clicked rapidly - consider adding if needed)
- Doesn't show detailed results (which customers were notified)
- No progress indicator for long-running checks

## Future Enhancements

Could add:
- [ ] Detailed results modal showing which customers were notified
- [ ] Rate limiting (e.g., prevent clicks within 60 seconds)
- [ ] Schedule preview (show what slots would be available)
- [ ] Dry-run mode (check without sending emails)
- [ ] Notification history log
- [ ] Export results as CSV

## Code Location

File: `/app/admin/waitlist/page.tsx`

```typescript
// State
const [checkingAvailability, setCheckingAvailability] = useState(false)

// Handler function (lines ~55-84)
const handleCheckAvailability = async () => {
  // ... implementation
}

// Button in JSX (lines ~179-195)
<Button 
  onClick={handleCheckAvailability}
  disabled={checkingAvailability}
>
  {/* ... button content */}
</Button>
```

## Testing

Quick test:
```
1. Go to http://localhost:3000/admin/waitlist
2. Click "Check Availability Now" button
3. Should see toast: "Checking for available slots..."
4. Button should show spinner
5. After completion: Success message with counts
6. Page should auto-refresh
```

## Screenshots Guide

Look for this button:
```
┌─────────────────────────────┐
│ Waitlist Management         │  🔔 Check Availability Now
│ View and manage customer... │  [                        ]
└─────────────────────────────┘
```

On mobile, it appears below the title instead of to the right.

## Logging

When button is clicked, server logs show:
```
🔔 [WAITLIST CRON] Starting waitlist availability check
🔍 [WAITLIST CRON] Found X pending waitlist requests
📋 [WAITLIST CRON] Processing request 1/X...
✅ [WAITLIST CRON] Found Y available slots!
✅ [WAITLIST CRON] Notified customer@email.com
🎉 [WAITLIST CRON] Completed! Processed X, Notified Y
```

Same logs as automatic cron job.

