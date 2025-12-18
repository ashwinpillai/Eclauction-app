import React, { useState } from 'react';
import Papa from 'papaparse';
import './DataSetup.css';

function DataSetup({ onDataSetup }) {
  const [playersUrl, setPlayersUrl] = useState('');
  const [teamsUrl, setTeamsUrl] = useState('');
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const parsePlayers = (results) => {
    console.log('Full results object:', results);
    console.log('Results.data length:', results.data?.length);
    console.log('Raw CSV results (first 3):', results.data?.slice(0, 3)); // Log first 3 rows
    if (results.data && results.data.length > 0) {
      console.log('First row BEFORE normalization:', results.data[0]);
      console.log('First row keys BEFORE normalization:', Object.keys(results.data[0] || {}));
    }
    if (!results.data || results.data.length === 0) {
      console.error('No data found in CSV results');
      setPlayers([]);
      return;
    }
    const data = results.data
      .map((row, idx) => {
        const r = normalizeRow(row);
        if (idx < 3) {
          console.log(`Row ${idx} normalized keys:`, Object.keys(r));
          console.log(`Row ${idx} normalized row object:`, r);
          console.log(`Row ${idx} - r.name:`, r.name, 'r.playername:', r.playername);
        }
        const name = r.name || r.playername || '';
        const role = r.role || r.playerrole || '';
        const category = r.category || r.playercategory || r.set || '';

        // New column in Players sheet: team / initial team assignment for pre-sold players
        const preAssignedTeamName = (r.team || r.initialteam || '').trim();

        const rawBasePrice = r.baseprice ?? '';
        const rawBasePriceStr = String(rawBasePrice || '').trim().toLowerCase();
        const isPreSold = rawBasePriceStr === 'sold';

        // For pre-sold players we still keep them in the data,
        // but treat basePrice as 0 so they don't affect auction pricing.
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
          isPreSold
        };
        if (idx < 3) console.log(`Row ${idx} parsed player:`, player);
        return player;
      })
      .filter(p => {
        const hasName = !!p.name;
        if (!hasName) console.log('Filtered out player (no name):', p);
        return hasName;
      }); // only require name, role and basePrice are optional
    console.log(`Parsed ${data.length} players from CSV`);
    setPlayers(data);
  };

  const parseTeams = (results) => {
    const data = results.data
      .map((row, idx) => {
        const r = normalizeRow(row);
        const name = r.teamname || r.team || '';
        const captain = r.captain || '';
        const viceCaptain = r.vicecaptain || r['vicecaptain'] || '';
        return {
          id: `team-${idx}`,
          name: String(name).trim(),
          captain: String(captain).trim(),
          viceCaptain: String(viceCaptain).trim()
        };
      })
      .filter(t => t.name);
    console.log(`Parsed ${data.length} teams from CSV`);
    setTeams(data);
  };

  const loadCsv = (url, parser, label) => {
    if (!url) { alert(`Please paste the published ${label} CSV URL`); return; }
    setLoading(true);
    Papa.parse(url, {
      download: true,
      header: true,
      complete: (results) => {
        const rows = results.data || [];
        
        // Check if HTML was returned instead of CSV (common with incorrect Google Sheets links)
        if (rows.length > 0) {
          const firstRow = rows[0];
          const firstRowKeys = Object.keys(firstRow || {});
          const firstValue = Object.values(firstRow || {})[0] || '';
          const firstKey = firstRowKeys[0] || '';
          
          // Check if any key or value contains HTML indicators
          const allValues = Object.values(firstRow || {}).join(' ').toLowerCase();
          const allKeys = firstRowKeys.join(' ').toLowerCase();
          const combinedCheck = (firstKey + ' ' + firstValue + ' ' + allValues + ' ' + allKeys).toLowerCase();
          
          if (combinedCheck.includes('<!doctype') || combinedCheck.includes('<html') || 
              combinedCheck.includes('script') || combinedCheck.includes('window[') ||
              combinedCheck.includes('ppconfig') || combinedCheck.includes('nonce=')) {
            alert(`Error: The URL returned HTML instead of CSV data.\n\nThis usually means you're using the wrong link. Please use the "Publish to web" CSV link:\n\n1. Open your Google Sheet\n2. Go to File → Share → Publish to web\n3. Select the sheet/tab you want to publish\n4. Choose "CSV" as the format (NOT "Web page")\n5. Click "Publish"\n6. Copy the CSV URL (it should contain "format=csv" or "output=csv")\n7. Make sure the sheet is publicly accessible`);
            setLoading(false);
            return;
          }
        }
        
        const nonEmpty = rows.filter(r =>
          Object.values(r || {}).some(v => String(v || '').trim() !== '')
        );
        if (nonEmpty.length === 0) {
          alert(`No rows found in the published ${label} CSV. Check the published link and that the sheet has data.`);
        } else {
          parser(results);
        }
        setLoading(false);
      },
      error: (error) => { alert(`Error loading ${label}: ` + error.message); setLoading(false); }
    });
  };

  const handleStartAuction = () => {
    if (!players.length) { alert('Load players first'); return; }
    if (!teams.length) { alert('Load teams first'); return; }
    onDataSetup(players, teams);
  };

  return (
    <div className="data-setup">
      <div className="setup-container">
        <h2>Data Setup (Published Google Sheets CSV)</h2>

        <div className="upload-section">
          <div className="upload-box">
            <h3>Players CSV (published link)</h3>
            <p>Use the “Publish to web” CSV link for the Players tab.</p>
            <input
              type="text"
              placeholder="Paste published CSV URL for players"
              value={playersUrl}
              onChange={(e) => setPlayersUrl(e.target.value)}
              className="sheet-url-input"
            />
            <button
              type="button"
              onClick={() => loadCsv(playersUrl, parsePlayers, 'players')}
              className="sheet-load-button"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load Players'}
            </button>
            {players.length > 0 && <div className="file-info">✓ {players.length} players loaded</div>}
          </div>

          <div className="upload-box">
            <h3>Teams CSV (published link)</h3>
            <p>Use the “Publish to web” CSV link for the Teams tab.</p>
            <input
              type="text"
              placeholder="Paste published CSV URL for teams"
              value={teamsUrl}
              onChange={(e) => setTeamsUrl(e.target.value)}
              className="sheet-url-input"
            />
            <button
              type="button"
              onClick={() => loadCsv(teamsUrl, parseTeams, 'teams')}
              className="sheet-load-button"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load Teams'}
            </button>
            {teams.length > 0 && <div className="file-info">✓ {teams.length} teams loaded</div>}
          </div>
        </div>

        <button
          className="start-button"
          onClick={handleStartAuction}
          disabled={loading || !players.length || !teams.length}
        >
          Start Auction
        </button>
      </div>
    </div>
  );
}

export default DataSetup;