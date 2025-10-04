// Type definitions for the DUST hair salon booking system

export interface Customer {
  id: string;
  email: string;
  phone: string;
  name: string;
  password_hash?: string; // Only present during auth operations
  is_existing_customer: boolean;
  total_bookings: number;
  last_booking_date?: string;
  notes?: string;
  allow_sms_notifications: boolean;
  auth_user_id?: string; // For future Supabase Auth integration
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  password_hash?: string; // Only present during auth operations
  name: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  new_customer_price: number; // in cents
  existing_customer_price: number; // in cents
  is_active: boolean;
  is_existing_customer_only: boolean;
  is_new_customer_only: boolean;
  category?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  price_charged: number; // in cents
  customer_type_at_booking: 'new' | 'existing';
  payment_link?: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  google_calendar_event_id?: string;
  square_payment_id?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  sms_confirmation_sent: boolean;
  sms_reminder_sent: boolean;
  sms_followup_sent: boolean;
  customer_notes?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SmsLog {
  id: string;
  customer_id?: string;
  booking_id?: string;
  phone_number: string;
  message_type: 'confirmation' | 'reminder' | 'followup' | 'custom';
  message_body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  twilio_message_sid?: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface Setting {
  key: string;
  value: any; // JSONB value
  description?: string;
  updated_at: string;
  updated_by?: string;
}
