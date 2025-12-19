import React, { useEffect, useState } from 'react';
import './App.css';
import AuctionArea from './components/AuctionArea';
import FinalOutput from './components/FinalOutput';
import { savePlayerToSheet, testGoogleSheets } from './utils/googleSheets';
import Papa from 'papaparse';

// Expose test function to window for easy testing from browser console
if (typeof window !== 'undefined') {
  window.testGoogleSheets = testGoogleSheets;
}

function App() {
  const TEAM_BUDGET_LIMIT = 100000; // per-team purse

  const PLAYERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8zX1pyfs_1Ec5UJlxJuK0mzyw7CyfL7JYm2VZsrdi559A81-YQ-IkMuh3DdJ0tcbWrfqBrYen4krP/pub?gid=0&single=true&output=csv';
  const TEAMS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQNYRls-USzRHiynhqVUGb11Q6D6TazIxORdueJQyQdVNuh7LvO0oVYn8EPT3TYlGWN5fS6UiTWtMWN/pub?gid=0&single=true&output=csv';

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [assignedPlayers, setAssignedPlayers] = useState({}); // {playerId: {teamId, price, effectiveSpend}}
  const [teamBudgets, setTeamBudgets] = useState({}); // {teamId: remaining}
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [auctionStarted, setAuctionStarted] = useState(false);
  const [auctionComplete, setAuctionComplete] = useState(false);
  const [lastAssigned, setLastAssigned] = useState(null); // {playerId, teamId, price}
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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
      const nameLower = team.name.toLowerCase().trim();
      let cap = TEAM_BUDGET_LIMIT;

      if (nameLower === 'ministry of darkness') {
        cap = 95000;
      } else if (nameLower === 'kingsmen') {
        cap = 97000;
      } else if (nameLower === 'striking stallions') {
        cap = 97000;
      }

      acc[team.id] = cap;
      return acc;
    }, {});
    setTeamBudgets(initialBudgets);
    setAuctionComplete(false);
  };

  // Auto-load Teams and Players from fixed Google Sheets CSV links on first load
  useEffect(() => {
    let isCancelled = false;

    const parsePlayers = (results) => {
      const data = (results.data || [])
        .map((row, idx) => {
          const r = normalizeRow(row);
          const name = r.name || r.playername || '';
          const role = r.role || r.playerrole || '';
          const category = r.category || r.playercategory || r.set || '';
          const preAssignedTeamName = (r.team || r.initialteam || '').trim();

          const rawBasePrice = r.baseprice ?? '';
          const rawBasePriceStr = String(rawBasePrice || '').trim().toLowerCase();
          const isPreSold = rawBasePriceStr === 'sold';
          const basePrice = isPreSold ? 0 : rawBasePrice || 0;
          const photo = r.photo || r.photourl || r.image || r.imageurl || '';
          const normCategory = String(category || role || '').trim().toLowerCase();

          const player = {
            id: `player-${idx}`,
            name: String(name).trim(),
            role: String(role).trim(),
            category: normCategory,
            basePrice: parseFloat(basePrice) || 0,
            photo: String(photo).trim(),
            preAssignedTeamName,
            isPreSold,
          };
          return player;
        })
        .filter((p) => !!p.name);
      return data;
    };

    const parseTeams = (results) => {
      const data = (results.data || [])
        .map((row, idx) => {
          const r = normalizeRow(row);
          const name = r.teamname || r.team || '';
          const captain = r.captain || '';
          const viceCaptain = r.vicecaptain || r['vicecaptain'] || '';
          return {
            id: `team-${idx}`,
            name: String(name).trim(),
            captain: String(captain).trim(),
            viceCaptain: String(viceCaptain).trim(),
          };
        })
        .filter((t) => t.name);
      return data;
    };

    const loadCsv = (url, label) =>
      new Promise((resolve, reject) => {
        Papa.parse(url, {
          download: true,
          header: true,
          complete: (results) => {
            const rows = results.data || [];
            const nonEmpty = rows.filter((r) =>
              Object.values(r || {}).some((v) => String(v || '').trim() !== '')
            );
            if (nonEmpty.length === 0) {
              reject(new Error(`No rows found in published ${label} CSV`));
            } else {
              resolve(results);
            }
          },
          error: (err) => reject(err),
        });
      });

    const loadAll = async () => {
      try {
        const [playersResults, teamsResults] = await Promise.all([
          loadCsv(PLAYERS_CSV_URL, 'players'),
          loadCsv(TEAMS_CSV_URL, 'teams'),
        ]);
        if (isCancelled) return;
        const parsedPlayers = parsePlayers(playersResults);
        const parsedTeams = parseTeams(teamsResults);
        handleDataSetup(parsedPlayers, parsedTeams);
        setLoading(false);
      } catch (err) {
        console.error('Error loading auction data', err);
        if (isCancelled) return;
        setLoadError(err.message || 'Failed to load auction data');
        setLoading(false);
      }
    };

    loadAll();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <main className="app-main">
        {loading && (
          <div className="loading-message">
            Loading auction data from Google Sheets...
          </div>
        )}

        {!loading && loadError && (
          <div className="error-message">
            Failed to load auction data: {loadError}
          </div>
        )}

        {!loading && !loadError && auctionStarted && !auctionComplete && (
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

        {!loading && !loadError && auctionComplete && (
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
