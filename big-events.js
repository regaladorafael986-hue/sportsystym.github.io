// ============================================================
// Big Event (Intramurals) Dashboard & Management
// ============================================================

let __activeBigEvent = null; // currently open big event ID

// ---- Open Big Event Dashboard ----
function openBigEvent(eventId) {
  if (!canAccessBigEvent(eventId)) {
    alert('Access denied. This event belongs to another campus.');
    return;
  }
  // Organizer: check assigned events
  if (currentUser && currentUser.role === 'organizer' && currentUser.assignedEvents && currentUser.assignedEvents.length > 0) {
    if (!currentUser.assignedEvents.includes(eventId)) {
      alert('Access denied. You are not assigned to this event.');
      return;
    }
  }
  __activeBigEvent = eventId;
  show('bigEventDash');
  renderBigEventDashboard();
}

function closeBigEventDash() {
  __activeBigEvent = null;
  show('tournaments');
}

// ---- Main Dashboard Renderer ----
function renderBigEventDashboard() {
  const container = document.getElementById('bigEventDashContent');
  if (!container) return;
  const bigEvents = getVisibleBigEvents();
  const ev = bigEvents.find(e => e.id === __activeBigEvent);
  if (!ev) { container.innerHTML = '<p>Event not found.</p>'; return; }

  const tournaments = getVisibleTournaments();
  const related = tournaments.map((t, i) => ({ ...t, _idx: i })).filter(t => t.bigEventId === ev.id);
  const totalSports = ev.sports.length;
  const totalUnits = ev.units.length;
  const completedCount = related.filter(t => {
    if (t.format === 'roundrobin' && t.roundRobin) return t.roundRobin.every(m => m.played);
    if (t.bracket) {
      const lastRound = Array.isArray(t.bracket) ? t.bracket[t.bracket.length - 1] : (t.bracket.winners ? t.bracket.winners[t.bracket.winners.length - 1] : null);
      return lastRound && lastRound[0] && lastRound[0].winner;
    }
    return false;
  }).length;
  const dates = ev.startDate ? (ev.endDate ? `${ev.startDate} → ${ev.endDate}` : ev.startDate) : '';

  // Build overall standings
  const unitStats = computeOverallStandings(ev, related);

  let html = '';

  // ---- Header ----
  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
    <div>
      <button class="form-btn secondary-btn" onclick="closeBigEventDash()" style="margin:0 12px 0 0;padding:6px 14px;font-size:0.85rem">&larr; Back</button>
      <span style="font-size:1.5rem;font-weight:800;color:var(--primary)">${ev.name}</span>
      <span style="color:var(--muted-text);font-size:0.9rem;margin-left:8px">${dates}</span>
    </div>
    <div style="display:flex;gap:8px">
      <button class="form-btn" onclick="openEditBigEvent('${ev.id}')" style="padding:6px 14px;font-size:0.85rem;margin:0">✏️ Edit Event</button>
      <button class="form-btn danger-btn" onclick="deleteBigEvent('${ev.id}')" style="padding:6px 14px;font-size:0.85rem;margin:0">🗑️ Delete</button>
    </div>
  </div>`;

  // ---- Stats Row ----
  html += `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
    <div class="card" style="flex:1;min-width:140px;padding:14px;display:flex;align-items:center;gap:12px">
      <div style="font-size:1.8rem">🏅</div>
      <div><div style="font-size:0.75rem;text-transform:uppercase;color:var(--muted-text);font-weight:600">Sports</div><div style="font-size:1.4rem;font-weight:800">${totalSports}</div></div>
    </div>
    <div class="card" style="flex:1;min-width:140px;padding:14px;display:flex;align-items:center;gap:12px">
      <div style="font-size:1.8rem">🏫</div>
      <div><div style="font-size:0.75rem;text-transform:uppercase;color:var(--muted-text);font-weight:600">Units</div><div style="font-size:1.4rem;font-weight:800">${totalUnits}</div></div>
    </div>
    <div class="card" style="flex:1;min-width:140px;padding:14px;display:flex;align-items:center;gap:12px">
      <div style="font-size:1.8rem">📊</div>
      <div><div style="font-size:0.75rem;text-transform:uppercase;color:var(--muted-text);font-weight:600">Progress</div><div style="font-size:1.4rem;font-weight:800">${completedCount}/${related.length}</div></div>
    </div>
  </div>`;

  // ---- Tab Bar ----
  const activeTab = window.__beTab || 'sports';
  const tabs = [
    { id: 'sports', label: '🏅 Sports & Brackets' },
    { id: 'teams', label: '👥 Teams & Players' },
    { id: 'standings', label: '🏆 Overall Standings' },
  ];
  html += `<div style="display:flex;gap:4px;border-bottom:2px solid rgba(16,24,40,0.06);margin-bottom:20px">`;
  tabs.forEach(t => {
    const isActive = activeTab === t.id;
    html += `<button onclick="window.__beTab='${t.id}';renderBigEventDashboard()" style="padding:10px 18px;border:none;background:${isActive ? 'var(--primary)' : 'transparent'};color:${isActive ? '#fff' : 'var(--muted-text)'};border-radius:8px 8px 0 0;font-weight:600;cursor:pointer;font-size:0.9rem;transition:all 0.15s">${t.label}</button>`;
  });
  html += `</div>`;

  // ---- Tab Content ----
  if (activeTab === 'sports') {
    html += renderBeSportsTab(ev, related);
  } else if (activeTab === 'teams') {
    html += renderBeTeamsTab(ev, related);
  } else if (activeTab === 'standings') {
    html += renderBeStandingsTab(ev, related, unitStats);
  }

  container.innerHTML = html;
}

// ============================================================
// TAB 1: Sports & Brackets
// ============================================================
function renderBeSportsTab(ev, related) {
  let html = '';
  ev.sports.forEach(sport => {
    const tour = related.find(t => t.sport === sport);
    const tIdx = tour ? tour._idx : null;
    const hasBracket = tour && !!(tour.bracket || tour.roundRobin || tour.groupStage);
    const teamCount = tour && tour.teams ? tour.teams.length : 0;
    const format = tour ? (tour.format || 'single') : 'single';
    const formatNames = { single: 'Single Elim', double: 'Double Elim', roundrobin: 'Round Robin', groupknockout: 'Group + Knockout' };

    // Check completion
    let isComplete = false;
    if (tour) {
      if (format === 'roundrobin' && tour.roundRobin) isComplete = tour.roundRobin.every(m => m.played);
      else if (tour.bracket) {
        const lr = Array.isArray(tour.bracket) ? tour.bracket[tour.bracket.length - 1] : (tour.bracket.winners ? tour.bracket.winners[tour.bracket.winners.length - 1] : null);
        isComplete = lr && lr[0] && !!lr[0].winner;
      }
    }
    const statusBadge = !tour ? '<span style="color:var(--danger);font-size:0.8rem">No tournament</span>'
      : !hasBracket ? '<span style="color:var(--muted-text);font-size:0.8rem">No bracket</span>'
      : isComplete ? '<span style="color:var(--success);font-weight:700;font-size:0.8rem">✅ Complete</span>'
      : '<span style="color:var(--accent);font-size:0.8rem">🔄 In Progress</span>';

    html += `<div class="card" style="margin-bottom:16px;border-left:4px solid ${isComplete ? 'var(--success)' : hasBracket ? 'var(--accent)' : 'var(--muted-text)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <strong style="font-size:1.1rem;color:var(--primary)">${sport}</strong>
          <span style="margin-left:8px;font-size:0.8rem;color:var(--muted-text)">${formatNames[format]} · ${teamCount} teams</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          ${statusBadge}`;

    if (tIdx !== null) {
      if (!hasBracket) {
        html += `<button class="form-btn" onclick="beDashGenBracket(${tIdx})" style="padding:5px 12px;font-size:0.8rem;margin:0">Generate Bracket</button>`;
      }
      // Format selector
      html += `<select onchange="beDashChangeFormat(${tIdx}, this.value)" style="padding:5px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.8rem">
        <option value="single" ${format === 'single' ? 'selected' : ''}>Single Elim</option>
        <option value="double" ${format === 'double' ? 'selected' : ''}>Double Elim</option>
        <option value="roundrobin" ${format === 'roundrobin' ? 'selected' : ''}>Round Robin</option>
        <option value="groupknockout" ${format === 'groupknockout' ? 'selected' : ''}>Group+KO</option>
      </select>`;
    }

    html += `</div></div>`;

    // Bracket display
    if (tIdx !== null && hasBracket) {
      html += `<div class="bracket-wrapper" style="max-height:400px;overflow:auto">`;
      html += renderClassicBracketForBE(tour, tIdx);
      html += `</div>`;
    } else if (tIdx !== null && !hasBracket) {
      html += `<div style="padding:20px;text-align:center;color:var(--muted-text)">Click <strong>"Generate Bracket"</strong> to create the bracket.</div>`;
    } else {
      html += `<div style="padding:20px;text-align:center;color:var(--muted-text)">No tournament found for this sport. It may need to be recreated.</div>`;
    }

    html += `</div>`;
  });
  return html;
}

// Render a bracket for a tournament inline (reuses renderClassicBracket)
function renderClassicBracketForBE(tour, tIdx) {
  if (tour.format === 'roundrobin' && tour.roundRobin) {
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">';
    tour.roundRobin.forEach((m, i) => {
      const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
      const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
      const winnerName = m.winner ? (g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name : null;
      h += `<div class="rr-match"><div class="rr-match-header">Match ${i + 1}</div><div class="rr-match-teams">`;
      h += `<div class="rr-team"><span class="rr-team-name${m.winner === m.a ? ' winner' : (m.played && m.winner !== m.a ? ' loser' : '')}">${aName}</span></div>`;
      h += `<div class="rr-team"><span class="rr-team-name${m.winner === m.b ? ' winner' : (m.played && m.winner !== m.b ? ' loser' : '')}">${bName}</span></div></div>`;
      if (m.played) {
        h += `<div class="rr-winner-badge">✅ ${winnerName}</div>`;
      } else {
        h += `<div class="rr-match-footer">`;
        h += `<button class="form-btn" onclick="beSetRRWinner(${tIdx},${i},'a')" style="padding:4px 10px;font-size:0.8rem;margin:0">✔ ${aName}</button>`;
        h += `<button class="form-btn" onclick="beSetRRWinner(${tIdx},${i},'b')" style="padding:4px 10px;font-size:0.8rem;margin:0">✔ ${bName}</button>`;
        h += `</div>`;
      }
      h += `</div>`;
    });
    h += '</div>';
    return h;
  }
  // Single / Double / Group+KO — use renderClassicBracket
  if (tour.format === 'double' && tour.bracket && tour.bracket.winners) {
    let h = '<div style="margin-bottom:8px"><strong>Winners Bracket</strong></div>';
    h += renderClassicBracket(tour.bracket.winners, tIdx, 'w', tour);
    h += '<div style="margin-top:12px;margin-bottom:8px"><strong>Losers Bracket</strong></div>';
    h += renderClassicBracket(tour.bracket.losers || [], tIdx, 'l', tour);
    return h;
  }
  if (Array.isArray(tour.bracket)) {
    return renderClassicBracket(tour.bracket, tIdx, 's', tour);
  }
  if (tour.groupStage) {
    let h = '<div style="margin-bottom:8px"><strong>Group Stage</strong></div>';
    Object.keys(tour.groupStage).forEach(gname => {
      h += `<div style="margin-bottom:6px"><em>${gname}</em>`;
      (tour.groupStage[gname] || []).forEach((m, i) => {
        const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
        const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
        h += `<div style="margin:3px 0">${aName} vs ${bName}`;
        if (m.played) h += ` — Winner: ${(g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name}`;
        h += `</div>`;
      });
      h += `</div>`;
    });
    return h;
  }
  return '<div style="color:var(--muted-text)">No bracket data</div>';
}

// Generate bracket for a sport from the dashboard
function beDashGenBracket(tIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIdx];
  if (!t) return;
  if (t.bracket || t.roundRobin || t.groupStage) {
    if (!confirm('Regenerate bracket? This will overwrite the existing one.')) return;
  }
  const teamIds = t.teams || [];
  if (teamIds.length < 2) return alert('Need at least 2 teams to generate a bracket.');
  const format = t.format || 'single';
  const result = createBracket(teamIds, format, { autoSeed: t.autoSeed !== false, bestOf: t.bestOf || 1 });
  if (format === 'roundrobin') {
    t.roundRobin = result;
    delete t.bracket;
  } else if (format === 'groupknockout') {
    t.groupStage = result.groupStage;
    t.bracket = result.bracket;
    delete t.roundRobin;
  } else if (format === 'double') {
    t.bracket = result;
    delete t.roundRobin;
    delete t.groupStage;
  } else {
    t.bracket = result;
    delete t.roundRobin;
    delete t.groupStage;
  }
  s('tournaments', tournaments);
  renderBigEventDashboard();
}

// Change format for a sport
function beDashChangeFormat(tIdx, newFormat) {
  const tournaments = g('tournaments');
  const t = tournaments[tIdx];
  if (!t) return;
  const oldFormat = t.format;
  if (newFormat === oldFormat) return;
  if ((t.bracket || t.roundRobin || t.groupStage) && !confirm(`Change format from "${oldFormat}" to "${newFormat}"? This will reset the bracket.`)) {
    renderBigEventDashboard();
    return;
  }
  t.format = newFormat;
  delete t.bracket;
  delete t.roundRobin;
  delete t.groupStage;
  s('tournaments', tournaments);
  renderBigEventDashboard();
}

// Set RR winner from dashboard
function beSetRRWinner(tIdx, matchIdx, slot) {
  const tournaments = g('tournaments');
  const t = tournaments[tIdx];
  if (!t || !t.roundRobin) return;
  const m = t.roundRobin[matchIdx];
  if (!m || m.played) return;
  m.played = true;
  m.winner = m[slot];
  s('tournaments', tournaments);
  renderBigEventDashboard();
  if (typeof loadStandings === 'function') loadStandings();
}

// ============================================================
// TAB 2: Teams & Players
// ============================================================
function renderBeTeamsTab(ev, related) {
  let html = '';
  ev.sports.forEach(sport => {
    const tour = related.find(t => t.sport === sport);
    const teamIds = tour && tour.teams ? tour.teams : [];
    const allTeams = getVisibleTeams();
    const allPlayers = getVisiblePlayers();
    const teams = teamIds.map(id => allTeams.find(t => t.id === id)).filter(Boolean);

    html += `<div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong style="font-size:1.05rem;color:var(--primary)">${sport}</strong>
        <span style="font-size:0.85rem;color:var(--muted-text)">${teams.length} teams</span>
      </div>`;

    if (teams.length === 0) {
      html += `<div style="padding:12px;color:var(--muted-text);text-align:center">No teams for this sport.</div>`;
    } else {
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">`;
      teams.forEach(team => {
        const teamPlayers = allPlayers.filter(p => p.team === team.id);
        const positions = getSportPositions(team.sport);
        const posOpts = '<option value="">Pos</option>' + positions.map(p => `<option value="${p}">${p}</option>`).join('');
        const safeId = team.id.replace(/[^a-zA-Z0-9_]/g, '_');

        html += `<div style="background:var(--bg);border:1px solid rgba(16,24,40,0.06);border-radius:8px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong>${team.name}</strong>
            <span style="font-size:0.8rem;color:var(--muted-text)">${teamPlayers.length} players</span>
          </div>
          <!-- Quick add -->
          <div style="display:flex;gap:4px;margin-bottom:8px">
            <input id="be_pn_${safeId}" placeholder="Player name" style="flex:1;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:0.8rem;margin:0">
            <select id="be_pp_${safeId}" style="width:80px;padding:5px;border:1px solid #ddd;border-radius:4px;font-size:0.8rem;margin:0">${posOpts}</select>
            <button onclick="beQuickAddPlayer('${team.id}','${safeId}')" style="background:var(--primary);color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.8rem;white-space:nowrap">+</button>
          </div>`;

        if (teamPlayers.length > 0) {
          html += `<div style="max-height:120px;overflow-y:auto;font-size:0.85rem">`;
          teamPlayers.forEach(p => {
            const pIdx = g('players').findIndex(pp => pp.name === p.name && pp.team === p.team && pp.sport === p.sport);
            html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(16,24,40,0.04)">
              <span>${p.name} <span style="color:var(--muted-text)">(${p.position || 'N/A'})</span></span>
              <span>
                <button onclick="openEditPlayer(${pIdx})" style="background:none;border:none;cursor:pointer;font-size:0.8rem;color:var(--primary)">✏️</button>
                <button onclick="beDeletePlayer(${pIdx})" style="background:none;border:none;cursor:pointer;font-size:0.8rem;color:var(--danger)">🗑️</button>
              </span>
            </div>`;
          });
          html += `</div>`;
        } else {
          html += `<div style="text-align:center;color:var(--muted-text);font-size:0.8rem;padding:6px 0">No players yet</div>`;
        }

        html += `</div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  });
  return html;
}

function beQuickAddPlayer(teamId, safeId) {
  const nameEl = document.getElementById('be_pn_' + safeId);
  const posEl = document.getElementById('be_pp_' + safeId);
  if (!nameEl || !posEl) return;
  const name = nameEl.value.trim();
  const position = posEl.value;
  if (!name) return alert('Enter a player name.');
  if (!position) return alert('Select a position.');
  const teamObj = g('teams').find(t => t.id === teamId);
  if (!teamObj) return;
  const p = g('players');
  p.push({ name: name, team: teamId, position: position, sport: teamObj.sport, campus: getTeamCampus(teamObj) });
  s('players', p);
  renderBigEventDashboard();
}

function beDeletePlayer(pIdx) {
  if (!confirm('Delete this player?')) return;
  const players = g('players');
  if (pIdx < 0 || pIdx >= players.length) return;
  players.splice(pIdx, 1);
  s('players', players);
  renderBigEventDashboard();
}

// ============================================================
// TAB 3: Overall Intramurals Standings
// ============================================================
function computeOverallStandings(ev, related) {
  const unitStats = {};
  ev.units.forEach(unit => {
    unitStats[unit] = { unit: unit, wins: 0, losses: 0, gold: 0, silver: 0, bronze: 0, points: 0 };
  });

  related.forEach(tour => {
    // Count wins per unit from matches
    const allMatches = [];
    if (tour.format === 'roundrobin' && tour.roundRobin) {
      tour.roundRobin.forEach(m => { if (m.played) allMatches.push(m); });
    } else if (tour.bracket) {
      const rounds = Array.isArray(tour.bracket) ? tour.bracket : (tour.bracket.winners || []);
      rounds.forEach(round => (round || []).forEach(m => { if (m && m.winner) allMatches.push(m); }));
      if (tour.bracket.losers) {
        tour.bracket.losers.forEach(round => (round || []).forEach(m => { if (m && m.winner) allMatches.push(m); }));
      }
    }

    // Map team IDs to unit names
    const teamToUnit = {};
    const allTeams = g('teams');
    (tour.teams || []).forEach(tid => {
      const t = allTeams.find(tm => tm.id === tid);
      if (t && t.group) teamToUnit[tid] = t.group;
      else if (t) teamToUnit[tid] = t.name;
    });

    allMatches.forEach(m => {
      const winUnit = teamToUnit[m.winner];
      const loser = m.winner === m.a ? m.b : m.a;
      const loseUnit = teamToUnit[loser];
      if (winUnit && unitStats[winUnit]) unitStats[winUnit].wins++;
      if (loseUnit && unitStats[loseUnit]) unitStats[loseUnit].losses++;
    });

    // Medal allocation: find tournament champion (1st), runner-up (2nd), 3rd place
    let champion = null;
    if (tour.format === 'roundrobin' && tour.roundRobin && tour.roundRobin.every(m => m.played)) {
      // Most wins in RR
      const rrWins = {};
      tour.roundRobin.forEach(m => { if (m.winner) rrWins[m.winner] = (rrWins[m.winner] || 0) + 1; });
      const sorted = Object.entries(rrWins).sort((a, b) => b[1] - a[1]);
      if (sorted[0]) champion = sorted[0][0];
      if (sorted[0]) { const u = teamToUnit[sorted[0][0]]; if (u && unitStats[u]) { unitStats[u].gold++; unitStats[u].points += 3; } }
      if (sorted[1]) { const u = teamToUnit[sorted[1][0]]; if (u && unitStats[u]) { unitStats[u].silver++; unitStats[u].points += 2; } }
      if (sorted[2]) { const u = teamToUnit[sorted[2][0]]; if (u && unitStats[u]) { unitStats[u].bronze++; unitStats[u].points += 1; } }
    } else if (tour.bracket) {
      const lr = Array.isArray(tour.bracket) ? tour.bracket[tour.bracket.length - 1] : (tour.bracket.winners ? tour.bracket.winners[tour.bracket.winners.length - 1] : null);
      if (lr && lr[0] && lr[0].winner) {
        const champUnit = teamToUnit[lr[0].winner];
        if (champUnit && unitStats[champUnit]) { unitStats[champUnit].gold++; unitStats[champUnit].points += 3; }
        const runnerUp = lr[0].winner === lr[0].a ? lr[0].b : lr[0].a;
        if (runnerUp) {
          const ruUnit = teamToUnit[runnerUp];
          if (ruUnit && unitStats[ruUnit]) { unitStats[ruUnit].silver++; unitStats[ruUnit].points += 2; }
        }
        // 3rd place: losers of semifinals
        const semis = Array.isArray(tour.bracket) ? tour.bracket[tour.bracket.length - 2] : (tour.bracket.winners ? tour.bracket.winners[tour.bracket.winners.length - 2] : null);
        if (semis) {
          semis.forEach(m => {
            if (m && m.winner) {
              const loser = m.winner === m.a ? m.b : m.a;
              if (loser && loser !== runnerUp) {
                const bUnit = teamToUnit[loser];
                if (bUnit && unitStats[bUnit]) { unitStats[bUnit].bronze++; unitStats[bUnit].points += 1; }
              }
            }
          });
        }
      }
    }
  });

  return Object.values(unitStats).sort((a, b) => b.points - a.points || b.gold - a.gold || b.wins - a.wins);
}

function renderBeStandingsTab(ev, related, unitStats) {
  let html = '<div class="card">';
  html += '<h3 style="margin-bottom:12px;display:flex;align-items:center;gap:8px">🏆 Overall Intramurals Standings</h3>';
  html += '<p style="color:var(--muted-text);font-size:0.85rem;margin-bottom:12px">Units ranked by total points across all sports. Gold=3pts, Silver=2pts, Bronze=1pt.</p>';

  html += '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:0.9rem"><thead>';
  html += '<tr style="background:#fafbfd"><th style="padding:10px;text-align:center;width:40px">#</th><th style="padding:10px;text-align:left">Unit</th><th style="padding:10px;text-align:center">🥇</th><th style="padding:10px;text-align:center">🥈</th><th style="padding:10px;text-align:center">🥉</th><th style="padding:10px;text-align:center">W</th><th style="padding:10px;text-align:center">L</th><th style="padding:10px;text-align:center;font-weight:800">PTS</th></tr>';
  html += '</thead><tbody>';

  unitStats.forEach((u, i) => {
    const rowBg = i === 0 ? 'rgba(253,224,71,0.15)' : i === 1 ? 'rgba(192,192,192,0.1)' : i === 2 ? 'rgba(205,127,50,0.08)' : '';
    html += `<tr style="${rowBg ? 'background:' + rowBg : ''}">
      <td style="padding:10px;text-align:center;font-weight:700">${i + 1}</td>
      <td style="padding:10px;font-weight:600">${u.unit}</td>
      <td style="padding:10px;text-align:center">${u.gold || '-'}</td>
      <td style="padding:10px;text-align:center">${u.silver || '-'}</td>
      <td style="padding:10px;text-align:center">${u.bronze || '-'}</td>
      <td style="padding:10px;text-align:center;color:var(--success);font-weight:600">${u.wins}</td>
      <td style="padding:10px;text-align:center;color:var(--danger)">${u.losses}</td>
      <td style="padding:10px;text-align:center;font-weight:800;font-size:1rem">${u.points}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';

  // Per-sport breakdown
  html += '<div style="margin-top:20px"><h4 style="margin-bottom:10px">📊 Per-Sport Results</h4>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">';
  ev.sports.forEach(sport => {
    const tour = related.find(t => t.sport === sport);
    let champion = null;
    if (tour) {
      if (tour.format === 'roundrobin' && tour.roundRobin && tour.roundRobin.every(m => m.played)) {
        const rrWins = {};
        tour.roundRobin.forEach(m => { if (m.winner) rrWins[m.winner] = (rrWins[m.winner] || 0) + 1; });
        const sorted = Object.entries(rrWins).sort((a, b) => b[1] - a[1]);
        if (sorted[0]) champion = sorted[0][0];
      } else if (tour.bracket) {
        const lr = Array.isArray(tour.bracket) ? tour.bracket[tour.bracket.length - 1] : (tour.bracket.winners ? tour.bracket.winners[tour.bracket.winners.length - 1] : null);
        if (lr && lr[0] && lr[0].winner) champion = lr[0].winner;
      }
    }
    const champName = champion ? (g('teams').find(tm => tm.id === champion) || { name: champion }).name : '—';
    const hasBracket = tour && !!(tour.bracket || tour.roundRobin || tour.groupStage);
    html += `<div style="background:var(--bg);padding:10px;border-radius:8px;border:1px solid rgba(16,24,40,0.04)">
      <div style="font-weight:600;margin-bottom:4px">${sport}</div>
      <div style="font-size:0.85rem;color:${champion ? 'var(--success)' : 'var(--muted-text)'}">🏆 ${champion ? champName : (hasBracket ? 'In Progress' : 'Not Started')}</div>
    </div>`;
  });
  html += '</div></div>';

  html += '</div>';
  return html;
}

// ============================================================
// Edit Big Event
// ============================================================
let __beEditCustomGames = [];
let __beEditCustomUnits = [];
let __beEditEventId = null;

function openEditBigEvent(eventId) {
  const bigEvents = g('bigEvents') || [];
  const ev = bigEvents.find(e => e.id === eventId);
  if (!ev) return alert('Event not found');

  __beEditEventId = eventId;
  __beEditCustomGames = (ev.sports || []).slice();
  __beEditCustomUnits = (ev.units || []).slice();

  let modal = document.getElementById('beEditModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'beEditModal';
    document.body.appendChild(modal);
  }

  const sportList = Object.keys(sports);
  const sportsChecks = sportList.map(sp => {
    const checked = ev.sports.includes(sp) ? 'checked' : '';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid rgba(16,24,40,0.15);border-radius:4px;background:var(--surface);color:var(--text)">
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--text)"><input type="checkbox" class="be-edit-sport" value="${sp}" ${checked}> ${sp}</label>
    </span>`;
  }).join('');

  // Existing groups from teams
  const teams = g('teams');
  const groupsMap = {};
  teams.forEach(t => {
    const grp = (t.group && t.group.trim()) ? t.group.trim() : null;
    if (grp) { groupsMap[grp] = (groupsMap[grp] || 0) + 1; }
  });
  const existingGroups = Object.keys(groupsMap);
  const existingGroupsHtml = existingGroups.length > 0
    ? existingGroups.map(grp => {
        const checked = ev.units.includes(grp) ? 'checked' : '';
        return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.9rem"><input type="checkbox" class="be-edit-existing-unit" value="${grp}" ${checked} onchange="beEditToggleExistingUnit(this)"> ${grp} <span style="color:var(--muted-text);font-size:0.8rem">(${groupsMap[grp]} teams)</span></label>`;
      }).join('')
    : '<p style="color:var(--muted-text);font-size:0.85rem">No existing groups.</p>';

  modal.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998" onclick="closeEditBigEvent()"></div>
    <div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:560px;max-height:85vh;overflow-y:auto;background:var(--surface);border-radius:12px;padding:24px;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,0.15)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px">✏️ Edit Big Event</h3>
        <button onclick="closeEditBigEvent()" class="form-btn secondary-btn" style="padding:4px 12px;margin:0">✕ Close</button>
      </div>

      <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px">Event Name</label>
      <input id="beEditName" value="${ev.name}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:12px">

      <!-- Games/Sports Section -->
      <div style="margin-bottom:12px;padding:12px;border:1px solid rgba(16,24,40,0.1);border-radius:8px;background:var(--bg)">
        <label style="font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:6px">🎮 Games/Sports</label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input id="beEditNewGame" placeholder="Add game (e.g., Sepak Takraw)" style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.85rem" onkeydown="if(event.key==='Enter'){event.preventDefault();beEditAddGame()}">
          <button class="form-btn" type="button" onclick="beEditAddGame()" style="padding:6px 12px;font-size:0.85rem;margin:0">+ Add</button>
        </div>
        <div id="beEditGamesList" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
        <div style="margin-top:8px;border-top:1px dashed rgba(16,24,40,0.15);padding-top:8px">
          <label style="font-size:0.85rem;color:var(--muted-text)">Or select existing sports:</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${sportsChecks}</div>
        </div>
      </div>

      <!-- Units Section -->
      <div style="margin-bottom:12px;padding:12px;border:1px solid rgba(16,24,40,0.1);border-radius:8px;background:var(--bg)">
        <label style="font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:6px">🏫 Participating Units</label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input id="beEditNewUnit" placeholder="Unit name (e.g., Unit 1)" style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.85rem" onkeydown="if(event.key==='Enter'){event.preventDefault();beEditAddUnit()}">
          <button class="form-btn" type="button" onclick="beEditAddUnit()" style="padding:6px 12px;font-size:0.85rem;margin:0">+ Add</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="form-btn secondary-btn" type="button" onclick="beEditQuickUnits(4)" style="padding:5px 10px;font-size:0.8rem;margin:0">+ Unit 1-4</button>
          <button class="form-btn secondary-btn" type="button" onclick="beEditQuickUnits(6)" style="padding:5px 10px;font-size:0.8rem;margin:0">+ Unit 1-6</button>
          <button class="form-btn secondary-btn" type="button" onclick="beEditQuickUnits(8)" style="padding:5px 10px;font-size:0.8rem;margin:0">+ Unit 1-8</button>
        </div>
        <div id="beEditUnitsList" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
        <div style="margin-top:8px;border-top:1px dashed rgba(16,24,40,0.15);padding-top:8px">
          <label style="font-size:0.85rem;color:var(--muted-text)">Or select existing groups:</label>
          <div style="max-height:100px;overflow-y:auto;margin-top:6px">${existingGroupsHtml}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div style="flex:1">
          <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px">Start Date</label>
          <input id="beEditStart" type="date" value="${ev.startDate || ''}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px">
        </div>
        <div style="flex:1">
          <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px">End Date</label>
          <input id="beEditEnd" type="date" value="${ev.endDate || ''}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px">
        </div>
      </div>

      <button class="form-btn accent-btn" onclick="saveBigEventEdit('${ev.id}')" style="width:100%;margin:0">💾 Save Changes</button>
    </div>`;
  modal.style.display = 'block';
  beEditRenderGames();
  beEditRenderUnits();
}

function closeEditBigEvent() {
  const modal = document.getElementById('beEditModal');
  if (modal) modal.style.display = 'none';
  __beEditEventId = null;
  __beEditCustomGames = [];
  __beEditCustomUnits = [];
}

function beEditAddGame() {
  const input = document.getElementById('beEditNewGame');
  const game = input.value.trim();
  if (!game) return;
  if (__beEditCustomGames.includes(game)) return alert('Game already added');
  if (!sports[game]) {
    saveCustomSport(game, 'team', ['Player']);
  }
  __beEditCustomGames.push(game);
  input.value = '';
  beEditRenderGames();
  // Also check the checkbox if it exists
  const cb = document.querySelector(`.be-edit-sport[value="${game}"]`);
  if (cb) cb.checked = true;
}

function beEditRemoveGame(game) {
  __beEditCustomGames = __beEditCustomGames.filter(g => g !== game);
  beEditRenderGames();
  // Also uncheck the checkbox if it exists
  const cb = document.querySelector(`.be-edit-sport[value="${game}"]`);
  if (cb) cb.checked = false;
}

function beEditRenderGames() {
  const container = document.getElementById('beEditGamesList');
  if (!container) return;
  if (__beEditCustomGames.length === 0) {
    container.innerHTML = '<span style="color:var(--muted-text);font-size:0.85rem">No games added yet</span>';
    return;
  }
  container.innerHTML = __beEditCustomGames.map(game =>
    `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--primary);color:#fff;border-radius:6px;font-size:0.85rem">
      🎮 ${game}
      <button onclick="beEditRemoveGame('${game.replace(/'/g, "\\'")}')" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;padding:0;line-height:1">×</button>
    </span>`
  ).join('');
}

function beEditAddUnit() {
  const input = document.getElementById('beEditNewUnit');
  const unit = input.value.trim();
  if (!unit) return;
  if (__beEditCustomUnits.includes(unit)) return alert('Unit already added');
  __beEditCustomUnits.push(unit);
  input.value = '';
  beEditRenderUnits();
}

function beEditRemoveUnit(unit) {
  __beEditCustomUnits = __beEditCustomUnits.filter(u => u !== unit);
  beEditRenderUnits();
  // Uncheck existing group checkbox if present
  const cb = document.querySelector(`.be-edit-existing-unit[value="${unit}"]`);
  if (cb) cb.checked = false;
}

function beEditQuickUnits(count) {
  for (let i = 1; i <= count; i++) {
    const unit = 'Unit ' + i;
    if (!__beEditCustomUnits.includes(unit)) __beEditCustomUnits.push(unit);
  }
  beEditRenderUnits();
}

function beEditToggleExistingUnit(cb) {
  const unit = cb.value;
  if (cb.checked) {
    if (!__beEditCustomUnits.includes(unit)) __beEditCustomUnits.push(unit);
  } else {
    __beEditCustomUnits = __beEditCustomUnits.filter(u => u !== unit);
  }
  beEditRenderUnits();
}

function beEditRenderUnits() {
  const container = document.getElementById('beEditUnitsList');
  if (!container) return;
  if (__beEditCustomUnits.length === 0) {
    container.innerHTML = '<span style="color:var(--muted-text);font-size:0.85rem">No units added yet</span>';
    return;
  }
  container.innerHTML = __beEditCustomUnits.map(unit =>
    `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--success);color:#fff;border-radius:6px;font-size:0.85rem">
      🏫 ${unit}
      <button onclick="beEditRemoveUnit('${unit.replace(/'/g, "\\'")}')" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;padding:0;line-height:1">×</button>
    </span>`
  ).join('');
}

function saveBigEventEdit(eventId) {
  const bigEvents = g('bigEvents') || [];
  const evIdx = bigEvents.findIndex(e => e.id === eventId);
  if (evIdx === -1) return alert('Event not found');
  const ev = bigEvents[evIdx];

  const newName = document.getElementById('beEditName').value.trim();
  if (!newName) return alert('Event name is required');

  // Gather sports: custom games list + checked existing sports (merged, unique)
  const checkedSports = Array.from(document.querySelectorAll('.be-edit-sport:checked')).map(cb => cb.value);
  const newSports = [...new Set([...__beEditCustomGames, ...checkedSports])];
  if (newSports.length === 0) return alert('Add at least one game/sport');

  const newUnits = __beEditCustomUnits.slice();
  if (newUnits.length === 0) return alert('Add at least one unit');

  const newStart = document.getElementById('beEditStart').value;
  const newEnd = document.getElementById('beEditEnd').value;

  // Register new sports if they don't exist
  newSports.forEach(game => {
    if (!sports[game]) {
      saveCustomSport(game, 'team', ['Player']);
    }
  });

  // Determine added/removed sports and units
  const addedSports = newSports.filter(s => !ev.sports.includes(s));
  const removedSports = ev.sports.filter(s => !newSports.includes(s));
  const addedUnits = newUnits.filter(u => !ev.units.includes(u));

  const tournaments = g('tournaments');
  let allTeams = g('teams');

  // Remove tournaments for removed sports
  if (removedSports.length > 0) {
    const toRemove = tournaments.filter(t => t.bigEventId === eventId && removedSports.includes(t.sport));
    toRemove.forEach(t => {
      const idx = tournaments.indexOf(t);
      if (idx !== -1) tournaments.splice(idx, 1);
    });
  }

  // Add new sports: create teams + tournaments
  addedSports.forEach(sport => {
    if (!sports[sport]) {
      saveCustomSport(sport, 'team', ['Player']);
    }
    const gameTeamIds = [];
    newUnits.forEach(unit => {
      const teamId = buildCampusTeamId(ev.campus || DEFAULT_CAMPUS, sport, unit);
      if (!allTeams.find(t => t.id === teamId)) {
        allTeams.push({ id: teamId, name: unit, sport: sport, campus: ev.campus || DEFAULT_CAMPUS, group: unit });
      }
      gameTeamIds.push(teamId);
    });
    tournaments.push({
      name: `${newName} - ${sport}`,
      sport: sport,
      teams: gameTeamIds,
      startDate: newStart,
      endDate: newEnd,
      format: 'single',
      bestOf: 1,
      bigEventId: eventId,
      campus: ev.campus || DEFAULT_CAMPUS
    });
  });

  // Add new units: add teams to existing sport tournaments
  if (addedUnits.length > 0) {
    newSports.forEach(sport => {
      addedUnits.forEach(unit => {
        const teamId = buildCampusTeamId(ev.campus || DEFAULT_CAMPUS, sport, unit);
        if (!allTeams.find(t => t.id === teamId)) {
          allTeams.push({ id: teamId, name: unit, sport: sport, campus: ev.campus || DEFAULT_CAMPUS, group: unit });
        }
        // Add to existing tournament
        const tour = tournaments.find(t => t.bigEventId === eventId && t.sport === sport);
        if (tour) {
          if (!tour.teams) tour.teams = [];
          if (!tour.teams.includes(teamId)) tour.teams.push(teamId);
          // Reset bracket since team count changed
          delete tour.bracket;
          delete tour.roundRobin;
          delete tour.groupStage;
        }
      });
    });
  }

  s('teams', allTeams);
  s('tournaments', tournaments);

  // Update event
  ev.name = newName;
  ev.sports = newSports;
  ev.units = newUnits;
  ev.startDate = newStart;
  ev.endDate = newEnd;

  // Update tournament names
  tournaments.forEach(t => {
    if (t.bigEventId === eventId) {
      t.name = `${newName} - ${t.sport}`;
      t.startDate = newStart;
      t.endDate = newEnd;
    }
  });
  s('tournaments', tournaments);
  s('bigEvents', bigEvents);

  closeEditBigEvent();
  renderBigEventDashboard();
  alert('Big Event updated!');
}
