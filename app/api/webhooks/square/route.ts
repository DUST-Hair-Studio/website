import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
// import crypto from 'crypto';

// Force Node.js runtime for crypto support (needed for webhook signature verification)
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const data = url.searchParams.get('data');
    
    let paymentSucceeded = false;
    let transactionId: string | null = null;
    let amountCents: number | null = null;
    
    if (data) {
      console.log('Square POS callback received');
      
      try {
        const transactionInfo = JSON.parse(decodeURIComponent(data));
        console.log('Transaction info:', transactionInfo);
        
        if (transactionInfo.transaction_id && !transactionInfo.error_code) {
          paymentSucceeded = true;
          transactionId = transactionInfo.transaction_id;
          amountCents = transactionInfo.amount_money?.amount ?? null;
          console.log('✅ Payment successful:', transactionId);
        } else if (transactionInfo.error_code) {
          console.log('❌ Payment failed or canceled:', transactionInfo.error_code);
        }
      } catch (error) {
        console.error('Error parsing transaction data:', error);
      }
    }
    
    let bookingIdToUpdate: string | null = null;
    
    if (paymentSucceeded && transactionId && amountCents != null) {
      const supabase = createAdminSupabaseClient();
      
      // Square doesn't allow query params on callback URL, so we match by "last POS initiated" (stored when Pay Now was clicked)
      const { data: pendingRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'pos_pending_booking')
        .single();

      if (pendingRow?.value) {
        try {
          const pending = JSON.parse(String(pendingRow.value)) as { bookingId: string; amountCents: number; at: string };
          const pendingAt = new Date(pending.at).getTime();
          const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
          if (pending.amountCents === amountCents && pendingAt > fifteenMinutesAgo) {
            bookingIdToUpdate = pending.bookingId;
            console.log('✅ POS callback: Matched pending booking', pending.bookingId);
          }
          // Clear so we don't reuse
          await supabase.from('settings').update({ value: '', updated_at: new Date().toISOString() }).eq('key', 'pos_pending_booking');
        } catch (e) {
          console.error('Error reading pos_pending_booking:', e);
        }
      }

      if (bookingIdToUpdate) {
        const { data: booking, error: fetchError } = await supabase
          .from('bookings')
          .select('id, customer_id')
          .eq('id', bookingIdToUpdate)
          .single();

        if (!fetchError && booking) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({
              payment_status: 'paid',
              square_transaction_id: transactionId,
              paid_at: new Date().toISOString(),
              status: 'confirmed',
            })
            .eq('id', bookingIdToUpdate);

          if (!updateError) {
            console.log(`✅ POS callback: Updated booking ${bookingIdToUpdate} to paid`);
            if (booking.customer_id) {
              try {
                await supabase.rpc('increment_customer_spent', {
                  customer_id: booking.customer_id,
                  amount: amountCents,
                });
              } catch (e) {
                console.error('Error updating customer spent:', e);
              }
            }
          } else {
            console.error('❌ Error updating booking:', updateError);
          }
        } else {
          console.log('⚠️ POS callback: No booking found for id', bookingIdToUpdate);
        }
      } else {
        console.log('⚠️ POS callback: No matching pending POS booking (amount or time window)');
      }
    }
    
    // Show success or canceled page
    const html = paymentSucceeded
      ? `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Complete - DUST Hair Studio</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; width: 100%; }
            .icon { font-size: 48px; margin-bottom: 16px; color: #22c55e; }
            h1 { margin: 0 0 16px 0; font-size: 24px; color: #1f2937; }
            p { margin: 0 0 24px 0; color: #6b7280; }
            .button { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500; }
            .button:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✓</div>
            <h1>Payment Complete</h1>
            <p>The booking has been marked as paid. You can return to the admin panel.</p>
            <a href="/admin/bookings" class="button">Return to Admin Panel</a>
          </div>
        </body>
      </html>
    `
      : `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Status - DUST Hair Studio</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; width: 100%; }
            .icon { font-size: 48px; margin-bottom: 16px; color: #f59e0b; }
            h1 { margin: 0 0 16px 0; font-size: 24px; color: #1f2937; }
            p { margin: 0 0 24px 0; color: #6b7280; }
            .button { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500; }
            .button:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⚠</div>
            <h1>Payment Canceled</h1>
            <p>You can try again by clicking "Pay Now (POS)" in the admin panel.</p>
            <a href="/admin/bookings" class="button">Return to Admin Panel</a>
          </div>
        </body>
      </html>
    `;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    });
  } catch (error) {
    console.error('Callback processing error:', error);
    return NextResponse.json({ error: 'Callback processing failed' }, { status: 500 });
  }
}

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
      console.log(`🔄 Processing payment ${payment.id} with status: ${payment.status}`);
      console.log(`💰 Payment details:`, {
        id: payment.id,
        status: payment.status,
        order_id: payment.order_id,
        payment_link_id: payment.payment_link_id,
        amount: payment.amount_money?.amount,
        currency: payment.amount_money?.currency,
        metadata: payment.metadata
      });
      
      if (payment && payment.status === 'COMPLETED') {
        // Find booking by order ID or payment link ID
        const supabase = createAdminSupabaseClient();
        
        // Try to find booking by square_order_id first (for POS payments)
        let { data: booking, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('square_order_id', payment.order_id)
          .single();

        if (!error && booking) {
          console.log(`✅ Found booking ${booking.id} by Square order ID ${payment.order_id} (POS payment)`);
        } else {
          console.log(`⚠️ No booking found by order ID ${payment.order_id}, trying payment link ID...`);
        }

        // If not found by order ID, try to find by payment link ID (for email payments)
        if (error && payment.payment_link_id) {
          const { data: bookingByLink, error: linkError } = await supabase
            .from('bookings')
            .select('*')
            .eq('square_payment_link_id', payment.payment_link_id)
            .single();
          
          if (!linkError && bookingByLink) {
            booking = bookingByLink;
            error = null;
            console.log(`✅ Found booking ${booking.id} by payment link ID ${payment.payment_link_id} (email payment)`);
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
            console.log(`✅ Found booking ${booking.id} by metadata booking ID ${payment.metadata.bookingId}`);
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
          console.log(`❌ No booking found for payment ${payment.id}`);
          console.log(`🔍 Search criteria used:`, {
            order_id: payment.order_id,
            payment_link_id: payment.payment_link_id,
            metadata_booking_id: payment.metadata?.bookingId
          });
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
