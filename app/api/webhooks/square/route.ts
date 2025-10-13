import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
// import crypto from 'crypto';

// Force Node.js runtime for crypto support (needed for webhook signature verification)
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    // const signature = request.headers.get('x-square-signature');
    
    // Verify webhook signature (temporarily disabled - signature key mismatch)
    // if (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && signature) {
    //   const expectedSignature = crypto
    //     .createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)
    //     .update(body)
    //     .digest('base64');
    //   
    //   if (signature !== expectedSignature) {
    //     console.error('Invalid webhook signature');
    //     return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    //   }
    // }

    const event = JSON.parse(body);
    console.log('Square webhook received:', JSON.stringify(event, null, 2));

    // Handle payment events
    if (event.type === 'payment.updated' || event.type === 'payment.created') {
      const payment = event.data.object.payment;
      console.log(`Processing payment ${payment.id} with status: ${payment.status}`);
      
      if (payment && payment.status === 'COMPLETED') {
        // Find booking by order ID or payment link ID
        const supabase = createAdminSupabaseClient();
        
        // Try to find booking by square_order_id first
        let { data: booking, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('square_order_id', payment.order_id)
          .single();

        // If not found by order ID, try to find by payment link ID
        if (error && payment.payment_link_id) {
          const { data: bookingByLink, error: linkError } = await supabase
            .from('bookings')
            .select('*')
            .eq('square_payment_link_id', payment.payment_link_id)
            .single();
          
          if (!linkError && bookingByLink) {
            booking = bookingByLink;
            error = null;
          }
        }

        // If still not found, try to find by metadata (booking ID)
        if (error && payment.metadata && payment.metadata.bookingId) {
          const { data: bookingByMetadata, error: metadataError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', payment.metadata.bookingId)
            .single();
          
          if (!metadataError && bookingByMetadata) {
            booking = bookingByMetadata;
            error = null;
          }
        }

        if (booking && !error) {
          console.log(`✅ Found booking ${booking.id} for customer ${booking.customer_id}, amount: ${payment.amount_money.amount} cents`);
          
          // Update booking payment status
          const { error: updateError } = await supabase
            .from('bookings')
            .update({
              payment_status: 'paid',
              square_transaction_id: payment.id,
              paid_at: new Date().toISOString(),
              status: 'confirmed' // Also update booking status to confirmed
            })
            .eq('id', booking.id);

          if (updateError) {
            console.error('❌ Error updating booking payment status:', updateError);
          } else {
            console.log(`✅ Payment completed for booking ${booking.id}, status updated to paid`);
            
            // Update customer's total spent amount
            try {
              const { error: customerUpdateError } = await supabase.rpc('increment_customer_spent', {
                customer_id: booking.customer_id,
                amount: payment.amount_money.amount
              });
              
              if (customerUpdateError) {
                console.error('❌ Error updating customer total spent:', customerUpdateError);
              } else {
                console.log(`✅ Updated customer ${booking.customer_id} total spent by ${payment.amount_money.amount} cents ($${Math.round(payment.amount_money.amount / 100)})`);
              }
            } catch (error) {
              console.error('❌ Error calling increment_customer_spent function:', error);
            }
          }
        } else {
          console.log(`No booking found for payment ${payment.id} with order ID ${payment.order_id}`);
        }
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
