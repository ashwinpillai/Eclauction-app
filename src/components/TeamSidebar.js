import React from 'react';
import './TeamSidebar.css';

function TeamSidebar({ teams, players, assignedPlayers, teamBudgets, teamBudgetLimit, onDownload }) {

  // Helper function to find a player by a given name string (robustly)
  const findPlayerByName = (nameString) => {
    if (!nameString) return null;
    const normName = nameString.toLowerCase().trim();
    // Use .find() for robust comparison against the players list
    return players.find(p => p.name.toLowerCase().trim() === normName);
  };


  // --- REVISED LOGIC: GET ALL PLAYERS ON THE ROSTER (ASSIGNED + C/VC) ---
  const getRosterPlayers = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return [];

    const roster = [];
    const playerIds = new Set();

    // 1. Add Captain and Vice Captain (find them in the main players list)
    
    // Find Captain Player Object
    const captainPlayer = findPlayerByName(team.captain);
    if (captainPlayer) {
      roster.push(captainPlayer);
      playerIds.add(captainPlayer.id);
    }
    
    // Find Vice Captain Player Object
    const vcPlayer = findPlayerByName(team.viceCaptain);
    // Add VC only if found and not the same person as Captain
    if (vcPlayer && !playerIds.has(vcPlayer.id)) { 
      roster.push(vcPlayer);
      playerIds.add(vcPlayer.id);
    }

    // 2. Add all other Assigned Players
    players.forEach(p => {
      const isAssigned = assignedPlayers[p.id]?.teamId === teamId;
      
      // Add the player if assigned AND they haven't already been added as the C/VC
      if (isAssigned && !playerIds.has(p.id)) { 
        roster.push(p);
        playerIds.add(p.id);
      }
    });

    return roster; // This is the comprehensive list of unique players on the team
  };
  // ----------------------------------------------------------------------

  const counts = (teamId) => {
    const teamPlayers = getRosterPlayers(teamId); 
    
    // Using exact category strings from the TeamAssignment logic:
    const allr = teamPlayers.filter(p => (p.category || '').toLowerCase() === 'allrounders').length;
    const allr1 = teamPlayers.filter(p => (p.category || '').toLowerCase() === 'allrounders-1').length;
    const allrP = teamPlayers.filter(p => (p.category || '').toLowerCase() === 'allrounders-p').length;
    
    return { 
        total: teamPlayers.length, // Total Roster Count (C/VC + Assigned)
        allr: allr, 
        allr1: allr1,
        allrP: allrP 
    };
  };

  return (
    <aside className="team-sidebar">
      <div className="sidebar-header">
        <h3>Teams</h3>
        <button className="sidebar-download" onClick={onDownload}>
          📥 Download Sheet
        </button>
      </div>
      <div className="sidebar-list">
        {teams.map(team => {
          const teamRoster = getRosterPlayers(team.id); // Get the full roster
          const remaining = teamBudgets[team.id] ?? teamBudgetLimit;
          const { total, allr, allr1, allrP } = counts(team.id);
          
          return (
            <div key={team.id} className="sidebar-card">
              <div className="sidebar-card-top">
                <div>
                  <div className="sidebar-team-name">{team.name}</div>
                  <div className="sidebar-captain">Captain: {team.captain}</div>
                  {team.viceCaptain && (
                    <div className="sidebar-vice-captain">VC: {team.viceCaptain}</div>
                  )}
                </div>
                {/* --- FIX: Display the actual total count (Max 10) --- */}
                <div className="sidebar-chip">Players: {total}/10</div> 
              </div>
              <div className="sidebar-budget">
                Remaining: ₹{remaining.toLocaleString('en-IN')}
              </div>
              <div className="sidebar-badge-row">
                {/* Displaying category counts */}
                <span className="sidebar-badge allr">All-rounders-1: {allr1}/2</span>
                <span className="sidebar-badge allr">All-rounders: {allr}/1</span> 
                <span className="sidebar-badge allrp">Allrounders-P: {allrP}/1</span> 
              </div>
              <div className="sidebar-players">
                {teamRoster.length > 0 ? teamRoster.map(p => (
                  <span key={p.id} className="sidebar-player-pill">
                    {p.name} ({p.role})
                  </span>
                )) : <span className="sidebar-empty">No players yet</span>}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default TeamSidebar;
