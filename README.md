# DUST Hair Studio - Custom Booking Platform

A comprehensive booking platform for DUST Hair Studio that replaces Squarespace, implements dynamic pricing for new vs. existing customers, and includes a full admin dashboard for managing bookings, customers, and services.

## Project Status

**Current Phase**: Production Ready ✅

### ✅ Completed Features
- **Authentication System**: Complete Supabase Auth integration with customer/admin roles
- **Service Management**: Dynamic pricing based on customer type (new vs existing)
- **Booking System**: Full multi-step booking flow with customer information capture
- **Admin Dashboard**: Complete admin portal with booking management, customer tracking, and analytics
- **Service Filtering**: Smart service display based on customer type and service availability
- **Schedule Management**: Business hours configuration with Google Calendar integration
- **Google Calendar Sync**: Two-way synchronization between bookings and Google Calendar
- **Production Deployment**: Fully built and tested with 19 routes working

## Tech Stack

- **Frontend**: Next.js 15 + Tailwind CSS + TypeScript
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **UI Components**: Custom components with shadcn/ui
- **Payments**: Square SDK v43 (Quick Pay Checkout & POS integration)
- **Hosting**: Vercel

## Core Architecture

### Authentication & User Management
- **Supabase Auth** handles all user authentication
- **Customers table** linked to `auth.users` via `auth_user_id`
- **Admin users** with elevated permissions and separate admin portal
- **Automatic user creation** when customers book without accounts

### Database Schema
```sql
-- Core tables
auth.users (Supabase managed)
customers (id, email, first_name, last_name, phone, is_existing_customer, auth_user_id)
admin_users (id, email, name, role, auth_user_id)
services (id, name, description, new_customer_price, existing_customer_price, is_existing_customer, is_new_customer)
bookings (id, customer_id, service_id, booking_date, booking_time, price_charged, customer_type_at_booking, status, square_payment_url, square_order_id, square_payment_link_id, square_transaction_id, paid_at)
```

### Square Payment Integration

The application integrates with Square for payment processing using a hybrid approach:

#### Payment Strategy: Pay After Service
- **No Pre-Payment Required**: Customers book appointments without payment
- **Admin-Generated Payment Links**: Payment links created but not auto-sent to customers
- **Flexible Payment Sharing**: Admin can share links via text, email, or in-person
- **POS Integration**: Track in-person payments made via Square POS after service

#### Square SDK Implementation
- **SDK Version**: Square SDK v43 with Next.js 15 compatibility
- **Environment Support**: Sandbox and Production environments
- **Quick Pay Checkout**: Creates hosted payment pages for easy customer payments
- **BigInt Handling**: Proper handling of monetary amounts using BigInt for precision

#### Database Schema for Payments
```sql
-- Square payment fields added to bookings table
ALTER TABLE bookings 
ADD COLUMN square_payment_url TEXT,           -- Generated payment link (admin use only)
ADD COLUMN square_order_id VARCHAR(255),      -- Square order tracking
ADD COLUMN square_payment_link_id VARCHAR(255), -- Square payment link management
ADD COLUMN square_transaction_id VARCHAR(255), -- Square POS transaction ID (for in-person payments)
ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;  -- Payment completion timestamp
```

#### Payment Workflow
1. **Booking Creation**: Customer books appointment (no payment required)
2. **Payment Link Generation**: System automatically creates Square payment link
3. **Admin Management**: Payment links stored for admin dashboard display
4. **Payment Collection**: Admin shares link when needed or collects payment in-person via Square POS
5. **Payment Tracking**: Manual or automated payment status updates

### Service Management System
Services have flexible customer type restrictions:
- **Available to both**: `is_existing_customer = true, is_new_customer = true`
- **Existing customers only**: `is_existing_customer = true, is_new_customer = false`
- **New customers only**: `is_existing_customer = false, is_new_customer = true`

Current services configured:
- **Consultation**: New customers only (free)
- **Haircut**: Both customer types (new: $225, existing: $135)
- **Short Haircut**: Both customer types (new: $175, existing: $135)
- **Bleach + Tone**: Both customer types (new: $300, existing: $200)
- **Fringe/Bang Trim**: Existing customers only (free)

