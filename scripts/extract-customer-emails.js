/**
 * Script to extract customer emails for the existing customer campaign
 * 
 * This script helps you extract emails from your booking database
 * to create your campaign email list.
 * 
 * Usage:
 * 1. Run this script to get a list of customer emails
 * 2. Copy the emails to the admin campaign interface
 * 3. Send your campaign
 */

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function extractCustomerEmails() {
  try {
    console.log('🔍 Extracting customer emails for campaign...')
    
    // Get all unique customer emails from bookings in the last 12 months
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        customers!inner(
          email,
          name,
          is_existing_customer,
          auth_user_id
        ),
        booking_date,
        created_at
      `)
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: false })

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
    }

    if (!bookings || bookings.length === 0) {
      console.log('❌ No bookings found in the last 12 months')
      return
    }

    // Filter out customers who already have accounts (auth_user_id exists)
    const guestCustomers = bookings.filter(booking => 
      booking.customers && 
      !booking.customers.auth_user_id && // No account
      booking.customers.email && 
      booking.customers.email.includes('@')
    )

    // Remove duplicates and sort by most recent booking
    const uniqueCustomers = new Map()
    
    guestCustomers.forEach(booking => {
      const email = booking.customers.email.toLowerCase()
      if (!uniqueCustomers.has(email)) {
        uniqueCustomers.set(email, {
          email: booking.customers.email,
          name: booking.customers.name,
          lastBooking: booking.booking_date,
          isExisting: booking.customers.is_existing_customer
        })
      }
    })

    const customerList = Array.from(uniqueCustomers.values())
      .sort((a, b) => new Date(b.lastBooking) - new Date(a.lastBooking))

    console.log(`\n📊 Campaign Email List Summary:`)
    console.log(`Total bookings found: ${bookings.length}`)
    console.log(`Guest customers (no account): ${customerList.length}`)
    console.log(`Existing customers: ${customerList.filter(c => c.isExisting).length}`)
    console.log(`New customers: ${customerList.filter(c => !c.isExisting).length}`)

    console.log(`\n📧 Email List (copy this to your campaign):`)
    console.log('=' .repeat(50))
    customerList.forEach((customer, index) => {
      console.log(`${customer.email}`)
    })
    console.log('=' .repeat(50))

    console.log(`\n💡 Next Steps:`)
    console.log(`1. Copy the emails above`)
    console.log(`2. Go to /admin/campaign in your admin dashboard`)
    console.log(`3. Paste the emails into the "Email List" field`)
    console.log(`4. Customize your message if needed`)
    console.log(`5. Send the campaign!`)

    // Save to file for easy access
    const fs = require('fs')
    const emailList = customerList.map(c => c.email).join('\n')
    fs.writeFileSync('campaign-email-list.txt', emailList)
    console.log(`\n💾 Email list saved to: campaign-email-list.txt`)

  } catch (error) {
    console.error('❌ Error extracting emails:', error.message)
    process.exit(1)
  }
}

// Run the extraction
extractCustomerEmails()



