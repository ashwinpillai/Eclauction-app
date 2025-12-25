import React, { useEffect, useMemo, useState } from 'react';
import './TeamAssignment.css';

function TeamAssignment({
  teams,
  player,
  onAssign,
  onUndo,
  onUnsold,
  teamBudgets,
  teamBudgetLimit,
  players,
  assignedPlayers,
  lastAssigned
}) {
  const [bidPrice, setBidPrice] = useState(player.basePrice || 0);
  const [soldTo, setSoldTo] = useState(null); // Team ID, set after first click
  const [isFinalized, setIsFinalized] = useState(false); // True when onAssign has been called

  useEffect(() => {
    // Reset state when a new player is brought up for auction
    setBidPrice(player.basePrice || 0);
    setSoldTo(null);
    setIsFinalized(false);
  }, [player]);

  const category = useMemo(() => (player.category || player.role || '').toLowerCase(), [player]);

  // --- LOGIC: Define and calculate the increment ---
  const incrementalSteps = useMemo(() => ({
    'allrounders': 2000,
    'allrounders-1': 1000,
    'best-batters-bowlers': 500,
    'wk-bat-bowl': 500,
    'new-to-game': 200,
    'mystery': 200,
  }), []);

  const currentIncrement = incrementalSteps[category] || 500; 

  const handleIncrement = () => {
    const newPrice = bidPrice + currentIncrement;
    setBidPrice(newPrice);
  };

  // --- REVISED LOGIC: COUNTS TOTAL ROSTER AND CATEGORY COUNTS ---
  const teamCategoryCounts = useMemo(() => {
    const counts = {};
    teams.forEach(team => {
      counts[team.id] = {
        categoryCounts: {}, // Total Roster Count per category
      };

      players.forEach(p => {
        const cat = (p.category || p.role || '').toLowerCase();
        const isAssignedToThisTeam = assignedPlayers[p.id]?.teamId === team.id;
        const isCaptain = p.name.toLowerCase().trim() === team.captain.toLowerCase().trim();
        const isViceCaptain = team.viceCaptain && p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim();
        
        if (isAssignedToThisTeam || isCaptain || isViceCaptain) {
          counts[team.id].categoryCounts[cat] = (counts[team.id].categoryCounts[cat] || 0) + 1;
        }
      });
    });
    return counts;
  }, [assignedPlayers, players, teams]);

  // --- UPDATED RULE CHECKING: 1 FOR MYSTERY/WK, 2 FOR OTHERS ---
  const canTakePlayer = (team) => {
    const teamCounts = teamCategoryCounts[team.id] || {};
    const categoryCounts = teamCounts.categoryCounts || {};
    
    const currentRosterSize = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

    const isPlayerAlreadyInCount = players.some(p => p.id === player.id && (
        assignedPlayers[p.id]?.teamId === team.id || 
        p.name.toLowerCase().trim() === team.captain.toLowerCase().trim() || 
        (team.viceCaptain && p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim())
    ));
    
    const countIfNew = isPlayerAlreadyInCount ? 0 : 1; 
    const projectedRosterSize = currentRosterSize + countIfNew;
    
    // RULE 1: MAX 10 PLAYERS
    if (projectedRosterSize > 10) return false;
    
    // RULE 2: CATEGORY LIMITS
    const projectedCategoryCount = (categoryCounts[category] || 0) + countIfNew;
    
    if (category === 'allrounders-p') return false;
    
    // Specific check: 1 for Mystery/WK, 2 for everything else
    const maxAllowed = (category === 'mystery' || category === 'wk-bat-bowl') ? 1 : 2;
    
    if (projectedCategoryCount > maxAllowed) {
      return false;
    }

    return true;
  };

  // --- HANDLERS ---
  const handleTentativeAssign = (teamId) => setSoldTo(teamId);
  const handleFinalizeSale = () => {
    if (soldTo) {
      setIsFinalized(true);
      onAssign(soldTo, bidPrice);
    }
  };
  const handleReopenBidding = () => setSoldTo(null);
  const handleUnsoldClick = () => { 
    if (window.confirm(`Are you sure you want to mark ${player.name} as UNSOLD?`)) {
      onUnsold(player.id);
    }
  };
  const handleUndo = () => {
    if (lastAssigned && onUndo) {
      onUndo(lastAssigned.playerId);
      setSoldTo(null);
      setIsFinalized(false);
    }
  };

  // --- RENDER LOGIC ---

  if (isFinalized) {
    const soldTeam = teams.find(t => t.id === soldTo);
    return (
      <div className="team-assignment-overlay">
        <div className="team-assignment-modal compact sold-confirmation">
          <div className="sold-badge">✓ SOLD</div>
          <h3>{player.name}</h3>
          <div className="sold-details">
            <div className="sold-to">Sold to: <strong>{soldTeam?.name}</strong></div>
            <div className="sold-price">Sale Amount: <strong>₹{bidPrice.toLocaleString('en-IN')}</strong></div>
          </div>
          {onUndo && lastAssigned && (
            <button className="undo-button" onClick={handleUndo}>↶ Undo Assignment</button>
          )}
        </div>
      </div>
    );
  }

  if (soldTo && !isFinalized) {
    const soldTeam = teams.find(t => t.id === soldTo);
    return (
      <div className="team-assignment-overlay">
        <div className="team-assignment-modal compact sold-confirmation">
          <h3>{player.name}</h3>
          <div className="sold-details">
            <div className="sold-to">Tentatively Sold to: <strong>{soldTeam?.name}</strong></div>
            <div className="sold-price">Sale Amount: <strong>₹{bidPrice.toLocaleString('en-IN')}</strong></div>
          </div>
          <button className="confirm-button" onClick={handleFinalizeSale}>✓ CONFIRM & NEXT</button>
          <button className="undo-button secondary" onClick={handleReopenBidding}>↶ Reopen Bidding</button>
        </div>
      </div>
    );
  }

  return (
    <div className="team-assignment-overlay">
      <div className="team-assignment-modal compact">
        <h3>Assign Player</h3>
        <div className="base-price-display">
          <span className="base-price-label-compact">Base Price:</span>
          <span className="base-price-value-compact">₹{player.basePrice.toLocaleString('en-IN')}</span>
        </div>
        
        <div className="bid-input-compact">
          <label htmlFor="bid-amount">Current Bid (₹)</label>
          <div className="bid-control-group">
            <input
              id="bid-amount"
              type="number"
              value={bidPrice}
              onChange={(e) => setBidPrice(Number(e.target.value))}
              className="bid-input"
            />
            <button className="increment-btn" onClick={handleIncrement}>
              + {currentIncrement.toLocaleString('en-IN')}
            </button>
          </div>
        </div>
        
        <div className="teams-grid-compact">
          {teams.map(team => {
            const teamCounts = teamCategoryCounts[team.id] || {};
            const currentRosterSize = Object.values(teamCounts.categoryCounts || {}).reduce((sum, count) => sum + count, 0);
            
            const isPlayerAlreadyInCount = players.some(p => p.id === player.id && (
                assignedPlayers[p.id]?.teamId === team.id || 
                p.name.toLowerCase().trim() === team.captain.toLowerCase().trim() || 
                (team.viceCaptain && p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim())
            ));
            const countIfNew = isPlayerAlreadyInCount ? 0 : 1;
            const projectedRosterSize = currentRosterSize + countIfNew;

            const budgetInsufficient = (teamBudgets[team.id] ?? teamBudgetLimit) < bidPrice;
            const roleRestriction = !canTakePlayer(team);
            const isDisabled = budgetInsufficient || roleRestriction;
            
            let disableReason = '';
            const maxAllowedForCat = (category === 'mystery' || category === 'wk-bat-bowl') ? 1 : 2;

            if (projectedRosterSize > 10) {
                disableReason = `Max 10 players reached (${currentRosterSize} signed)`;
            } else if (budgetInsufficient) {
              disableReason = 'Insufficient budget';
            } else if (roleRestriction) {
              if (category === 'allrounders-p') {
                disableReason = 'Category removed';
              } else {
                disableReason = `Max ${maxAllowedForCat} ${category.toUpperCase()} reached`;
              }
            }
            
            return (
              <button
                key={team.id}
                className={`team-card-compact ${isDisabled ? 'disabled' : ''}`}
                onClick={() => handleTentativeAssign(team.id)}
                disabled={isDisabled}
              >
                <div className="team-name-compact">{team.name}</div>
                <div className="team-budget-compact">₹{(teamBudgets[team.id] ?? teamBudgetLimit).toLocaleString('en-IN')}</div>
                {isDisabled && <div className="budget-warning-compact">{disableReason}</div>}
              </button>
            );
          })}
        </div>
        <button className="unsold-button" onClick={handleUnsoldClick}>❌ Mark as UNSOLD</button>
      </div>
    </div>
  );
}

export default TeamAssignment;