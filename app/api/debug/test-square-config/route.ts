import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();
    
    // Get Square settings from database
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['square_enabled', 'square_access_token', 'square_environment', 'square_location_id', 'square_application_id']);
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch settings', details: error }, { status: 500 });
    }
    
    // Convert to object
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);
    
    // Check configuration
    const diagnostics = {
      square_enabled: settingsMap.square_enabled,
      square_environment: settingsMap.square_environment,
      has_access_token: !!settingsMap.square_access_token,
      access_token_prefix: settingsMap.square_access_token ? String(settingsMap.square_access_token).substring(0, 6) + '...' : 'NOT SET',
      access_token_length: settingsMap.square_access_token ? String(settingsMap.square_access_token).length : 0,
      has_location_id: !!settingsMap.square_location_id,
      location_id_prefix: settingsMap.square_location_id ? String(settingsMap.square_location_id).substring(0, 8) + '...' : 'NOT SET',
      has_application_id: !!settingsMap.square_application_id,
      application_id_prefix: settingsMap.square_application_id ? String(settingsMap.square_application_id).substring(0, 8) + '...' : 'NOT SET',
      next_public_app_url: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET (will use http://localhost:3000)',
      redirect_url_example: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/confirmation?id=EXAMPLE_ID`,
      issues: [] as string[]
    };
    
    // Check for issues
    if (!settingsMap.square_enabled) {
      diagnostics.issues.push('❌ Square is disabled in settings');
    }
    
    if (!settingsMap.square_access_token) {
      diagnostics.issues.push('❌ Square Access Token is not set');
    } else {
      const token = String(settingsMap.square_access_token).trim();
      if (token.startsWith('EAA') && settingsMap.square_environment === 'sandbox') {
        diagnostics.issues.push('⚠️  Production token detected but environment is set to sandbox');
      } else if (!token.startsWith('EAA') && settingsMap.square_environment === 'production') {
        diagnostics.issues.push('⚠️  Sandbox token detected but environment is set to production');
      }
    }
    
    if (!settingsMap.square_location_id) {
      diagnostics.issues.push('❌ Square Location ID is not set');
    }
    
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      diagnostics.issues.push('⚠️  NEXT_PUBLIC_APP_URL environment variable is not set');
    }
    
    if (diagnostics.issues.length === 0) {
      diagnostics.issues.push('✅ All basic configuration checks passed');
    }
    
    // Try to create Square client and test connection
    try {
      const square = await import('square');
      const { SquareClient, SquareEnvironment } = square;
      
      const squareEnvironment = settingsMap.square_environment === 'production' 
        ? SquareEnvironment.Production 
        : SquareEnvironment.Sandbox;
      
      const client = new SquareClient({
        token: String(settingsMap.square_access_token).trim(),
        environment: squareEnvironment,
      });
      
      // Test the connection by getting locations
      const locationsResponse = await client.locationsApi.listLocations();
      
      if (locationsResponse.result.locations) {
        diagnostics.issues.push(`✅ Successfully connected to Square API (${settingsMap.square_environment})`);
        diagnostics.issues.push(`ℹ️  Found ${locationsResponse.result.locations.length} location(s)`);
        
        // Check if the configured location ID exists
        const locationExists = locationsResponse.result.locations.some(
          loc => loc.id === settingsMap.square_location_id
        );
        
        if (!locationExists && settingsMap.square_location_id) {
          diagnostics.issues.push('❌ Configured Location ID does not exist in your Square account');
          diagnostics.issues.push('Available locations:');
          locationsResponse.result.locations.forEach(loc => {
            diagnostics.issues.push(`   - ${loc.name} (${loc.id})`);
          });
        } else if (locationExists) {
          diagnostics.issues.push('✅ Location ID is valid');
        }
      }
    } catch (squareError: any) {
      diagnostics.issues.push('❌ Failed to connect to Square API');
      if (squareError.errors) {
        squareError.errors.forEach((err: any) => {
          diagnostics.issues.push(`   - ${err.category}: ${err.detail || err.code}`);
        });
      } else if (squareError.message) {
        diagnostics.issues.push(`   - ${squareError.message}`);
      }
    }
    
    return NextResponse.json(diagnostics, { status: 200 });
    
  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({ 
      error: 'Diagnostic failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

