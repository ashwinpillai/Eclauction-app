# Google Apps Script Setup Instructions

To enable saving auction data to your Google Sheet, follow these steps:

## Step 1: Open Google Apps Script

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1q4HMARSKAFtfNA2AOX8011UE1hfxqty-OmLIR88n_jQ/edit
2. Go to **Extensions → Apps Script**

## Step 2: Paste the Script Code

Delete any existing code and paste the following:

```javascript
// Google Apps Script to receive auction data and save to appropriate team tabs
// Sheet structure: Column A = Player Name, Column B = Auction Base Price, Column C = Auction Sold Price, Column D = Team

const SPREADSHEET_ID = '1q4HMARSKAFtfNA2AOX8011UE1hfxqty-OmLIR88n_jQ';

// Map category names from app format to sheet format
const categoryMapping = {
  'allrounders': 'All rounders',
  'allrounders-1': 'All rounders 1',
  'best-batters-bowlers': 'Best Batters/Bowlers',
  'wk-bat-bowl': 'WK (Bat/Bowl)',
  'new-to-game': 'New to the game',
  // Handle case variations
  'all rounders': 'All rounders',
  'all rounders 1': 'All rounders 1',
  'best batters/bowlers': 'Best Batters/Bowlers',
  'wk (bat/bowl)': 'WK (Bat/Bowl)',
  'new to the game': 'New to the game'
};

function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);
    
    // Get the spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Get the team sheet (handle variations in team name)
    // Try exact match first, then try with spaces
    let sheet = ss.getSheetByName(data.teamName);
    if (!sheet) {
      // Try variations: "KingsMen" -> "Kings Men", "Enigma Titans" should already match
      const teamNameVariations = [
        data.teamName,
        data.teamName.replace(/([a-z])([A-Z])/g, '$1 $2'), // Add space before capital letters
        data.teamName.replace(/\s+/g, ''), // Remove spaces
      ];
      
      for (const name of teamNameVariations) {
        sheet = ss.getSheetByName(name);
        if (sheet) break;
      }
    }
    
    if (!sheet) {
      // List all available sheets for debugging
      const allSheets = ss.getSheets().map(s => s.getName());
      Logger.log('Team sheet not found: ' + data.teamName);
      Logger.log('Available sheets: ' + allSheets.join(', '));
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Team sheet not found: ' + data.teamName + '. Available: ' + allSheets.join(', ')
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Map the category to match sheet format (case-insensitive lookup)
    const categoryKey = (data.category || '').toLowerCase().trim();
    const sheetCategory = categoryMapping[categoryKey] || data.category || '';
    
    // Check if player already exists (by name) to avoid duplicates
    const existingRow = findPlayerRow(sheet, data.playerName);
    if (existingRow > 0) {
      // Update existing player
      sheet.getRange(existingRow, 1, 1, 4).setValues([[
        data.playerName,
        data.basePrice || '',
        data.soldPrice || '',
        data.teamName
      ]]);
      
      // Format the price columns
      sheet.getRange(existingRow, 2).setNumberFormat('#,##0');
      sheet.getRange(existingRow, 3).setNumberFormat('#,##0');
    } else {
      // Find the correct row to insert the player within the category section
      const insertRow = findInsertRowForCategory(sheet, sheetCategory);
      
      // Insert the player data
      sheet.getRange(insertRow, 1, 1, 4).setValues([[
        data.playerName,
        data.basePrice || '',
        data.soldPrice || '',
        data.teamName
      ]]);
      
      // Format the price columns
      sheet.getRange(insertRow, 2).setNumberFormat('#,##0');
      sheet.getRange(insertRow, 3).setNumberFormat('#,##0');
    }
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error response
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to find the row number of a category header (case-insensitive)
function findCategoryRow(sheet, category) {
  if (!category) return 0;
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const searchCategory = category.toLowerCase().trim();
  
  // Search for the category in column A (index 0)
  for (let i = 0; i < values.length; i++) {
    const cellValue = String(values[i][0] || '').trim().toLowerCase();
    if (cellValue === searchCategory) {
      return i + 1; // Return 1-based row number
    }
  }
  return 0; // Category not found
}

// Helper function to find the correct row to insert a player within a category section
function findInsertRowForCategory(sheet, category) {
  if (!category) {
    // If no category, append to the end
    return sheet.getLastRow() + 1;
  }
  
  const categoryRow = findCategoryRow(sheet, category);
  if (categoryRow === 0) {
    // Category not found, append to end
    Logger.log('Category not found: ' + category);
    return sheet.getLastRow() + 1;
  }
  
  // Find the next available row within this category section
  // The category section ends when we hit another category or an empty row
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const allCategories = ['all rounders', 'all rounders 1', 'best batters/bowlers', 'wk (bat/bowl)', 'new to the game'];
  
  // Start searching from the row immediately after the category header
  // categoryRow is 1-based, so values[categoryRow] is the row after the category (0-based index)
  for (let i = categoryRow; i < values.length; i++) {
    const cellValue = String(values[i][0] || '').trim();
    
    // If we find an empty row, this is where we should insert
    if (cellValue === '') {
      return i + 1; // Return 1-based row number
    }
    
    // If we find another category header, insert before it
    const cellValueLower = cellValue.toLowerCase();
    for (const cat of allCategories) {
      if (cellValueLower === cat && i !== categoryRow - 1) { // Make sure it's not the same category
        // Found next category, insert before it (this row)
        return i + 1; // Return 1-based row number
      }
    }
  }
  
  // If we reach here, append to the end (after the last row with data)
  return sheet.getLastRow() + 1;
}

// Helper function to find if a player already exists
function findPlayerRow(sheet, playerName) {
  if (!playerName) return 0;
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Search for the player name in column A (index 0)
  for (let i = 0; i < values.length; i++) {
    const cellValue = String(values[i][0] || '').trim();
    // Remove any suffix like (C) for captain
    const cleanCellValue = cellValue.replace(/\s*\(.*?\)\s*$/, '').trim();
    const cleanPlayerName = playerName.replace(/\s*\(.*?\)\s*$/, '').trim();
    
    if (cleanCellValue.toLowerCase() === cleanPlayerName.toLowerCase()) {
      return i + 1; // Return 1-based row number
    }
  }
  return 0; // Player not found
}

// Optional: Test function to verify the script works
function testDoPost() {
  const testData = {
    playerName: 'Test Player',
    teamName: 'ThunderBolts',
    basePrice: 10000,
    soldPrice: 15000,
    category: 'allrounders',
    role: 'All-rounder',
    timestamp: new Date().toISOString()
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
```

