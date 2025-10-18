import { NextRequest, NextResponse } from 'next/server';
import { getSquareClient } from '@/lib/square';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';

// Force Node.js runtime for crypto support
export const runtime = 'nodejs';

// Generate Square POS URL for automatic app opening
function generateSquarePOSUrl(params: {
  orderId: string;
  amount: number;
  customerName: string;
  serviceName: string;
  applicationId: string;
}): string {
  // Square POS API URL format
  // square-commerce-v1://payment/create?data={base64_encoded_json}
  
  const posData = {
    amount_money: {
      amount: params.amount,
      currency: 'USD'
    },
    note: `Booking: ${params.serviceName} - ${params.customerName}`,
    order_id: params.orderId,
    reference_id: params.orderId,
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://website-sigma-steel-43.vercel.app'}/api/webhooks/square`,
    client_id: params.applicationId,
    version: 'v2.0'
  };

  // Encode the data as base64
  const encodedData = Buffer.from(JSON.stringify(posData)).toString('base64');
  
  // Return the Square POS URL
  return `square-commerce-v1://payment/create?data=${encodedData}`;
}

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();
    
    console.log('🔍 Creating Square order for booking:', bookingId);

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // First, fetch the booking itself
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

    // Then fetch customer and service details separately
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

    // Combine the data
    const bookingWithDetails = {
      ...booking,
      customers: customer,
      services: service
    };

    // Check if booking already has a Square order
    if (bookingWithDetails.square_order_id) {
      return NextResponse.json(
        { 
          success: true,
          orderId: bookingWithDetails.square_order_id,
          message: 'Order already exists for this booking'
        },
        { status: 200 }
      );
    }

    // Get Square client
    const squareClient = await getSquareClient();

    // Get location ID from settings
    const { data: locationSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'square_location_id')
      .single();

    if (!locationSetting?.value) {
      return NextResponse.json(
        { error: 'Square location ID not configured' },
        { status: 500 }
      );
    }

    const locationId = locationSetting.value;

    // Create Square order
    const orderRequest = {
      idempotencyKey: randomUUID(),
      order: {
        locationId: locationId,
        lineItems: [
          {
            name: bookingWithDetails.services?.name || 'Hair Service',
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(bookingWithDetails.price_charged || bookingWithDetails.services?.price || 0),
              currency: 'USD'
            }
          }
        ],
        metadata: {
          bookingId: bookingWithDetails.id,
          customerEmail: bookingWithDetails.customers?.email || '',
          customerName: bookingWithDetails.customers?.name || '',
          serviceName: bookingWithDetails.services?.name || ''
        }
      }
    };

    console.log('Creating Square order for booking:', bookingId, 'with request:', orderRequest);

    const { result, ...httpResponse } = await (squareClient as any).ordersApi.createOrder(orderRequest);

    if (httpResponse.statusCode !== 200 || !result.order) {
      console.error('Square API error:', httpResponse);
      return NextResponse.json(
        { error: 'Failed to create Square order' },
        { status: 500 }
      );
    }

    const orderId = result.order.id;

    // Update booking with Square order ID
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        square_order_id: orderId
      })
      .eq('id', bookingWithDetails.id);

    if (updateError) {
      console.error('Error updating booking with order ID:', updateError);
      return NextResponse.json(
        { error: 'Failed to save order ID to booking' },
        { status: 500 }
      );
    }

    console.log(`✅ Created Square order ${orderId} for booking ${bookingId}`);

    // Get Square application ID from settings
    const { data: appIdSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'square_application_id')
      .single();

    // Generate Square POS URL for automatic app opening
    const posUrl = generateSquarePOSUrl({
      orderId: orderId,
      amount: bookingWithDetails.price_charged || bookingWithDetails.services?.price || 0,
      customerName: bookingWithDetails.customers?.name || '',
      serviceName: bookingWithDetails.services?.name || '',
      applicationId: appIdSetting?.value || process.env.SQUARE_APPLICATION_ID || ''
    });

    return NextResponse.json({
      success: true,
      orderId: orderId,
      posUrl: posUrl,
      message: 'Square order created successfully'
    });

  } catch (error) {
    console.error('Error creating Square order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
