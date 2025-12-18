# Cricket Auction ECL

A modern, interactive Cricket Auction Management System built with React.

## Features

- **Data Setup**: Upload CSV files for players and Excel files for teams
- **Random Player Selection**: Beautiful animated popup display for selected players
- **Team Assignment**: Assign players to teams after bidding
- **Final Results**: View all teams with assigned players and download results

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## Usage

### 1. Data Setup

**Players CSV Format:**
Create a CSV file with the following columns:
- `name` - Player name
- `role` - Player role (e.g., Batsman, Bowler, All-Rounder, Wicket-Keeper)
- `basePrice` - Base price (numeric value)

Example CSV:
```csv
name,role,basePrice
Virat Kohli,Batsman,2000000
Jasprit Bumrah,Bowler,1500000
Hardik Pandya,All-Rounder,1800000
```

**Teams Excel Format:**
Create an Excel file with the following columns:
- `Team Name` or `TeamName` or `team_name` - Team name
- `Captain` or `captain` - Captain name

Example Excel:
| Team Name | Captain |
|-----------|---------|
| Mumbai Indians | Rohit Sharma |
| Chennai Super Kings | MS Dhoni |

### 2. Auction Process

1. Click "Select Random Player" to randomly select a player
2. The player will appear in an animated popup showing name, role, and base price
3. After bidding is complete, click "Complete Bidding"
4. Select a team to assign the player to
5. Repeat until all players are assigned or click "Finish Auction"

### 3. Final Results

- View all teams with their assigned players
- See team statistics (total players, total base price)
- Download the complete results as an Excel file

## Technologies Used

- React 18
- PapaParse (CSV parsing)
- SheetJS (Excel parsing)
- CSS3 Animations

## Project Structure

```
src/
├── components/
│   ├── DataSetup.js          # CSV/Excel upload component
│   ├── AuctionArea.js        # Main auction interface
│   ├── PlayerPopup.js         # Animated player popup
│   ├── TeamAssignment.js      # Team selection modal
│   └── FinalOutput.js         # Results display and download
├── App.js                     # Main app component
└── index.js                   # Entry point
```

## License

MIT

