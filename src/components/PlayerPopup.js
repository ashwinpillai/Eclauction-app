import React, { useEffect, useState } from 'react';
import './PlayerPopup.css';
import { getPlayerStats } from '../utils/playerStats';

function PlayerPopup({ player, show, subtitle }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show && player) {
      setIsAnimating(true);
      setTimeout(() => {
        setIsVisible(true);
        setIsAnimating(false);
      }, 80);
    } else {
      setIsVisible(false);
      setIsAnimating(false);
    }
  }, [show, player]);

  if (!player || !show) return null;

 
  const stats = getPlayerStats(player.name);

  return (
    <div className={`player-popup ${isAnimating ? 'animating' : ''} ${isVisible ? 'show' : ''}`}>
      <div className="popup-glow"></div>
      <div className="popup-content">
        <div className="player-photo-container">
          {player.photo ? (
            <img 
              src={player.photo} 
              alt={player.name}
              className="player-photo"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
          ) : null}
          <div className="player-icon" style={{ display: player.photo ? 'none' : 'block' }}>🏏</div>
        </div>
        <h2 className="player-name">{player.name}</h2>
        {subtitle && (
          <div className="player-subtitle">{subtitle}</div>
        )}
        <div className="player-role-display" >
          {player.role}
        </div>
        
        {/* Player Stats Section */}
        {stats ? (
          <div className="player-stats-section">
            {stats.batting && (
              <div className="stats-card batting-stats">
                <div className="stats-header">🏏 Batting</div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Runs</span>
                    <span className="stat-value">{stats.batting.runs}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">SR</span>
                    <span className="stat-value">{stats.batting.sr}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg</span>
                    <span className="stat-value">{stats.batting.avg}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">HS</span>
                    <span className="stat-value">{stats.batting.highest}</span>
                  </div>
                </div>
              </div>
            )}
            {stats.bowling && (
              <div className="stats-card bowling-stats">
                <div className="stats-header">⚾ Bowling</div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Wkts</span>
                    <span className="stat-value">{stats.bowling.wickets}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg</span>
                    <span className="stat-value">{stats.bowling.avg}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Econ</span>
                    <span className="stat-value">{stats.bowling.econ}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Overs</span>
                    <span className="stat-value">{stats.bowling.overs}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="debut-badge">
            <span className="debut-icon">✨</span>
            <span className="debut-text">Season Debut</span>
          </div>
        )}
        
      </div>
    </div>
  );
}

export default PlayerPopup;