# Square POS Integration Requirements

## 📋 **Project Overview**

This document provides complete requirements and context for implementing Square POS integration in the Dust Hair Studio booking system.

## 🎯 **Current State**

### **What's Already Working:**
✅ **Payment Link Emails** - Customers receive professional emails with Square checkout links  
✅ **Basic POS Marking** - Admin can mark payments as collected via "Pay Now (POS)" button  
✅ **Square SDK Integration** - Square SDK v43 is properly configured with production credentials  
✅ **Database Schema** - Bookings table has Square payment fields (`square_payment_url`, `square_order_id`, `square_payment_link_id`, `square_transaction_id`)  
✅ **Webhook Handler** - Basic Square webhook processing exists at `/api/webhooks/square`  

### **What's Missing (The Problem):**
❌ **No Transaction Linking** - POS payments aren't connected to bookings in the system  
❌ **Manual Reconciliation** - Admin has to manually track which POS payments match which bookings  
❌ **No Order Creation** - No Square orders are created for POS payments  

## 🔧 **Technical Architecture**

### **Current Payment Flow:**
1. Customer books appointment (no payment required)
2. Admin clicks "Pay Now (POS)" → Booking marked as `paid` in database
3. Admin processes payment in Square POS app (separate, unconnected)
4. **Gap**: No connection between Square POS transaction and booking record

### **Current Code Structure:**
```
/app/api/bookings/send-payment-link/route.ts    # Email payment links ✅
/app/api/bookings/generate-payment-link/route.ts # Generate payment URLs ✅  
/app/api/webhooks/square/route.ts               # Basic webhook handler ✅
/lib/square-payment.ts                          # Square payment utilities ✅
/lib/square.ts                                  # Square client configuration ✅
```

### **Database Fields Available:**
```sql
-- In bookings table:
square_payment_url TEXT           -- For email payment links ✅
square_order_id VARCHAR(255)      -- For linking POS orders 🔧 NEEDS IMPLEMENTATION
square_payment_link_id VARCHAR(255) -- For email payment links ✅  
square_transaction_id VARCHAR(255)  -- For POS transaction linking 🔧 NEEDS IMPLEMENTATION
```

## 🎯 **Requirements: Square POS Integration**

### **Primary Goal:**
Create a seamless connection between Square POS transactions and booking records, eliminating manual reconciliation.

### **User Stories:**

#### **Story 1: Admin POS Payment Flow**
```
As an admin, 
When I click "Pay Now (POS)" for a booking,
I want the system to:
1. Create a Square order with booking details
2. Display the order ID for me to use in Square POS
3. Automatically link the POS transaction to the booking when payment completes
4. Update the booking status to "paid" with transaction details
```

#### **Story 2: Automatic Transaction Linking**
```
As an admin,
When I process a payment in Square POS using the provided order ID,
I want the system to:
1. Automatically detect the completed payment via webhook
2. Link the transaction to the correct booking
3. Update booking status and payment details
4. Show transaction details in the admin dashboard
```

#### **Story 3: Payment Audit Trail**
```
As an admin,
I want to see:
1. Which payments were collected via POS vs email links
2. Square transaction IDs for all payments
3. Order IDs used for POS payments
4. Complete payment history for each booking
```

## 🛠️ **Technical Implementation Plan**

### **Phase 1: Order Creation for POS Payments**

#### **1.1 Modify "Pay Now (POS)" Button**
**File:** `/app/admin/bookings/page.tsx`
**Current Function:** `markPaymentCollected()`
**New Function:** `createSquareOrderForPOS()`

**Requirements:**
- Create Square order using `square.orders.createOrder()`
- Include booking details (service, customer, amount)
- Store `square_order_id` in booking record
- Display order ID to admin for POS use
- Don't mark as paid yet (wait for actual payment)

#### **1.2 New API Endpoint**
**File:** `/app/api/bookings/create-pos-order/route.ts`

**Functionality:**
```typescript
POST /api/bookings/create-pos-order
Body: { bookingId: string }
Response: { 
  success: boolean, 
  orderId: string,
  message: string 
}
```

**Implementation:**
- Fetch booking details from database
- Create Square order with booking information
- Update booking with `square_order_id`
- Return order ID for admin to use in POS

### **Phase 2: Enhanced Webhook Processing**

#### **2.1 Update Webhook Handler**
**File:** `/app/api/webhooks/square/route.ts`

