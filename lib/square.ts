// Square client configuration - reads from database settings

import { createAdminSupabaseClient } from '@/lib/supabase-server'

// Create a function that returns the Square client from database settings
export async function getSquareClient() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get Square settings from database
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['square_enabled', 'square_access_token', 'square_environment', 'square_application_id', 'square_location_id'])
    
    if (error) {
      console.error('Error fetching Square settings:', error)
      throw new Error('Failed to fetch Square settings')
    }
    
    // Convert to object
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)
    
    console.log('🔍 Square settings from database:', {
      square_enabled: settingsMap.square_enabled,
      has_access_token: !!settingsMap.square_access_token,
      access_token_length: settingsMap.square_access_token ? String(settingsMap.square_access_token).length : 0,
      environment: settingsMap.square_environment
    })
    
    // Check if Square is enabled
    if (!settingsMap.square_enabled) {
      throw new Error('Square payment processing is disabled in settings')
    }
    
    // Get access token and environment
    let accessToken = settingsMap.square_access_token as string
    let environment = (settingsMap.square_environment as string) || 'production'
    
    // For local development, prefer environment variables
    if (process.env.NODE_ENV === 'development' && process.env.SQUARE_ACCESS_TOKEN) {
      console.log('🔧 Using environment variables for local development')
      accessToken = process.env.SQUARE_ACCESS_TOKEN
      environment = process.env.SQUARE_ENVIRONMENT || 'sandbox'
    } else if (!accessToken && process.env.SQUARE_ACCESS_TOKEN) {
      // Fallback to environment variables if database settings are incomplete
      console.log('⚠️ Using environment variable fallback for Square access token')
      accessToken = process.env.SQUARE_ACCESS_TOKEN
      environment = process.env.SQUARE_ENVIRONMENT || 'production'
    }
    
    if (!accessToken) {
      throw new Error('Square access token is not configured in settings or environment variables')
    }
    
    // Use dynamic import for better compatibility with Next.js
    let square;
    try {
      square = await import('square');
    } catch (importError) {
      console.error('❌ Failed to import Square SDK:', importError);
      throw new Error(`Square SDK import failed: ${importError instanceof Error ? importError.message : 'Unknown error'}. Make sure you're using Node.js runtime.`);
    }
    
    // Square SDK v43+ uses SquareClient instead of Client
    const { SquareClient, SquareEnvironment } = square;
    
    if (!SquareClient) {
      console.error('❌ SquareClient not found in imported module:', Object.keys(square));
      throw new Error('SquareClient not found in square module');
    }
    
    const squareEnvironment = environment === 'production' 
      ? SquareEnvironment.Production 
      : SquareEnvironment.Sandbox;
    
    console.log('🔍 Creating Square client with:', {
      environment: squareEnvironment === square.SquareEnvironment.Production ? 'production' : 'sandbox',
      token_length: accessToken.trim().length,
      token_prefix: accessToken.trim().substring(0, 6) + '...'
    })
    
    const client = new SquareClient({
      token: accessToken.trim(), // Trim any whitespace
      environment: squareEnvironment,
    });
    
    return client;
  } catch (error) {
    console.error('Failed to create Square client:', error);
    throw error;
  }
}

// Legacy function for environment variable-based configuration
// This can be removed once all environment variable usage is migrated
export async function getSquareClientFromEnv() {
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set in environment variables');
  }

  if (!process.env.SQUARE_ENVIRONMENT) {
    throw new Error('SQUARE_ENVIRONMENT is not set in environment variables');
  }

  try {
    // Use dynamic import for better compatibility with Next.js
    let square;
    try {
      square = await import('square');
    } catch (importError) {
      console.error('❌ Failed to import Square SDK:', importError);
      throw new Error(`Square SDK import failed: ${importError instanceof Error ? importError.message : 'Unknown error'}. Make sure you're using Node.js runtime.`);
    }
    
    // Square SDK v43+ uses SquareClient instead of Client
    const { SquareClient, SquareEnvironment } = square;
    
    if (!SquareClient) {
      console.error('❌ SquareClient not found in imported module:', Object.keys(square));
      throw new Error('SquareClient not found in square module');
    }
    
    const environment = process.env.SQUARE_ENVIRONMENT === 'production' 
      ? SquareEnvironment.Production 
      : SquareEnvironment.Sandbox;
    
    const accessToken = process.env.SQUARE_ACCESS_TOKEN!.trim(); // Trim any whitespace
    
    const client = new SquareClient({
      token: accessToken, // Note: it's 'token' not 'accessToken' in SDK v43+
      environment: environment,
    });
    
    return client;
  } catch (error) {
    console.error('Failed to create Square client from environment:', error);
    throw error;
  }
}

// For backwards compatibility, create a default export that throws if used synchronously
const squareClient = {
  get locationsApi() {
    throw new Error('Square client must be accessed asynchronously. Use getSquareClient() instead.');
  },
  get paymentsApi() {
    throw new Error('Square client must be accessed asynchronously. Use getSquareClient() instead.');
  },
  get checkoutApi() {
    throw new Error('Square client must be accessed asynchronously. Use getSquareClient() instead.');
  },
  get ordersApi() {
    throw new Error('Square client must be accessed asynchronously. Use getSquareClient() instead.');
  }
};

export default squareClient;

