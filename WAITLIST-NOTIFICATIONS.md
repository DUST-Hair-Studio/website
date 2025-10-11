# Waitlist Notification Badge

## Overview
The admin sidebar now displays a notification badge on the Waitlist menu item showing the number of unread/new waitlist requests since the admin last viewed the page.

## Features

### 1. Notification Badge
- **Red badge** with count appears on the Waitlist sidebar item
- Shows number of new waitlist entries (e.g., "3")
- Displays "99+" for counts over 99
- Works in both **collapsed** and **expanded** sidebar states
- Auto-refreshes every 30 seconds

### 2. Badge Positioning
- **Collapsed sidebar**: Badge appears in top-right corner of icon
- **Expanded sidebar**: Badge appears at the end of the row (right side)

### 3. Auto-Clear Behavior
- Badge automatically clears when admin visits the waitlist page
- Updates `waitlist_last_viewed_at` timestamp in settings
- All future waitlist entries created after this timestamp will count as "unread"

## Technical Implementation

### API Endpoints

**GET `/api/admin/waitlist/unread-count`**
- Returns count of waitlist entries created after last viewed timestamp
- Response: `{ unreadCount: number, lastViewedAt: string | null }`

**POST `/api/admin/waitlist/mark-viewed`**
- Updates `waitlist_last_viewed_at` setting to current timestamp
- Called automatically when admin visits waitlist page
- Response: `{ success: true, lastViewedAt: string }`

### Database Schema

**Settings Table**:
```sql
key: 'waitlist_last_viewed_at'
value: '2025-10-11T00:00:00.000Z' (ISO timestamp or NULL)
description: 'Timestamp when admin last viewed the waitlist page'
```

### Components Modified

1. **`components/admin/admin-sidebar.tsx`**
   - Added `unreadWaitlistCount` state
   - Fetches count on mount and every 30 seconds
   - Renders badge conditionally on waitlist menu item

2. **`app/admin/waitlist/page.tsx`**
   - Calls `mark-viewed` endpoint on page load
   - Clears the notification count when admin views the page

## Usage

### For Admins
1. New waitlist requests automatically increment the badge count
2. Visit the waitlist page to mark all as "viewed" and clear the badge
3. Badge will reappear when new customers join the waitlist

### Migration Required
Run the SQL migration to create the initial setting:
```bash
database-migrations/waitlist-last-viewed-tracking.sql
```

## UX Benefits

✅ **At-a-glance awareness** - See immediately if there are new waitlist requests  
✅ **Persistent tracking** - Count survives page refreshes and sessions  
✅ **Auto-refresh** - Updates every 30 seconds without manual refresh  
✅ **Zero friction** - No manual "mark as read" - just visit the page  
✅ **Mobile-friendly** - Works in both collapsed and expanded sidebar states

## Future Enhancements

Possible improvements:
- Per-admin tracking (each admin has their own unread count)
- Different colors for urgent vs normal waitlist entries
- Desktop notifications for new waitlist entries
- Filter to show only "unread" waitlist entries

