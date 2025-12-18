import React, { useEffect, useState } from 'react';
import './App.css';
import DataSetup from './components/DataSetup';
import AuctionArea from './components/AuctionArea';
import FinalOutput from './components/FinalOutput';
import { savePlayerToSheet, testGoogleSheets } from './utils/googleSheets';

// Expose test function to window for easy testing from browser console
if (typeof window !== 'undefined') {
  window.testGoogleSheets = testGoogleSheets;
}

function App() {
  const TEAM_BUDGET_LIMIT = 100000; // per-team purse

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [assignedPlayers, setAssignedPlayers] = useState({}); // {playerId: {teamId, price, effectiveSpend}}
  const [teamBudgets, setTeamBudgets] = useState({}); // {teamId: remaining}
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [auctionStarted, setAuctionStarted] = useState(false);
  const [auctionComplete, setAuctionComplete] = useState(false);
  const [lastAssigned, setLastAssigned] = useState(null); // {playerId, teamId, price}

  // Block page refresh and browser back/forward navigation during auction
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = (e) => {
      // If no auction in progress, don't block normal navigation
      if (!auctionStarted || auctionComplete) return;
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '';
    };

    const handlePopState = () => {
      if (!auctionStarted || auctionComplete) return;
      // Immediately push the current URL back so back/forward do nothing
      window.history.pushState(null, '', window.location.href);
      alert('Please do not use the browser back/forward buttons during the auction. Use the app controls instead.');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    // Prepare a state entry so back button hits our handler
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [auctionStarted, auctionComplete]);

  const handleDataSetup = (playersData, teamsData) => {
    setPlayers(playersData);
    setTeams(teamsData);
    setAuctionStarted(true);
    
    // Pre-assign captains, vice-captains, and any players marked as pre-sold
    // with a preAssignedTeamName from the players CSV.
    const preAssigned = {};
    teamsData.forEach(team => {
      const teamNameLower = team.name.toLowerCase().trim();

      // Find and assign captain
      const captain = playersData.find(p => 
        p.name.toLowerCase().trim() === team.captain.toLowerCase().trim()
      );
      if (captain) {
        preAssigned[captain.id] = { 
          teamId: team.id, 
          price: 0, 
          isPreAssigned: true 
        };
      }
      
      // Find and assign vice-captain if exists
      if (team.viceCaptain) {
        const viceCaptain = playersData.find(p => 
          p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim()
        );
        if (viceCaptain) {
          preAssigned[viceCaptain.id] = { 
            teamId: team.id, 
            price: 0, 
            isPreAssigned: true 
          };
        }
      }

      // Assign any players from the players CSV that are already tagged as
      // pre-sold to this team via the "team" / "initialTeam" column.
      playersData.forEach(p => {
        if (!p.preAssignedTeamName) return;
        if (preAssigned[p.id]) return; // don't override captain/VC mapping

        const playerTeamLower = p.preAssignedTeamName.toLowerCase().trim();
        if (playerTeamLower && playerTeamLower === teamNameLower) {
          preAssigned[p.id] = {
            teamId: team.id,
            price: 0,
            isPreAssigned: true,
            isPreSold: !!p.isPreSold
          };
        }
      });
    });
    
    setAssignedPlayers(preAssigned);
    const initialBudgets = teamsData.reduce((acc, team) => {
      acc[team.id] = TEAM_BUDGET_LIMIT;
      return acc;
    }, {});
    setTeamBudgets(initialBudgets);
    setAuctionComplete(false);
  };

  const handlePlayerAssigned = (playerId, teamId, bidPrice) => {
    // Find player and team details
    const player = players.find(p => p.id === playerId);
    const team = teams.find(t => t.id === teamId);
    if (!player || !team) return;
    
    const base = player.basePrice || 0;
    const effectiveSpend = Math.max(0, bidPrice - base);
    
    // Save to Google Sheets
    savePlayerToSheet({
      playerName: player.name,
      teamName: team.name,
      basePrice: player.basePrice || 0,
      soldPrice: bidPrice,
      category: player.category || '',
      role: player.role || ''
    });
    
    setAssignedPlayers(prev => ({
      ...prev,
      [playerId]: { teamId, price: bidPrice, effectiveSpend }
    }));
    setTeamBudgets(prev => ({
      ...prev,
      [teamId]: Math.max(0, (prev[teamId] ?? TEAM_BUDGET_LIMIT) - effectiveSpend)
    }));
    setLastAssigned({ playerId, teamId, price: bidPrice, effectiveSpend });
    setCurrentPlayer(null);
  };

  const handleUndoAssignment = (playerId) => {
    const assignment = assignedPlayers[playerId];
    if (!assignment) return;

    // Restore budget
    setTeamBudgets(prev => ({
      ...prev,
      [assignment.teamId]: (prev[assignment.teamId] ?? 0) + (assignment.effectiveSpend ?? assignment.price)
    }));

    // Remove assignment
    setAssignedPlayers(prev => {
      const updated = { ...prev };
      delete updated[playerId];
      return updated;
    });

    setLastAssigned(null);
  };

  const handleAuctionComplete = () => {
    setAuctionComplete(true);
    setAuctionStarted(false);
  };

  const getUnassignedPlayers = () => {
    // Filter out players who are already assigned (including captains/VCs)
    return players.filter(player => !assignedPlayers[player.id]);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>ECL Cricket Season 4 - 2026</h1>
      </header>

      <main className="app-main">
        {!auctionStarted && !auctionComplete && players.length === 0 && (
          <DataSetup onDataSetup={handleDataSetup} />
        )}

        {auctionStarted && !auctionComplete && (
          <AuctionArea
            players={players}
            teams={teams}
            currentPlayer={currentPlayer}
            setCurrentPlayer={setCurrentPlayer}
            assignedPlayers={assignedPlayers}
            onPlayerAssigned={handlePlayerAssigned}
            onUndoAssignment={handleUndoAssignment}
            onAuctionComplete={handleAuctionComplete}
            unassignedPlayers={getUnassignedPlayers()}
            teamBudgets={teamBudgets}
            teamBudgetLimit={TEAM_BUDGET_LIMIT}
            lastAssigned={lastAssigned}
          />
        )}

        {auctionComplete && (
          <FinalOutput
            players={players}
            teams={teams}
            assignedPlayers={assignedPlayers}
            teamBudgets={teamBudgets}
            teamBudgetLimit={TEAM_BUDGET_LIMIT}
          />
        )}
      </main>
    </div>
  );
}

export default App;

