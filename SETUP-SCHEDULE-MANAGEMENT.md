# Schedule Management Setup Guide

## 🎯 What's Been Built

A complete schedule management system with Google Calendar integration that works with your existing Settings table structure.

### ✅ Features Implemented:
- **Business Hours Management**: Friday-Sunday 11am-9pm PST (configurable)
- **Google Calendar Integration**: Two-way sync (bookings → calendar, blocked time → availability)
- **Real-time Availability**: Checks business hours, existing bookings, and Google Calendar blocks
- **Admin UI**: Complete schedule management interface at `/admin/schedule`

## 📋 Setup Steps

### 1. Database Migration
Run this SQL in your Supabase SQL editor:
```sql
-- Update existing business_hours setting to new format (Friday-Sunday 11am-9pm PST)
UPDATE settings 
SET value = '{"friday":{"start":"11:00","end":"21:00","is_open":true},"saturday":{"start":"11:00","end":"21:00","is_open":true},"sunday":{"start":"11:00","end":"21:00","is_open":true},"monday":{"start":"","end":"","is_open":false},"tuesday":{"start":"","end":"","is_open":false},"wednesday":{"start":"","end":"","is_open":false},"thursday":{"start":"","end":"","is_open":false}}',
    updated_at = NOW()
WHERE key = 'business_hours';

-- Add timezone setting for business hours
INSERT INTO settings (key, value, description) 
VALUES ('business_hours_timezone', '"America/Los_Angeles"', 'Timezone for business hours')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Add google_calendar_event_id column to bookings table if it doesn't exist
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR(255);

-- Create index for Google Calendar event ID
CREATE INDEX IF NOT EXISTS idx_bookings_google_event ON bookings(google_calendar_event_id);
```

### 2. Google OAuth Setup (Optional but Recommended)

#### Create Google Cloud Project:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API
4. Go to "APIs & Services" → "Credentials"
5. Create OAuth 2.0 Client ID
6. Add authorized redirect URI: `http://localhost:3000/admin/settings` (development)
7. Add authorized redirect URI: `https://yourdomain.com/admin/settings` (production)

#### Add Environment Variables:
Add to your `.env.local`:
```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Test the System

1. **Start the dev server**: `npm run dev`
2. **Go to Admin**: `/admin/schedule`
3. **Configure Business Hours**: Set your preferred schedule (default is Fri-Sun 11am-9pm PST)
4. **Connect Google Calendar**: Click "Connect Google Calendar" (optional)
5. **Test Booking**: Create a test booking to see calendar sync

## 🔄 How It Works

### Business Hours Management:
- **Current Format**: Uses your existing Settings table with JSON structure
- **Default Schedule**: Friday-Sunday 11am-9pm PST (as requested)
- **Flexible**: Can be changed to any schedule via the admin UI

### Google Calendar Integration:
- **Bookings → Calendar**: New bookings automatically create events in your Google Calendar
- **Calendar → Availability**: If you block time in Google Calendar, it blocks availability in the system
- **Two-way Sync**: Everything stays perfectly synchronized

### Availability Checking:
- **Real-time**: Checks business hours, existing bookings, and Google Calendar blocks
- **Smart**: Generates 30-minute slots based on service duration
- **Conflict Prevention**: Prevents double-booking automatically

## 🎛️ Admin Interface

Access at `/admin/schedule`:

### Business Hours Section:
- Toggle each day on/off
- Set custom open/close times for each day
- Save changes with one click

### Google Calendar Section:
- Shows connection status
- One-click connect/disconnect
- Lists integration features
- Shows calendar ID when connected

### Quick Setup Guide:
- Step-by-step instructions
- Visual guide for setup process

## 🔧 API Endpoints

- `GET/POST /api/admin/business-hours` - Business hours management
- `GET/POST/DELETE /api/admin/google-calendar` - Google Calendar integration
- `GET /api/admin/availability` - Real-time availability checking

## 🚀 What's Next

1. **Run the database migration** (SQL above)
2. **Set up Google OAuth** (optional but recommended)
3. **Test the system** with a few bookings
4. **Customize business hours** to your exact schedule
5. **Connect Google Calendar** for full two-way sync

## 🆘 Troubleshooting

### Business Hours Not Loading:
- Check that the database migration ran successfully
- Verify the Settings table has the `business_hours` key

### Google Calendar Not Connecting:
- Verify environment variables are set correctly
- Check Google Cloud Console OAuth setup
- Ensure redirect URI matches your app URL

### Availability Not Working:
- Check business hours are set correctly
- Verify Google Calendar connection (if using)
- Check existing bookings don't conflict

---

**Ready to go!** This system gives Luca complete control over his schedule with seamless Google Calendar integration. 🎉
