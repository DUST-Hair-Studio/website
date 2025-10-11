// Square client configuration - using require to avoid Next.js ESM issues

if (!process.env.SQUARE_ACCESS_TOKEN) {
  throw new Error('SQUARE_ACCESS_TOKEN is not set in environment variables');
}

if (!process.env.SQUARE_ENVIRONMENT) {
  throw new Error('SQUARE_ENVIRONMENT is not set in environment variables');
}

// Create a function that returns the Square client
export async function getSquareClient() {
  try {
    // Use dynamic import for better compatibility with Next.js
    const square = await import('square');
    
    // Square SDK v43+ uses SquareClient instead of Client
    const { SquareClient, SquareEnvironment } = square;
    
    if (!SquareClient) {
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
    console.error('Failed to create Square client:', error);
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

