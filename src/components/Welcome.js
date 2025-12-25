import React from 'react';
import './Welcome.css';

function Welcome({ onContinue }) {
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-wrapper">
            <div className="ecl-logo">
              <img 
                src="https://i.ibb.co/G4dp3mVz/IMG-20240213-155349-removebg-preview.png" 
                alt="ECL - Equinox Cricket League" 
                className="ecl-logo-image"
              />
            </div>
          </div>
          <div className="logo-wrapper">
            <div className="equinox-agents-logo">
              <div className="equinox-text">EQUINOX</div>
              <div className="agents-text">AGENTS</div>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="welcome-message">
          <h1 className="welcome-title">Welcome to ECL Season 4 – Player's Auction</h1>
        </div>

        {/* Previous Season Winners */}
        <div className="winners-section">
          <h2 className="winners-title">Season Champions
          </h2>
          <div className="winners-list">
            <div className="winner-item">
              <span className="season-label">Season 3</span>
              <span className="team-name">STRIKING STALLIONS</span>
            </div>
            <div className="winner-item">
              <span className="season-label">Season 2</span>
              <span className="team-name">THUNDERBOLTS</span>
            </div>
            <div className="winner-item">
              <span className="season-label">Season 1</span>
              <span className="team-name">THUNDERBOLTS</span>
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <button className="continue-button" onClick={onContinue}>
          LET'S Begin
        </button>
      </div>
    </div>
  );
}

export default Welcome;

