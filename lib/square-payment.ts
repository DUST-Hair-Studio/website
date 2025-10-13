// Square payment link generation for admin use
import { getSquareClient } from './square';
import { createAdminSupabaseClient } from './supabase-server';
import { randomUUID } from 'crypto';

export async function createPaymentLink(booking: {
  id: string;
  serviceName: string;
  price: number; // in cents
  customerEmail: string;
  customerPhone?: string;
  customerName: string;
}) {
  try {
    const squareClient = await getSquareClient();
    
    // Get location ID - prefer environment variable for local development
    let locationId = process.env.SQUARE_LOCATION_ID;
    
    // For local development, use environment variable
    if (process.env.NODE_ENV === 'development' && locationId) {
      console.log('🔧 Using environment variable for location ID in local development');
    } else if (!locationId) {
      // Fallback to database settings
      const supabase = createAdminSupabaseClient();
      const { data: locationSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'square_location_id')
        .single();
      
      locationId = locationSetting?.value as string;
    }
    
    if (!locationId) {
      throw new Error('Square location ID is not configured');
    }
    
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: locationId,
        lineItems: [
          {
            name: booking.serviceName,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(booking.price),
              currency: 'USD',
            },
          },
        ],
        metadata: {
          bookingId: booking.id,
          customerEmail: booking.customerEmail,
          customerName: booking.customerName,
        },
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/confirmation?id=${booking.id}`,
        askForShippingAddress: false,
      },
    });

    // Payment link created successfully

    return {
      paymentUrl: response.paymentLink?.url,
      orderId: response.paymentLink?.orderId,
      paymentLinkId: response.paymentLink?.id,
    };
  } catch (error) {
    console.error('Square payment link creation failed:', error);
    throw error;
  }
}

export async function getPaymentLinkStatus(paymentLinkId: string) {
  try {
    const squareClient = await getSquareClient();
    
    const response = await squareClient.checkout.paymentLinks.get({ id: paymentLinkId });
    
    // Access properties with type assertion to handle Square SDK type differences
    const paymentLink = response.paymentLink as unknown as Record<string, unknown>;
    
    return {
      status: paymentLink?.status,
      url: paymentLink?.url,
      orderId: paymentLink?.orderId,
    };
  } catch (error) {
    console.error('Failed to retrieve payment link status:', error);
    throw error;
  }
}
