import { NextRequest, NextResponse } from 'next/server';
import { createPaymentLink } from '@/lib/square-payment';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, serviceName, price, customerEmail, customerPhone, customerName } = body;

    if (!bookingId || !serviceName || !price || !customerEmail || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate payment link using Square
    const paymentResult = await createPaymentLink({
      id: bookingId,
      serviceName,
      price,
      customerEmail,
      customerPhone,
      customerName
    });

    // Update booking with payment link information
    const supabase = createAdminSupabaseClient()
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        square_payment_url: paymentResult.paymentUrl,
        square_order_id: paymentResult.orderId,
        square_payment_link_id: paymentResult.paymentLinkId,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking with payment link:', updateError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      paymentUrl: paymentResult.paymentUrl,
      orderId: paymentResult.orderId,
      paymentLinkId: paymentResult.paymentLinkId,
    });

  } catch (error) {
    console.error('Error generating payment link:', error);
    
    // Extract more detailed error information
    let errorMessage = 'Failed to generate payment link';
    if (error && typeof error === 'object') {
      const err = error as any;
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        errorMessage = err.errors.map((e: any) => e.detail || e.code).join(', ');
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