## Key Features

### 🎯 Customer Portal
- **Dynamic Service Display**: Services shown/hidden based on customer type
- **Multi-step Booking Flow**: Service selection → Date/Time → Customer details → Confirmation
- **Smart Pricing**: Automatic price calculation based on customer type
- **Guest Booking**: Customers can book without creating accounts
- **Customer Type Tracking**: New vs existing customer status management

### 🛠️ Admin Dashboard
- **Booking Management**: View, filter, and update all bookings
- **Customer Management**: Toggle customer types (new ↔ existing)
- **Service Management**: Full CRUD operations for services with dual pricing
- **Service Status Control**: Activate/deactivate services with dedicated inactive section
- **Service Categories**: Organize services by category for better management
- **Customer Type Targeting**: Granular control over which customer types can access each service
- **Schedule Management**: Configure business hours (Fri-Sun 11am-8pm PST)
- **Google Calendar Integration**: Two-way sync with automatic booking creation and availability blocking
- **Analytics Dashboard**: Revenue tracking, customer counts, booking statistics
- **Status Management**: Update booking status (pending → confirmed → completed)
- **Search & Filtering**: Find bookings by customer, service, or status

### 🔐 Authentication System
- **Customer Authentication**: Login/register with Supabase Auth
- **Admin Authentication**: Separate admin portal with role-based access
- **Protected Routes**: Admin routes require authentication and admin privileges
- **Automatic User Creation**: Guest bookings create customer records automatically

## User Flows

### New Customer Journey
1. **Visit homepage** → See services with new customer pricing
2. **Click "Book Now"** → Multi-step booking flow
3. **Enter details** → System creates customer record
4. **Booking confirmed** → Receives confirmation (SMS integration planned)
5. **Admin marks as existing** → Future bookings show existing customer pricing

### Existing Customer Journey
1. **Login** → See services with existing customer pricing (lower rates)
2. **Book appointment** → Pre-filled customer information
3. **Booking confirmed** → Access to existing customer exclusive services

### Admin (Luca) Workflow
1. **Admin login** → Access admin dashboard
2. **View today's bookings** → See customer type indicators
3. **Manage bookings** → Update status, add notes
4. **Track customers** → Mark new customers as existing
5. **Monitor performance** → View analytics and revenue

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account and project
- Vercel account (for deployment)

### Environment Variables
Create `.env.local`:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Calendar Integration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Square Payment Integration
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=your_square_location_id
```

**Required Keys:**
- `SUPABASE_SERVICE_ROLE_KEY`: Found in Supabase project settings under "API" → "Service Role Key"
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Create in [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
- `SQUARE_ACCESS_TOKEN`: Found in [Square Developer Dashboard](https://developer.squareup.com/) → Applications → Your App → Credentials
- `SQUARE_LOCATION_ID`: Found in Square Developer Dashboard → Locations → Your Location → Location Details
- `NEXT_PUBLIC_APP_URL`: Your app's base URL (use `https://yourdomain.com` in production)

### Installation
```bash
npm install
npm run dev
```

### Database Setup
1. Create Supabase project
2. Run database migrations for tables and RLS policies
3. Create admin user in both `auth.users` and `admin_users` tables
4. Configure service data with proper customer type flags

## API Endpoints

### Customer APIs
- `GET /api/customer/me` - Get current customer data
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get user's bookings
- `GET /api/services` - Get available services

