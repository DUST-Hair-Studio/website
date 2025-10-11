// Square payment link generation for admin use
import { getSquareClient } from './square';
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
    
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
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
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/booking/confirmation?id=${booking.id}`,
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
    
    const { result } = await squareClient.checkout.paymentLinks.get(paymentLinkId);
    
    return {
      status: result.paymentLink?.status,
      url: result.paymentLink?.url,
      orderId: result.paymentLink?.orderId,
    };
  } catch (error) {
    console.error('Failed to retrieve payment link status:', error);
    throw error;
  }
}
