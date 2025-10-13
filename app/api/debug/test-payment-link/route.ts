import { NextResponse } from 'next/server';
import { createPaymentLink } from '@/lib/square-payment';

// Force Node.js runtime for Square SDK compatibility
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('🧪 Testing payment link creation...');
    
    // Test with dummy data
    const testBooking = {
      id: 'test-booking-id',
      serviceName: 'Test Service',
      price: 5000, // $50.00
      customerEmail: 'test@example.com',
      customerPhone: '555-1234',
      customerName: 'Test Customer'
    };
    
    console.log('🧪 Creating test payment link with data:', testBooking);
    
    const result = await createPaymentLink(testBooking);
    
    console.log('✅ Test payment link created successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Payment link creation works!',
      result: {
        hasUrl: !!result.paymentUrl,
        hasOrderId: !!result.orderId,
        hasPaymentLinkId: !!result.paymentLinkId,
        paymentUrl: result.paymentUrl
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Detailed error logging
    if (error && typeof error === 'object') {
      const err = error as any;
      console.error('Error details:', {
        message: err.message,
        errors: err.errors,
        statusCode: err.statusCode,
        body: err.body,
        stack: err.stack
      });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error && typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error)
    }, { status: 500 });
  }
}

