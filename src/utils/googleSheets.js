/**
 * Utility functions for saving auction data to Google Sheets
 * 
 * To use this, you need to set up a Google Apps Script web app:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1q4HMARSKAFtfNA2AOX8011UE1hfxqty-OmLIR88n_jQ/edit
 * 2. Go to Extensions → Apps Script
 * 3. Paste the provided script code from GOOGLE_APPS_SCRIPT.md
 * 4. Deploy as a web app (Execute as: Me, Who has access: Anyone)
 * 5. Copy the web app URL and set it as GOOGLE_SCRIPT_URL below
 */

// TODO: Replace this with your Google Apps Script web app URL after deployment
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSrBzwHOIVhvD1TrZpen2vCmjXocSLZp9mrGTvpcCrA1PwZ9deofebtSmOBVQCDaeH6w/exec';

/**
 * Saves a player assignment to Google Sheets
 * @param {Object} data - Assignment data
 * @param {string} data.playerName - Player's name
 * @param {string} data.teamName - Team's name
 * @param {number} data.basePrice - Base price of the player
 * @param {number} data.soldPrice - Sold/bid price
 * @param {string} data.category - Player category
 * @param {string} data.role - Player role
 * @returns {Promise} - Promise that resolves when data is saved
 */
export const savePlayerToSheet = async ({ playerName, teamName, basePrice, soldPrice, category, role }) => {
  if (!GOOGLE_SCRIPT_URL) {
    console.warn('Google Sheets URL not configured. Data not saved.');
    return;
  }

  const payload = {
    playerName,
    teamName,
    basePrice: basePrice || 0,
    soldPrice: soldPrice || 0,
    category: category || '',
    role: role || '',
    timestamp: new Date().toISOString()
  };

  try {
    // Note: With no-cors mode, we can't read the response, but the request is sent
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Google Apps Script doesn't support CORS, so we use no-cors
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('Player data saved to Google Sheets:', payload);
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    // Don't throw - we don't want to break the auction flow if saving fails
  }
};

/**
 * Updates the Google Script URL (can be called from DataSetup if needed)
 */
export const setGoogleScriptUrl = (url) => {
  // In a real implementation, you might want to store this in state or localStorage
  // For now, we'll use an environment variable or the constant above
  console.log('Google Script URL would be set to:', url);
};

/**
 * Test function to verify Google Sheets integration
 * Call this from browser console: window.testGoogleSheets()
 */
export const testGoogleSheets = async () => {
  const testData = {
    playerName: 'Test Player',
    teamName: 'ThunderBolts',
    basePrice: 10000,
    soldPrice: 15000,
    category: 'allrounders',
    role: 'All-rounder'
  };
  
  console.log('Testing Google Sheets integration with data:', testData);
  await savePlayerToSheet(testData);
  console.log('Test data sent. Check your Google Sheet to verify it was saved.');
  console.log('Also check Apps Script execution logs: View → Executions in Apps Script editor');
};

