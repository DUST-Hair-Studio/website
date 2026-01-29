import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// Force Node.js runtime for crypto support
export const runtime = 'nodejs';

// Generate Square POS URL for automatic app opening
function generateSquarePOSUrl(params: {
  amount: number;
  customerName: string;
  serviceName: string;
  applicationId: string;
  bookingId: string;
}): { posUrl: string; callbackUrl: string } {
  // Square POS API URL format from documentation
  // square-commerce-v1://payment/create?data={JSON_encoded_data}
  
  // Must match Square Dashboard exactly - no query params or Square rejects with "callback URL does not match"
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://dusthair.vercel.app').replace(/\/+$/, '');
  const callbackUrl = `${baseUrl}/api/webhooks/square`;
  
  console.log('🔗 POS Callback URL being used:', callbackUrl);
  
  const posData = {
    amount_money: {
      amount: params.amount,
      currency_code: 'USD'
    },
    callback_url: callbackUrl,
    client_id: params.applicationId,
    version: '1.3',
    notes: `Booking: ${params.serviceName} - ${params.customerName}`,
    options: {
      supported_tender_types: ['CREDIT_CARD', 'CASH', 'OTHER', 'SQUARE_GIFT_CARD', 'CARD_ON_FILE']
    }
  };

  // Return the Square POS URL with properly encoded data, plus callbackUrl for debugging
  const posUrl = `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(posData))}`;
  return { posUrl, callbackUrl };
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();
    
    console.log('🔍 Creating Square POS URL for booking:', bookingId);

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking:', {
        bookingId,
        error: bookingError,
        booking
      });
      return NextResponse.json(
        { error: `Booking not found: ${bookingError?.message || 'Unknown error'}` },
        { status: 404 }
      );
    }

    // Fetch customer and service details
    const { data: customer } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', booking.customer_id)
      .single();

    const { data: service } = await supabase
      .from('services')
      .select('name, duration_minutes, price')
      .eq('id', booking.service_id)
      .single();

    // Get Square application ID from settings
    const { data: appIdSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'square_application_id')
      .single();

    if (!appIdSetting?.value) {
      return NextResponse.json(
        { error: 'Square application ID not configured' },
        { status: 500 }
      );
    }

    const amountCents = booking.price_charged || service?.price || 0;

    // Generate Square POS URL for automatic app opening
    const { posUrl, callbackUrl } = generateSquarePOSUrl({
      amount: amountCents,
      customerName: customer?.name || '',
      serviceName: service?.name || '',
      applicationId: appIdSetting.value,
      bookingId: booking.id
    });

    // Store "last POS initiated" so callback (which has no booking_id) can find this booking
    await supabase.from('settings').upsert(
      { key: 'pos_pending_booking', value: JSON.stringify({ bookingId: booking.id, amountCents, at: new Date().toISOString() }), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

    console.log(`✅ Generated Square POS URL for booking ${bookingId}`);

    return NextResponse.json({
      success: true,
      posUrl,
      callbackUrl, // So you can verify it matches Square Dashboard → POS API → Web Callback URL
      message: 'Square POS URL generated successfully'
    });

  } catch (error) {
    console.error('Error generating Square POS URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
