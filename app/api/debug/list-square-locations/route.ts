import { NextResponse } from 'next/server';
import { getSquareClient } from '@/lib/square';

// Force Node.js runtime for Square SDK compatibility
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('🔍 Listing Square locations...');
    
    const squareClient = await getSquareClient();
    
    const response = await squareClient.locations.list();
    
    const locations = response.locations || [];
    
    console.log('✅ Found locations:', locations.map(l => ({
      id: l.id,
      name: l.name,
      status: l.status
    })));
    
    return NextResponse.json({
      success: true,
      locations: locations.map(location => ({
        id: location.id,
        name: location.name,
        address: location.address ? {
          addressLine1: location.address.addressLine1,
          locality: location.address.locality,
          administrativeDistrictLevel1: location.address.administrativeDistrictLevel1,
          postalCode: location.address.postalCode
        } : null,
        status: location.status,
        businessName: location.businessName,
        phoneNumber: location.phoneNumber
      }))
    });
    
  } catch (error) {
    console.error('❌ Failed to list locations:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error && typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error)
    }, { status: 500 });
  }
}

