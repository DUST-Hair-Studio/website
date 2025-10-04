// Quick script to update Google OAuth redirect URI
// Run this with: node update-redirect-uri.js

const { google } = require('googleapis');

async function updateRedirectUri() {
  try {
    // You'll need to authenticate with the project owner account
    const auth = new google.auth.GoogleAuth({
      keyFile: 'path-to-service-account.json', // Or use your user credentials
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    const service = google.oauth2('v2');
    
    // This is a simplified approach - you might need to use the Admin SDK
    console.log('This approach requires proper authentication setup');
    console.log('Better to use the Google Cloud Console with the owner account');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateRedirectUri();