### Admin APIs
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/bookings` - All bookings with details
- `PATCH /api/admin/bookings/[id]` - Update booking status
- `GET /api/admin/customers` - Get all customers with booking stats
- `PATCH /api/admin/customers` - Bulk update customer types
- `GET /api/admin/customers/[id]` - Get single customer with booking history
- `PATCH /api/admin/customers/[id]` - Update customer (name, email, phone, notes, type)
- `GET /api/admin/check-access` - Verify admin permissions
- `GET /api/admin/services` - Get all services (including inactive)
- `POST /api/admin/services` - Create new service
- `GET /api/admin/services/[id]` - Get single service details
- `PATCH /api/admin/services/[id]` - Update service (including activation/deactivation)
- `DELETE /api/admin/services/[id]` - Delete service (if no bookings exist)
- `GET /api/admin/business-hours` - Get business hours configuration
- `POST /api/admin/business-hours` - Update business hours
- `GET /api/admin/google-calendar` - Get Google Calendar connection status
- `POST /api/admin/google-calendar` - Connect Google Calendar (OAuth callback)
- `GET /api/admin/availability` - Get available time slots based on business hours and calendar

### Auth APIs
- `POST /api/auth/admin/login` - Admin authentication
- `POST /api/admin/create-user` - Create admin users

### Square Payment APIs
- `GET /api/test-square` - Test Square integration and payment link creation
- `POST /api/bookings` - Create booking with automatic payment link generation (enhanced)

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Vercel Deployment
- Automatic deployments from main branch
- Environment variables configured in Vercel dashboard
- Production Supabase project connected

## Development Notes

### Recent Improvements

#### Production Build Fixes (Latest - January 2025)
- ✅ **TypeScript Error Resolution** - Fixed all `any` type errors across the application
- ✅ **Next.js 15 Compatibility** - Added proper Suspense boundaries for `useSearchParams()` usage
- ✅ **Production Build Success** - Application now builds successfully with all 31 routes
- ✅ **Type Safety Improvements** - Enhanced type definitions for business hours and error handling
- ✅ **Code Quality** - Eliminated all ESLint warnings and TypeScript compilation errors

#### Booking Flow & Pricing Enhancements (January 2025)
- ✅ **Conditional Price Display** - Prices hidden for non-logged-in users on homepage, duration always visible
- ✅ **Authentication-Gated Booking** - "Book Now" button redirects to login for unauthenticated users
- ✅ **Service Information Panel** - Added service details (name, duration, price) to booking step 2
- ✅ **Improved Booking Layout** - Three-column grid layout with service info, date selection, and time selection
- ✅ **Calendar Styling** - Removed border radius and side borders for cleaner calendar appearance
- ✅ **Navigation Cleanup** - Removed "Book Appointment" button from navigation for cleaner UX
- ✅ **Progress Indicator Removal** - Removed mobile-unfriendly step indicator for better mobile experience
- ✅ **Email Reminder Update** - Changed SMS reminder to email reminder in confirmation message
- ✅ **Service Selection Bug Fix** - Fixed pricing display bug when changing services in booking flow

#### Phase 1 Schedule Management (Latest - January 2025)
- ✅ **Business Hours Management** - Complete admin interface for configuring operating hours (Fri-Sun 11am-8pm PST)
- ✅ **Google Calendar OAuth Integration** - Full OAuth 2.0 flow with Google Calendar API
- ✅ **Two-Way Calendar Synchronization** - Bookings automatically create Google Calendar events
- ✅ **Availability Blocking** - Blocked time in Google Calendar automatically blocks system availability
- ✅ **Schedule Management UI** - Professional admin interface for managing business hours and calendar connection
- ✅ **OAuth Callback Handling** - Seamless Google Calendar connection with proper error handling
- ✅ **Calendar Event Creation** - New bookings automatically sync to Google Calendar with customer details
- ✅ **Token Management** - Secure storage and refresh of Google Calendar access tokens
- ✅ **Admin Schedule Dashboard** - Complete schedule management with connection status and controls
- ✅ **Timezone Handling Fix** - Resolved date parsing issues that caused incorrect day-of-week calculations

#### Service Change Bug Fix (Latest - January 2025)
- ✅ **Service Change Race Condition Fix** - Resolved critical bug where changing services didn't update availability correctly
- ✅ **State Reset Implementation** - Proper state clearing when changing services to prevent stale data conflicts
- ✅ **Availability Cache Management** - Clear availability caches when service changes to force fresh data
- ✅ **Calendar Loading States** - Added loading overlay with spinning scissor icon during availability checks
- ✅ **Buffer Time Configuration** - Made buffer time configurable in admin settings (default: 0 minutes)
- ✅ **Service Change UX** - Maintained "Change Service" button while fixing underlying state management issues
- ✅ **Debug Logging** - Comprehensive logging system for troubleshooting availability issues
- ✅ **State Synchronization** - Ensured calendar availability updates correctly when service duration changes

#### Admin Customer Management (January 2025)
- ✅ **Complete Admin Customer CRUD** - Full customer management interface with edit capabilities
- ✅ **Customer Search & Filtering** - Search by name, email, phone with type filtering (new/existing)
- ✅ **Customer Statistics Dashboard** - Total customers, new vs existing breakdown, booking counts, revenue tracking
- ✅ **Bulk Customer Operations** - Select multiple customers and bulk update their types
- ✅ **Individual Customer Editing** - Modal dialog to edit customer name, email, phone, notes, and customer type
- ✅ **Customer Details View** - Detailed customer information with booking history
- ✅ **Enhanced API Endpoints** - Comprehensive customer management API with admin client integration
- ✅ **Professional UI Design** - Clean, responsive interface with proper loading states and error handling

#### Admin Service Management (January 2025)
- ✅ **Complete Admin Service CRUD** - Full create, read, update, delete functionality for services
- ✅ **Dual Pricing System** - Services support separate pricing for new vs existing customers
- ✅ **Service Status Management** - Toggle services between active/inactive states
- ✅ **Inactive Services Section** - Dedicated UI section for managing deactivated services
- ✅ **Row Level Security (RLS) Bypass** - Implemented admin Supabase client for administrative operations
- ✅ **Service Categories** - Support for organizing services by category
- ✅ **Service Availability Controls** - Granular control over which customer types can access each service
- ✅ **Enhanced UI Components** - Improved modal dialogs, toast notifications, and form styling

#### UI/UX Enhancements
- ✅ **Modal Background Fixes** - White backgrounds for all modal dialogs and alert dialogs
- ✅ **Toast Notification Styling** - Mint green backgrounds with black borders for better visibility
- ✅ **Input Field Improvements** - Reduced focus ring thickness and improved spacing
- ✅ **Label Spacing** - Added proper spacing between field labels and input elements
- ✅ **Toggle Switch Redesign** - Larger, more professional toggle switches with green/gray color scheme
- ✅ **Form Validation** - Improved error handling and user feedback

#### Square Payment Integration (Latest - January 2025)
- ✅ **Square SDK v43 Integration** - Full integration with Square's latest SDK for Next.js 15
- ✅ **Quick Pay Checkout** - Payment link generation using Square's hosted checkout pages
- ✅ **Admin-Controlled Payment Flow** - Payment links generated but not auto-sent to customers
- ✅ **Database Schema Enhancement** - Added payment tracking fields to bookings table
- ✅ **BigInt Amount Handling** - Proper handling of monetary amounts using BigInt for precision
- ✅ **Environment Configuration** - Sandbox and production Square environment support
- ✅ **Payment Link Management** - Store and track Square payment links, order IDs, and transaction IDs
- ✅ **POS Integration Ready** - Database schema supports in-person Square POS payment tracking

#### Technical Improvements
- ✅ **Admin API Endpoints** - Complete REST API for service management (`/api/admin/services`)
- ✅ **Environment Configuration** - Service role key setup for admin operations
- ✅ **Error Handling** - Comprehensive debugging and error resolution
- ✅ **Database Schema Updates** - Enhanced service table with proper indexing and constraints

#### Technical Improvements
- ✅ **Fixed service filtering logic** - Proper customer type-based service display
- ✅ **Simplified database naming** - Removed confusing "only" suffixes from flags
- ✅ **Added admin portal button** - Conditional navigation for admin users
- ✅ **Enhanced booking system** - Multi-step flow with customer data capture
- ✅ **Availability System Integration** - Dynamic time slot generation based on business hours
- ✅ **Google Calendar API Integration** - Two-way sync with proper OAuth 2.0 implementation
- ✅ **Schedule Management System** - Complete business hours configuration and availability blocking

### Calendar Availability System

#### Overview
The calendar system is one of the most complex parts of the application. It dynamically disables dates that have no available time slots while keeping all dates visible. This section documents the critical implementation details to prevent future breakage.

#### How Calendar Availability Works

1. **Date Visibility vs Availability**
   - **All dates are always visible** in the calendar
   - **Dates with no availability are disabled/grayed out** (not hidden)
   - **Past dates are disabled** by the calendar component's built-in logic
   - **Non-business days are disabled** based on business hours settings
   - **Dates with zero available slots are disabled** by our custom logic

2. **Business Hours Configuration**
   - Admin configurable operating hours per day of week
   - Default: Friday-Sunday 11am-8pm PST
   - Each day can be individually enabled/disabled
   - Timezone-aware scheduling (America/Los_Angeles)
   - **Dynamic checking**: Only checks business days (no API calls for Mon-Thurs when closed)

3. **Availability Checking Logic**
   ```typescript
   // File: app/(customer)/book/page.tsx
   // Function: checkAvailabilityForVisibleDays()
   
   // 1. Only check future dates (starting from today)
   const currentDate = new Date(today.getTime()) // Avoid Date mutation
   
   // 2. Only check business days (skip Mon-Thurs when closed)
   while (currentDate < nextMonth) {
     if (isBusinessDay(currentDate)) {
       businessDays.push(currentDate.toISOString().split('T')[0])
     }
     currentDate.setDate(currentDate.getDate() + 1)
   }
   
   // 3. Use caching to avoid duplicate API calls
   const datesToCheck = businessDays.filter(dateStr => !availabilityCache.has(dateStr))
   
   // 4. Parallel API calls for efficiency
   const promises = datesToCheck.map(async (dateStr) => {
     const response = await fetch(`/api/admin/availability?startDate=${dateStr}&endDate=${dateStr}&serviceDuration=${selectedService.duration_minutes}`)
     const data = await response.json()
     const hasAvailability = data.availableSlots.length > 0
     
     // Cache result and add to disabled dates if no availability
     setAvailabilityCache(prev => new Map(prev).set(dateStr, hasAvailability))
     return hasAvailability ? null : dateStr
   })
   ```

4. **Calendar Disabled Logic**
   ```typescript
   // File: app/(customer)/book/page.tsx
   // Calendar component disabled prop
   
   <Calendar
     disabled={(date) => {
       const isPast = date < new Date()
       const isBusinessDayResult = isBusinessDay(date)
       const hasNoAvail = hasNoAvailability(date)
       
       // Disable if: past date OR not business day OR no availability
       return isPast || !isBusinessDayResult || hasNoAvail
     }}
   />
   ```

#### Critical Implementation Details

##### 1. Date Object Mutation Prevention
**Problem**: JavaScript Date objects are mutable, causing infinite loops
**Solution**: Always create new Date objects using `getTime()`
```typescript
// ❌ WRONG - Causes mutation
const currentDate = new Date(today)

