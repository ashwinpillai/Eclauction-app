import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './AuctionArea.css';
import PlayerPopup from './PlayerPopup';
import TeamAssignment from './TeamAssignment';

// Component for the category start notification
const CategoryNotification = ({ category, onStart, isFinalRound }) => {
    const categoryDisplayName = category.toUpperCase().replace(/-/g, ' ');
    return (
        <div className="auction-notification-overlay">
            <div className="auction-notification-modal">
                <h2>Category Starting: {categoryDisplayName}</h2>
                <p>
                    The auction will proceed in the following order: 'NEW-TO-GAME', 'WK-BAT-BOWL', 'BEST-BATTERS-BOWLERS', 'ALLROUNDERS-1', 'ALLROUNDERS'.
                </p>
                <p>
                    {isFinalRound 
                        ? "This is the **FINAL RESURFACING ROUND** for all previously unsold players. They will not return to the auction if marked unsold again." 
                        : "Alert: Any players marked **UNSOLD** in this section will come up for auction again at the end of all primary categories."
                    }
                </p>
                <button onClick={onStart}>Start Auction for {categoryDisplayName}</button>
            </div>
        </div>
    );
};


function AuctionArea({
  players,
  teams,
  currentPlayer,
  setCurrentPlayer,
  assignedPlayers,
  onPlayerAssigned,
  onUndoAssignment,
  onAuctionComplete,
  teamBudgets,
  teamBudgetLimit,
  lastAssigned
}) {
  const categoryOrder = useMemo(
    () => ['new-to-game', 'wk-bat-bowl','mystery', 'best-batters-bowlers', 'allrounders-1', 'allrounders'],
    []
  );

  // --- NEW STATE FOR UNSOLD PLAYERS AND NOTIFICATIONS ---
  const [unsoldPlayers, setUnsoldPlayers] = useState([]); // Array of player objects
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [showNotification, setShowNotification] = useState(true);
  const [isFinalRound, setIsFinalRound] = useState(false);
  // -----------------------------------------------------

  // --- TEAM INTRO (CAPTAIN / VICE-CAPTAIN) STATE ---
  const [introQueue, setIntroQueue] = useState([]);
  const [introIndex, setIntroIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(true);

  // Build introduction queue once from teams data
  useEffect(() => {
    const queue = [];
    teams.forEach(team => {
      if (team.captain) {
        queue.push({
          teamId: team.id,
          teamName: team.name,
          roleLabel: 'Captain',
          personName: team.captain
        });
      }
      if (team.viceCaptain) {
        queue.push({
          teamId: team.id,
          teamName: team.name,
          roleLabel: 'Vice-Captain',
          personName: team.viceCaptain
        });
      }
    });
    setIntroQueue(queue);
    setIntroIndex(0);
    setShowIntro(queue.length > 0);
  }, [teams]);

  // Combined list of players remaining in the current category queue (excluding assigned/unsold)
  const playersInPrimaryQueue = useMemo(() => {
    const assignedIds = Object.keys(assignedPlayers);
    const unsoldIds = unsoldPlayers.map(p => p.id);
    // Filter out players who are either sold or already moved to the unsold list
    return players.filter(p => !assignedIds.includes(p.id) && !unsoldIds.includes(p.id));
  }, [players, assignedPlayers, unsoldPlayers]);

  const getCurrentCategory = useCallback(() => {
      return categoryOrder[currentCategoryIndex];
  }, [categoryOrder, currentCategoryIndex]);


  const pickNextPlayer = useCallback(() => {
    
    // --- PHASE 1: Main Category Auction ---
    if (!isFinalRound) {
        // Find the next player from the current category (or subsequent categories if current is empty)
        for (let i = currentCategoryIndex; i < categoryOrder.length; i++) {
            const cat = categoryOrder[i];
            const candidates = playersInPrimaryQueue.filter(
                p => (p.category || '').toLowerCase() === cat
            );
            if (candidates.length > 0) {
                // Return a random player from the current category
                const randomIndex = Math.floor(Math.random() * candidates.length);
                return candidates[randomIndex];
            }
        }
        
        // If we reach here, all players from primary categories are exhausted.
        return null;
    }
    
    // --- PHASE 2: Final Resurfacing Round ---
    if (isFinalRound && unsoldPlayers.length > 0) {
        // Pick the first unsold player (FIFO logic)
        return unsoldPlayers[0];
    }
    
    return null; // All done
  }, [categoryOrder, currentCategoryIndex, playersInPrimaryQueue, isFinalRound, unsoldPlayers]);
  
  
  // --- EFFECT TO HANDLE CATEGORY TRANSITION ---
  useEffect(() => {
      // Don't transition if a notification is already up, or if the current player is active
      if (showNotification || currentPlayer) return; 

      const currentCat = getCurrentCategory();
      
      const categoryPlayersRemaining = playersInPrimaryQueue.filter(
          p => (p.category || '').toLowerCase() === currentCat
      ).length;

      // If the current category is empty, proceed to the next phase
      if (!isFinalRound && categoryPlayersRemaining === 0) {
          
          const nextIndex = currentCategoryIndex + 1;
          
          if (nextIndex < categoryOrder.length) {
             // Move to next primary category
             setCurrentCategoryIndex(nextIndex);
             setShowNotification(true);
             return;
          } 
          
          // Check if primary categories are finished and there are unsold players
          if (unsoldPlayers.length > 0) {
             setIsFinalRound(true);
             setShowNotification(true);
             return;
          }
          
          // Final completion case (handled by the bottom notice)
      }
      
  }, [playersInPrimaryQueue, getCurrentCategory, currentCategoryIndex, categoryOrder.length, isFinalRound, unsoldPlayers.length, showNotification, currentPlayer]);


  const handleRandomPlayer = () => {
    // Prevent player selection while notification is visible
    if (showNotification) return; 

    const next = pickNextPlayer();
    
    if (!next) {
      if (playersInPrimaryQueue.length === 0 && unsoldPlayers.length === 0) {
        alert('All players have been assigned or permanently skipped!');
        return;
      }
      // If next is null, it means the auction is between phases (e.g., waiting for notification)
      return; 
    }
    setCurrentPlayer(next);
  };
  
  const handleStartCategory = () => {
      setShowNotification(false);
  };


  // --- UNSOLD HANDLER ---
  const handlePlayerUnsold = (playerId) => {
      const playerToMove = players.find(p => p.id === playerId);
      if (!playerToMove) return;
      
      // If we are in the Final Round, move the player to the back of the unsold queue
      if (isFinalRound) {
          setUnsoldPlayers(prev => {
              const remaining = prev.filter(p => p.id !== playerId);
              return [...remaining, playerToMove];
          });
          setCurrentPlayer(null);
          return;
      }

      // If in a primary round, move to the unsold list (only once)
      if (!unsoldPlayers.some(p => p.id === playerId)) {
          setUnsoldPlayers(prev => [...prev, playerToMove]);
      }
      setCurrentPlayer(null);
  };


  // Logic to handle assignment flow
  const handleAssignToTeam = (teamId, bidPrice) => {
    if (!currentPlayer) return;

    // Standard checks (omitted for brevity)
    const price = Number(bidPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    if (price < currentPlayer.basePrice) return;
    const remaining = teamBudgets[teamId] ?? teamBudgetLimit;
    if (price > remaining) return;
    
    // If assigned in the final round, remove the player from the unsold list
    if (isFinalRound) {
        setUnsoldPlayers(prev => prev.filter(p => p.id !== currentPlayer.id));
    }

    onPlayerAssigned(currentPlayer.id, teamId, price);
    setCurrentPlayer(null);
  };

  const handleUndoAssignment = (playerId) => {
      const playerToUndo = players.find(p => p.id === playerId);
      if (playerToUndo) {
          // If undoing an assignment, check if they belonged to the unsold list
          const originalCategory = (playerToUndo.category || '').toLowerCase();
          
          // If the player's category has already passed, or we are in the final round, put them in unsold.
          if (isFinalRound || categoryOrder.indexOf(originalCategory) < currentCategoryIndex) {
              setUnsoldPlayers(prev => [...prev, playerToUndo]);
          }
          // Note: If the category has NOT passed, the player automatically re-enters the primary queue (playersInPrimaryQueue)
      }
      onUndoAssignment(playerId);
  };
  
  
  // --- STATS CALCULATION ---
  const remainingPlayers = playersInPrimaryQueue.length + unsoldPlayers.length;
  const assignedCount = Object.keys(assignedPlayers).length;
  const totalPlayers = players.length;

  // --- TEAM INTRO HELPERS ---
  const currentIntro = showIntro && introQueue[introIndex] ? introQueue[introIndex] : null;

  const introPlayer = useMemo(() => {
    if (!currentIntro) return null;
    const matched = players.find(
      p => p.name.toLowerCase().trim() === currentIntro.personName.toLowerCase().trim()
    );
    if (matched) return matched;
    // Fallback player object if not found in main list
    return {
      id: `intro-${introIndex}`,
      name: currentIntro.personName,
      role: currentIntro.roleLabel,
      category: '',
      basePrice: 0,
      photo: ''
    };
  }, [currentIntro, players, introIndex]);

  const handleNextIntro = () => {
    if (!introQueue.length) {
      setShowIntro(false);
      return;
    }
    if (introIndex < introQueue.length - 1) {
      setIntroIndex(prev => prev + 1);
    } else {
      // Done with intros, move to normal auction flow
      setShowIntro(false);
      setShowNotification(true);
    }
  };
  
  // Logic to show Category Notification Modal
  if (showIntro && introPlayer && currentIntro) {
      return (
        <div className="auction-layout">
          <div className="auction-area">
            <div className="auction-header">
              <h2>Team Introductions</h2>
              <h3>Team - {currentIntro.teamName}</h3>
            </div>
            <div className="live-auction-row">
              <PlayerPopup
                player={introPlayer}
                show
                subtitle={`${currentIntro.roleLabel}`}
              />
            </div>
            <div className="auction-controls auction-controls-below">
              <button
                className="random-player-btn"
                onClick={handleNextIntro}
              >
                {introIndex < introQueue.length - 1 ? 'Next Introduction' : 'Start Auction'}
              </button>
            </div>
          </div>
        </div>
      );
  }

  if (showNotification && (currentCategoryIndex < categoryOrder.length || isFinalRound)) {
      return (
          <CategoryNotification 
              category={isFinalRound ? 'Unsold Players' : categoryOrder[currentCategoryIndex]} 
              onStart={handleStartCategory}
              isFinalRound={isFinalRound}
          />
      );
  }


  return (
    <div className="auction-layout">
      <div className="auction-area">
        <div className="auction-header">
          <h2>Auction in Progress</h2>
          <h3>Current Set: {isFinalRound ? 'FINAL UNSOLD ROUND' : getCurrentCategory().toUpperCase().replace(/-/g, ' ')}</h3>
          <div className="auction-stats">
            <div className="stat-box">
              <span className="stat-label">Total Players</span>
              <span className="stat-value">{totalPlayers}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Assigned</span>
              <span className="stat-value">{assignedCount}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Remaining</span>
              <span className="stat-value">{remainingPlayers}</span>
            </div>
          </div>
        </div>

        {currentPlayer && (
          <div className="live-auction-row">
            <PlayerPopup player={currentPlayer} show />
            <TeamAssignment
              teams={teams}
              player={currentPlayer}
              teamBudgets={teamBudgets}
              teamBudgetLimit={teamBudgetLimit}
              players={players}
              assignedPlayers={assignedPlayers}
              onAssign={handleAssignToTeam}
              onUndo={handleUndoAssignment}
              onUnsold={handlePlayerUnsold} // Pass the new handler
              lastAssigned={lastAssigned}
            />
          </div>
        )}

        {!currentPlayer && (
          <div className="auction-controls auction-controls-below">
            <button
              className="random-player-btn"
              onClick={handleRandomPlayer}
              disabled={remainingPlayers === 0}
            >
              📋 Select Next Player
            </button>
            <button
              className="finish-auction-btn"
              onClick={onAuctionComplete} // Assuming this handles the final results view
            >
              🛑 Finish Auction
            </button>
          </div>
        )}

        {remainingPlayers === 0 && (
          <div className="auction-complete-notice">
            <h3>🎉 Auction Complete!</h3>
            <button
              className="view-results-btn"
              onClick={onAuctionComplete}
            >
              View Final Results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuctionArea;
