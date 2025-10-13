import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// Force Node.js runtime for Square SDK compatibility
export const runtime = 'nodejs';

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
    }, {} as Record<string, unknown>);
    
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
    
    // Basic configuration validation
    if (settingsMap.square_enabled && settingsMap.square_access_token && settingsMap.square_location_id) {
      diagnostics.issues.push('✅ All required Square settings are configured');
      
      // Check token format
      const token = String(settingsMap.square_access_token).trim();
      if (token.startsWith('EAAA')) {
        diagnostics.issues.push('✅ Access token format looks correct');
      } else {
        diagnostics.issues.push('⚠️  Access token format may be incorrect (should start with EAAA)');
      }
      
      // Check environment match
      if (settingsMap.square_environment === 'production' && token.startsWith('EAAA')) {
        diagnostics.issues.push('✅ Production environment with production token');
      } else if (settingsMap.square_environment === 'sandbox' && token.startsWith('EAAAl')) {
        diagnostics.issues.push('✅ Sandbox environment with sandbox token');
      } else {
        diagnostics.issues.push('⚠️  Environment and token type may not match');
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