// ✅ CORRECT - Creates new object
const currentDate = new Date(today.getTime())
```

##### 2. Efficient Date Range Checking
**Problem**: Checking 3 months of dates takes 6+ seconds
**Solution**: Prioritize current month, skip past dates
```typescript
// ❌ WRONG - Checks past dates
const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)

// ✅ CORRECT - Only future dates
const currentDate = new Date(today.getTime()) // Start from today
```

##### 3. Business Day Filtering
**Problem**: Wasting API calls on closed days (Mon-Thurs)
**Solution**: Only check business days
```typescript
// Only add to checking list if business is open
if (isBusinessDay(currentDate)) {
  businessDays.push(currentDate.toISOString().split('T')[0])
}
```

##### 4. Caching Strategy
**Problem**: Re-checking same dates multiple times
**Solution**: Cache results to avoid duplicate API calls
```typescript
// Check cache first
const datesToCheck = businessDays.filter(dateStr => !availabilityCache.has(dateStr))

// Cache results
setAvailabilityCache(prev => new Map(prev).set(dateStr, hasAvailability))
```

#### Time Slot Generation

1. **Time Slot Generation**
   - 30-minute intervals during business hours
   - Service duration + 15-minute buffer time
   - Slots extending beyond closing time are automatically excluded
   - Real-time availability checking

2. **Availability Factors**
   - **Existing Bookings**: Prevents double-booking
   - **Google Calendar Blocks**: Syncs with personal calendar
   - **Business Hours**: Only shows slots during open hours
   - **Service Duration**: Ensures adequate time for appointment

3. **Timezone Handling**
   - **Issue Fixed**: Date parsing now correctly handles Pacific timezone
   - **Problem**: UTC midnight dates were interpreted as previous day
   - **Solution**: Local timezone date creation prevents day-of-week errors
   - **Result**: Thursday appointments now show correctly when business is open

#### Technical Implementation
```typescript
// Timezone-safe date parsing
const dateStr = current.toISOString().split('T')[0]
const localDate = new Date(dateStr + 'T00:00:00') // Local timezone
const dayOfWeek = localDate.getDay() // Correct day calculation

