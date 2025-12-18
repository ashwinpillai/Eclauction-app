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

  // --- LOGIC: Define and calculate the increment (UNCHANGED) ---
  const incrementalSteps = useMemo(() => ({
    'allrounders': 2000,
    'allrounders-1': 1000,
    'best-batters-bowlers': 500,
    'wk-bat-bowl': 500,
    'new-to-game': 200,
  }), []);

  const currentIncrement = incrementalSteps[category] || 500; 

  const handleIncrement = () => {
    const newPrice = bidPrice + currentIncrement;
    setBidPrice(newPrice);
  };
  // --- END INCREMENT LOGIC ---

  
  // --- REVISED LOGIC: COUNTS ONLY TOTAL ROSTER AND CATEGORY COUNTS ---
  const teamCategoryCounts = useMemo(() => {
    const counts = {};
    teams.forEach(team => {
      counts[team.id] = {
        allrounders: 0,
        allrounders1: 0,
        categoryCounts: {}, // Total Roster Count for each category
      };

      // Helper to count player in specific category fields (for total roster count)
      const countPlayerCategory = (cat, teamId) => {
        counts[teamId].categoryCounts[cat] = (counts[teamId].categoryCounts[cat] || 0) + 1;
        if (cat === 'allrounders-1') {
          counts[teamId].allrounders1 += 1;
        }
        if (cat === 'allrounders') {
          counts[teamId].allrounders += 1;
        }
      };

      // Iterate over ALL players to establish the current roster size and category breakdown
      players.forEach(p => {
          const cat = (p.category || p.role || '').toLowerCase();
          const isAssignedToThisTeam = assignedPlayers[p.id]?.teamId === team.id;
          const isCaptain = p.name.toLowerCase().trim() === team.captain.toLowerCase().trim();
          const isViceCaptain = team.viceCaptain && p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim();
          
          // CRITICAL: Calculate TOTAL ROSTER count (C/VC + Assigned)
          if (isAssignedToThisTeam || isCaptain || isViceCaptain) {
              countPlayerCategory(cat, team.id);
          }
      });
    });
    return counts;
  }, [assignedPlayers, players, teams]);
  // --- END REVISED COUNTING LOGIC ---

  
  // --- REVISED LOGIC: CHECKING RULES (FLAT LIMITS ONLY, PER-ROLE SLOTS) ---
  const canTakePlayer = (team) => {
    const teamCounts = teamCategoryCounts[team.id] || {};
    const categoryCounts = teamCounts.categoryCounts || {};
    
    // Calculate Roster Size
    const currentRosterSize = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

    // Check if the player being auctioned is ALREADY counted on this team (as C/VC or assigned)
    const isPlayerAlreadyInCount = players.some(p => p.id === player.id && (
        assignedPlayers[p.id]?.teamId === team.id || 
        p.name.toLowerCase().trim() === team.captain.toLowerCase().trim() || 
        (team.viceCaptain && p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim())
    ));
    
    // Determine the increment: 0 if already counted, 1 if this is a new assignment
    const countIfNew = isPlayerAlreadyInCount ? 0 : 1; 
    
    const projectedRosterSize = currentRosterSize + countIfNew;
    
    // ---------------------------------------------
    // --- RULE 1: ABSOLUTE MAX 10 PLAYERS ---
    // ---------------------------------------------
    if (projectedRosterSize > 10) {
      return false; // Cannot bid, max roster size reached
    }
    
    // ---------------------------------------------
    // --- RULE 2: CATEGORY LIMITS (FLAT MAXIMA) ---
    // ---------------------------------------------
    
    const projectedCategoryCount = (categoryCounts[category] || 0) + countIfNew;
    
    // 2.1 Block Allrounders-P entirely
    if (category === 'allrounders-p') {
        return false;
    }
    
    // 2.2 Generic: MAX 2 PLAYERS PER CATEGORY (including Captain/VC)
    if (projectedCategoryCount > 2) {
      return false;
    }

    return true; // All rules passed
  };
  // --- END REVISED RULE CHECKING LOGIC ---


  // --- MODIFIED HANDLERS for 2-STEP PROCESS (UNCHANGED) ---

  const handleTentativeAssign = (teamId) => {
    setSoldTo(teamId);
  };

  const handleFinalizeSale = () => {
    if (soldTo) {
      setIsFinalized(true);
      onAssign(soldTo, bidPrice);
    }
  };

  const handleReopenBidding = () => {
    setSoldTo(null);
  };

  const handleUnsoldClick = () => { 
    if (window.confirm(`Are you sure you want to mark ${player.name} as UNSOLD? They will be available in the final round.`)) {
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

  // --- RENDER LOGIC (UPDATED disableReason TEXT for clarity) ---

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
            <div className="sold-captain">Captain: {soldTeam?.captain}</div>
          </div>
          {/* Undo button for the LAST action */}
          {onUndo && lastAssigned && (
            <button className="undo-button" onClick={handleUndo}>
              ↶ Undo Assignment
            </button>
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
          <button className="confirm-button" onClick={handleFinalizeSale}>
            ✓ CONFIRM & NEXT PLAYER
          </button>
          <button className="undo-button secondary" onClick={handleReopenBidding}>
            ↶ Reopen Bidding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="team-assignment-overlay">
      <div className="team-assignment-modal compact">
        <h3>Assign Player</h3>
       
        
        {/* --- BASE PRICE DISPLAY --- */}
        <div className="base-price-display">
          <span className="base-price-label-compact">Base Price:</span>
          <span className="base-price-value-compact">₹{player.basePrice.toLocaleString('en-IN')}</span>
        </div>
        
        {/* --- BID INPUT SECTION --- */}
        <div className="bid-input-compact">
          <label htmlFor="bid-amount">Current Bid (₹)</label>
          <div className="bid-control-group">
            <input
              id="bid-amount"
              type="number"
              min={player.basePrice || 0}
              value={bidPrice}
              onChange={(e) => {
                let val = Number(e.target.value);
                if (val < player.basePrice) val = player.basePrice;
                setBidPrice(val);
              }}
              className="bid-input"
            />
            <button
              className="increment-btn"
              onClick={handleIncrement}
            >
              + {currentIncrement.toLocaleString('en-IN')}
            </button>
          </div>
         
        </div>
        {/* --- END BID INPUT SECTION --- */}
        
        <div className="teams-grid-compact">
          {teams.map(team => {
            const teamCounts = teamCategoryCounts[team.id] || {};
            const currentRosterSize = Object.values(teamCounts.categoryCounts || {}).reduce((sum, count) => sum + count, 0);
            
            // Check if the player being auctioned is ALREADY counted on this team
            const isPlayerAlreadyInCount = players.some(p => p.id === player.id && (
                assignedPlayers[p.id]?.teamId === team.id || 
                p.name.toLowerCase().trim() === team.captain.toLowerCase().trim() || 
                (team.viceCaptain && p.name.toLowerCase().trim() === team.viceCaptain.toLowerCase().trim())
            ));
            const countIfNew = isPlayerAlreadyInCount ? 0 : 1;
            const projectedRosterSize = currentRosterSize + countIfNew;
            const projectedCategoryCount = (teamCounts.categoryCounts[category] || 0) + countIfNew; // Re-calculate projected category count here

            const budgetInsufficient = (teamBudgets[team.id] ?? teamBudgetLimit) < bidPrice;
            const invalidBid = bidPrice <= 0;
            const roleRestriction = !canTakePlayer(team);
            
            const isDisabled = budgetInsufficient || invalidBid || roleRestriction;
            
            let disableReason = '';
            
            // Highest priority disable reason
            if (projectedRosterSize > 10) {
                disableReason = `Max 10 player limit reached (${currentRosterSize} already signed)`;
            } else if (budgetInsufficient) {
              disableReason = 'Insufficient budget';
            } else if (roleRestriction) {
              if (category === 'allrounders-p') {
                disableReason = 'Allrounders-P category is removed';
              } else {
                disableReason = `Limit reached for this set (Max 2 players in ${category.toUpperCase()} for this team, incl. C/VC)`;
              }
            }
            
            return (
              <button
                key={team.id}
                className={`team-card-compact ${isDisabled ? 'disabled' : ''}`}
                onClick={() => handleTentativeAssign(team.id)}
                disabled={isDisabled}
                title={isDisabled ? `${team.name}: ${disableReason}` : `${team.name} - Budget: ₹${(teamBudgets[team.id] ?? teamBudgetLimit).toLocaleString('en-IN')}`}
              >
                <div className="team-name-compact">{team.name}</div>
                <div className="team-budget-compact">₹{(teamBudgets[team.id] ?? teamBudgetLimit).toLocaleString('en-IN')}</div>
                {isDisabled && (
                  <div className="budget-warning-compact">{disableReason}</div>
                )}
              </button>
            );
          })}
        </div>
        
        <button className="unsold-button" onClick={handleUnsoldClick}>
          ❌ Mark as UNSOLD
        </button>
      </div>
    </div>
  );
}

export default TeamAssignment;