**Current:** Basic payment detection
**Enhanced:** Order-based transaction linking

**New Logic:**
```typescript
// When payment webhook received:
1. Check if payment has order_id
2. Find booking by square_order_id
3. Verify payment status is 'COMPLETED' ✅ CRITICAL
4. ONLY if payment successful, update booking with:
   - payment_status: 'paid'
   - square_transaction_id: payment.id
   - paid_at: timestamp
   - status: 'confirmed'
5. Log successful transaction linking
```

**Important:** Booking status should ONLY be updated to "paid" when payment status is `COMPLETED`. Failed, cancelled, or pending payments should NOT update the booking status.

#### **2.2 Handle Edge Cases**
- **Payment Status Validation:** Only process `COMPLETED` payments
- **Failed Payment Handling:** Log failed payments but don't update booking
- **Multiple payments for same order:** Handle duplicate webhook events
- **Payments without order IDs:** Fallback to existing logic for email payment links
- **Webhook signature verification:** Optional security enhancement
- **Error handling and logging:** Comprehensive error tracking

### **Phase 3: Admin UI Enhancements**

#### **3.1 Enhanced Payment Status Display**
**File:** `/app/admin/bookings/page.tsx`

**New Features:**
- Show `square_order_id` for pending POS payments
- Display `square_transaction_id` for completed payments
- Payment method indicator (POS vs Email Link)
- Transaction timestamp

#### **3.2 Payment History**
**New Component:** Payment audit trail showing:
- Payment method (POS/Email)
- Transaction details
- Timestamps
- Order IDs

### **Phase 4: Error Handling & Monitoring**

#### **4.1 Comprehensive Error Handling**
- Square API failures
- Order creation failures
- Webhook processing errors
- Database update failures

#### **4.2 Admin Notifications**
- Failed order creation alerts
- Unlinked transaction warnings
- Payment reconciliation issues

## 🔗 **Square API Integration Details**

### **Required Square API Calls:**

#### **1. Create Order**
```typescript
const order = await squareClient.orders.createOrder({
  idempotencyKey: randomUUID(),
  order: {
    locationId: locationId,
    lineItems: [{
      name: booking.services.name,
      quantity: '1',
      basePriceMoney: {
        amount: BigInt(booking.price_charged),
        currency: 'USD'
      }
    }],
    metadata: {
      bookingId: booking.id,
      customerEmail: booking.customers.email,
      customerName: booking.customers.name
    }
  }
});
```

#### **2. Webhook Event Processing**
```typescript
// Event: payment.updated or payment.created
// Check: payment.order_id exists
// Action: Link to booking and update status
```

### **Square SDK Configuration:**
- **SDK Version:** 43.1.0 ✅ (already configured)
- **Environment:** Production ✅ (already configured)
- **Access Token:** Production token ✅ (already configured)
- **Location ID:** Production location ✅ (already configured)

## 📊 **Database Schema Updates**

### **Current Schema (No Changes Needed):**
```sql
-- bookings table already has all required fields:
ALTER TABLE bookings 
ADD COLUMN square_payment_url TEXT,           -- ✅ Email payment links
ADD COLUMN square_order_id VARCHAR(255),      -- 🔧 POS order linking
ADD COLUMN square_payment_link_id VARCHAR(255), -- ✅ Email payment links  
ADD COLUMN square_transaction_id VARCHAR(255), -- 🔧 POS transaction linking
ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;  -- ✅ Payment timestamp
```

## 🧪 **Testing Strategy**

### **Test Scenarios:**

#### **1. Happy Path Testing**
- Create order for POS payment
- Process payment in Square POS
- Verify webhook updates booking
- Check admin dashboard displays correctly

#### **2. Error Scenario Testing**
- Square API failures
- Invalid order IDs
- Webhook processing errors
- Database update failures

#### **3. Edge Case Testing**
- Multiple payments for same order
- Webhook received before order creation
- Payment without order ID
- Duplicate webhook events

## 🚀 **Deployment Considerations**

### **Environment Variables:**
- All Square configuration already set ✅
- Current webhook URL: `https://website-sigma-steel-43.vercel.app/api/webhooks/square`
- Future webhook URL: `https://www.dusthairstudio.com/api/webhooks/square`