// Business day checking
const isBusinessDay = (date: Date): boolean => {
  if (businessHours.length === 0) return true // Allow if not loaded yet
  
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
  const dayHours = businessHours.find(hours => hours.day_of_week === dayOfWeek)
  const isOpen = dayHours && dayHours.is_open
  
  return !!isOpen // Ensure boolean return
}

// Availability checking with caching
const hasNoAvailability = (date: Date) => {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return datesWithNoAvailability.has(dateStr)
}
```

### Database Management
- **Row Level Security (RLS)** enabled on all tables
- **Automatic auth linking** via database triggers
- **Customer type tracking** for pricing and service availability
- **Admin user management** with role-based access

### Security Features
- **Supabase Auth** handles all authentication securely
- **Protected admin routes** require authentication and admin privileges
- **Customer data isolation** via RLS policies
- **Secure API endpoints** with proper error handling

## Troubleshooting

### Calendar Availability Issues

#### Calendar Dates Not Disabling Properly

**Problem**: Dates with no availability are not showing as disabled (grayed out)
**Root Cause**: Usually one of these issues:

1. **Date Object Mutation**
   ```typescript
   // ❌ WRONG - Causes infinite loops
   const currentDate = new Date(today)
   
   // ✅ CORRECT - Creates new object
   const currentDate = new Date(today.getTime())
   ```

2. **Checking Past Dates**
   ```typescript
   // ❌ WRONG - Wastes time checking past dates
   const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
   
   // ✅ CORRECT - Only future dates
   const currentDate = new Date(today.getTime()) // Start from today
   ```

3. **Missing Caching**
   ```typescript
   // ❌ WRONG - Re-checks same dates
   const promises = businessDays.map(async (dateStr) => { ... })
   
   // ✅ CORRECT - Use cache
   const datesToCheck = businessDays.filter(dateStr => !availabilityCache.has(dateStr))
   ```

#### Debugging Calendar Issues

1. **Check Console Logs**
   ```bash
   # Look for these log messages:
   # "🔍 Checking availability for visible calendar days (prioritized)..."
   # "📅 Checking X dates from current month"
   # "🎯 OCTOBER 10TH API RESPONSE:"
   ```

2. **Test Availability API Directly**
   ```bash
   # Test specific date
   curl "http://localhost:3000/api/admin/availability?startDate=2025-10-10&endDate=2025-10-10&serviceDuration=60"
   
   # Expected response for unavailable date:
   {"availableSlots":[]}
   
   # Expected response for available date:
   {"availableSlots":["11:00 AM","11:30 AM",...]}
   ```

3. **Check Business Hours Configuration**
   ```bash
   curl "http://localhost:3000/api/admin/business-hours"
   
   # Should show which days are open:
   # Friday (day 5): is_open: true
   # Saturday (day 6): is_open: true  
   # Sunday (day 0): is_open: true
   ```

4. **Verify Date Formatting**
   ```typescript
   // Check if date strings are formatted correctly
   const dateStr = `${year}-${month}-${day}` // Should be "2025-10-10"
   console.log('Date string:', dateStr)
   ```

#### Common Calendar Problems

**Problem**: October 10th not showing as disabled despite having no availability
**Debug Steps**:
1. Check if `checkAvailabilityForVisibleDays()` is being called
2. Verify `datesWithNoAvailability` set contains '2025-10-10'
3. Check if `hasNoAvailability()` function returns true for that date
4. Verify Calendar component's `disabled` prop is working

**Problem**: Calendar takes 6+ seconds to show disabled dates
**Solutions**:
1. Ensure only future dates are being checked
2. Verify caching is working (check `availabilityCache` Map)
3. Make sure only business days are being checked
4. Check if too many dates are being processed at once

**Problem**: Dates are hidden instead of disabled
**Solution**: Never use `display: none` or `visibility: hidden`. Always use the `disabled` prop:
```typescript
// ❌ WRONG - Hides dates
<Calendar modifiers={{ unavailable: true }} modifiersClassNames={{ unavailable: "hidden" }} />

