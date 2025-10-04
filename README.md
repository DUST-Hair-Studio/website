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
bookings (id, customer_id, service_id, booking_date, booking_time, price_charged, customer_type_at_booking, status)
```

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
```

**Required Keys:**
- `SUPABASE_SERVICE_ROLE_KEY`: Found in Supabase project settings under "API" → "Service Role Key"
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Create in [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
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

#### Booking Flow & Pricing Enhancements (Latest - January 2025)
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

#### Technical Improvements
- ✅ **Admin API Endpoints** - Complete REST API for service management (`/api/admin/services`)
- ✅ **Environment Configuration** - Service role key setup for admin operations
- ✅ **Error Handling** - Comprehensive debugging and error resolution
- ✅ **Database Schema Updates** - Enhanced service table with proper indexing and constraints

#### Previous Improvements
- ✅ **Fixed service filtering logic** - Proper customer type-based service display
- ✅ **Simplified database naming** - Removed confusing "only" suffixes from flags
- ✅ **Added admin portal button** - Conditional navigation for admin users
- ✅ **Fixed TypeScript errors** - Production-ready build with all 19 routes
- ✅ **Added Suspense boundaries** - Proper Next.js 15 compatibility
- ✅ **Enhanced booking system** - Multi-step flow with customer data capture

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

## Future Enhancements (Planned)

### Phase 3: Payments & Communications
- Square Checkout API for payment links
- Twilio SMS integration for confirmations
- Automated reminders and follow-ups

### Phase 4: Advanced Features
- Customer loyalty tracking
- Advanced reporting and analytics
- Multi-staff scheduling support

---

**Last Updated**: January 2025  
**Status**: Production Ready - Phase 1 Complete with Google Calendar Integration  
**Admin Portal**: Fully functional with complete service management, customer management, booking management, and schedule management  
**Customer Portal**: Complete booking flow with dynamic pricing  
**Latest Feature**: Phase 1 Schedule Management - Google Calendar integration with two-way sync, business hours management, and availability blocking