### **Square Dashboard Configuration:**
- Webhook events: `payment.created`, `payment.updated`
- Current webhook URL: Already configured ✅
- **URL Migration Required:** Update webhook URL when moving to dusthairstudio.com
- Signature verification: Optional (currently disabled)

### **URL Migration Planning:**
**When moving from soft launch to production domain:**

1. **Update Square Webhook URL:**
   - Go to Square Developer Dashboard
   - Update webhook URL from `website-sigma-steel-43.vercel.app` to `dusthairstudio.com`
   - Test webhook connectivity

2. **Update Environment Variables:**
   - `NEXT_PUBLIC_APP_URL`: Update to `https://www.dusthairstudio.com`
   - Verify all internal links and redirects work

3. **Test Critical Functions:**
   - Payment link generation
   - Webhook processing
   - Admin dashboard functionality

### **Rollout Strategy:**
1. Deploy order creation functionality
2. Test with small number of transactions
3. Enable webhook processing
4. Monitor for issues
5. Full rollout

## 📝 **Success Criteria**

### **Functional Requirements:**
- ✅ Admin can create Square orders for POS payments
- ✅ Order IDs are displayed for POS use
- ✅ POS transactions automatically link to bookings
- ✅ Payment status updates automatically
- ✅ Complete audit trail available

### **Performance Requirements:**
- Order creation: < 2 seconds
- Webhook processing: < 5 seconds
- Admin dashboard loads: < 3 seconds

### **Reliability Requirements:**
- 99.9% webhook processing success rate
- Graceful handling of Square API failures
- Complete error logging and monitoring

## 🔧 **Implementation Priority**

### **Phase 1 (Critical):**
1. Create `/api/bookings/create-pos-order` endpoint
2. Modify `markPaymentCollected()` to create Square orders
3. Update admin UI to show order IDs

### **Phase 2 (Important):**
1. Enhance webhook handler for order-based linking
2. Add comprehensive error handling
3. Update admin dashboard with transaction details

### **Phase 3 (Nice to Have):**
1. Payment audit trail component
2. Advanced error notifications
3. Payment reconciliation tools

## 📚 **Reference Materials**

### **Existing Code Files:**
- `/lib/square.ts` - Square client configuration
- `/lib/square-payment.ts` - Payment link utilities  
- `/app/api/webhooks/square/route.ts` - Current webhook handler
- `/app/admin/bookings/page.tsx` - Admin booking interface

### **Square Documentation:**
- [Square Orders API](https://developer.squareup.com/reference/square/orders-api)
- [Square Webhooks](https://developer.squareup.com/reference/square/webhooks)
- [Square SDK v43](https://developer.squareup.com/reference/square/square-sdk-overview)

### **Environment & URL Configuration:**

#### **Current Setup (Soft Launch):**
- **Website:** https://website-sigma-steel-43.vercel.app
- **Admin Dashboard:** https://website-sigma-steel-43.vercel.app/admin/bookings
- **Webhook Endpoint:** https://website-sigma-steel-43.vercel.app/api/webhooks/square

#### **Production Setup (Final):**
- **Website:** https://www.dusthairstudio.com
- **Admin Dashboard:** https://www.dusthairstudio.com/admin/bookings  
- **Webhook Endpoint:** https://www.dusthairstudio.com/api/webhooks/square

#### **Important Environment Considerations:**

**Square POS Sandbox Limitations:**
- ❌ **Square POS app does NOT support sandbox mode**
- ✅ **Square webhooks DO support sandbox mode**
- ⚠️ **Webhook testing must be done in production environment**

**Current Configuration:**
- **Square Environment:** Production (required for POS)
- **Square Access Token:** Production token (EAAAl4...)
- **Square Location ID:** Production location (LQW9NJ0S...)
- **Webhook Configuration:** Production webhook URL

---

## 🎯 **Summary for Developer**

**Goal:** Implement Square POS integration to automatically link POS transactions with booking records.

**Key Challenge:** Currently, "Pay Now (POS)" just marks bookings as paid without creating any connection to actual Square transactions.

**Solution:** Create Square orders when "Pay Now (POS)" is clicked, then use webhooks to automatically link completed payments to bookings.

**Expected Outcome:** Seamless POS payment workflow with automatic transaction linking and complete audit trail.

**Timeline:** 2-3 days for full implementation and testing.

---

**Last Updated:** October 13, 2025  
**Status:** Ready for implementation  
**Priority:** High - Core business functionality