// ✅ CORRECT - Disables dates
<Calendar disabled={(date) => isPast || !isBusinessDay || hasNoAvailability} />
```

### Time Slot Issues

#### No Available Times Showing
1. **Check Business Hours**: Verify the day is configured as open in admin settings
2. **Timezone Issues**: Ensure dates are parsed in correct timezone (America/Los_Angeles)
3. **Google Calendar**: Check if personal calendar has blocked time slots
4. **Service Duration**: Verify service duration doesn't exceed available time

#### Service Change Issues

**Problem**: Changing services doesn't update availability (e.g., 1-hour service shows no availability, but 15-minute service should show slots)
**Root Cause**: Stale state from previous service causing race conditions between availability checks
**Solution**: Proper state reset when changing services

```typescript
// File: app/(customer)/book/page.tsx
// Function: handleServiceSelect()

const handleServiceSelect = (service: Service) => {
  // Reset all booking-related state (simulate going back to step 1)
  setSelectedDate(null)
  setSelectedTime('')
  setAvailableTimes([])
  setLoadingTimes(false)
  setLoadingCalendar(false)
  
  // Clear availability caches to force fresh data
  setDatesWithNoAvailability(new Set())
  setAvailabilityCache(new Map())
  
  // Set new service and go to step 2
  setSelectedService(service)
  setStep(2)
}
```

**Debug Steps**:
1. Check console logs for "🎯 handleServiceSelect called"
2. Verify state is being reset (datesWithNoAvailability should be empty)
3. Check if checkAvailabilityForVisibleDays runs with new service
4. Test API directly: `curl "http://localhost:3000/api/admin/availability?startDate=2025-10-10&endDate=2025-10-10&serviceDuration=15"`

#### Common Timezone Problems
- **Issue**: Thursday appointments not showing despite being configured as open
- **Cause**: Date strings parsed as UTC midnight (previous day in Pacific time)
- **Fix**: Use local timezone date creation: `new Date(dateStr + 'T00:00:00')`
- **Prevention**: Always parse dates in local timezone for day-of-week calculations

#### Debugging Availability
```bash
# Test availability API directly
curl "http://localhost:3000/api/admin/availability?startDate=2025-10-09&endDate=2025-10-09&serviceDuration=60"

