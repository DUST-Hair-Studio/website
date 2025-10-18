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
}): string {
  // Square POS API URL format from documentation
  // square-commerce-v1://payment/create?data={JSON_encoded_data}
  
  const posData = {
    amount_money: {
      amount: params.amount,
      currency_code: 'USD'
    },
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://website-sigma-steel-43.vercel.app'}/admin/pos-callback`,
    client_id: params.applicationId,
    version: '1.3',
    notes: `Booking: ${params.serviceName} - ${params.customerName}`,
    options: {
      supported_tender_types: ['CREDIT_CARD', 'CASH', 'OTHER', 'SQUARE_GIFT_CARD', 'CARD_ON_FILE']
    }
  };

  // Return the Square POS URL with properly encoded data
  return `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(posData))}`;
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

    // Generate Square POS URL for automatic app opening
    const posUrl = generateSquarePOSUrl({
      amount: booking.price_charged || service?.price || 0,
      customerName: customer?.name || '',
      serviceName: service?.name || '',
      applicationId: appIdSetting.value,
      bookingId: booking.id
    });

    console.log(`✅ Generated Square POS URL for booking ${bookingId}`);

    return NextResponse.json({
      success: true,
      posUrl: posUrl,
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
