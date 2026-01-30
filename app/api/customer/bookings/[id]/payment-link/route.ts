import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createPaymentLink } from '@/lib/square-payment';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id: bookingId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let customer: { id: string } | null = null;

    const { data: customerByAuthId, error: errorByAuthId } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (customerByAuthId && !errorByAuthId) {
      customer = customerByAuthId;
    } else {
      const { data: customerByEmail, error: errorByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (customerByEmail && !errorByEmail) {
        customer = customerByEmail;
      } else {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        price_charged,
        payment_status,
        services ( name ),
        customers ( name, email, phone )
      `)
      .eq('id', bookingId)
      .eq('customer_id', customer.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'This appointment is already paid' }, { status: 400 });
    }

    if (!booking.price_charged || booking.price_charged <= 0) {
      return NextResponse.json({ error: 'No payment required for this appointment' }, { status: 400 });
    }

    const serviceName = (booking.services as { name: string } | null)?.name ?? 'Appointment';
    const customers = booking.customers as { name: string; email: string; phone?: string } | null;
    const customerName = customers?.name ?? '';
    const customerEmail = customers?.email ?? user.email ?? '';
    const customerPhone = customers?.phone ?? '';

    if (!customerEmail || !customerName) {
      return NextResponse.json({ error: 'Missing customer details for payment' }, { status: 400 });
    }

    const paymentResult = await createPaymentLink({
      id: booking.id,
      serviceName,
      price: booking.price_charged,
      customerEmail,
      customerPhone,
      customerName,
    });

    const adminSupabase = createAdminSupabaseClient();
    await adminSupabase
      .from('bookings')
      .update({
        square_payment_url: paymentResult.paymentUrl,
        square_order_id: paymentResult.orderId,
        square_payment_link_id: paymentResult.paymentLinkId,
      })
      .eq('id', bookingId);

    return NextResponse.json({
      success: true,
      paymentUrl: paymentResult.paymentUrl,
    });
  } catch (error) {
    console.error('Customer payment link API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