# Check business hours configuration
curl "http://localhost:3000/api/admin/business-hours"
```

### Square Payment Issues

#### Payment Link Creation Failures
**Symptoms**: `createPaymentLink` function throws errors
**Common Causes & Solutions**:

1. **BigInt Serialization Error**
   ```
   Error: Do not know how to serialize a BigInt
   ```
   **Solution**: Ensure BigInt values are converted to strings for JSON serialization

2. **Invalid Phone Number Format**
   ```
   Error: Invalid phone number
   ```
   **Solution**: Use E.164 format (`+15551234567`) or omit phone number entirely

3. **Invalid Email Address**
   ```
   Error: Invalid email address
   ```
   **Solution**: Use valid email format or remove `prePopulatedData` section

4. **Square Client Initialization Issues**
   ```
   Error: Client is not a constructor
   ```
   **Solution**: Use `require('square')` instead of ES6 imports for better Next.js compatibility

#### Square SDK Compatibility Issues
**Problem**: Square SDK v43 with Next.js 15 compatibility
**Solutions**:
1. **Use CommonJS require**: `const square = require('square')`
2. **Correct API structure**: `squareClient.checkout.paymentLinks.create()`
3. **BigInt for amounts**: `amount: BigInt(priceInCents)`
4. **Async client access**: Use `await getSquareClient()` pattern

#### Testing Square Integration
```bash
# Test Square connection and payment link creation
curl http://localhost:3000/api/test-square

