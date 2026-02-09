import { NextRequest, NextResponse } from 'next/server';
import { createPaymentLink } from '@/lib/square-payment';
import { EmailService, PaymentLinkData } from '@/lib/email-service';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// Force Node.js runtime for Square SDK + email sending compatibility
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('📧 [SEND PAYMENT LINK EMAIL] Starting payment link email generation...');
    
    const body = await request.json();
    console.log('📧 [SEND PAYMENT LINK EMAIL] Request body:', { 
      bookingId: body.bookingId,
      serviceName: body.serviceName,
      price: body.price,
      hasEmail: !!body.customerEmail,
      hasPhone: !!body.customerPhone,
      hasName: !!body.customerName
    });
    
    const { bookingId, serviceName, price, customerEmail, customerPhone, customerName } = body;

    if (!bookingId || !serviceName || !price || !customerEmail || !customerName) {
      console.log('❌ [SEND PAYMENT LINK EMAIL] Missing required fields:', {
        bookingId: !!bookingId,
        serviceName: !!serviceName,
        price: !!price,
        customerEmail: !!customerEmail,
        customerName: !!customerName
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('📧 [SEND PAYMENT LINK EMAIL] All fields present, generating payment link...');
    
    // Generate payment link using Square
    const paymentResult = await createPaymentLink({
      id: bookingId,
      serviceName,
      price,
      customerEmail,
      customerPhone,
      customerName
    });
    
    console.log('✅ [SEND PAYMENT LINK EMAIL] Payment link created successfully:', {
      hasUrl: !!paymentResult.paymentUrl,
      hasOrderId: !!paymentResult.orderId,
      hasPaymentLinkId: !!paymentResult.paymentLinkId
    });

    // Get full booking data for email
    const supabase = createAdminSupabaseClient();
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          duration_minutes
        ),
        customers (
          name,
          email,
          phone
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ [SEND PAYMENT LINK EMAIL] Error fetching booking data:', bookingError);
      return NextResponse.json(
        { error: 'Failed to fetch booking data' },
        { status: 500 }
      );
    }

    // Update booking with payment link information
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        square_payment_url: paymentResult.paymentUrl,
        square_order_id: paymentResult.orderId,
        square_payment_link_id: paymentResult.paymentLinkId,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('❌ [SEND PAYMENT LINK EMAIL] Error updating booking with payment link:', updateError);
      // Don't fail the request, just log the error
    }

    // Prepare payment data for email
    const paymentData: PaymentLinkData = {
      id: booking.id,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      duration_minutes: booking.duration_minutes,
      price_charged: booking.price_charged,
      services: {
        name: booking.services?.name || serviceName,
        duration_minutes: booking.services?.duration_minutes || booking.duration_minutes
      },
      customers: {
        name: booking.customers?.name || customerName,
        email: booking.customers?.email || customerEmail,
        phone: booking.customers?.phone || customerPhone || ''
      },
      paymentUrl: paymentResult.paymentUrl || '',
      orderId: paymentResult.orderId || '',
      paymentLinkId: paymentResult.paymentLinkId || ''
    };

    console.log('📧 [SEND PAYMENT LINK EMAIL] Sending payment link email...');
    
    // Send payment link email
    const emailService = new EmailService();
    const emailSent = await emailService.sendPaymentLinkEmail(paymentData);

    if (emailSent) {
      console.log('✅ [SEND PAYMENT LINK EMAIL] Payment link email sent successfully!');
      return NextResponse.json({
        success: true,
        message: 'Payment link sent via email',
        paymentUrl: paymentResult.paymentUrl,
        orderId: paymentResult.orderId,
        paymentLinkId: paymentResult.paymentLinkId,
        emailSent: true
      });
    } else {
      console.log('⚠️ [SEND PAYMENT LINK EMAIL] Email failed, but payment link was generated');
      return NextResponse.json({
        success: true,
        message: 'Payment link generated but email failed to send',
        paymentUrl: paymentResult.paymentUrl,
        orderId: paymentResult.orderId,
        paymentLinkId: paymentResult.paymentLinkId,
        emailSent: false
      });
    }

  } catch (error) {
    console.error('❌ [SEND PAYMENT LINK EMAIL] Error generating and sending payment link:', error);
    
    // Extract more detailed error information
    let errorMessage = 'Failed to generate and send payment link';
    if (error && typeof error === 'object') {
      const err = error as { message?: string; errors?: Array<{ detail?: string; code?: string }> };
      if (err.message) {
        errorMessage = err.message;
      }
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        errorMessage = err.errors.map((e) => e.detail || e.code).join(', ');
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
