/**
 * Script to fix existing free appointments in the database
 * This updates all appointments with price_charged = 0 to have payment_status = 'paid'
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixFreeAppointments() {
  try {
    console.log('🔍 Finding free appointments with pending status...')
    
    // Find all bookings with price_charged = 0 and payment_status = 'pending'
    const { data: freeAppointments, error: fetchError } = await supabase
      .from('bookings')
      .select('id, price_charged, payment_status, services(name)')
      .eq('price_charged', 0)
      .eq('payment_status', 'pending')

    if (fetchError) {
      console.error('❌ Error fetching free appointments:', fetchError)
      return
    }

    console.log(`📋 Found ${freeAppointments?.length || 0} free appointments with pending status`)

    if (!freeAppointments || freeAppointments.length === 0) {
      console.log('✅ No free appointments need fixing')
      return
    }

    // Update all free appointments to have payment_status = 'paid'
    const { data: updatedAppointments, error: updateError } = await supabase
      .from('bookings')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('price_charged', 0)
      .eq('payment_status', 'pending')
      .select('id, services(name)')

    if (updateError) {
      console.error('❌ Error updating free appointments:', updateError)
      return
    }

    console.log(`✅ Successfully updated ${updatedAppointments?.length || 0} free appointments`)
    
    // Log the updated appointments
    if (updatedAppointments && updatedAppointments.length > 0) {
      console.log('\n📝 Updated appointments:')
      updatedAppointments.forEach(appointment => {
        console.log(`  - Booking ID: ${appointment.id}, Service: ${appointment.services?.name || 'Unknown'}`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the fix
fixFreeAppointments()
  .then(() => {
    console.log('\n🎉 Free appointments fix completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
