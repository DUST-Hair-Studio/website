# Existing Customer Registration Campaign - Implementation Plan

## 🎯 Campaign Overview
**Goal**: Convert existing customers (who book as guests) into registered users with "existing customer" status to maintain current pricing.

## 📧 Email Campaign Strategy

### Email Content (Casual & Direct)
```
Subject: Important: Your pricing is changing (but not for you)

Hi all,

I want to thank you for your business over the years.

As of today, I'm changing my prices for new customers. You will be grandfathered into the current pricing structure, but to get this pricing I need you to please create an account here: [CREATE ACCOUNT BUTTON]

This ensures you keep your current rates while new customers will see the updated pricing.

Thanks for your continued support!

[Your name]
```

### Email List Preparation
1. **Extract from bookings**: Get emails from last 6-12 months of bookings
2. **Filter existing accounts**: Remove customers who already have accounts
3. **Segment by value**: Prioritize high-value customers
4. **Clean data**: Remove duplicates and invalid emails

## 🛠 Technical Implementation

### ✅ Completed Features
1. **Special Registration Route**: `/register/existing` - automatically sets `is_existing_customer: true`
2. **Modified Registration Form**: Accepts `isExistingCustomer` prop
3. **Campaign Tracking**: Database tables and API endpoints for analytics
4. **Email Template**: HTML template ready for use
5. **Drill-down & Resend**: View per-recipient sent/failed details and resend to failed recipients (run `database-migrations/campaign-send-history-send-details.sql` for full support)

### ✅ Campaign Blasts via Resend Broadcasts
Campaign sends use Resend **Broadcasts** (Marketing), avoiding the 100/day transactional limit. Create segments in **Admin → Segments**, then send campaigns to a segment from the Campaigns page.

### 🔧 Implementation Steps

#### Step 1: Database Setup
```bash
# Run the migration
psql -d your_database -f database-migrations/campaign-tracking.sql
```

#### Step 2: Deploy Code Changes
- ✅ `/register/existing` page created
- ✅ Registration form updated
- ✅ Campaign tracking implemented
- ✅ Analytics API created

#### Step 3: Email Campaign Setup
1. **Use the built-in campaign interface**: Go to `/admin/campaign` in your admin dashboard
2. **Extract customer emails**: Run the email extraction script or manually collect emails
3. **Customize the message**: The interface has your casual message pre-filled
4. **Test**: Send to a small test group first

#### Step 4: Campaign Launch
1. **Email List**: Use the built-in campaign interface at `/admin/campaign`
2. **Send Campaign**: Click "Send Campaign" in the admin interface
3. **Monitor**: Check results in the campaign interface and analytics

## 📊 Success Metrics

### Key Performance Indicators
- **Registration Rate**: % of email recipients who register
- **Time to Register**: How quickly people register after email
- **Booking Behavior**: Do registered customers book more frequently?
- **Revenue Impact**: Savings passed to customers vs. increased loyalty

### Analytics Dashboard
Access campaign data via: `GET /api/admin/campaign-analytics`

**Metrics Tracked:**
- Total campaign registrations
- Existing vs. new customer breakdown
- Registration timestamps
- Email addresses of registrants

## 🎯 Expected Outcomes

### Conservative Estimates
- **20-30% registration rate** from email list
- **$50-100 average savings** per converted customer
- **15-25% increase** in repeat bookings from registered users

### Success Factors
- ✅ Clear value proposition (grandfathered pricing)
- ✅ Frictionless registration process
- ✅ Immediate benefit confirmation
- ✅ Personal, authentic messaging

## 📋 Pre-Launch Checklist

### Technical Setup
- [ ] Deploy code changes to production
- [ ] Run database migration
- [ ] Test registration flow at `/register/existing`
- [ ] Verify campaign tracking works
- [ ] Test analytics endpoint

### Email Preparation
- [ ] Update email template with your domain
- [ ] Add your name and contact info
- [ ] Prepare email list (extract from bookings)
- [ ] Test email template
- [ ] Set up email service

### Launch
- [ ] Send test email to yourself
- [ ] Send to small test group (5-10 people)
- [ ] Monitor for any issues
- [ ] Launch to full list
- [ ] Monitor analytics

## 🔄 Post-Launch Actions

### Week 1: Monitor & Optimize
- Check registration rates daily
- Monitor for any technical issues
- Respond to customer questions
- Track booking behavior

### Week 2-4: Follow-up
- Send reminder to non-registrants (if needed)
- Analyze customer behavior changes
- Plan next campaign iteration

## 📞 Support & Troubleshooting

### Common Issues
1. **Registration not working**: Check if database migration ran
2. **Analytics not showing**: Verify campaign tracking is enabled
3. **Email links broken**: Update domain in email template

### Analytics Access
- **Admin Dashboard**: Check customer management for campaign customers
- **API Endpoint**: `/api/admin/campaign-analytics` for detailed metrics
- **Database**: Direct query to `campaign_registrations` table

## 🎉 Success Celebration
Once you hit your target registration rate, celebrate! This campaign will:
- Build stronger customer relationships
- Increase customer lifetime value
- Provide better data for future marketing
- Create a foundation for loyalty programs