# Expected successful response:
{
  "success": true,
  "tests": {
    "paymentLink": {
      "success": true,
      "paymentUrl": "https://sandbox.square.link/u/...",
      "orderId": "...",
      "paymentLinkId": "..."
    }
  }
}
```

### Performance Issues

#### Calendar Loading Slowly
**Symptoms**: Calendar takes 5+ seconds to show disabled dates
**Causes & Solutions**:
1. **Too many dates being checked**: Limit to current month first, then next month
2. **Checking past dates**: Start from today, not beginning of month
3. **No caching**: Implement `availabilityCache` Map to avoid duplicate API calls
4. **Sequential API calls**: Use `Promise.all()` for parallel requests

#### Memory Issues
**Symptoms**: Browser becomes unresponsive, high memory usage
**Causes & Solutions**:
1. **Date object mutation**: Always use `new Date(today.getTime())`
2. **Infinite loops**: Ensure while loops have proper exit conditions
3. **Large state objects**: Use Set/Map instead of arrays for large datasets

## Future Enhancements (Planned)

### Phase 3: Payments & Communications ✅
- ✅ **Square Quick Pay Checkout** - Payment link generation for admin-controlled payment sharing
- ✅ **Square POS Integration** - In-person payment tracking after appointments
- - Twilio SMS integration for confirmations
- - Automated reminders and follow-ups

### Phase 4: Advanced Features
- Customer loyalty tracking
- Advanced reporting and analytics
- Multi-staff scheduling support

---

## Critical Files for Calendar System

### Core Calendar Files
- **`app/(customer)/book/page.tsx`** - Main booking page with calendar logic
- **`app/api/admin/availability/route.ts`** - Availability API endpoint
- **`lib/schedule-utils.ts`** - Time slot generation logic
- **`app/api/admin/business-hours/route.ts`** - Business hours configuration

### Key Functions to Never Break
```typescript
// app/(customer)/book/page.tsx
checkAvailabilityForVisibleDays() // Main availability checking function
hasNoAvailability() // Checks if date has no availability
isBusinessDay() // Checks if date is a business day
```

### State Variables to Preserve
```typescript
// Critical state - never remove or rename
const [datesWithNoAvailability, setDatesWithNoAvailability] = useState<Set<string>>(new Set())
const [availabilityCache, setAvailabilityCache] = useState<Map<string, boolean>>(new Map())
const [businessHours, setBusinessHours] = useState<{day_of_week: number; is_open: boolean; open_time: string; close_time: string; timezone: string}[]>([])
```

## Maintenance Guidelines

### When Modifying Calendar Logic
1. **Always test with October 10th, 2025** - This date should be disabled if it has no availability
2. **Check console logs** - Look for the specific log messages documented above
3. **Test API endpoints directly** - Use curl commands to verify availability responses
4. **Preserve caching logic** - Never remove the `availabilityCache` Map
5. **Maintain date object safety** - Always use `new Date(date.getTime())` for copies

### Common Breaking Changes to Avoid
1. **Removing caching** - This will cause duplicate API calls and slow performance
2. **Changing date formatting** - Date strings must be "YYYY-MM-DD" format
3. **Modifying business day logic** - This affects which dates get checked
4. **Changing disabled prop logic** - This affects how dates appear in the calendar
5. **Removing useEffect dependencies** - This can cause availability checking to not trigger

### Testing Checklist
- [ ] October 10th, 2025 shows as disabled (if it has no availability)
- [ ] Calendar loads in under 3 seconds
- [ ] Only future dates are checked (no past dates)
- [ ] Only business days are checked (no Mon-Thurs when closed)
- [ ] Caching works (subsequent loads are faster)
- [ ] All dates are visible (none are hidden)
- [ ] Disabled dates are grayed out (not hidden)

---

**Last Updated**: January 2025  
**Status**: Production Ready - All Phases Complete with Full Build Success ✅  
**Build Status**: Successfully builds with all 31 routes and 0 TypeScript errors  
**Admin Portal**: Fully functional with complete service management, customer management, booking management, schedule management, and payment integration  
**Customer Portal**: Complete booking flow with dynamic pricing and real-time availability  
**Payment Integration**: Square Quick Pay Checkout with admin-controlled payment link generation  
**Latest Feature**: Square Payment Integration - Complete payment link generation and admin payment management system