## Step 3: Save and Deploy

1. Click the **Save** button (💾) or press `Ctrl+S` (or `Cmd+S` on Mac)
2. Give your project a name (e.g., "Auction Data Logger")
3. Click **Deploy → New deployment**
4. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
5. Configure the deployment:
   - **Description**: "Auction data logger v1" (or any description)
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone** (this allows the web app to receive requests)
6. Click **Deploy**
7. Click **Authorize access** and grant the necessary permissions
8. Copy the **Web app URL** (it will look like: `https://script.google.com/macros/s/AKfyc.../exec`)

## Step 4: Update the App Configuration

1. Open `/src/utils/googleSheets.js` in your code editor
2. Replace the empty string in `GOOGLE_SCRIPT_URL` with your Web app URL:

```javascript
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```

3. Save the file and rebuild/restart your app

## How It Works

- When a player is assigned to a team during the auction, the app automatically sends the data to your Google Sheet
- The script finds the correct team tab (ThunderBolts, Enigma Titans, Rising Champions, Kings Men, Striking Stallions, Spartans)
- It finds the appropriate category section (All rounders, All rounders 1, Best Batters/Bowlers, WK (Bat/Bowl), New to the game)
- Adds the player data with: Player Name (Column A), Auction Base Price (Column B), Auction Sold Price (Column C), Team (Column D)
- If the player already exists, it updates their sold price instead of creating a duplicate
- Data is saved in real-time as players are assigned

## Sheet Structure

The script expects the following structure in each team tab:
- Column A: Player Name (with category headers like "All rounders" as row labels)
- Column B: Auction Base Price
- Column C: Auction Sold Price
- Column D: Team name

## Troubleshooting

- If data isn't saving, check the browser console for any error messages
- Verify the Web app URL is correct in `googleSheets.js`
- Make sure the deployment has "Who has access" set to "Anyone"
- Check that your Google Sheet ID matches: `1q4HMARSKAFtfNA2AOX8011UE1hfxqty-OmLIR88n_jQ`
- Make sure team tab names match exactly (case-sensitive): ThunderBolts, Enigma Titans, Rising Champions, Kings Men, Striking Stallions, Spartans
- Check the Apps Script execution log (View → Executions) for any errors
