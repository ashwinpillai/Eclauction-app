import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import Login from './components/Login';
import Welcome from './components/Welcome';
import AuctionArea from './components/AuctionArea';
import FinalOutput from './components/FinalOutput';
import { savePlayerToSheet, testGoogleSheets } from './utils/googleSheets';
import Papa from 'papaparse';

// Expose test function to window for easy testing from browser console
if (typeof window !== 'undefined') {
  window.testGoogleSheets = testGoogleSheets;
}

const TEAM_BUDGET_LIMIT = 100000; // per-team purse

function App() {
  // --- 1. State Hooks ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  
  const [showWelcome, setShowWelcome] = useState(() => {
    // Show welcome if authenticated on initial load and auction hasn't started
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    return isAuth;
  });
  
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [assignedPlayers, setAssignedPlayers] = useState({});
  const [teamBudgets, setTeamBudgets] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [auctionStarted, setAuctionStarted] = useState(false);
  const [auctionComplete, setAuctionComplete] = useState(false);
  const [lastAssigned, setLastAssigned] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const PLAYERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8zX1pyfs_1Ec5UJlxJuK0mzyw7CyfL7JYm2VZsrdi559A81-YQ-IkMuh3DdJ0tcbWrfqBrYen4krP/pub?gid=0&single=true&output=csv';
  const TEAMS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQNYRls-USzRHiynhqVUGb11Q6D6TazIxORdueJQyQdVNuh7LvO0oVYn8EPT3TYlGWN5fS6UiTWtMWN/pub?gid=0&single=true&output=csv';

  // --- 2. Helper Functions ---
  const normalizeRow = (row) => {
    const normalized = {};
    Object.keys(row || {}).forEach((key) => {
      const normKey = String(key || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/_/g, '');
      normalized[normKey] = row[key];
    });
    return normalized;
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    // Show welcome page after login
    setShowWelcome(true);
  };

  const handleWelcomeContinue = () => {
    setShowWelcome(false);
    // Start loading data when user continues from welcome page
    setLoading(true);
  };

  const handleDataSetup = useCallback((playersData, teamsData) => {
    setPlayers(playersData);
    setTeams(teamsData);
    setAuctionStarted(true);

    const preAssigned = {};
    teamsData.forEach(team => {
      const teamNameLower = team.name.toLowerCase().trim();

      // Assign Captains
      const captain = playersData.find(p => p.name.toLowerCase().trim() === team.captain.toLowerCase().trim());
      if (captain) preAssigned[captain.id] = { teamId: team.id, price: 0, isPreAssigned: true };

      // Assign Vice-Captains
      if (team.viceCaptain) {
        const viceCaptain = playersData.find(p => p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim());
        if (viceCaptain) preAssigned[viceCaptain.id] = { teamId: team.id, price: 0, isPreAssigned: true };
      }

      // Assign Pre-sold
      playersData.forEach(p => {
        if (!p.preAssignedTeamName || preAssigned[p.id]) return;
        if (p.preAssignedTeamName.toLowerCase().trim() === teamNameLower) {
          preAssigned[p.id] = { teamId: team.id, price: 0, isPreAssigned: true, isPreSold: !!p.isPreSold };
        }
      });
    });

    setAssignedPlayers(preAssigned);

    const initialBudgets = teamsData.reduce((acc, team) => {
      const nameLower = team.name.toLowerCase().trim();
      let cap = TEAM_BUDGET_LIMIT;
      if (nameLower === 'ministry of darkness') cap = 95000;
      else if (nameLower === 'kingsmen') cap = 97000;
      else if (nameLower === 'striking stallions') cap = 97000;
      acc[team.id] = cap;
      return acc;
    }, {});

    setTeamBudgets(initialBudgets);
    setAuctionComplete(false);
  }, []);

  // --- 3. Effects ---

  // Navigation Blocking Effect
  useEffect(() => {
    if (!auctionStarted || auctionComplete) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      alert('Please do not use browser navigation during the auction.');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [auctionStarted, auctionComplete]);

  // Data Fetching Effect
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    if (showWelcome) {
      // Don't load data while welcome page is showing
      setLoading(false);
      return;
    }

    let isCancelled = false;

    const loadCsv = (url, label) =>
      new Promise((resolve, reject) => {
        Papa.parse(url, {
          download: true,
          header: true,
          complete: (results) => {
            if ((results.data || []).length === 0) reject(new Error(`No data in ${label}`));
            else resolve(results);
          },
          error: (err) => reject(err),
        });
      });

    const loadAll = async () => {
      try {
        const [playersRes, teamsRes] = await Promise.all([
          loadCsv(PLAYERS_CSV_URL, 'players'),
          loadCsv(TEAMS_CSV_URL, 'teams'),
        ]);

        if (isCancelled) return;

        const parsedPlayers = (playersRes.data || []).map((row, idx) => {
          const r = normalizeRow(row);
          const isPreSold = String(r.baseprice || '').toLowerCase().trim() === 'sold';
          return {
            id: `player-${idx}`,
            name: String(r.name || r.playername || '').trim(),
            role: String(r.role || r.playerrole || '').trim(),
            category: String(r.category || r.set || '').trim().toLowerCase(),
            basePrice: isPreSold ? 0 : parseFloat(r.baseprice) || 0,
            photo: String(r.photo || r.photourl || r.imageurl || '').trim(),
            preAssignedTeamName: (r.team || r.initialteam || '').trim(),
            isPreSold
          };
        }).filter(p => p.name);

        const parsedTeams = (teamsRes.data || []).map((row, idx) => {
          const r = normalizeRow(row);
          return {
            id: `team-${idx}`,
            name: String(r.teamname || r.team || '').trim(),
            captain: String(r.captain || '').trim(),
            viceCaptain: String(r.vicecaptain || '').trim(),
          };
        }).filter(t => t.name);

        handleDataSetup(parsedPlayers, parsedTeams);
        setLoading(false);
      } catch (err) {
        if (!isCancelled) {
          setLoadError(err.message);
          setLoading(false);
        }
      }
    };

    loadAll();
    return () => { isCancelled = true; };
  }, [isAuthenticated, showWelcome, handleDataSetup]);

  // --- 4. Handlers ---
  const handlePlayerAssigned = (playerId, teamId, bidPrice) => {
    const player = players.find(p => p.id === playerId);
    const team = teams.find(t => t.id === teamId);
    if (!player || !team) return;

    const effectiveSpend = Math.max(0, bidPrice - player.basePrice);

    savePlayerToSheet({
      playerName: player.name,
      teamName: team.name,
      basePrice: player.basePrice,
      soldPrice: bidPrice,
      category: player.category,
      role: player.role
    });

    setAssignedPlayers(prev => ({ ...prev, [playerId]: { teamId, price: bidPrice, effectiveSpend } }));
    setTeamBudgets(prev => ({ ...prev, [teamId]: Math.max(0, (prev[teamId] || TEAM_BUDGET_LIMIT) - effectiveSpend) }));
    setLastAssigned({ playerId, teamId, price: bidPrice, effectiveSpend });
    setCurrentPlayer(null);
  };

  const handleUndoAssignment = (playerId) => {
    const assignment = assignedPlayers[playerId];
    if (!assignment) return;
    setTeamBudgets(prev => ({ ...prev, [assignment.teamId]: (prev[assignment.teamId] || 0) + assignment.effectiveSpend }));
    setAssignedPlayers(prev => {
      const updated = { ...prev };
      delete updated[playerId];
      return updated;
    });
    setLastAssigned(null);
  };

  // --- 5. Render Logic ---
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  // Show welcome page if authenticated and welcome hasn't been dismissed
  if (showWelcome) {
    return <Welcome onContinue={handleWelcomeContinue} />;
  }

  return (
    <div className="App">
      <main className="app-main">
        {loading && <div className="loading-message">Loading auction data...</div>}
        {!loading && loadError && <div className="error-message">Error: {loadError}</div>}
        
        {!loading && !loadError && auctionStarted && !auctionComplete && (
          <AuctionArea
            players={players}
            teams={teams}
            currentPlayer={currentPlayer}
            setCurrentPlayer={setCurrentPlayer}
            assignedPlayers={assignedPlayers}
            onPlayerAssigned={handlePlayerAssigned}
            onUndoAssignment={handleUndoAssignment}
            onAuctionComplete={() => { setAuctionComplete(true); setAuctionStarted(false); }}
            unassignedPlayers={players.filter(p => !assignedPlayers[p.id])}
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