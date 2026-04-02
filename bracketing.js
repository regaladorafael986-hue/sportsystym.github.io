// Bracketing module - Set Winners

// Check if a bracket match (teamA vs teamB) is scheduled for today
function isMatchScheduledToday(teamA, teamB) {
  if (!teamA || !teamB) return false;
  const matches = g('matches') || [];
  const today = new Date().toISOString().split('T')[0];
  return matches.some(m => 
    m.date === today && 
    m.status !== 'completed' &&
    ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA))
  );
}

// Check if ANY match for this tournament is scheduled for today
function isTournamentScheduledToday(tournament) {
  if (!tournament || !tournament.teams) return false;
  const matches = g('matches') || [];
  const today = new Date().toISOString().split('T')[0];
  const teamSet = new Set(tournament.teams);
  return matches.some(m =>
    m.date === today &&
    m.status !== 'completed' &&
    teamSet.has(m.a) && teamSet.has(m.b)
  );
}

// Get schedule info for a bracket match (returns {date, time, status} or null)
function getMatchScheduleInfo(teamA, teamB) {
  if (!teamA || !teamB) return null;
  const matches = g('matches') || [];
  const m = matches.find(m =>
    m.status !== 'completed' &&
    ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA))
  );
  if (!m) return null;
  return { date: m.date || '', time: m.time || '', status: m.status || 'scheduled' };
}

function syncWinnerSelectionToSchedule(teamA, teamB, winnerId, tournamentName) {
  if (!teamA || !teamB || !winnerId) return;
  const matches = g('matches') || [];
  const samePair = (match) =>
    (match.a === teamA && match.b === teamB) || (match.a === teamB && match.b === teamA);
  const sameTournament = (match) => !tournamentName || !match.tournament || match.tournament === tournamentName;

  let idx = matches.findIndex(match => match.status !== 'completed' && sameTournament(match) && samePair(match));
  if (idx === -1) idx = matches.findIndex(match => sameTournament(match) && samePair(match));
  if (idx === -1) idx = matches.findIndex(match => match.status !== 'completed' && samePair(match));
  if (idx === -1) return;

  const match = matches[idx];
  const winnerIsA = match.a === winnerId;
  const winnerIsB = match.b === winnerId;
  if (!winnerIsA && !winnerIsB) return;

  let scoreA = Number(match.sa) || 0;
  let scoreB = Number(match.sb) || 0;
  if (scoreA === scoreB || (winnerIsA && scoreA <= scoreB) || (winnerIsB && scoreB <= scoreA)) {
    scoreA = winnerIsA ? 1 : 0;
    scoreB = winnerIsB ? 1 : 0;
  }

  match.sa = scoreA;
  match.sb = scoreB;
  match.status = 'completed';
  if (match.lineup) delete match.lineup;
  s('matches', matches);
}

function clearTournamentScheduleLinks(tournament) {
  if (!tournament) return;
  const matches = g('matches') || [];
  const teamSet = new Set(tournament.teams || []);
  const filtered = matches.filter(match => {
    if (tournament.name && match.tournament !== tournament.name) return true;
    if (!teamSet.size) return false;
    return !(teamSet.has(match.a) && teamSet.has(match.b));
  });
  if (filtered.length !== matches.length) s('matches', filtered);
}

// Finish a bracket match: mark winner, sync scores to schedule, mark schedule completed
function finishBracketMatch(tIndex, bracketType, rIdx, mIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  let match = null;
  if (bracketType === 'gf' && t.grandFinal) {
    match = t.grandFinal;
  } else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    if (bracketType === 'w') match = (t.bracket.winners[rIdx] || [])[mIdx];
    else match = (t.bracket.losers[rIdx] || [])[mIdx];
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    match = t.roundRobin[rIdx];
  } else if (t.format === 'groupknockout' && t.groupStage) {
    return;
  } else if (Array.isArray(t.bracket)) {
    match = (t.bracket[rIdx] || [])[mIdx];
  }
  if (!match || !match.a || !match.b) return alert('Match not found');
  // Read scores from DOM inputs first
  const prefix = (bracketType === 'gf') ? `score_${tIndex}_gf_${rIdx}_${mIdx}_` : (bracketType === 'w') ? `score_${tIndex}_w_${rIdx}_${mIdx}_` : (bracketType === 'l') ? `score_${tIndex}_l_${rIdx}_${mIdx}_` : `score_${tIndex}_s_${rIdx}_${mIdx}_`;
  const aEl = document.getElementById(prefix + 'a');
  const bEl = document.getElementById(prefix + 'b');
  if (aEl && aEl.value !== '') match.scoreA = Number(aEl.value);
  if (bEl && bEl.value !== '') match.scoreB = Number(bEl.value);
  s('tournaments', tournaments);
  const scoreA = (match.scoreA !== undefined && match.scoreA !== null) ? Number(match.scoreA) : null;
  const scoreB = (match.scoreB !== undefined && match.scoreB !== null) ? Number(match.scoreB) : null;
  if (scoreA === null || scoreB === null || scoreA === scoreB) return alert('Enter valid scores with a clear winner before finishing');
  if (!match.winner) {
    const winnerId = scoreA > scoreB ? match.a : match.b;
    match.played = true;
    match.winner = winnerId;
    s('tournaments', tournaments);
    if (bracketType !== 'rr') {
      chooseWinner(tIndex, rIdx, mIdx, winnerId, bracketType);
    }
  }
  if (typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, scoreA, scoreB, true);
  }
  renderBracket(tIndex);
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

// Finish a round-robin bracket match
function finishRRMatch(tIndex, matchIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.roundRobin || !t.roundRobin[matchIdx]) return;
  const match = t.roundRobin[matchIdx];
  if (!match.a || !match.b) return;
  // Read scores from DOM inputs
  const aEl = document.getElementById(`rr_score_${tIndex}_${matchIdx}_a`);
  const bEl = document.getElementById(`rr_score_${tIndex}_${matchIdx}_b`);
  if (aEl && aEl.value !== '') match.scoreA = Number(aEl.value);
  if (bEl && bEl.value !== '') match.scoreB = Number(bEl.value);
  s('tournaments', tournaments);
  const scoreA = (match.scoreA !== undefined && match.scoreA !== null) ? Number(match.scoreA) : null;
  const scoreB = (match.scoreB !== undefined && match.scoreB !== null) ? Number(match.scoreB) : null;
  if (scoreA === null || scoreB === null || scoreA === scoreB) return alert('Enter valid scores with a clear winner before finishing');
  if (!match.winner) {
    match.played = true;
    match.winner = scoreA > scoreB ? match.a : match.b;
    s('tournaments', tournaments);
  }
  if (typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, scoreA, scoreB, true);
  }
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

// Finish a group+knockout stage match
function finishGKMatch(tIndex, groupName, matchIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.groupStage || !t.groupStage[groupName] || !t.groupStage[groupName][matchIdx]) return;
  const match = t.groupStage[groupName][matchIdx];
  if (!match.a || !match.b) return;
  // Read scores from DOM inputs
  const aEl = document.getElementById(`gk_score_${tIndex}_${groupName}_${matchIdx}_a`);
  const bEl = document.getElementById(`gk_score_${tIndex}_${groupName}_${matchIdx}_b`);
  if (aEl && aEl.value !== '') match.scoreA = Number(aEl.value);
  if (bEl && bEl.value !== '') match.scoreB = Number(bEl.value);
  s('tournaments', tournaments);
  const scoreA = (match.scoreA !== undefined && match.scoreA !== null) ? Number(match.scoreA) : null;
  const scoreB = (match.scoreB !== undefined && match.scoreB !== null) ? Number(match.scoreB) : null;
  if (scoreA === null || scoreB === null || scoreA === scoreB) return alert('Enter valid scores with a clear winner before finishing');
  if (!match.winner) {
    match.played = true;
    match.winner = scoreA > scoreB ? match.a : match.b;
    s('tournaments', tournaments);
  }
  if (typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, scoreA, scoreB, true);
  }
  checkAndFinalizeGroups(tIndex);
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

function populateScoringTournaments() {
  const sel = document.getElementById('sTournament');
  if (!sel) return;
  const allTournaments = g('tournaments');
  const bigEvents = getVisibleBigEvents();
  const opts = ['<option value="">Choose a tournament...</option>'];
  // Build visible list with original indices
  const visible = [];
  allTournaments.forEach((t, origIdx) => {
    if (!canAccessTournament(t)) return;
    if (selectedSport && t.sport !== selectedSport) return;
    if (typeof organizerCanAccessTournament === 'function' && !organizerCanAccessTournament(t)) return;
    visible.push({ t, i: origIdx });
  });
  // Group tournaments by bigEventId
  const grouped = {};
  visible.forEach(({ t, i }) => {
    const group = t.bigEventId || 'none';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({ t, i });
  });
  // Add each big event group
  bigEvents.forEach(ev => {
    if (!grouped[ev.id]) return;
    if (typeof organizerCanAccessEvent === 'function' && !organizerCanAccessEvent(ev.id)) return;
    opts.push(`<optgroup label="${ev.name}">`);
    grouped[ev.id].forEach(({ t, i }) => {
      const hasBracket = !!(t.bracket || t.roundRobin || t.groupStage);
      const teamCount = t.teams ? t.teams.length : 0;
      const formatNames = { single: 'SE', double: 'DE', roundrobin: 'RR', groupknockout: 'G+K' };
      const fmt = formatNames[t.format] || '';
      const label = `${t.name} (${t.sport}${fmt ? ' • ' + fmt : ''}${teamCount ? ' • ' + teamCount + ' teams' : ''}${hasBracket ? '' : ' • No bracket yet'})`;
      opts.push(`<option value="${i}">${label}</option>`);
    });
    opts.push('</optgroup>');
  });
  // Add tournaments not in any big event
  if (grouped['none']) {
    opts.push('<optgroup label="Other Tournaments">');
    grouped['none'].forEach(({ t, i }) => {
      const hasBracket = !!(t.bracket || t.roundRobin || t.groupStage);
      const teamCount = t.teams ? t.teams.length : 0;
      const formatNames = { single: 'SE', double: 'DE', roundrobin: 'RR', groupknockout: 'G+K' };
      const fmt = formatNames[t.format] || '';
      const label = `${t.name} (${t.sport}${fmt ? ' • ' + fmt : ''}${teamCount ? ' • ' + teamCount + ' teams' : ''}${hasBracket ? '' : ' • No bracket yet'})`;
      opts.push(`<option value="${i}">${label}</option>`);
    });
    opts.push('</optgroup>');
  }
  sel.innerHTML = opts.join('');
  // also populate the overview preview select (if present)
  populateOverviewBracketSelect();
}

function onScoringTournamentChange(val) {
  const display = document.getElementById('scoringBracketDisplay');
  const panel = document.getElementById('scoringScorePanel');
  if (!val && val !== 0) {
    if (display) display.innerHTML = '';
    if (panel) panel.innerHTML = '';
    document.getElementById('scoringTeamPool').innerHTML = '';
    return;
  }
  const tIdx = Number(val);
  const tournaments = g('tournaments');
  const t = tournaments[tIdx];
  if (!t) return;

  // Backward-compatible auto-fill: older data may have RR/GK structures with empty slots.
  if (t.teams && t.teams.length >= 2) {
    const opts = { autoSeed: false, bestOf: t.bestOf || 1 };
    if (t.format === 'roundrobin' && Array.isArray(t.roundRobin) && t.roundRobin.length > 0) {
      const rrEmpty = t.roundRobin.every(m => m && !m.a && !m.b && !m.winner && !m.played);
      if (rrEmpty) {
        t.roundRobin = createBracket(t.teams, 'roundrobin', opts);
        tournaments[tIdx] = t;
        s('tournaments', tournaments);
      }
    }
    if (t.format === 'groupknockout' && t.groupStage) {
      const groups = Object.keys(t.groupStage || {});
      const gkEmpty = groups.length > 0 && groups.every(gn =>
        (t.groupStage[gn] || []).every(m => m && !m.a && !m.b && !m.winner && !m.played)
      );
      if (gkEmpty) {
        const grp = createBracket(t.teams, 'groupknockout', opts);
        t.groupStage = grp.groupStage;
        const hasKoTeams = Array.isArray(t.bracket) && (t.bracket[0] || []).some(m => m && (m.a || m.b || m.winner));
        if (!hasKoTeams) t.bracket = grp.knockout;
        tournaments[tIdx] = t;
        s('tournaments', tournaments);
      }
    }
  }

  // Auto-create empty bracket structure if none exists
  const hasBracket = !!(t.bracket || t.roundRobin || t.groupStage);
  if (!hasBracket && t.teams && t.teams.length >= 2) {
    createEmptyBracket(tIdx);
  }
  const hasBracketNow = !!(tournaments[tIdx].bracket || tournaments[tIdx].roundRobin || tournaments[tIdx].groupStage);
  if (hasBracketNow) {
    renderScoringBracket(val);
    renderTeamPool(val);
    renderScorePanel(val);
  } else {
    document.getElementById('scoringTeamPool').innerHTML = '';
    if (panel) panel.innerHTML = '';
    if (display) display.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted-text)">
      <div style="font-size:2.5rem;margin-bottom:10px">📋</div>
      <div style="font-weight:700;font-size:1.1rem;margin-bottom:6px">No bracket available</div>
      <div style="font-size:0.9rem">Add at least 2 teams to this tournament in Teams & Players first.</div>
    </div>`;
  }
}

// Strip all team placements from bracket so teams return to pool
function clearBracketPlacements(t) {
  function clearRounds(rounds) {
    if (!Array.isArray(rounds)) return;
    rounds.forEach(r => (r || []).forEach(m => {
      if (m) { m.a = null; m.b = null; m.winner = null; delete m.scoreA; delete m.scoreB; }
    }));
  }
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    clearRounds(t.bracket.winners);
    clearRounds(t.bracket.losers);
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    (t.roundRobin || []).forEach(m => { if (m) { m.a = null; m.b = null; m.winner = null; m.played = false; delete m.scoreA; delete m.scoreB; } });
  } else if (t.format === 'groupknockout' && t.groupStage) {
    Object.keys(t.groupStage).forEach(gn => (t.groupStage[gn] || []).forEach(m => { if (m) { m.a = null; m.b = null; m.winner = null; m.played = false; delete m.scoreA; delete m.scoreB; } }));
    clearRounds(t.bracket);
  } else if (Array.isArray(t.bracket)) {
    clearRounds(t.bracket);
  }
  delete t.grandFinal; delete t.winner;
}

// Create empty bracket structure for a tournament
function createEmptyBracket(tIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIdx];
  if (!t || !t.teams || t.teams.length < 2) return;
  const format = t.format || 'single';
  const opts = { autoSeed: false, bestOf: t.bestOf || 1 };
  delete t.bracket; delete t.roundRobin; delete t.groupStage;
  delete t.grandFinal; delete t.winner;
  if (format === 'roundrobin') {
    t.roundRobin = createBracket(t.teams, 'roundrobin', opts);
  } else if (format === 'double') {
    t.bracket = createBracket(t.teams, 'double', opts);
    clearBracketPlacements(t);
  } else if (format === 'groupknockout') {
    const grp = createBracket(t.teams, 'groupknockout', opts);
    t.groupStage = grp.groupStage;
    t.bracket = grp.knockout;
  } else {
    t.bracket = createBracket(t.teams, 'single', opts);
    clearBracketPlacements(t);
  }
  s('tournaments', tournaments);
}

function resetBracketFromScoring() {
  const sel = document.getElementById('sTournament');
  const idx = sel ? sel.value : '';
  if (!idx && idx !== 0) return alert('Select a tournament first');
  const tIdx = Number(idx);
  const tournaments = g('tournaments');
  const t = tournaments[tIdx];
  if (!t) return alert('Tournament not found');
  if (!t.teams || t.teams.length < 2) return alert('This tournament needs at least 2 teams. Add teams in Teams & Players first.');
  if (!confirm('Reset this bracket? All team placements, scores, and results will be cleared.')) return;
  clearTournamentScheduleLinks(t);
  createEmptyBracket(tIdx);
  populateScoringTournaments();
  if (typeof loadMatches === 'function') loadMatches();
  if (typeof populateBracketMatchSelect === 'function') populateBracketMatchSelect();
  sel.value = String(tIdx);
  onScoringTournamentChange(tIdx);
}

// Populate the dashboard overview bracket select used for quick preview
function populateOverviewBracketSelect() {
  const sel = document.getElementById('overviewBracketSelect');
  if (!sel) return;
  const all = getVisibleTournaments();
  const bigEvents = getVisibleBigEvents();
  // Build a lookup for big event names
  const bigEventMap = {};
  bigEvents.forEach(ev => { bigEventMap[ev.id] = ev.name; });
  // Sort tournaments alphabetically by name
  const sorted = all.map((t, i) => ({ t, i }))
    .filter(({ t }) => (t.bracket || t.roundRobin || t.groupStage) && (!selectedSport || t.sport === selectedSport))
    .sort((a, b) => a.t.name.localeCompare(b.t.name));
  const formatNames = { single: 'Single Elim', double: 'Double Elim', roundrobin: 'Round Robin', groupknockout: 'Group + Knockout' };
  const opts = ['<option value="">Select tournament...</option>'];
  sorted.forEach(({ t, i }) => {
    const fmt = formatNames[t.format] || t.format || '';
    const event = t.bigEventId && bigEventMap[t.bigEventId] ? ` • ${bigEventMap[t.bigEventId]}` : '';
    const dates = t.startDate && t.endDate ? ` • ${t.startDate} → ${t.endDate}` : '';
    opts.push(`<option value="${i}">${t.name} (${t.sport}${fmt ? ' • ' + fmt : ''}${event}${dates})</option>`);
  });
  sel.innerHTML = opts.join('');
}

function filterOverviewSelect(q) {
  const val = (q || '').toLowerCase();
  const sel = document.getElementById('overviewBracketSelect');
  if (!sel) return;
  for (let i = 0; i < sel.options.length; i++) {
    const opt = sel.options[i];
    if (!opt.value) { opt.style.display = ''; continue; }
    // Match on all text, not just name
    opt.style.display = (!val || opt.text.toLowerCase().includes(val)) ? '' : 'none';
  }
}

// Render a read-only bracket preview for dashboard overview
function renderBracketPreview(tIndexOrVal) {
  const el = document.getElementById('overviewBracketPreview');
  if (!el) return;
  const idx = (typeof tIndexOrVal === 'string' && tIndexOrVal !== '') ? Number(tIndexOrVal) : Number(tIndexOrVal);
  if (!tIndexOrVal && tIndexOrVal !== 0) { el.innerHTML = '<div style="color:var(--muted-text);padding:12px">Select a tournament to preview its bracket</div>'; return; }
  const tournaments = getVisibleTournaments();
  const t = tournaments[idx];
  if (!t) { el.innerHTML = '<div style="color:var(--muted-text);padding:12px">Tournament not found</div>'; return; }

  // Build a compact read-only view depending on format
  let html = `<div style="font-weight:700;margin-bottom:8px">${t.name} — ${t.format === 'roundrobin' ? 'Round Robin' : t.format === 'double' ? 'Double Elim' : t.format === 'groupknockout' ? 'Group + Knockout' : 'Single Elim'}</div>`;
  if (t.format === 'roundrobin' && t.roundRobin) {
    html += '<div style="font-size:0.95rem">';
    (t.roundRobin || []).slice(0,6).forEach((m, i) => {
      const a = m.a ? (g('teams').find(tm=>tm.id===m.a)||{name:m.a}).name : 'TBD';
      const b = m.b ? (g('teams').find(tm=>tm.id===m.b)||{name:m.b}).name : 'TBD';
      html += `<div style="margin:4px 0">${a} vs ${b}${m.played ? ` — ${(g('teams').find(tm=>tm.id===m.winner)||{name:m.winner}).name}` : ''}</div>`;
    });
    html += '</div>';
    el.innerHTML = html; return;
  }

  if (t.format === 'groupknockout' && t.groupStage) {
    html += '<div style="font-size:0.95rem">';
    const groups = Object.keys(t.groupStage || {}).slice(0,3);
    groups.forEach(gname => {
      html += `<div style="margin-bottom:6px"><strong>${gname}</strong>`;
      (t.groupStage[gname]||[]).slice(0,4).forEach(m => {
        const a = m.a ? (g('teams').find(tm=>tm.id===m.a)||{name:m.a}).name : 'TBD';
        const b = m.b ? (g('teams').find(tm=>tm.id===m.b)||{name:m.b}).name : 'TBD';
        html += `<div style="margin:3px 0">${a} vs ${b}${m.played ? ` — ${(g('teams').find(tm=>tm.id===m.winner)||{name:m.winner}).name}` : ''}</div>`;
      });
      html += `</div>`;
    });
    html += '</div>';
    // append small knockout preview
    if (t.bracket) html += `<div style="margin-top:8px">${renderClassicBracket(t.bracket, idx, 's', t)}</div>`;
    // sanitize
    html = html.replace(/onclick="[^"]*"/g, '').replace(/<button[\s\S]*?<\/button>/g, '');
    el.innerHTML = html; return;
  }

  // For single or double, reuse classic renderer but strip interactivity
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    let out = '<div style="font-size:0.95rem">';
    out += '<div style="margin-bottom:6px"><strong>Winners</strong></div>';
    out += renderClassicBracket(t.bracket.winners, idx, 'w', t);
    out += '<div style="margin-top:8px"><strong>Losers</strong></div>';
    out += renderClassicBracket(t.bracket.losers || [], idx, 'l', t);
    out += '</div>';
    out = out.replace(/onclick="[^"]*"/g, '').replace(/<button[\s\S]*?<\/button>/g, '').replace(/draggable="true"/g, '');
    el.innerHTML = out; return;
  }

  // single-elimination
  if (Array.isArray(t.bracket)) {
    let out = renderClassicBracket(t.bracket, idx, 's', t);
    out = out.replace(/onclick="[^"]*"/g, '').replace(/<button[\s\S]*?<\/button>/g, '').replace(/draggable="true"/g, '');
    el.innerHTML = out; return;
  }

  el.innerHTML = '<div style="color:var(--muted-text);padding:12px">No bracket to preview</div>';
}

function populateScoringRounds() {
  const tiEl = document.getElementById('sTournament');
  const roundSel = document.getElementById('sRound');
  const matchSel = document.getElementById('sBracketMatch');
  const info = document.getElementById('sMatchInfo');
  if (!tiEl || !roundSel || !matchSel) return; // controls removed from UI
  const ti = tiEl.value;
  roundSel.innerHTML = '<option value="">Select Round</option>';
  matchSel.innerHTML = '<option value="">Select Winner</option>';
  if (!ti) return;
  const tourn = g('tournaments')[ti];
  if (!tourn) return;
  if (tourn.format === 'roundrobin' && tourn.roundRobin) {
    // do not repeat the format label here; just expose matches
    roundSel.innerHTML = '<option value="rr">Matches</option>';
    // set selected value if currentRound stored
    if (tourn.currentRound) roundSel.value = tourn.currentRound;
  } else if (tourn.bracket) {
    const allRounds = ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Round 6', 'Round 7', 'Round 8', 'Round 9', 'Round 10', 'Semi-Finals', 'Finals', 'Grand Finals'];
    allRounds.forEach((name, idx) => {
      roundSel.innerHTML += `<option value="${idx}">${name}</option>`;
    });
    if (tourn.currentRound !== undefined) {
      roundSel.value = tourn.currentRound;
      // populate matches for the selected/current round
      populateScoringMatches();
    }
  }
  // show current round label
  const crDisp = document.getElementById('currentRoundDisplay');
  if (crDisp) {
    if (tourn.currentRound === undefined || tourn.currentRound === null || tourn.currentRound === '') {
      crDisp.innerText = '';
    } else {
      const cr = (tourn.format === 'roundrobin' && tourn.currentRound === 'rr') ? 'Matches' : (tourn.roundNames && tourn.roundNames[tourn.currentRound]) || `Round ${Number(tourn.currentRound)+1}`;
      crDisp.innerText = `Current Round: ${cr}`;
    }
  }
  if (info) info.innerHTML = '';
  // update the visual scoring bracket for the selected tournament
  const selTi = document.getElementById('sTournament');
  if (selTi && selTi.value !== '') renderScoringBracket(Number(selTi.value));
}

function setCurrentRound() {
  const tiEl = document.getElementById('sTournament');
  const roundSel = document.getElementById('sRound');
  if (!tiEl || !roundSel) return alert('Round controls are not available');
  const ti = tiEl.value;
  if (!ti) return alert('Select a tournament');
  if (roundSel.value === '') return alert('Select a round to set as current');
  const tournaments = g('tournaments');
  const t = tournaments[ti];
  if (!t) return alert('Tournament not found');
  t.currentRound = roundSel.value;
  tournaments[ti] = t;
  s('tournaments', tournaments);
  populateScoringRounds();
  renderBracket(Number(ti));
  renderScoringBracket(Number(ti));
  alert('Current round set.');
}

function populateScoringMatches() {
  const tiEl = document.getElementById('sTournament');
  const riEl = document.getElementById('sRound');
  const matchSel = document.getElementById('sBracketMatch');
  const info = document.getElementById('sMatchInfo');
  if (!tiEl || !riEl || !matchSel) return; // controls removed from UI
  const ti = tiEl.value;
  const ri = riEl.value;
  matchSel.innerHTML = '<option value="">Select Winner</option>';
  if (!ti || ri === '') return;
  const tourn = g('tournaments')[ti];
  if (!tourn) return;
  // round robin matches
  if (ri === 'rr' && tourn.format === 'roundrobin' && tourn.roundRobin) {
    const rr = tourn.roundRobin;
    if (!rr || rr.length === 0) {
      matchSel.innerHTML = '<option value="">No matches scheduled</option>';
      if (info) info.innerHTML = 'No round robin matches available.';
      return;
    }
    rr.forEach((m, idx) => {
      const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
      const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
      matchSel.innerHTML += `<option value="${idx}">${aName} vs ${bName}</option>`;
    });
    if (info) info.innerHTML = '';
    // refresh scoring view
    renderScoringBracket(Number(ti));
    return;
  }
  // standard bracket matches
  if (!tourn.bracket) return;
  const round = tourn.bracket[ri];
  if (!round || round.length === 0) {
    matchSel.innerHTML = '<option value="">No matches scheduled yet</option>';
    if (info) info.innerHTML = 'Matches will appear here once teams advance to this round.';
    return;
  }
  round.forEach((m, idx) => {
    const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
    const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
    const label = `${aName} vs ${bName}`;
    matchSel.innerHTML += `<option value="${idx}">${label}</option>`;
  });
  if (info) info.innerHTML = '';
  // refresh scoring view
  renderScoringBracket(Number(ti));
}

function showBracketMatchInfo() {
  const tiEl = document.getElementById('sTournament');
  const riEl = document.getElementById('sRound');
  const miEl = document.getElementById('sBracketMatch');
  const info = document.getElementById('sMatchInfo');
  if (!tiEl || !riEl || !miEl || !info) return;
  const ti = tiEl.value;
  const ri = riEl.value;
  const mi = miEl.value;
  info.innerHTML = '';
  if (!ti || ri === '' || mi === '') return;
  const tourn = g('tournaments')[ti];
  if (!tourn) return;
  // determine if round-robin
  if (ri === 'rr' && tourn.format === 'roundrobin' && tourn.roundRobin) {
    const m = tourn.roundRobin[mi];
    if (!m) return;
    const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
    const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
    let html = `<div>${aName} vs ${bName}</div>`;
    html += '<div>Select winner: <select id="sWinnerSelect">';
    if (m.a) html += `<option value="${m.a}">${aName}</option>`;
    if (m.b) html += `<option value="${m.b}">${bName}</option>`;
    html += '</select></div>';
    info.innerHTML = html;
    return;
  }
  if (!tourn.bracket) return;
  const round = tourn.bracket[ri];
  if (!round || round.length === 0) return;
  const m = round[mi];
  const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
  const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
  const roundLabel = (typeof getRoundLabel === 'function') ? getRoundLabel(tourn, ri, (tourn.bracket && tourn.bracket.length) || 0) : `Round ${Number(ri)+1}`;
  let html = `<div>${aName} vs ${bName} — ${roundLabel}</div>`;
  html += '<div>Select winner: <select id="sWinnerSelect">';
  if (m.a) html += `<option value="${m.a}">${aName}</option>`;
  if (m.b) html += `<option value="${m.b}">${bName}</option>`;
  html += '</select></div>';
  info.innerHTML = html;
}

function setBracketMatchWinner() {
  const tiEl = document.getElementById('sTournament');
  const riEl = document.getElementById('sRound');
  const miEl = document.getElementById('sBracketMatch');
  if (!tiEl || !riEl || !miEl) return alert('Round/match controls are not available');
  const ti = tiEl.value;
  const ri = riEl.value;
  const mi = miEl.value;
  if (!ti || ri === '' || mi === '') return alert('Select tournament, round and match');
  const tourn = g('tournaments')[ti];
  if (!tourn) return;
  const winnerSelect = document.getElementById('sWinnerSelect');
  if (!winnerSelect || !winnerSelect.value) return alert('Select a winner');
  const winnerName = winnerSelect.options[winnerSelect.selectedIndex].text;
  if (!confirm(`Are you sure to set "${winnerName}" as the winner?`)) return;

  // handle round-robin
  if (ri === 'rr' && tourn.format === 'roundrobin' && tourn.roundRobin) {
    const m = tourn.roundRobin[Number(mi)];
    if (!m) return alert('Match not found');
    m.played = true;
    m.winner = winnerSelect.value;
    const all = g('tournaments');
    all[ti] = tourn;
    s('tournaments', all);
    renderBracket(Number(ti));
    loadStandings();
    alert('Winner set successfully!');
    return;
  }

  // standard bracket
  if (!tourn.bracket) return alert('This tournament does not have bracketed matches.');
  const round = tourn.bracket[ri];
  if (!round || round.length === 0) return alert('This round has no matches scheduled.');
  chooseWinner(Number(ti), Number(ri), Number(mi), winnerSelect.value);
  alert('Winner set successfully!');
}

function chooseWinner(tIndex, rIdx, mIdx, winnerId, bracket = 'w') {
  if (!winnerId) {
    alert('Cannot choose a bye as winner.');
    return;
  }
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.bracket) return;

  // ── Double-Elimination ──
  if (t.format === 'double' && t.bracket.winners) {
    const winners = t.bracket.winners;
    const losers = t.bracket.losers || [];
    if (!t.grandFinal) t.grandFinal = { a: null, b: null, winner: null };

    if (bracket === 'w') {
      const match = winners[rIdx] && winners[rIdx][mIdx];
      if (!match) return;
      match.winner = winnerId;

      // Advance winner in winners bracket
      if (rIdx + 1 < winners.length) {
        const nextM = Math.floor(mIdx / 2);
        const slot = (mIdx % 2 === 0) ? 'a' : 'b';
        if (!winners[rIdx + 1][nextM]) winners[rIdx + 1][nextM] = { a: null, b: null, winner: null };
        winners[rIdx + 1][nextM][slot] = winnerId;
      } else {
        // Winners Finals winner → Grand Final slot a
        t.grandFinal.a = winnerId;
      }

      // Drop loser to losers bracket (pre-allocated slots)
      const loserId = (match.a === winnerId) ? match.b : match.a;
      if (loserId) {
        if (rIdx === 0) {
          // W-R0 losers → L-R0 (pairing round): pair them up
          const lrMatch = Math.floor(mIdx / 2);
          const lrSlot = (mIdx % 2 === 0) ? 'a' : 'b';
          if (losers[0] && losers[0][lrMatch]) {
            losers[0][lrMatch][lrSlot] = loserId;
          }
        } else {
          // W-R(k) losers → L-R(2k-1) (drop-down round): slot b, match index = mIdx
          const lr = 2 * rIdx - 1;
          if (losers[lr] && losers[lr][mIdx]) {
            losers[lr][mIdx].b = loserId;
          }
        }
      }

      // Auto-resolve emerging byes in both brackets
      autoResolveByes(winners);
      autoResolveLoserByes(winners, losers);
      // Check if bracket finals produced winners for grand final
      const wfM = winners[winners.length - 1] && winners[winners.length - 1][0];
      if (wfM && wfM.winner && !t.grandFinal.a) t.grandFinal.a = wfM.winner;
      const lfM = losers.length > 0 && losers[losers.length - 1] && losers[losers.length - 1][0];
      if (lfM && lfM.winner && !t.grandFinal.b) t.grandFinal.b = lfM.winner;

      t.bracket.winners = winners;
      t.bracket.losers = losers;
      tournaments[tIndex] = t;
      s('tournaments', tournaments);
  syncWinnerSelectionToSchedule(match.a, match.b, winnerId, t.name);
      renderBracket(tIndex);
      loadStandings();
      updateTournamentCurrentRound(tIndex);
      renderScoringBracket(tIndex);
      if (typeof loadDash === 'function') loadDash();
      return;
    }

    // Losers bracket match chosen
    if (bracket === 'l') {
      const match = losers[rIdx] && losers[rIdx][mIdx];
      if (!match) return;
      match.winner = winnerId;
      const nextR = rIdx + 1;

      if (nextR < losers.length) {
        const isEven = (rIdx % 2 === 0);
        if (isEven) {
          // Even→Odd: L-R(2k) match m winner → L-R(2k+1) match m, slot a
          if (losers[nextR] && losers[nextR][mIdx]) {
            losers[nextR][mIdx].a = winnerId;
          }
        } else {
          // Odd→Even: L-R(2k+1) match m winner → L-R(2k+2) match floor(m/2), slot a/b
          const nextMatch = Math.floor(mIdx / 2);
          const slot = (mIdx % 2 === 0) ? 'a' : 'b';
          if (losers[nextR] && losers[nextR][nextMatch]) {
            losers[nextR][nextMatch][slot] = winnerId;
          }
        }
      } else {
        // Last losers round winner → Grand Final slot b
        t.grandFinal.b = winnerId;
      }

      // Auto-resolve emerging losers bracket byes
      autoResolveLoserByes(winners, losers);
      // Check if losers finals produced a grand final contender
      const lfM2 = losers[losers.length - 1] && losers[losers.length - 1][0];
      if (lfM2 && lfM2.winner && !t.grandFinal.b) t.grandFinal.b = lfM2.winner;

      t.bracket.losers = losers;
      tournaments[tIndex] = t;
      s('tournaments', tournaments);
  syncWinnerSelectionToSchedule(match.a, match.b, winnerId, t.name);
      renderBracket(tIndex);
      loadStandings();
      updateTournamentCurrentRound(tIndex);
      renderScoringBracket(tIndex);
      if (typeof loadDash === 'function') loadDash();
      return;
    }
  }

  // ── Grand Final — user always picks the champion ──
  if (bracket === 'gf') {
    if (!t.grandFinal) return;
    t.grandFinal.winner = winnerId;
    t.winner = winnerId;
    tournaments[tIndex] = t;
    s('tournaments', tournaments);
    syncWinnerSelectionToSchedule(t.grandFinal.a, t.grandFinal.b, winnerId, t.name);
    renderBracket(tIndex);
    loadStandings();
    updateTournamentCurrentRound(tIndex);
    renderScoringBracket(tIndex);
    if (typeof loadDash === 'function') loadDash();
    return;
  }

  // single-elimination fallback (also used for group-knockout knockout stage)
  const rounds = t.bracket;
  const match = rounds[rIdx] && rounds[rIdx][mIdx];
  if (!match) return;
  match.winner = winnerId;
  if (rIdx + 1 < rounds.length) {
    const nextMatchIndex = Math.floor(mIdx / 2);
    const slot = (mIdx % 2 === 0) ? 'a' : 'b';
    if (!rounds[rIdx + 1]) rounds[rIdx + 1] = [];
    if (!rounds[rIdx + 1][nextMatchIndex]) rounds[rIdx + 1][nextMatchIndex] = { a: null, b: null, winner: null };
    rounds[rIdx + 1][nextMatchIndex][slot] = winnerId;
  } else {
    t.winner = winnerId;
  }
  // Auto-resolve any emerging byes (skips finals — user always picks champion)
  autoResolveByes(rounds);
  tournaments[tIndex] = t;
  s('tournaments', tournaments);
  syncWinnerSelectionToSchedule(match.a, match.b, winnerId, t.name);
  renderBracket(tIndex);
  loadStandings();
  updateTournamentCurrentRound(tIndex);
  renderScoringBracket(tIndex);
  if (typeof loadDash === 'function') loadDash();
}

// ── Undo helpers (cascade-clear bracket results) ──
function _undoSingleRound(rounds, rIdx, mIdx) {
  const match = (rounds[rIdx] || [])[mIdx];
  if (!match || !match.winner) return;
  const oldWinner = match.winner;
  match.winner = null;
  match.played = false;
  delete match.scoreA; delete match.scoreB;
  if (rIdx + 1 < rounds.length) {
    const nextMIdx = Math.floor(mIdx / 2);
    const nm = (rounds[rIdx + 1] || [])[nextMIdx];
    if (nm) {
      if (nm.a === oldWinner) nm.a = null;
      if (nm.b === oldWinner) nm.b = null;
      if (nm.winner) _undoSingleRound(rounds, rIdx + 1, nextMIdx);
    }
  }
}

function _undoLosersMatch(t, rIdx, mIdx) {
  const losers = t.bracket.losers || [];
  const match = (losers[rIdx] || [])[mIdx];
  if (!match || !match.winner) return;
  const oldWinner = match.winner;
  match.winner = null;
  match.played = false;
  delete match.scoreA; delete match.scoreB;
  const nextR = rIdx + 1;
  if (nextR < losers.length) {
    const nextMIdx = (rIdx % 2 === 0) ? mIdx : Math.floor(mIdx / 2);
    const nm = (losers[nextR] || [])[nextMIdx];
    if (nm) {
      if (nm.a === oldWinner) nm.a = null;
      if (nm.b === oldWinner) nm.b = null;
      if (nm.winner) _undoLosersMatch(t, nextR, nextMIdx);
    }
  } else if (t.grandFinal && t.grandFinal.b === oldWinner) {
    t.grandFinal.b = null;
    if (t.grandFinal.winner) { t.grandFinal.winner = null; delete t.winner; delete t.grandFinal.scoreA; delete t.grandFinal.scoreB; }
  }
}

function _undoWinnersMatch(t, rIdx, mIdx) {
  const winners = t.bracket.winners;
  const losers = t.bracket.losers || [];
  const match = (winners[rIdx] || [])[mIdx];
  if (!match || !match.winner) return;
  const oldWinner = match.winner;
  const oldLoser = match.a === oldWinner ? match.b : match.a;
  match.winner = null;
  match.played = false;
  delete match.scoreA; delete match.scoreB;
  if (rIdx + 1 < winners.length) {
    const nextMIdx = Math.floor(mIdx / 2);
    const nm = (winners[rIdx + 1] || [])[nextMIdx];
    if (nm) {
      if (nm.a === oldWinner) nm.a = null;
      if (nm.b === oldWinner) nm.b = null;
      if (nm.winner) _undoWinnersMatch(t, rIdx + 1, nextMIdx);
    }
  } else if (t.grandFinal && t.grandFinal.a === oldWinner) {
    t.grandFinal.a = null;
    if (t.grandFinal.winner) { t.grandFinal.winner = null; delete t.winner; delete t.grandFinal.scoreA; delete t.grandFinal.scoreB; }
  }
  if (oldLoser) {
    if (rIdx === 0) {
      const lrMatch = Math.floor(mIdx / 2);
      const lm = (losers[0] || [])[lrMatch];
      if (lm) {
        if (lm.a === oldLoser) lm.a = null;
        if (lm.b === oldLoser) lm.b = null;
        if (lm.winner) _undoLosersMatch(t, 0, lrMatch);
      }
    } else {
      const lr = 2 * rIdx - 1;
      const lm = (losers[lr] || [])[mIdx];
      if (lm) {
        if (lm.b === oldLoser) lm.b = null;
        if (lm.winner) _undoLosersMatch(t, lr, mIdx);
      }
    }
  }
}

// Main undo: reverse a bracket match result (with cascading)
function undoMatchWinner(tIndex, bracketType, rIdx, mIdx, groupName) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  const labels = { gf: 'Grand Final', rr: `RR Match ${mIdx + 1}`, w: `Winners R${rIdx+1} M${mIdx+1}`, l: `Losers R${rIdx+1} M${mIdx+1}` };
  const matchLabel = labels[bracketType] || (groupName ? `${groupName} Match ${mIdx+1}` : `Round ${rIdx+1} Match ${mIdx+1}`);
  if (!confirm(`Undo "${matchLabel}" result? Any results in later rounds that depend on this match will also be cleared.`)) return;
  let teamA = null, teamB = null;
  if (bracketType === 'gf') {
    if (!t.grandFinal || !t.grandFinal.winner) return;
    teamA = t.grandFinal.a; teamB = t.grandFinal.b;
    t.grandFinal.winner = null;
    delete t.grandFinal.scoreA; delete t.grandFinal.scoreB; delete t.winner;
  } else if (bracketType === 'rr' && t.roundRobin) {
    const match = t.roundRobin[mIdx];
    if (!match || !match.winner) return;
    teamA = match.a; teamB = match.b;
    match.winner = null; match.played = false;
    delete match.scoreA; delete match.scoreB;
  } else if (bracketType === 'gk' && t.groupStage && groupName) {
    const match = (t.groupStage[groupName] || [])[mIdx];
    if (!match || !match.winner) return;
    teamA = match.a; teamB = match.b;
    match.winner = null; match.played = false;
    delete match.scoreA; delete match.scoreB;
  } else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    if (bracketType === 'w') {
      const match = (t.bracket.winners[rIdx] || [])[mIdx];
      if (!match || !match.winner) return;
      teamA = match.a; teamB = match.b;
      _undoWinnersMatch(t, rIdx, mIdx);
    } else if (bracketType === 'l') {
      const match = (t.bracket.losers[rIdx] || [])[mIdx];
      if (!match || !match.winner) return;
      teamA = match.a; teamB = match.b;
      _undoLosersMatch(t, rIdx, mIdx);
    }
  } else if (Array.isArray(t.bracket)) {
    const match = (t.bracket[rIdx] || [])[mIdx];
    if (!match || !match.winner) return;
    teamA = match.a; teamB = match.b;
    _undoSingleRound(t.bracket, rIdx, mIdx);
    if (!t.bracket[t.bracket.length - 1]?.[0]?.winner) delete t.winner;
  }
  // Revert completed schedule entry back to 'scheduled'
  if (teamA && teamB) {
    const matches = g('matches') || [];
    const sm = matches.find(m =>
      m.status === 'completed' &&
      ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA))
    );
    if (sm) { sm.status = 'scheduled'; sm.sa = 0; sm.sb = 0; s('matches', matches); }
  }
  tournaments[tIndex] = t;
  s('tournaments', tournaments);
  renderBracket(tIndex);
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

// Render a visual scoring bracket inside the Bracketing panel - Classic Tree Style
function renderScoringBracket(tIndex) {
  const el = document.getElementById('scoringBracketDisplay');
  if (!el) return;
  const tournaments = g('tournaments');
  const idx = Number(tIndex);
  const t = tournaments[idx];
  if (!t) { 
    el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--muted-text);font-size:1.1rem;">Select a tournament to view its bracket</div>'; 
    return; 
  }
  
  let html = `<div class="scoring-bracket-title">${t.name}</div>`;
  const allTeams = g('teams') || [];
  const _logo = (id) => {
    if (!id) return '';
    const tm = allTeams.find(x => x.id === id);
    if (tm && tm.logo) return `<img src="${tm.logo}" class="bracket-team-logo">`;
    const initial = tm ? tm.name.charAt(0).toUpperCase() : '?';
    return `<span class="bracket-team-logo" style="display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;font-weight:700;font-size:0.65rem">${initial}</span>`;
  };

  // round-robin format
  if (t.format === 'roundrobin') {
    html += '<div class="rr-grid">';
    (t.roundRobin || []).forEach((m, i) => {
      const aName = m.a ? (allTeams.find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
      const bName = m.b ? (allTeams.find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
      const winnerName = m.winner ? (allTeams.find(tm => tm.id === m.winner) || { name: m.winner }).name : null;
      const aLogo = _logo(m.a), bLogo = _logo(m.b), wLogo = _logo(m.winner);
      const rrScoreA = (m.scoreA !== undefined && m.scoreA !== null) ? m.scoreA : '';
      const rrScoreB = (m.scoreB !== undefined && m.scoreB !== null) ? m.scoreB : '';
      const rrHasScores = rrScoreA !== '' || rrScoreB !== '';
      html += `<div class="rr-match">`;
      html += `<div class="rr-match-header">Match ${i + 1}${rrHasScores ? `<span class="rr-match-score-badge">${rrScoreA} - ${rrScoreB}</span>` : ''}</div>`;
      html += `<div class="rr-match-teams">`;
      html += `<div class="rr-team"><span class="rr-team-name${m.winner === m.a ? ' winner' : (m.played && m.winner !== m.a ? ' loser' : '')}">${aLogo}${aName}${rrScoreA !== '' ? `<span class="rr-team-score">${rrScoreA}</span>` : ''}</span></div>`;
      html += `<div class="rr-team"><span class="rr-team-name${m.winner === m.b ? ' winner' : (m.played && m.winner !== m.b ? ' loser' : '')}">${bLogo}${bName}${rrScoreB !== '' ? `<span class="rr-team-score">${rrScoreB}</span>` : ''}</span></div>`;
      html += `</div>`;
      if (m.played) {
        html += `<div class="rr-winner-badge">${wLogo} ✅ Winner: ${winnerName}${rrHasScores ? ` (${rrScoreA}-${rrScoreB})` : ''}</div>`;
        html += `<div style="text-align:center;margin-top:4px"><button class="bracket-undo-btn" onclick="undoMatchWinner(${idx},'rr',0,${i})">↩ Undo</button></div>`;
      } else if (m.a && m.b) {
        const rrInfo = getMatchScheduleInfo(m.a, m.b);
        const rrHasSchedule = !!(rrInfo && rrInfo.date);
        if (rrInfo && rrInfo.date) {
          const rrLabel = rrInfo.time ? `🕐 ${rrInfo.time}` : `📅 ${rrInfo.date}`;
          html += `<div style="text-align:center;margin-top:4px"><span style="display:inline-block;font-size:0.75rem;padding:3px 10px;border-radius:10px;background:rgba(40,167,69,0.1);color:var(--success);font-weight:600">${rrLabel}</span></div>`;
        } else {
          html += `<div style="text-align:center;margin-top:4px"><span style="display:inline-block;font-size:0.75rem;padding:3px 10px;border-radius:10px;background:rgba(148,163,184,0.1);color:var(--muted-text);font-weight:600">🔒 Not Scheduled</span></div>`;
        }
        html += `<div style="text-align:center;margin-top:6px;display:flex;gap:4px;justify-content:center" id="rr_override_${idx}_${i}">`;
        html += `<button class="bracket-live-btn" style="padding:5px 14px;font-size:0.82rem" onclick="openLiveScoring(${idx},'rr',0,${i})">🎯 Live Score</button>`;
        if (rrHasSchedule) {
          html += `<button class="form-btn accent-btn" style="padding:5px 14px;font-size:0.82rem" onclick="rrOverride(${idx},${i})">⚡</button>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    });
    html += '</div>';
    el.innerHTML = html;
    renderScorePanel(idx);
    return;
  }

  // Group + Knockout
  if (t.format === 'groupknockout') {
    html += '<div style="margin-bottom:8px"><h4>Group Stage</h4>';
    if (t.groupStage) {
      Object.keys(t.groupStage).forEach(gname => {
        html += `<div style="margin:6px 0; padding:8px; border:1px solid #f4f6fb; border-radius:6px"><strong>${gname}</strong>`;
        (t.groupStage[gname] || []).forEach((m, i) => {
          const aName = m.a ? (allTeams.find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
          const bName = m.b ? (allTeams.find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
          const winnerName = m.winner ? (allTeams.find(tm => tm.id === m.winner) || { name: m.winner }).name : null;
          const aL = _logo(m.a), bL = _logo(m.b), wL = _logo(m.winner);
          const gkScA = (m.scoreA !== undefined && m.scoreA !== null) ? m.scoreA : '';
          const gkScB = (m.scoreB !== undefined && m.scoreB !== null) ? m.scoreB : '';
          const gkHasScores = gkScA !== '' || gkScB !== '';
          html += `<div style="margin:6px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${aL}<strong>${aName}</strong>`;
          if (gkHasScores) html += `<span class="bracket-score">${gkScA}</span>`;
          html += ` <span style="color:var(--muted-text)">vs</span> ${bL}<strong>${bName}</strong>`;
          if (gkHasScores) html += `<span class="bracket-score">${gkScB}</span>`;
          if (m.played) {
            html += ` — ${wL} <span style="color:var(--success);font-weight:600">Winner: ${winnerName}</span>${gkHasScores ? ` <span style="font-size:0.8rem;color:var(--muted-text)">(${gkScA}-${gkScB})</span>` : ''}`;
            html += `</div><div style="margin:-2px 0 4px 8px"><button class="bracket-undo-btn" onclick="undoMatchWinner(${idx},'gk',0,${i},'${gname.replace(/'/g,"\\'")}')">↩ Undo</button></div>`;
          } else if (m.a && m.b) {
            const gkInfo = getMatchScheduleInfo(m.a, m.b);
            if (gkInfo && gkInfo.date) {
              const gkLabel = gkInfo.time ? `🕐 ${gkInfo.time}` : `📅 ${gkInfo.date}`;
              html += ` <span style="font-size:0.75rem;padding:2px 7px;border-radius:8px;background:rgba(40,167,69,0.1);color:var(--success);font-weight:600">${gkLabel}</span>`;
            } else {
              html += ` <span style="font-size:0.75rem;color:var(--muted-text)">🔒 Not Scheduled</span>`;
            }
            html += `</div>`;
            const safeGname = gname.replace(/'/g,"\\'");
            html += `<div style="margin:4px 0 4px 8px" id="gk_override_${idx}_${safeGname}_${i}">`;
            if (gkInfo && gkInfo.date) {
              html += `<button class="form-btn accent-btn" style="padding:5px 14px;font-size:0.82rem" onclick="gkOverride(${idx},'${safeGname}',${i})">⚡ Override</button>`;
            }
            html += `</div>`;
          }
          if (!m.played && !(m.a && m.b)) html += `</div>`;
        });
        html += `</div>`;
      });
    }
    html += '</div>';

    // Group status & knockout bracket
    if (t.groupStage) {
      const allGroupsDone = Object.keys(t.groupStage).every(gn =>
        (t.groupStage[gn] || []).every(m => m.played)
      );
      const knockoutHasTeams = t.bracket && t.bracket[0] && t.bracket[0].some(m => m && (m.a || m.b));
      if (allGroupsDone && !knockoutHasTeams) {
        html += `<div style="text-align:center;margin:12px 0"><button class="form-btn primary-btn" style="padding:10px 24px;font-size:1rem" onclick="checkAndFinalizeGroups(${idx}); renderScoringBracket(${idx});">🏆 Finalize Groups & Start Knockout</button></div>`;
      } else if (allGroupsDone && knockoutHasTeams) {
        html += `<div style="text-align:center;margin:8px 0;color:var(--success);font-weight:600">✅ Groups finalized — Knockout stage active</div>`;
      } else {
        const totalMatches = Object.values(t.groupStage).reduce((sum, arr) => sum + arr.length, 0);
        const playedMatches = Object.values(t.groupStage).reduce((sum, arr) => sum + arr.filter(m => m.played).length, 0);
        html += `<div style="text-align:center;margin:8px 0;color:var(--muted-text);font-size:0.9rem">Group matches: ${playedMatches}/${totalMatches} completed</div>`;
      }
    }
    
    // Knockout bracket
    if (t.bracket) {
      html += '<h4 style="margin-top:12px">Knockout Stage</h4>';
      html += '<div class="bracket-wrapper">' + renderClassicBracket(t.bracket, idx, 's', t) + '</div>';
    }
    el.innerHTML = html;
    renderScorePanel(idx);
    return;
  }

  // double-elimination format
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    html += '<div class="double-elim">';
    
    // Winners bracket
    html += '<div class="bracket-container">';
    html += '<div class="bracket-header">🏅 Winners Bracket</div>';
    html += '<div class="bracket-wrapper">' + renderClassicBracket(t.bracket.winners, idx, 'w', t) + '</div>';
    html += '</div>';

    // Losers bracket
    html += '<div class="bracket-container">';
    html += '<div class="bracket-header">🔄 Losers Bracket</div>';
    html += '<div class="bracket-wrapper">' + renderClassicBracket(t.bracket.losers || [], idx, 'l', t) + '</div>';
    html += '</div>';
    
    html += '</div>';
    
    // Grand Final — bracket-style match box
    const gf = t.grandFinal || { a: null, b: null, winner: null };
    const nameA = gf.a ? (allTeams.find(tm => tm.id === gf.a) || { name: gf.a }).name : 'TBD';
    const nameB = gf.b ? (allTeams.find(tm => tm.id === gf.b) || { name: gf.b }).name : 'TBD';
    const gfLogoA = _logo(gf.a), gfLogoB = _logo(gf.b);
    const gfCanPick = gf.a && gf.b && !gf.winner;
    const gfSchedInfo = gfCanPick ? getMatchScheduleInfo(gf.a, gf.b) : null;
    const gfHasSchedule = !!(gfCanPick && gfSchedInfo && gfSchedInfo.date);
    html += `<div class="grand-final">`;
    html += `<div class="gf-title">🏆 Grand Final</div>`;

    // Schedule badge
    if (gfCanPick) {
      if (gfSchedInfo && gfSchedInfo.date) {
        const gfLabel = gfSchedInfo.time ? `🕐 ${gfSchedInfo.time}` : `📅 ${gfSchedInfo.date}`;
        html += `<div style="text-align:center;margin-bottom:8px"><span style="display:inline-block;font-size:0.78rem;padding:3px 12px;border-radius:10px;background:rgba(40,167,69,0.1);color:var(--success);font-weight:600">${gfLabel}</span></div>`;
      } else {
        html += `<div style="text-align:center;margin-bottom:8px"><span style="display:inline-block;font-size:0.78rem;padding:3px 12px;border-radius:10px;background:rgba(148,163,184,0.1);color:var(--muted-text);font-weight:600">🔒 Not Scheduled</span></div>`;
      }
    }

    html += `<div class="gf-bracket-box">`;
    // Team A slot
    const gfClsA = `gf-slot${gf.winner === gf.a ? ' gf-slot-winner' : ''}${gf.winner && gf.winner !== gf.a ? ' gf-slot-loser' : ''}`;
    const gfClsB = `gf-slot${gf.winner === gf.b ? ' gf-slot-winner' : ''}${gf.winner && gf.winner !== gf.b ? ' gf-slot-loser' : ''}`;
    {
      html += `<div class="${gfClsA}">`;
      html += `<div class="gf-slot-info">${gfLogoA ? gfLogoA.replace('bracket-team-logo','gf-team-logo') : ''}<span class="gf-slot-name">${nameA}</span></div>`;
      html += `<div class="gf-slot-score">${gf.scoreA !== undefined && gf.scoreA !== null ? gf.scoreA : (gf.a ? '-' : '')}</div>`;
      html += `</div>`;
      html += `<div class="gf-divider"><span class="gf-vs-badge">VS</span></div>`;
      html += `<div class="${gfClsB}">`;
      html += `<div class="gf-slot-info">${gfLogoB ? gfLogoB.replace('bracket-team-logo','gf-team-logo') : ''}<span class="gf-slot-name">${nameB}</span></div>`;
      html += `<div class="gf-slot-score">${gf.scoreB !== undefined && gf.scoreB !== null ? gf.scoreB : (gf.b ? '-' : '')}</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    if (gfCanPick) {
      html += `<div style="text-align:center;margin-top:8px;display:flex;gap:6px;justify-content:center" id="gf_override_${idx}">`;
      html += `<button class="bracket-live-btn" style="padding:5px 16px;font-size:0.82rem" onclick="openLiveScoring(${idx},'gf',0,0)">🎯 Live Score</button>`;
      if (gfHasSchedule) {
        html += `<button class="form-btn accent-btn" style="padding:5px 16px;font-size:0.82rem" onclick="gfOverride(${idx})">⚡</button>`;
      }
      html += `</div>`;
    }

    // Waiting or Champion
    if (!gf.a || !gf.b) {
      html += `<div style="margin-top:12px;color:var(--muted-text);font-size:0.9rem;text-align:center">Waiting for bracket winners...</div>`;
    } else if (gf.winner) {
      const winnerName = (allTeams.find(tm => tm.id === gf.winner) || { name: gf.winner }).name;
      const wLogo = _logo(gf.winner);
      html += `<div class="gf-champion-badge">${wLogo ? wLogo.replace('bracket-team-logo','gf-team-logo') + ' ' : ''}🏆 Champion: ${winnerName}</div>`;
      html += `<div style="text-align:center;margin-top:8px"><button class="bracket-undo-btn" style="font-size:0.78rem;padding:4px 14px" onclick="undoMatchWinner(${idx},'gf',0,0)">↩ Undo Result</button></div>`;
    }
    html += `</div>`;
    
    el.innerHTML = html;
    renderScorePanel(idx);
    return;
  }

  // single-elimination format - Classic Tree Style
  if (!t.bracket || !Array.isArray(t.bracket)) {
    el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--muted-text);">No bracket data available</div>';
    return;
  }
  
  html += '<div class="bracket-wrapper">';
  html += renderClassicBracket(t.bracket, idx, 's', t);
  html += '</div>';
  
  el.innerHTML = html;
  renderScorePanel(idx);
}

// Render classic tournament bracket with connecting lines
function renderClassicBracket(rounds, tIndex, bracketType, tournament) {
  if (!rounds || rounds.length === 0) return '<div style="padding:20px;color:var(--muted-text);text-align:center;">No matches yet</div>';

  const totalRounds = rounds.length;
  const teams = g('teams') || [];
  const getName = (id) => id ? (teams.find(t => t.id === id) || { name: id }).name : 'TBD';
  const getLogo = (id) => {
    if (!id) return '';
    const tm = teams.find(t => t.id === id);
    if (tm && tm.logo) return `<img src="${tm.logo}" class="bracket-team-logo">`;
    const initial = tm ? tm.name.charAt(0).toUpperCase() : '?';
    return `<span class="bracket-team-logo" style="display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;font-weight:700;font-size:0.65rem">${initial}</span>`;
  };

  // Layout constants
  const matchH = 122;  // height of a match box (two seeds + schedule badge + score row)
  const gapY = 24;     // gap between matches in round 1
  const colW = 200;    // width per round column
  const connW = 48;    // connector gap between columns
  const champW = 160;  // champion column width
  const titleH = 36;   // space above bracket for round titles

  // First-round match count
  const r0 = rounds[0] || [];
  const n = r0.length;
  if (n === 0) return '<div style="padding:20px;color:var(--muted-text);text-align:center;">No matches yet</div>';

  const spacing = matchH + gapY;

  // Calculate center-Y positions for every match
  const pos = [];
  for (let r = 0; r < totalRounds; r++) {
    pos[r] = [];
    const round = rounds[r] || [];
    for (let m = 0; m < round.length; m++) {
      if (r === 0) {
        pos[0][m] = m * spacing + matchH / 2;
      } else {
        const t = m * 2, b = m * 2 + 1;
        const tY = pos[r - 1][t] !== undefined ? pos[r - 1][t] : null;
        const bY = pos[r - 1][b] !== undefined ? pos[r - 1][b] : null;
        if (tY !== null && bY !== null) pos[r][m] = (tY + bY) / 2;
        else if (tY !== null) pos[r][m] = tY;
        else if (bY !== null) pos[r][m] = bY;
        else pos[r][m] = m * spacing * Math.pow(2, r) + matchH / 2;
      }
    }
  }

  const totalH = n * spacing;
  const totalW = totalRounds * colW + (totalRounds) * connW + champW + 20;

  let html = `<div class="bracket-canvas" style="position:relative;min-width:${totalW}px;height:${totalH + titleH}px;padding-top:${titleH}px">`;

  // ── Round titles ──
  for (let r = 0; r < totalRounds; r++) {
    const x = r * (colW + connW);
    const label = getRoundLabel(tournament, r, totalRounds);
    html += `<div class="bracket-round-label" style="position:absolute;left:${x}px;top:0;width:${colW}px">${label}</div>`;
  }

  // ── Match boxes ──
  for (let rIdx = 0; rIdx < totalRounds; rIdx++) {
    const round = rounds[rIdx] || [];
    const x = rIdx * (colW + connW);
    const isFinals = (rIdx === totalRounds - 1);
    for (let mIdx = 0; mIdx < round.length; mIdx++) {
      const m = round[mIdx];
      if (!m) continue;
      const cy = pos[rIdx][mIdx];
      if (cy === undefined) continue;
      const top = titleH + cy - matchH / 2;

      const hasWinner = !!m.winner;
      const winA = hasWinner && m.a && m.winner === m.a;
      const winB = hasWinner && m.b && m.winner === m.b;
      const loseA = hasWinner && m.a && !winA;
      const loseB = hasWinner && m.b && !winB;

      let clsA = 'bracket-seed' + (winA ? ' winner' : '') + (loseA ? ' loser' : '') + (!m.a ? ' tbd' : '');
      let clsB = 'bracket-seed' + (winB ? ' winner' : '') + (loseB ? ' loser' : '') + (!m.b ? ' tbd' : '');

      // Score display helpers
      const sA = (m.scoreA !== undefined && m.scoreA !== null) ? m.scoreA : '';
      const sB = (m.scoreB !== undefined && m.scoreB !== null) ? m.scoreB : '';
      const hasScores = sA !== '' || sB !== '';
      // Score badges shown after match is decided
      let scoreContentA = '', scoreContentB = '';
      scoreContentA = (sA !== '') ? `<span class="bracket-score${winA ? ' bracket-score-win' : ''}">${sA}</span>` : '';
      scoreContentB = (sB !== '') ? `<span class="bracket-score${winB ? ' bracket-score-win' : ''}">${sB}</span>` : '';

      // Finals match: wider box with pick-winner buttons
      const boxW = isFinals ? colW + 20 : colW;
      const finalsClass = isFinals ? ' bracket-finals-box' : '';
      const bestOf = (tournament && tournament.bestOf) ? Number(tournament.bestOf) : 1;

      // Determine if slots are droppable (first round, no winner, slot empty)
      const canDropA = rIdx === 0 && !hasWinner && !m.a;
      const canDropB = rIdx === 0 && !hasWinner && !m.b;

      // Can this match be advanced? Both teams present, no winner yet
      const canPickWinner = m.a && m.b && !hasWinner;
      const schedInfo = (m.a && m.b && !hasWinner) ? getMatchScheduleInfo(m.a, m.b) : null;
      const hasScheduledMatch = !!(schedInfo && schedInfo.date);

      // Match box — z-index:3 so it sits above connector lines
      // pointer-events:auto when active (pick winner) OR decided (undo button)
      const boxPointer = (canPickWinner || hasWinner) ? 'auto' : 'none';
      html += `<div class="bracket-match-box${finalsClass}" style="position:absolute;left:${x}px;top:${top}px;width:${boxW}px;z-index:3;pointer-events:${boxPointer}" id="bmb_${tIndex}_${bracketType}_${rIdx}_${mIdx}">`;

      // Schedule time badge at top of box
      if (schedInfo && schedInfo.date) {
        const sLabel = schedInfo.time ? `🕐 ${schedInfo.time}` : `📅 ${schedInfo.date}`;
        html += `<div style="font-size:0.68rem;font-weight:600;text-align:center;padding:3px 8px;background:rgba(40,167,69,0.1);color:var(--success);border-bottom:1px solid rgba(16,24,40,0.06);pointer-events:none">${sLabel}</div>`;
      } else if (m.a && m.b && !hasWinner) {
        html += `<div style="font-size:0.68rem;font-weight:600;text-align:center;padding:3px 8px;background:rgba(148,163,184,0.08);color:var(--muted-text);border-bottom:1px solid rgba(16,24,40,0.06);pointer-events:none">🔒 Not Scheduled</div>`;
      }

      // Team A slot — direct click only when match is scheduled today
      if (canDropA) {
        html += `<div class="${clsA} drop-slot" style="pointer-events:auto" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="this.classList.remove('drag-over');handleDrop(event,${tIndex},${rIdx},${mIdx},'a')"><span class="drop-hint">Drop team here</span></div>`;
      } else {
        html += `<div class="${clsA}">${m.a ? getLogo(m.a) + `<span class="bracket-seed-name">${getName(m.a)}</span>` + scoreContentA : '<span class="bracket-seed-name">TBD</span>'}</div>`;
      }

      // Team B slot — direct click only when match is scheduled today
      if (canDropB) {
        html += `<div class="${clsB} drop-slot" style="pointer-events:auto" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="this.classList.remove('drag-over');handleDrop(event,${tIndex},${rIdx},${mIdx},'b')"><span class="drop-hint">Drop team here</span></div>`;
      } else {
        html += `<div class="${clsB}">${m.b ? getLogo(m.b) + `<span class="bracket-seed-name">${getName(m.b)}</span>` + scoreContentB : '<span class="bracket-seed-name">TBD</span>'}</div>`;
      }

      // Final score badge when match is decided
      if (hasWinner && hasScores) {
        html += `<div class="bracket-final-score">${sA} - ${sB}</div>`;
      }
      // Undo button for decided matches
      if (hasWinner) {
        html += `<div class="bracket-undo-row" style="pointer-events:auto"><button class="bracket-undo-btn" onclick="undoMatchWinner(${tIndex},'${bracketType}',${rIdx},${mIdx});event.stopPropagation()">↩ Undo</button></div>`;
      } else if (canPickWinner) {
        // Live Score button (opens digital score sheet)
        html += `<div class="bracket-live-row" style="pointer-events:auto;display:flex;gap:4px;padding:3px 6px;justify-content:center">`;
        html += `<button class="bracket-live-btn" onclick="openLiveScoring(${tIndex},'${bracketType}',${rIdx},${mIdx});event.stopPropagation()">🎯 Live Score</button>`;
        if (hasScheduledMatch) {
          html += `<button class="bracket-override-btn" onclick="bracketOverride(${tIndex},'${bracketType}',${rIdx},${mIdx});event.stopPropagation()">⚡</button>`;
        }
        html += `</div>`;
      }
      if (bestOf > 1) {
        const needed = Math.ceil(bestOf / 2);
        html += `<div class="bracket-bo-label">Bo${bestOf} — First to ${needed}</div>`;
      }
      html += '</div>';
    }
  }

  // ── Connector lines (z-index:1, below match boxes; pointer-events:none) ──
  for (let rIdx = 0; rIdx < totalRounds - 1; rIdx++) {
    const round = rounds[rIdx] || [];
    const nextRound = rounds[rIdx + 1] || [];
    const xRight = rIdx * (colW + connW) + colW;  // right edge of column
    const xMid = xRight + connW / 2;              // midpoint of gap

    for (let nm = 0; nm < nextRound.length; nm++) {
      const ti = nm * 2, bi = nm * 2 + 1;
      const tY = pos[rIdx][ti], bY = pos[rIdx][bi];
      const nY = pos[rIdx + 1][nm];

      if (tY !== undefined && bY !== undefined) {
        // Horizontal from top match
        html += `<div class="bc-h" style="left:${xRight}px;top:${titleH + tY}px;width:${connW / 2}px;z-index:1"></div>`;
        // Horizontal from bottom match
        html += `<div class="bc-h" style="left:${xRight}px;top:${titleH + bY}px;width:${connW / 2}px;z-index:1"></div>`;
        // Vertical merge
        html += `<div class="bc-v" style="left:${xMid}px;top:${titleH + tY}px;height:${bY - tY}px;z-index:1"></div>`;
        // Horizontal to next match
        html += `<div class="bc-h" style="left:${xMid}px;top:${titleH + nY}px;width:${connW / 2}px;z-index:1"></div>`;
      } else if (tY !== undefined) {
        html += `<div class="bc-h" style="left:${xRight}px;top:${titleH + tY}px;width:${connW}px;z-index:1"></div>`;
      } else if (bY !== undefined) {
        html += `<div class="bc-h" style="left:${xRight}px;top:${titleH + bY}px;width:${connW}px;z-index:1"></div>`;
      }
    }
  }

  // ── Champion column ──
  const lastRIdx = totalRounds - 1;
  const lastRound = rounds[lastRIdx] || [];
  const finalMatch = lastRound[0];
  const lx = lastRIdx * (colW + connW) + colW + 20; // +20 for wider finals box
  const ly = pos[lastRIdx] && pos[lastRIdx][0] !== undefined ? pos[lastRIdx][0] : totalH / 2;

  // Connector to champion
  html += `<div class="bc-h" style="left:${lx}px;top:${titleH + ly}px;width:${connW - 10}px;z-index:1"></div>`;

  // For double-elim sub-brackets, label differently
  const isSubBracket = (bracketType === 'w' || bracketType === 'l');
  const champLabel = bracketType === 'w' ? 'W. FINALS<br>WINNER' : bracketType === 'l' ? 'L. FINALS<br>WINNER' : '🏆 CHAMPION';
  const champLabelTbd = bracketType === 'w' ? 'W. FINALS' : bracketType === 'l' ? 'L. FINALS' : '🏆<br>CHAMPION';

  const cX = lx + connW - 10;
  if (finalMatch && finalMatch.winner) {
    const champName = getName(finalMatch.winner);
    const champLogo = getLogo(finalMatch.winner);
    html += `<div class="bracket-champion${isSubBracket ? ' bracket-sub-champ' : ''}" style="position:absolute;left:${cX}px;top:${titleH + ly}px;transform:translateY(-50%)">${champLogo ? '<div style="margin-bottom:4px">' + champLogo.replace('bracket-team-logo','bracket-team-logo-lg') + '</div>' : ''}${champName}<br><small>${champLabel}</small></div>`;
  } else {
    html += `<div class="bracket-champion bracket-champ-tbd" style="position:absolute;left:${cX}px;top:${titleH + ly}px;transform:translateY(-50%)">${champLabelTbd}</div>`;
  }

  html += '</div>';
  return html;
}

// Handle click on seed to set winner
function handleSeedClick(tIndex, bracketType, rIdx, mIdx, slot) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  
  let match = null;
  if (bracketType === 'w' && t.bracket && t.bracket.winners) {
    match = (t.bracket.winners[rIdx] || [])[mIdx];
  } else if (bracketType === 'l' && t.bracket && t.bracket.losers) {
    match = (t.bracket.losers[rIdx] || [])[mIdx];
  } else if (bracketType === 's' && Array.isArray(t.bracket)) {
    match = (t.bracket[rIdx] || [])[mIdx];
  }
  
  if (!match) return;
  if (match.winner) return; // Already has winner

  // Block scoring if match is not scheduled today
  if (match.a && match.b && !isMatchScheduledToday(match.a, match.b)) {
    alert('This match is not scheduled for today. Please set a schedule first.');
    return;
  }
  
  const teamId = match[slot];
  if (!teamId) return;
  
  const allTeams = g('teams');
  const teamAName = match.a ? (allTeams.find(tm => tm.id === match.a) || { name: match.a }).name : 'TBD';
  const teamBName = match.b ? (allTeams.find(tm => tm.id === match.b) || { name: match.b }).name : 'TBD';
  const teamName = (allTeams.find(tm => tm.id === teamId) || { name: teamId }).name;

  // If both teams present, prompt for scores
  if (match.a && match.b) {
    const scoreA = prompt(`Enter score for ${teamAName}:`, match.scoreA !== undefined ? match.scoreA : '');
    if (scoreA === null) return;
    const scoreB = prompt(`Enter score for ${teamBName}:`, match.scoreB !== undefined ? match.scoreB : '');
    if (scoreB === null) return;
    const numA = scoreA !== '' ? Number(scoreA) : null;
    const numB = scoreB !== '' ? Number(scoreB) : null;
    if (numA !== null && !isNaN(numA)) match.scoreA = numA;
    if (numB !== null && !isNaN(numB)) match.scoreB = numB;
    s('tournaments', tournaments);
    // Auto-determine winner from scores
    if (numA !== null && numB !== null && !isNaN(numA) && !isNaN(numB) && numA !== numB) {
      const winnerId = numA > numB ? match.a : match.b;
      chooseWinner(tIndex, rIdx, mIdx, winnerId, bracketType);
      return;
    } else if (numA !== null && numB !== null && numA === numB) {
      // Tie — ask who wins
      if (confirm(`Scores are tied ${numA}-${numB}. Set ${teamName} as winner?`)) {
        chooseWinner(tIndex, rIdx, mIdx, teamId, bracketType);
        return;
      }
    }
    // Just save scores and re-render
    renderBracket(tIndex);
    renderScoringBracket(tIndex);
    return;
  }
  
  // Single team present — old behavior
  if (confirm(`Set ${teamName} as winner?`)) {
    chooseWinner(tIndex, rIdx, mIdx, teamId, bracketType);
  }
}

// Render separate score input panel above the bracket
function renderScorePanel(tIndex) {
  const el = document.getElementById('scoringScorePanel');
  if (!el) return;
  el.innerHTML = '';
  return;
  const tournaments = g('tournaments');
  const idx = Number(tIndex);
  const t = tournaments[idx];
  if (!t) { el.innerHTML = ''; return; }
  const allTeams = g('teams') || [];
  const getName = (id) => id ? (allTeams.find(x => x.id === id) || { name: id }).name : 'TBD';
  const getLogo = (id) => {
    if (!id) return '';
    const tm = allTeams.find(x => x.id === id);
    if (tm && tm.logo) return `<img src="${tm.logo}" class="score-panel-logo">`;
    const initial = tm ? tm.name.charAt(0).toUpperCase() : '?';
    return `<span class="score-panel-logo score-panel-initial">${initial}</span>`;
  };

  // Collect all matches that need scoring (both teams placed, no winner)
  const active = [];
  const bestOf = (t.bestOf) ? Number(t.bestOf) : 1;
  const maxGames = bestOf > 1 ? Math.ceil(bestOf / 2) : '';
  const scorePlaceholder = bestOf > 1 ? 'W' : '0';

  function collectMatches(rounds, bracketType) {
    if (!rounds) return;
    (Array.isArray(rounds) ? rounds : []).forEach((round, rIdx) => {
      (round || []).forEach((m, mIdx) => {
        if (m && m.a && m.b && !m.winner) {
          const pfx = (bracketType === 'w') ? `score_${idx}_w_${rIdx}_${mIdx}_` : (bracketType === 'l') ? `score_${idx}_l_${rIdx}_${mIdx}_` : `score_${idx}_s_${rIdx}_${mIdx}_`;
          const sA = (m.scoreA !== undefined && m.scoreA !== null) ? m.scoreA : '';
          const sB = (m.scoreB !== undefined && m.scoreB !== null) ? m.scoreB : '';
          active.push({ m, rIdx, mIdx, bracketType, pfx, sA, sB });
        }
      });
    });
  }

  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    collectMatches(t.bracket.winners, 'w');
    collectMatches(t.bracket.losers, 'l');
    // Include Grand Final if both teams placed and no winner
    const gf = t.grandFinal;
    if (gf && gf.a && gf.b && !gf.winner) {
      const pfx = `score_${idx}_gf_0_0_`;
      const sA = (gf.scoreA !== undefined && gf.scoreA !== null) ? gf.scoreA : '';
      const sB = (gf.scoreB !== undefined && gf.scoreB !== null) ? gf.scoreB : '';
      active.push({ m: gf, rIdx: 0, mIdx: 0, bracketType: 'gf', pfx, sA, sB, isGrandFinal: true });
    }
  } else if (Array.isArray(t.bracket)) {
    collectMatches(t.bracket, 's');
  }

  if (active.length === 0) {
    el.innerHTML = '';
    return;
  }

  // Determine match schedule status
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const scheduledMatches = g('matches') || [];

  let html = `<div class="score-panel">`;
  html += `<div class="score-panel-header"><span style="font-size:1.2rem">📝</span> Score Input <span class="score-panel-count">${active.length} active</span></div>`;
  html += `<div class="score-panel-grid">`;

  active.forEach(({ m, rIdx, mIdx, bracketType, pfx, sA, sB, isGrandFinal }) => {
    const roundLabel = isGrandFinal ? '🏆 Grand Final' : getRoundLabel(t, rIdx, null);
    const matchSchedule = scheduledMatches.find(sm =>
      sm.status !== 'completed' &&
      ((sm.a === m.a && sm.b === m.b) || (sm.a === m.b && sm.b === m.a))
    );
    const hasSchedule = !!matchSchedule;
    const scheduledToday = hasSchedule && matchSchedule.date === today;
    const scheduleReady = scheduledToday && matchSchedule.time && matchSchedule.time <= currentTime;
    // Unique ID for this match card for override toggle
    const cardId = `scoreCard_${idx}_${bracketType}_${rIdx}_${mIdx}`;

    // Determine status label
    let statusBadge = '';
    if (scheduleReady) {
      statusBadge = '<span style="font-size:0.7rem;padding:2px 8px;margin-left:8px;border-radius:10px;background:rgba(40,167,69,0.1);color:var(--success);font-weight:600">✅ Live Now</span>';
    } else if (scheduledToday) {
      statusBadge = `<span style="font-size:0.7rem;padding:2px 8px;margin-left:8px;border-radius:10px;background:rgba(40,167,69,0.1);color:var(--success);font-weight:600">✅ Scheduled Today (${matchSchedule.time || ''})</span>`;
    } else if (hasSchedule) {
      statusBadge = `<span style="font-size:0.7rem;padding:2px 8px;margin-left:8px;border-radius:10px;background:rgba(255,165,0,0.1);color:#e67e22;font-weight:600">📅 Scheduled: ${matchSchedule.date}</span>`;
    } else {
      statusBadge = '<span style="font-size:0.7rem;padding:2px 8px;margin-left:8px;border-radius:10px;background:rgba(231,76,60,0.1);color:var(--danger);font-weight:600">⏳ Not Scheduled</span>';
    }

    // Score input always available if scheduled today OR if match has a schedule and override is clicked
    // For scheduled today: always editable
    // For has schedule but not today: editable via override
    // No schedule: show override button
    const defaultEditable = scheduledToday;

    html += `<div class="score-panel-card${isGrandFinal ? ' score-panel-gf' : ''}" id="${cardId}">`;
    html += `<div class="score-panel-round${isGrandFinal ? ' score-panel-round-gf' : ''}">${roundLabel}${isGrandFinal ? '' : ' — Match ' + (mIdx + 1)}${statusBadge}</div>`;
    html += `<div class="score-panel-bracket">`;
    // Team A slot
    html += `<div class="score-panel-slot">`;
    html += `<div class="score-panel-team-info">${getLogo(m.a)}<span class="score-panel-team-name">${getName(m.a)}</span></div>`;
    html += `<input type="number" id="${pfx}a" class="score-panel-input" placeholder="${scorePlaceholder}" min="0"${maxGames ? ' max="'+maxGames+'"' : ''} value="${sA}" oninput="autoSetScore(${idx},'${bracketType}',${rIdx},${mIdx})"${!defaultEditable ? ' disabled style="opacity:0.5"' : ''}>`;
    html += `</div>`;
    // VS divider
    html += `<div class="score-panel-divider"><span class="score-panel-vs-badge">VS</span></div>`;
    // Team B slot
    html += `<div class="score-panel-slot">`;
    html += `<div class="score-panel-team-info">${getLogo(m.b)}<span class="score-panel-team-name">${getName(m.b)}</span></div>`;
    html += `<input type="number" id="${pfx}b" class="score-panel-input" placeholder="${scorePlaceholder}" min="0"${maxGames ? ' max="'+maxGames+'"' : ''} value="${sB}" oninput="autoSetScore(${idx},'${bracketType}',${rIdx},${mIdx})"${!defaultEditable ? ' disabled style="opacity:0.5"' : ''}>`;
    html += `</div>`;
    html += `</div>`;
    // Finish Match button
    if (defaultEditable) {
      html += `<button class="form-btn" style="width:100%;background:var(--success);color:#fff;padding:8px 14px;font-size:0.88rem;margin-top:6px;border-radius:8px;font-weight:700" onclick="finishBracketMatch(${idx},'${bracketType}',${rIdx},${mIdx})">🏁 Finish Match</button>`;
    } else {
      html += `<div id="${cardId}_actions" style="display:flex;gap:8px;align-items:center;justify-content:center;margin-top:4px">`;
      html += `<button class="form-btn accent-btn" style="margin:0;padding:6px 14px;font-size:0.82rem" onclick="overrideScoreInput('${cardId}',${idx},'${bracketType}',${rIdx},${mIdx},'${pfx}')">⚡ Start Early / Override</button>`;
      html += `</div>`;
    }
    if (bestOf > 1) {
      html += `<div class="score-panel-bo">Bo${bestOf} — First to ${Math.ceil(bestOf/2)}</div>`;
    }
    html += `</div>`;
  });

  html += `</div></div>`;
  el.innerHTML = html;
}

// Override: enable score inputs for a match that isn't scheduled today (early start)
function overrideScoreInput(cardId, tIdx, bracketType, rIdx, mIdx, pfx) {
  const inputA = document.getElementById(pfx + 'a');
  const inputB = document.getElementById(pfx + 'b');
  if (inputA) { inputA.disabled = false; inputA.style.opacity = '1'; }
  if (inputB) { inputB.disabled = false; inputB.style.opacity = '1'; }
  const actions = document.getElementById(cardId + '_actions');
  if (actions) {
    actions.innerHTML = `<button class="form-btn" style="width:100%;background:var(--success);color:#fff;padding:8px 14px;font-size:0.88rem;border-radius:8px;font-weight:700" onclick="finishBracketMatch(${tIdx},'${bracketType}',${rIdx},${mIdx})">🏁 Finish Match</button>`;
  }
}

function closeOverridePicker() {
  const overlay = document.getElementById('overridePickerOverlay');
  if (overlay) overlay.style.display = 'none';
  window.__overridePickerCallback = null;
}

function showOverridePicker(title, optionA, optionB, onPick) {
  let overlay = document.getElementById('overridePickerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overridePickerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:10001;display:none;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `
      <div style="width:min(460px,96vw);background:var(--surface);border:1px solid rgba(16,24,40,0.08);border-radius:12px;box-shadow:0 12px 36px rgba(16,24,40,0.2);padding:18px">
        <div id="overridePickerTitle" style="font-weight:800;font-size:1.05rem;margin-bottom:10px">Override Winner</div>
        <div style="color:var(--muted-text);font-size:0.88rem;margin-bottom:12px">Select the winner directly.</div>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          <button id="overridePickA" class="form-btn" style="padding:10px 12px;background:var(--success);color:#fff;font-weight:700;border-radius:8px"></button>
          <button id="overridePickB" class="form-btn" style="padding:10px 12px;background:var(--success);color:#fff;font-weight:700;border-radius:8px"></button>
        </div>
        <div style="text-align:right">
          <button id="overridePickCancel" class="form-btn secondary-btn" style="padding:7px 12px">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverridePicker();
    });
  }

  const titleEl = document.getElementById('overridePickerTitle');
  const btnA = document.getElementById('overridePickA');
  const btnB = document.getElementById('overridePickB');
  const btnCancel = document.getElementById('overridePickCancel');
  if (!titleEl || !btnA || !btnB || !btnCancel) return;

  titleEl.textContent = title || 'Override Winner';
  btnA.textContent = `✔ ${optionA}`;
  btnB.textContent = `✔ ${optionB}`;

  window.__overridePickerCallback = onPick;
  btnA.onclick = () => {
    const cb = window.__overridePickerCallback;
    closeOverridePicker();
    if (typeof cb === 'function') cb('a');
  };
  btnB.onclick = () => {
    const cb = window.__overridePickerCallback;
    closeOverridePicker();
    if (typeof cb === 'function') cb('b');
  };
  btnCancel.onclick = () => closeOverridePicker();

  overlay.style.display = 'flex';
}

// Override: pick winner immediately for a bracket match
function bracketOverride(tIndex, bracketType, rIdx, mIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  let match = null;
  if (bracketType === 'w' && t.bracket && t.bracket.winners) match = (t.bracket.winners[rIdx] || [])[mIdx];
  else if (bracketType === 'l' && t.bracket && t.bracket.losers) match = (t.bracket.losers[rIdx] || [])[mIdx];
  else if (bracketType === 's' && Array.isArray(t.bracket)) match = (t.bracket[rIdx] || [])[mIdx];
  if (!match || !match.a || !match.b) return;
  const allTeams = g('teams');
  const nameA = (allTeams.find(tm => tm.id === match.a) || { name: match.a }).name;
  const nameB = (allTeams.find(tm => tm.id === match.b) || { name: match.b }).name;
  showOverridePicker('Override Winner', nameA, nameB, (picked) => {
    const winnerId = picked === 'a' ? match.a : match.b;
    chooseWinner(tIndex, rIdx, mIdx, winnerId, bracketType);
  });
}

// Override: pick winner immediately for Grand Final
function gfOverride(tIndex) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.grandFinal || !t.grandFinal.a || !t.grandFinal.b) return;
  const allTeams = g('teams');
  const nameA = (allTeams.find(tm => tm.id === t.grandFinal.a) || { name: t.grandFinal.a }).name;
  const nameB = (allTeams.find(tm => tm.id === t.grandFinal.b) || { name: t.grandFinal.b }).name;
  showOverridePicker('Override Grand Final Winner', nameA, nameB, (picked) => {
    const winnerId = picked === 'a' ? t.grandFinal.a : t.grandFinal.b;
    chooseWinner(tIndex, 0, 0, winnerId, 'gf');
  });
}

// Override: pick winner immediately for a round-robin match
function rrOverride(tIndex, matchIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.roundRobin || !t.roundRobin[matchIdx]) return;
  const match = t.roundRobin[matchIdx];
  if (!match.a || !match.b) return;
  const allTeams = g('teams');
  const nameA = (allTeams.find(tm => tm.id === match.a) || { name: match.a }).name;
  const nameB = (allTeams.find(tm => tm.id === match.b) || { name: match.b }).name;
  showOverridePicker('Override Round Robin Winner', nameA, nameB, (picked) => {
    const winnerId = picked === 'a' ? match.a : match.b;
    setRRWinner(tIndex, matchIdx, winnerId);
  });
}

// Set a round-robin match winner directly (no score required)
function setRRWinner(tIndex, matchIdx, winnerId) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.roundRobin || !t.roundRobin[matchIdx]) return;
  const match = t.roundRobin[matchIdx];
  if (!match.a || !match.b) return;
  match.played = true;
  match.winner = winnerId;
  s('tournaments', tournaments);
  syncWinnerSelectionToSchedule(match.a, match.b, winnerId, t.name);
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

// Override: pick winner immediately for a Group+Knockout group match
function gkOverride(tIndex, groupName, matchIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.groupStage || !t.groupStage[groupName] || !t.groupStage[groupName][matchIdx]) return;
  const match = t.groupStage[groupName][matchIdx];
  if (!match.a || !match.b) return;
  const allTeams = g('teams');
  const nameA = (allTeams.find(tm => tm.id === match.a) || { name: match.a }).name;
  const nameB = (allTeams.find(tm => tm.id === match.b) || { name: match.b }).name;
  showOverridePicker('Override Group Match Winner', nameA, nameB, (picked) => {
    const winnerId = picked === 'a' ? match.a : match.b;
    setGKWinner(tIndex, groupName, matchIdx, winnerId);
  });
}

// Set a group+knockout group match winner directly (no score required)
function setGKWinner(tIndex, groupName, matchIdx, winnerId) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.groupStage || !t.groupStage[groupName] || !t.groupStage[groupName][matchIdx]) return;
  const match = t.groupStage[groupName][matchIdx];
  if (!match.a || !match.b) return;
  match.played = true;
  match.winner = winnerId;
  s('tournaments', tournaments);
  syncWinnerSelectionToSchedule(match.a, match.b, winnerId, t.name);
  checkAndFinalizeGroups(tIndex);
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

// Render draggable team pool for manual placement
function renderTeamPool(tIndex) {
  const el = document.getElementById('scoringTeamPool');
  if (!el) return;
  const tournaments = g('tournaments');
  const idx = Number(tIndex);
  const t = tournaments[idx];
  if (!t) { 
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted-text);font-size:0.9rem;">Select a tournament</div>'; 
    return; 
  }
  const teams = (t.teams || []).map(id => (g('teams').find(tm => tm.id === id) || { id, name: id }));
  // collect assigned team ids to mark them
  const assigned = new Set();
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    (t.bracket.winners || []).forEach(r => (r||[]).forEach(m => { if (m && m.a) assigned.add(m.a); if (m && m.b) assigned.add(m.b); }));
    (t.bracket.losers || []).forEach(r => (r||[]).forEach(m => { if (m && m.a) assigned.add(m.a); if (m && m.b) assigned.add(m.b); }));
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    (t.roundRobin || []).forEach(m => { if (m && m.a) assigned.add(m.a); if (m && m.b) assigned.add(m.b); });
  } else if (t.format === 'groupknockout' && t.groupStage) {
    Object.keys(t.groupStage).forEach(gn => (t.groupStage[gn] || []).forEach(m => { if (m && m.a) assigned.add(m.a); if (m && m.b) assigned.add(m.b); }));
    (t.bracket || []).forEach(r => (r||[]).forEach(m => { if (m && m.a) assigned.add(m.a); if (m && m.b) assigned.add(m.b); }));
  } else if (Array.isArray(t.bracket)) {
    (t.bracket || []).forEach(r => (r||[]).forEach(m => { if (m && m.a) assigned.add(m.a); if (m && m.b) assigned.add(m.b); }));
  }
  
  const assignedCount = assigned.size;
  const totalCount = teams.length;
  const autoPlacementFormat = (t.format === 'roundrobin' || t.format === 'groupknockout');
  let html = `<div class="team-pool-header">Team Pool <span class="pool-count">${assignedCount}/${totalCount}</span></div>`;
  if (teams.length === 0) {
    html += '<div class="pool-empty">No teams in tournament</div>';
  } else {
    html += `<div class="pool-instructions">${autoPlacementFormat ? 'Auto-generated from tournament teams' : 'Drag teams into bracket slots'}</div>`;
    html += teams.map(tm => {
      const isAssigned = assigned.has(tm.id);
      const tLogo = (tm.logo) ? `<img src="${tm.logo}" class="pool-team-logo">` : `<span class="pool-team-initial">${tm.name.charAt(0).toUpperCase()}</span>`;
      return `<div class="draggable-team${isAssigned ? ' assigned' : ''}" draggable="${!isAssigned && !autoPlacementFormat}" ondragstart="handleDragStart(event,'${tm.id}')" ondragend="handleDragEnd(event)">${tLogo}<span class="pool-team-name">${tm.name}</span>${isAssigned ? '<span class="pool-assigned-badge">✓</span>' : ''}</div>`;
    }).join('');
  }
  el.innerHTML = html;
}

function handleDragStart(e, teamId) {
  e.dataTransfer.setData('text/plain', teamId);
  e.dataTransfer.effectAllowed = 'move';
  if (e.target) e.target.classList.add('dragging');
  // Highlight all drop slots
  setTimeout(() => document.querySelectorAll('.drop-slot').forEach(el => el.classList.add('drop-target-active')), 0);
}

function handleDragEnd(e) {
  if (e.target) e.target.classList.remove('dragging');
  document.querySelectorAll('.drop-slot').forEach(el => el.classList.remove('drop-target-active','drag-over'));
}

function handleDrop(e, tIndex, rIdx, mIdx, slot) {
  e.preventDefault();
  const teamId = e.dataTransfer.getData('text/plain');
  if (!teamId) return;
  assignTeamToSlot(Number(tIndex), Number(rIdx), Number(mIdx), slot, teamId);
}

function assignTeamToSlot(tIndex, rIdx, mIdx, slot, teamId) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  // remove team from previous slots
  removeTeamFromSlots(t, teamId);
  // place into the target slot depending on format
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    const winners = t.bracket.winners;
    if (winners[rIdx] && winners[rIdx][mIdx]) winners[rIdx][mIdx][slot] = teamId;
    else if (winners[rIdx] && !winners[rIdx][mIdx]) winners[rIdx][mIdx] = { a: null, b: null, winner: null, [slot]: teamId };
    // persist
    t.bracket.winners = winners;
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    // for round robin, we interpret rIdx as match index and slot as 'a' or 'b'
    if (t.roundRobin[rIdx]) t.roundRobin[rIdx][slot] = teamId;
  } else if (Array.isArray(t.bracket)) {
    if (!t.bracket[rIdx]) t.bracket[rIdx] = [];
    if (!t.bracket[rIdx][mIdx]) t.bracket[rIdx][mIdx] = { a: null, b: null, winner: null };
    t.bracket[rIdx][mIdx][slot] = teamId;
  }
  tournaments[tIndex] = t;
  s('tournaments', tournaments);
  // re-render pool and bracket
  updateTournamentCurrentRound(tIndex);
  renderTeamPool(tIndex);
  renderScoringBracket(tIndex);
  if (typeof loadDash === 'function') loadDash();
}

// Save numerical scores entered in a match and persist; optionally auto-assign winner when scores are unambiguous
function saveMatchScore(tIndex, bracketType, rIdx, mIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  // determine field ids used earlier for inputs
  const prefix = (bracketType === 'gf') ? `score_${tIndex}_gf_${rIdx}_${mIdx}_` : (bracketType === 'w') ? `score_${tIndex}_w_${rIdx}_${mIdx}_` : (bracketType === 'l') ? `score_${tIndex}_l_${rIdx}_${mIdx}_` : `score_${tIndex}_s_${rIdx}_${mIdx}_`;
  const aEl = document.getElementById(prefix + 'a');
  const bEl = document.getElementById(prefix + 'b');
  const aVal = aEl ? Number(aEl.value) : null;
  const bVal = bEl ? Number(bEl.value) : null;
  if (aVal === null && bVal === null) return alert('Enter at least one score');
  // get match object depending on format
  let match = null;
  if (bracketType === 'gf' && t.grandFinal) {
    match = t.grandFinal;
  } else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    if (bracketType === 'w') match = (t.bracket.winners[rIdx] || [])[mIdx];
    else match = (t.bracket.losers[rIdx] || [])[mIdx];
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    match = t.roundRobin[rIdx];
  } else if (Array.isArray(t.bracket)) {
    match = (t.bracket[rIdx] || [])[mIdx];
  }
  if (!match) return alert('Match not found');
  if (aVal !== null && !Number.isNaN(aVal)) match.scoreA = aVal;
  if (bVal !== null && !Number.isNaN(bVal)) match.scoreB = bVal;
  // persist scores
  s('tournaments', tournaments);
  // Sync scores to scheduled match (without completing)
  if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, match.scoreA || 0, match.scoreB || 0, false);
  }
  // attempt to auto-set winner if scores unambiguous
  setMatchScoresAndMaybeWinner(tIndex, bracketType, rIdx, mIdx);
  renderBracket(tIndex);
  renderScoringBracket(tIndex);
  if (typeof loadDash === 'function') loadDash();
}

// Save round-robin match scores and auto-pick winner (respects Best-of-N)
function saveRRScore(tIndex, matchIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.roundRobin || !t.roundRobin[matchIdx]) return alert('Match not found');
  const aEl = document.getElementById(`rr_score_${tIndex}_${matchIdx}_a`);
  const bEl = document.getElementById(`rr_score_${tIndex}_${matchIdx}_b`);
  const aVal = aEl && aEl.value !== '' ? Number(aEl.value) : null;
  const bVal = bEl && bEl.value !== '' ? Number(bEl.value) : null;
  if (aVal === null && bVal === null) return alert('Enter at least one score');
  const match = t.roundRobin[matchIdx];
  if (aVal !== null && !isNaN(aVal)) match.scoreA = aVal;
  if (bVal !== null && !isNaN(bVal)) match.scoreB = bVal;
  // Auto-determine winner with BO/N validation
  if (aVal !== null && bVal !== null && !isNaN(aVal) && !isNaN(bVal) && aVal !== bVal) {
    const bestOf = Number(t.bestOf) || 1;
    let canDecide = true;
    if (bestOf > 1) {
      const needed = Math.ceil(bestOf / 2);
      canDecide = (aVal === needed || bVal === needed) && (aVal + bVal <= bestOf);
    }
    if (canDecide) {
      match.played = true;
      match.winner = aVal > bVal ? match.a : match.b;
    }
  }
  s('tournaments', tournaments);
  // Sync scores to scheduled match (complete if winner decided)
  if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, match.scoreA || 0, match.scoreB || 0, !!match.winner);
  }
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

// Save group+knockout stage scores and auto-pick winner (respects Best-of-N)
function saveGKScore(tIndex, groupName, matchIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.groupStage || !t.groupStage[groupName] || !t.groupStage[groupName][matchIdx]) return alert('Match not found');
  const aEl = document.getElementById(`gk_score_${tIndex}_${groupName}_${matchIdx}_a`);
  const bEl = document.getElementById(`gk_score_${tIndex}_${groupName}_${matchIdx}_b`);
  const aVal = aEl && aEl.value !== '' ? Number(aEl.value) : null;
  const bVal = bEl && bEl.value !== '' ? Number(bEl.value) : null;
  if (aVal === null && bVal === null) return alert('Enter at least one score');
  const match = t.groupStage[groupName][matchIdx];
  if (aVal !== null && !isNaN(aVal)) match.scoreA = aVal;
  if (bVal !== null && !isNaN(bVal)) match.scoreB = bVal;
  if (aVal !== null && bVal !== null && !isNaN(aVal) && !isNaN(bVal) && aVal !== bVal) {
    const bestOf = Number(t.bestOf) || 1;
    let canDecide = true;
    if (bestOf > 1) {
      const needed = Math.ceil(bestOf / 2);
      canDecide = (aVal === needed || bVal === needed) && (aVal + bVal <= bestOf);
    }
    if (canDecide) {
      match.played = true;
      match.winner = aVal > bVal ? match.a : match.b;
    }
  }
  s('tournaments', tournaments);
  // Sync scores to scheduled match (complete if winner decided)
  if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, match.scoreA || 0, match.scoreB || 0, !!match.winner);
  }
  checkAndFinalizeGroups(tIndex);
  renderScoringBracket(tIndex);
  loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

// When both scores present, choose winner automatically if possible (respects Best-of-N)
function setMatchScoresAndMaybeWinner(tIndex, bracketType, rIdx, mIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  let match = null;
  if (bracketType === 'gf' && t.grandFinal) {
    match = t.grandFinal;
  } else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    if (bracketType === 'w') match = (t.bracket.winners[rIdx] || [])[mIdx];
    else match = (t.bracket.losers[rIdx] || [])[mIdx];
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    match = t.roundRobin[rIdx];
  } else if (Array.isArray(t.bracket)) {
    match = (t.bracket[rIdx] || [])[mIdx];
  }
  if (!match) return;
  const a = (match.scoreA !== undefined) ? Number(match.scoreA) : null;
  const b = (match.scoreB !== undefined) ? Number(match.scoreB) : null;
  if (a === null || b === null) return;
  if (isNaN(a) || isNaN(b)) return;
  if (a === b) return; // draw - do not auto-assign
  if (match.winner) return;

  // Best-of-N check: scores represent games won, winner needs ceil(bestOf/2)
  const bestOf = Number(t.bestOf) || 1;
  if (bestOf > 1) {
    const needed = Math.ceil(bestOf / 2);
    // Neither team has reached the required wins yet
    if (a < needed && b < needed) return;
    // Validate: winner's score must equal needed, total games must not exceed bestOf
    if (a + b > bestOf) return;
    if (a !== needed && b !== needed) return;
  }

  const winnerId = (a > b) ? match.a : match.b;
  if (!winnerId) return;
  const prevSnapshot = JSON.parse(JSON.stringify(t || null));
  const bType = (bracketType === 'w') ? 'w' : (bracketType === 'l') ? 'l' : (bracketType === 'gf') ? 'gf' : undefined;
  chooseWinner(Number(tIndex), Number(rIdx), Number(mIdx), winnerId, bType);
  // Auto-sync winner to scheduled match (mark completed)
  if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, a, b, true);
  }
  window.__lastAutoWinner = { tIndex: Number(tIndex), prev: prevSnapshot, timestamp: Date.now() };
  const boLabel = bestOf > 1 ? ` (Bo${bestOf})` : '';
  showAutoWinnerToast(`Auto-assigned winner: ${(g('teams').find(tm=>tm.id===winnerId)||{name:winnerId}).name}${boLabel}`);
}

// called by number inputs onchange/oninput - debounce by tiny delay to allow typing
function autoSetScore(tIndex, bracketType, rIdx, mIdx) {
  const key = `__auto_score_timer_${tIndex}_${bracketType}_${rIdx}_${mIdx}`;
  if (window[key]) clearTimeout(window[key]);
  window[key] = setTimeout(()=>{
    const tournaments = g('tournaments');
    const t = tournaments[tIndex];
    if (!t) return;
    const prefix = (bracketType === 'gf') ? `score_${tIndex}_gf_${rIdx}_${mIdx}_` : (bracketType === 'w') ? `score_${tIndex}_w_${rIdx}_${mIdx}_` : (bracketType === 'l') ? `score_${tIndex}_l_${rIdx}_${mIdx}_` : `score_${tIndex}_s_${rIdx}_${mIdx}_`;
    const aEl = document.getElementById(prefix + 'a');
    const bEl = document.getElementById(prefix + 'b');
    let match = null;
    if (bracketType === 'gf' && t.grandFinal) {
      match = t.grandFinal;
    } else if (t.format === 'double' && t.bracket && t.bracket.winners) {
      if (bracketType === 'w') match = (t.bracket.winners[rIdx] || [])[mIdx];
      else match = (t.bracket.losers[rIdx] || [])[mIdx];
    } else if (t.format === 'roundrobin' && t.roundRobin) {
      match = t.roundRobin[rIdx];
    } else if (Array.isArray(t.bracket)) {
      match = (t.bracket[rIdx] || [])[mIdx];
    }
    if (!match) return;
    if (aEl && aEl.value !== '') match.scoreA = Number(aEl.value);
    if (bEl && bEl.value !== '') match.scoreB = Number(bEl.value);
    s('tournaments', tournaments);
    // Sync to scheduled match
    if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
      syncBracketToSchedule(match.a, match.b, match.scoreA || 0, match.scoreB || 0, false);
    }
  }, 650);
}

// Auto-save round-robin scores as user types
function autoSaveRRScore(tIndex, matchIdx) {
  const key = `__auto_rr_timer_${tIndex}_${matchIdx}`;
  if (window[key]) clearTimeout(window[key]);
  window[key] = setTimeout(()=>{
    const tournaments = g('tournaments');
    const t = tournaments[tIndex];
    if (!t || !t.roundRobin || !t.roundRobin[matchIdx]) return;
    const match = t.roundRobin[matchIdx];
    const aEl = document.getElementById(`rr_score_${tIndex}_${matchIdx}_a`);
    const bEl = document.getElementById(`rr_score_${tIndex}_${matchIdx}_b`);
    if (aEl && aEl.value !== '') match.scoreA = Number(aEl.value);
    if (bEl && bEl.value !== '') match.scoreB = Number(bEl.value);
    s('tournaments', tournaments);
    if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
      syncBracketToSchedule(match.a, match.b, match.scoreA || 0, match.scoreB || 0, false);
    }
  }, 650);
}

// Auto-save group+knockout scores as user types
function autoSaveGKScore(tIndex, groupName, matchIdx) {
  const key = `__auto_gk_timer_${tIndex}_${groupName}_${matchIdx}`;
  if (window[key]) clearTimeout(window[key]);
  window[key] = setTimeout(()=>{
    const tournaments = g('tournaments');
    const t = tournaments[tIndex];
    if (!t || !t.groupStage || !t.groupStage[groupName] || !t.groupStage[groupName][matchIdx]) return;
    const match = t.groupStage[groupName][matchIdx];
    const aEl = document.getElementById(`gk_score_${tIndex}_${groupName}_${matchIdx}_a`);
    const bEl = document.getElementById(`gk_score_${tIndex}_${groupName}_${matchIdx}_b`);
    if (aEl && aEl.value !== '') match.scoreA = Number(aEl.value);
    if (bEl && bEl.value !== '') match.scoreB = Number(bEl.value);
    s('tournaments', tournaments);
    if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
      syncBracketToSchedule(match.a, match.b, match.scoreA || 0, match.scoreB || 0, false);
    }
  }, 650);
}

// show a small toast to allow undoing the last auto-assigned winner
function showAutoWinnerToast(msg){
  const t = document.getElementById('autoToast');
  if(!t) return;
  t.querySelector('.auto-toast-message').innerText = msg || 'Winner auto-assigned';
  t.classList.add('show');
  t.style.display = 'flex';
  // auto-hide after 6s
  if(window.__autoToastTimer) clearTimeout(window.__autoToastTimer);
  window.__autoToastTimer = setTimeout(()=>{ dismissAutoToast(); }, 6000);
}

function dismissAutoToast(){
  const t = document.getElementById('autoToast');
  if(!t) return;
  t.classList.remove('show');
  t.style.display = 'none';
  if(window.__autoToastTimer) { clearTimeout(window.__autoToastTimer); window.__autoToastTimer = null; }
}

function undoLastAutoWinner(){
  const last = window.__lastAutoWinner;
  if(!last || !last.prev) return alert('No auto-assigned winner to undo');
  const tournaments = g('tournaments');
  tournaments[last.tIndex] = last.prev;
  s('tournaments', tournaments);
  // re-render and clear the undo buffer
  renderBracket(last.tIndex);
  renderScoringBracket(last.tIndex);
  loadStandings();
  dismissAutoToast();
  window.__lastAutoWinner = null;
  alert('Auto-assigned winner undone');
}

// Assign a persistent match label based on the order the user clicks matches
function assignMatchNumber(tIndex, bracketType, rIdx, mIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || !t.bracket) return;
  // ensure counters exist
  if (!t.matchCounters) t.matchCounters = { w: 0, l: 0 };
  // get target match object depending on bracket type
  let match = null;
  if (bracketType === 'w') {
    if (!t.bracket.winners || !t.bracket.winners[rIdx]) return;
    match = t.bracket.winners[rIdx][mIdx];
    if (!match) {
      t.bracket.winners[rIdx][mIdx] = { a: null, b: null, winner: null };
      match = t.bracket.winners[rIdx][mIdx];
    }
  } else if (bracketType === 'l') {
            const gkIsToday = gkInfo && gkInfo.date && isMatchScheduledToday(m.a, m.b);
    if (!t.bracket.losers || !t.bracket.losers[rIdx]) return;
    if (!match) {
      t.bracket.losers[rIdx][mIdx] = { a: null, b: null, winner: null };
      match = t.bracket.losers[rIdx][mIdx];
            } else {
              html += ` <span style="font-size:0.75rem;color:var(--muted-text)">🔒 Not Scheduled</span>`;
    }
  } else return;

            html += `<div style="margin:4px 0 4px 8px${gkIsToday ? ';display:flex;gap:6px;flex-wrap:wrap' : ''}" id="gk_override_${idx}_${safeGname}_${i}">`;
            if (gkIsToday) {
              html += `<button class="form-btn" style="padding:5px 14px;font-size:0.82rem;background:var(--success);color:#fff;font-weight:700;border-radius:8px" onclick="setGKWinner(${idx},'${safeGname}',${i},'${m.a}')">✔ ${aName}</button>`;
              html += `<button class="form-btn" style="padding:5px 14px;font-size:0.82rem;background:var(--success);color:#fff;font-weight:700;border-radius:8px" onclick="setGKWinner(${idx},'${safeGname}',${i},'${m.b}')">✔ ${bName}</button>`;
            } else {
              html += `<button class="form-btn accent-btn" style="padding:5px 14px;font-size:0.82rem" onclick="gkOverride(${idx},'${safeGname}',${i})">⚡ Override</button>`;
            }
  const prefix = (bracketType === 'w') ? 'U-Match' : 'L-Match';
  match.matchLabel = `${prefix} ${t.matchCounters[bracketType]}`;
  tournaments[tIndex] = t;
  s('tournaments', tournaments);
  renderScoringBracket(tIndex);
}

function removeTeamFromSlots(t, teamId) {
  if (!t || !teamId) return;
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    (t.bracket.winners || []).forEach(r => (r||[]).forEach(m => { if (m && m.a === teamId) m.a = null; if (m && m.b === teamId) m.b = null; }));
    (t.bracket.losers || []).forEach(r => (r||[]).forEach(m => { if (m && m.a === teamId) m.a = null; if (m && m.b === teamId) m.b = null; }));
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    (t.roundRobin || []).forEach(m => { if (m && m.a === teamId) m.a = null; if (m && m.b === teamId) m.b = null; });
  } else if (Array.isArray(t.bracket)) {
    (t.bracket || []).forEach(r => (r||[]).forEach(m => { if (m && m.a === teamId) m.a = null; if (m && m.b === teamId) m.b = null; }));
  }
}

// Compute and store the current active round for a tournament so UI stays in sync
function updateTournamentCurrentRound(tIndex) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  if (t.format === 'roundrobin') {
    t.currentRound = 'rr';
    t.currentRoundBracket = 'rr';
    tournaments[tIndex] = t; s('tournaments', tournaments); return;
  }
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    // prefer earliest winners round with pending matches
    for (let r = 0; r < (t.bracket.winners || []).length; r++) {
      const rnd = t.bracket.winners[r] || [];
      const pending = rnd.some(m => m && !m.winner && (m.a || m.b));
      if (pending) { t.currentRound = r; t.currentRoundBracket = 'w'; tournaments[tIndex] = t; s('tournaments', tournaments); return; }
    }
    // then check losers for pending
    for (let r = 0; r < (t.bracket.losers || []).length; r++) {
      const rnd = t.bracket.losers[r] || [];
      const pending = rnd.some(m => m && !m.winner && (m.a || m.b));
      if (pending) { t.currentRound = r; t.currentRoundBracket = 'l'; tournaments[tIndex] = t; s('tournaments', tournaments); return; }
    }
    // fallback to last winners round
    t.currentRound = Math.max(0, (t.bracket.winners || []).length - 1);
    t.currentRoundBracket = 'w';
    tournaments[tIndex] = t; s('tournaments', tournaments); return;
  }
  // single-elimination
  if (Array.isArray(t.bracket)) {
    for (let r = 0; r < t.bracket.length; r++) {
      const rnd = t.bracket[r] || [];
      const pending = rnd.some(m => m && !m.winner && (m.a || m.b));
      if (pending) { t.currentRound = r; t.currentRoundBracket = 'w'; tournaments[tIndex] = t; s('tournaments', tournaments); return; }
    }
    t.currentRound = Math.max(0, t.bracket.length - 1);
    t.currentRoundBracket = 'w';
    tournaments[tIndex] = t; s('tournaments', tournaments); return;
  }
}

// ═══════════════════════════════════════════════════════════════
// ██  LIVE SCORING SYSTEM — Full-screen digital score sheet  ██
// ═══════════════════════════════════════════════════════════════

// Scoring configuration per sport (periods, scoring increments, win conditions)
const SCORING_CONFIGS = {
  Basketball: { periodName: 'Quarter', periods: 4, overtimeName: 'OT', scoreButtons: [1, 2, 3], minusButtons: [1], winBy: 0, pointsPerPeriod: false },
  Volleyball: { periodName: 'Set', periods: 3, overtimeName: 'Extra Set', scoreButtons: [1], minusButtons: [1], winBy: 2, maxScore: 25, maxScoreDecider: 15, setsToWin: 2, pointsPerPeriod: true },
  Badminton:  { periodName: 'Set', periods: 3, overtimeName: 'Decider', scoreButtons: [1], minusButtons: [1, 3], winBy: 2, maxScore: 21, maxScoreDecider: 21, setsToWin: 2, pointsPerPeriod: true },
  Soccer:     { periodName: 'Half', periods: 2, overtimeName: 'Extra Time', scoreButtons: [1], minusButtons: [1], winBy: 0, pointsPerPeriod: false },
  TableTennis:{ periodName: 'Set', periods: 5, overtimeName: 'Decider', scoreButtons: [1], minusButtons: [1], winBy: 2, maxScore: 11, maxScoreDecider: 11, setsToWin: 3, pointsPerPeriod: true },
  Tennis:     { periodName: 'Set', periods: 3, overtimeName: 'Final Set', scoreButtons: [1], minusButtons: [1], winBy: 2, maxScore: 6, maxScoreDecider: 6, setsToWin: 2, pointsPerPeriod: true },
  Baseball:   { periodName: 'Inning', periods: 9, overtimeName: 'Extra Inning', scoreButtons: [1], minusButtons: [1], winBy: 0, pointsPerPeriod: false },
  Default:    { periodName: 'Period', periods: 2, overtimeName: 'Overtime', scoreButtons: [1], minusButtons: [1], winBy: 0, pointsPerPeriod: false }
};

function getScoringConfig(sport) {
  return SCORING_CONFIGS[sport] || SCORING_CONFIGS.Default;
}

// Active live scoring session state
let _liveScore = null;

function openLiveScoring(tIndex, bracketType, rIdx, mIdx) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  let match = null;
  if (bracketType === 'gf' && t.grandFinal) match = t.grandFinal;
  else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    match = bracketType === 'w' ? (t.bracket.winners[rIdx]||[])[mIdx] : (t.bracket.losers[rIdx]||[])[mIdx];
  } else if (t.format === 'roundrobin' && t.roundRobin) match = t.roundRobin[mIdx];
  else if (Array.isArray(t.bracket)) match = (t.bracket[rIdx]||[])[mIdx];
  if (!match || !match.a || !match.b) return alert('Both teams must be placed before scoring.');
  if (match.winner) return alert('This match already has a winner.');

  const allTeams = g('teams') || [];
  const teamA = allTeams.find(x => x.id === match.a) || { id: match.a, name: match.a };
  const teamB = allTeams.find(x => x.id === match.b) || { id: match.b, name: match.b };
  const config = getScoringConfig(t.sport);
  const schedInfo = getMatchScheduleInfo(match.a, match.b);
  const matchObj = g('matches') || [];
  const schedMatch = matchObj.find(m =>
    ((m.a === match.a && m.b === match.b) || (m.a === match.b && m.b === match.a))
  );

  // Initialize or restore live scoring state
  const lsKey = `ls_${tIndex}_${bracketType}_${rIdx}_${mIdx}`;
  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem(lsKey)); } catch(e) {}

  if (stored) {
    _liveScore = stored;
  } else {
    _liveScore = {
      key: lsKey,
      tIndex, bracketType, rIdx, mIdx,
      teamA: { id: teamA.id, name: teamA.name, logo: teamA.logo || null, group: teamA.group || '' },
      teamB: { id: teamB.id, name: teamB.name, logo: teamB.logo || null, group: teamB.group || '' },
      sport: t.sport || 'Default',
      tournament: t.name,
      bigEventName: '',
      config,
      currentPeriod: 0,
      periods: [],           // [{scoreA, scoreB}] per period
      totalA: 0,
      totalB: 0,
      feed: [],              // last scoring events
      status: 'live',
      timerSeconds: 0,
      timerRunning: false,
      startTime: Date.now(),
      venue: schedMatch ? (schedMatch.court || '') : '',
      date: schedMatch ? (schedMatch.date || '') : '',
      time: schedMatch ? (schedMatch.time || '') : '',
      winner: null
    };
    // Initialize first period
    _liveScore.periods.push({ scoreA: 0, scoreB: 0 });

    // Get big event name
    if (t.bigEventId) {
      const evts = g('bigEvents') || [];
      const ev = evts.find(e => e.id === t.bigEventId);
      if (ev) _liveScore.bigEventName = ev.name;
    }
  }

  // Save to sessionStorage for recovery
  _saveLiveScore();
  _renderLiveScoringOverlay();
  _startLiveTimer();
}

function _saveLiveScore() {
  if (!_liveScore) return;
  try { sessionStorage.setItem(_liveScore.key, JSON.stringify(_liveScore)); } catch(e) {}
  // Also persist scores to tournament data in real time
  _syncLiveScoreToData();
}

function _syncLiveScoreToData() {
  if (!_liveScore) return;
  const tournaments = g('tournaments');
  const t = tournaments[_liveScore.tIndex];
  if (!t) return;
  let match = null;
  const { bracketType, rIdx, mIdx } = _liveScore;
  if (bracketType === 'gf' && t.grandFinal) match = t.grandFinal;
  else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    match = bracketType === 'w' ? (t.bracket.winners[rIdx]||[])[mIdx] : (t.bracket.losers[rIdx]||[])[mIdx];
  } else if (t.format === 'roundrobin' && t.roundRobin) match = t.roundRobin[mIdx];
  else if (Array.isArray(t.bracket)) match = (t.bracket[rIdx]||[])[mIdx];
  if (!match) return;
  match.scoreA = _liveScore.totalA;
  match.scoreB = _liveScore.totalB;
  // Store period breakdown for viewer
  match.liveData = {
    periods: JSON.parse(JSON.stringify(_liveScore.periods)),
    currentPeriod: _liveScore.currentPeriod,
    status: _liveScore.status,
    feed: (_liveScore.feed || []).slice(-5),
    config: { periodName: _liveScore.config.periodName, setsToWin: _liveScore.config.setsToWin || 0 },
    timerSeconds: _liveScore.timerSeconds,
    sport: _liveScore.sport,
    winner: _liveScore.winner
  };
  s('tournaments', tournaments);
  // Sync to schedule
  if (match.a && match.b && typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(match.a, match.b, _liveScore.totalA, _liveScore.totalB, false);
  }
}

let _liveTimerInterval = null;

function _startLiveTimer() {
  if (_liveTimerInterval) clearInterval(_liveTimerInterval);
  _liveTimerInterval = setInterval(() => {
    if (!_liveScore || !_liveScore.timerRunning) return;
    _liveScore.timerSeconds++;
    const el = document.getElementById('lsTimerValue');
    if (el) el.textContent = _formatTimer(_liveScore.timerSeconds);
  }, 1000);
}

function _stopLiveTimer() {
  if (_liveTimerInterval) { clearInterval(_liveTimerInterval); _liveTimerInterval = null; }
}

function _formatTimer(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function toggleLiveTimer() {
  if (!_liveScore) return;
  _liveScore.timerRunning = !_liveScore.timerRunning;
  const btn = document.getElementById('lsTimerToggle');
  if (btn) btn.textContent = _liveScore.timerRunning ? '⏸' : '▶';
  _saveLiveScore();
}

function resetLiveTimer() {
  if (!_liveScore) return;
  _liveScore.timerSeconds = 0;
  _liveScore.timerRunning = false;
  const el = document.getElementById('lsTimerValue');
  if (el) el.textContent = '00:00';
  const btn = document.getElementById('lsTimerToggle');
  if (btn) btn.textContent = '▶';
  _saveLiveScore();
}

function _recalcTotals() {
  if (!_liveScore) return;
  const cfg = _liveScore.config;
  if (cfg.pointsPerPeriod || cfg.setsToWin) {
    // For set-based sports, total = sets won
    let setsA = 0, setsB = 0;
    _liveScore.periods.forEach((p, i) => {
      // Only count completed periods (not the current one unless it's won)
      if (i < _liveScore.currentPeriod || (p.scoreA !== p.scoreB && (p.scoreA >= (cfg.maxScore||999) || p.scoreB >= (cfg.maxScore||999)))) {
        if (p.scoreA > p.scoreB) setsA++;
        else if (p.scoreB > p.scoreA) setsB++;
      }
    });
    _liveScore.totalA = setsA;
    _liveScore.totalB = setsB;
  } else {
    // For quarter/half sports, total = sum of all period scores
    let tA = 0, tB = 0;
    _liveScore.periods.forEach(p => { tA += p.scoreA; tB += p.scoreB; });
    _liveScore.totalA = tA;
    _liveScore.totalB = tB;
  }
}

function lsAddScore(team, points) {
  if (!_liveScore || _liveScore.status === 'finished') return;
  const p = _liveScore.periods[_liveScore.currentPeriod];
  if (!p) return;
  if (team === 'a') p.scoreA = Math.max(0, p.scoreA + points);
  else p.scoreB = Math.max(0, p.scoreB + points);
  _recalcTotals();
  // Add to feed
  const teamName = team === 'a' ? _liveScore.teamA.name : _liveScore.teamB.name;
  const sign = points > 0 ? '+' + points : String(points);
  _liveScore.feed.unshift({ team, points, name: teamName, time: _formatTimer(_liveScore.timerSeconds) });
  if (_liveScore.feed.length > 10) _liveScore.feed.length = 10;
  _saveLiveScore();
  _updateLiveScoringUI();
}

function lsEndPeriod() {
  if (!_liveScore || _liveScore.status === 'finished') return;
  const cfg = _liveScore.config;
  _recalcTotals();

  // Check if match should be decided (sets-to-win)
  if (cfg.setsToWin) {
    // Count completed sets (wins)
    let sA = 0, sB = 0;
    _liveScore.periods.forEach((p, i) => {
      if (p.scoreA > p.scoreB) sA++;
      else if (p.scoreB > p.scoreA) sB++;
    });
    if (sA >= cfg.setsToWin || sB >= cfg.setsToWin) {
      // Match is over
      _liveScore.totalA = sA;
      _liveScore.totalB = sB;
      _saveLiveScore();
      _updateLiveScoringUI();
      return;
    }
  }

  // Start next period
  _liveScore.currentPeriod++;
  if (!_liveScore.periods[_liveScore.currentPeriod]) {
    _liveScore.periods.push({ scoreA: 0, scoreB: 0 });
  }
  _liveScore.timerSeconds = 0;
  _liveScore.timerRunning = false;
  _saveLiveScore();
  _updateLiveScoringUI();
}

function lsAddOvertime() {
  if (!_liveScore || _liveScore.status === 'finished') return;
  _liveScore.currentPeriod = _liveScore.periods.length;
  _liveScore.periods.push({ scoreA: 0, scoreB: 0 });
  _liveScore.timerSeconds = 0;
  _saveLiveScore();
  _updateLiveScoringUI();
}

function lsResetCurrentPeriod() {
  if (!_liveScore) return;
  if (!confirm('Reset scores for the current period?')) return;
  const p = _liveScore.periods[_liveScore.currentPeriod];
  if (p) { p.scoreA = 0; p.scoreB = 0; }
  _recalcTotals();
  _saveLiveScore();
  _updateLiveScoringUI();
}

function lsChangePeriod(idx) {
  if (!_liveScore) return;
  _liveScore.currentPeriod = Number(idx);
  if (!_liveScore.periods[_liveScore.currentPeriod]) {
    _liveScore.periods[_liveScore.currentPeriod] = { scoreA: 0, scoreB: 0 };
  }
  _saveLiveScore();
  _updateLiveScoringUI();
}

function lsFinishMatch() {
  if (!_liveScore) return;
  _recalcTotals();
  const tA = _liveScore.totalA;
  const tB = _liveScore.totalB;
  if (tA === tB) return alert('Scores are tied. Add overtime or adjust scores before finishing.');
  const winnerTeam = tA > tB ? _liveScore.teamA : _liveScore.teamB;
  if (!confirm(`Finish match and declare ${winnerTeam.name} as winner?`)) return;

  _liveScore.status = 'finished';
  _liveScore.winner = winnerTeam.id;
  _liveScore.timerRunning = false;
  _stopLiveTimer();
  _saveLiveScore();

  // Apply winner to bracket
  const { tIndex, bracketType, rIdx, mIdx } = _liveScore;
  const bt = bracketType === 'rr' ? undefined : bracketType;
  if (_liveScore.bracketType === 'rr') {
    const tournaments = g('tournaments');
    const t = tournaments[tIndex];
    if (t && t.roundRobin && t.roundRobin[mIdx]) {
      t.roundRobin[mIdx].played = true;
      t.roundRobin[mIdx].winner = winnerTeam.id;
      t.roundRobin[mIdx].scoreA = tA;
      t.roundRobin[mIdx].scoreB = tB;
      s('tournaments', tournaments);
    }
  } else {
    chooseWinner(tIndex, rIdx, mIdx, winnerTeam.id, bt);
  }

  // Sync final scores to schedule as completed
  if (typeof syncBracketToSchedule === 'function') {
    syncBracketToSchedule(_liveScore.teamA.id, _liveScore.teamB.id, tA, tB, true);
  }

  // Clean up session storage
  try { sessionStorage.removeItem(_liveScore.key); } catch(e) {}

  _updateLiveScoringUI();
  // Refresh underlying views
  if (typeof renderScoringBracket === 'function') renderScoringBracket(tIndex);
  if (typeof loadStandings === 'function') loadStandings();
  if (typeof loadDash === 'function') loadDash();
}

function closeLiveScoring() {
  if (_liveScore && _liveScore.status !== 'finished') {
    _saveLiveScore(); // preserve state for resume
  }
  _stopLiveTimer();
  const overlay = document.getElementById('liveScoringOverlay');
  if (overlay) overlay.remove();
  _liveScore = null;
  // Refresh bracket
  const sel = document.getElementById('sTournament');
  if (sel && sel.value !== '') {
    renderScoringBracket(Number(sel.value));
  }
}

function _getPeriodLabel(idx) {
  if (!_liveScore) return 'Period ' + (idx + 1);
  const cfg = _liveScore.config;
  const totalRegular = cfg.periods || 2;
  if (idx < totalRegular) return cfg.periodName + ' ' + (idx + 1);
  return cfg.overtimeName + (idx > totalRegular ? ' ' + (idx - totalRegular + 1) : '');
}

function _getGameStatusText() {
  if (!_liveScore) return '';
  const cfg = _liveScore.config;
  if (_liveScore.status === 'finished') return 'FINAL';
  const periodLabel = _getPeriodLabel(_liveScore.currentPeriod).toUpperCase();

  // Check for match point / set point
  if (cfg.setsToWin) {
    let sA = 0, sB = 0;
    _liveScore.periods.forEach((p, i) => {
      if (i < _liveScore.currentPeriod) {
        if (p.scoreA > p.scoreB) sA++;
        else if (p.scoreB > p.scoreA) sB++;
      }
    });
    if (sA === cfg.setsToWin - 1 || sB === cfg.setsToWin - 1) {
      return periodLabel + ' / MATCH POINT';
    }
  }
  return periodLabel;
}

function _renderLiveScoringOverlay() {
  // Remove existing
  let overlay = document.getElementById('liveScoringOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'liveScoringOverlay';
  overlay.className = 'ls-overlay';

  const ls = _liveScore;
  const cfg = ls.config;
  const sportIcon = { Basketball: '🏀', Soccer: '⚽', Volleyball: '🏐', Badminton: '🏸', Tennis: '🎾', TableTennis: '🏓', Baseball: '⚾', Chess: '♟️', Esports: '🎮' }[ls.sport] || '🏅';

  // Find match schedule for match ID
  const matchObj = (g('matches') || []).find(m =>
    ((m.a === ls.teamA.id && m.b === ls.teamB.id) || (m.a === ls.teamB.id && m.b === ls.teamA.id))
  );
  const matchId = matchObj ? ('M-' + String((g('matches')||[]).indexOf(matchObj)+1).padStart(3,'0')) : '';
  const roundLabel = ls.bracketType === 'gf' ? 'Grand Final' : getRoundLabel((g('tournaments')||[])[ls.tIndex] || {}, ls.rIdx, null);

  let html = '';
  // HEADER
  html += `<div class="ls-header">
    <div class="ls-header-left">
      <span class="ls-header-icon">${sportIcon}</span>
      <div>
        <div class="ls-header-title">${_escHtml(ls.bigEventName || ls.tournament)}</div>
        <div class="ls-header-sub">${_escHtml(ls.sport)} Tournament</div>
      </div>
    </div>
    <div class="ls-header-center">
      ${ls.status === 'live' ? '<div class="ls-live-pill"><span class="ls-live-dot"></span> LIVE</div>' : '<div class="ls-live-pill" style="background:rgba(34,197,94,0.15);color:#22c55e">FINISHED</div>'}
    </div>
    <div class="ls-header-right">
      ${matchId ? '<span>MATCH ID: <strong>' + matchId + '</strong></span>' : ''}
      <span>ROUND: <strong>${_escHtml(roundLabel)}</strong></span>
      <button class="ls-close-btn" onclick="closeLiveScoring()">✕ Close</button>
    </div>
  </div>`;

  // BODY
  html += '<div class="ls-body">';

  // LEFT - SCORING CONTROLS
  html += '<div class="ls-left">';
  html += `<div class="ls-panel-title">SCORING CONTROL <span style="font-size:1rem;cursor:pointer" onclick="toggleLiveTimer()" title="Timer">⏱</span></div>`;

  // Current period selector
  html += `<div><label style="font-size:0.72rem;font-weight:600;color:var(--muted-text);text-transform:uppercase;margin-bottom:4px;display:block">Current ${_escHtml(cfg.periodName)}</label>`;
  html += `<select class="ls-set-select" id="lsPeriodSelect" onchange="lsChangePeriod(this.value)">`;
  ls.periods.forEach((p, i) => {
    html += `<option value="${i}" ${i === ls.currentPeriod ? 'selected' : ''}>${_getPeriodLabel(i)}</option>`;
  });
  html += `</select></div>`;

  if (ls.status !== 'finished') {
    html += `<button class="ls-end-set-btn" onclick="lsEndPeriod()">END ${cfg.periodName.toUpperCase()}</button>`;
    html += `<button class="ls-new-period-btn" onclick="lsAddOvertime()">➕ NEW ${cfg.overtimeName.toUpperCase()}</button>`;
  }

  // Team A actions
  html += `<div class="ls-actions-label">${_escHtml(ls.teamA.name)} ACTIONS</div>`;
  html += '<div class="ls-actions-grid">';
  cfg.scoreButtons.forEach(pts => {
    html += `<button class="ls-action-btn" onclick="lsAddScore('a',${pts})" ${ls.status === 'finished' ? 'disabled' : ''}>+${pts}</button>`;
    if (pts === 1 && cfg.scoreButtons.length > 1) return;
    html += `<button class="ls-action-btn accent" onclick="lsAddScore('a',${pts})" ${ls.status === 'finished' ? 'disabled' : ''}>+${pts}</button>`;
  });
  cfg.minusButtons.forEach(pts => {
    html += `<button class="ls-action-btn" onclick="lsAddScore('a',${-pts})" ${ls.status === 'finished' ? 'disabled' : ''}>-${pts}</button>`;
  });
  html += '</div>';

  // Team B actions
  html += `<div class="ls-actions-label">${_escHtml(ls.teamB.name)} ACTIONS</div>`;
  html += '<div class="ls-actions-grid">';
  cfg.scoreButtons.forEach(pts => {
    html += `<button class="ls-action-btn" onclick="lsAddScore('b',${pts})" ${ls.status === 'finished' ? 'disabled' : ''}>+${pts}</button>`;
    if (pts === 1 && cfg.scoreButtons.length > 1) return;
    html += `<button class="ls-action-btn success" onclick="lsAddScore('b',${pts})" ${ls.status === 'finished' ? 'disabled' : ''}>+${pts}</button>`;
  });
  cfg.minusButtons.forEach(pts => {
    html += `<button class="ls-action-btn" onclick="lsAddScore('b',${-pts})" ${ls.status === 'finished' ? 'disabled' : ''}>-${pts}</button>`;
  });
  html += '</div>';

  if (ls.status !== 'finished') {
    html += `<button class="ls-reset-btn" onclick="lsResetCurrentPeriod()">↻ RESET SCORE</button>`;
  }

  html += '</div>'; // end ls-left

  // CENTER - SCORE DISPLAY
  html += '<div class="ls-center" id="lsCenterPanel">';
  html += _buildCenterPanel();
  html += '</div>';

  // RIGHT - GAME INFO
  html += '<div class="ls-right" id="lsRightPanel">';
  html += _buildRightPanel();
  html += '</div>';

  html += '</div>'; // end ls-body

  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

function _buildCenterPanel() {
  const ls = _liveScore;
  if (!ls) return '';
  const cfg = ls.config;
  const curP = ls.periods[ls.currentPeriod] || { scoreA: 0, scoreB: 0 };

  // Display score: for set-based, show current set score big; for quarter-based show running total
  let displayA, displayB;
  if (cfg.pointsPerPeriod || cfg.setsToWin) {
    displayA = curP.scoreA;
    displayB = curP.scoreB;
  } else {
    displayA = ls.totalA;
    displayB = ls.totalB;
  }

  let html = '';

  // Team names
  html += `<div class="ls-teams-row">
    <div class="ls-team-block">
      <div class="ls-team-name team-a">${_escHtml(ls.teamA.name)}</div>
      <div class="ls-team-sub">${_escHtml(ls.teamA.group)}</div>
    </div>
    <div class="ls-vs-badge">vs</div>
    <div class="ls-team-block">
      <div class="ls-team-name team-b">${_escHtml(ls.teamB.name)}</div>
      <div class="ls-team-sub">${_escHtml(ls.teamB.group)}</div>
    </div>
  </div>`;

  // Big score
  html += `<div class="ls-score-display">
    <span class="ls-big-score">${displayA}</span>
    <span class="ls-score-dash">—</span>
    <span class="ls-big-score team-b-score">${displayB}</span>
  </div>`;

  // Status row
  html += `<div class="ls-status-row">
    <span>STATUS:</span>
    <span class="ls-status-badge ${ls.status === 'finished' ? 'ended' : 'live'}">${ls.status === 'finished' ? 'FINAL' : 'LIVE'}</span>
    <span class="ls-time-display">⏱ TIME: ${_formatTimer(ls.timerSeconds)}</span>
  </div>`;

  // Score by period table
  html += `<div style="margin-top:8px"><strong style="font-size:0.85rem">SCORE BY ${cfg.periodName.toUpperCase()}</strong></div>`;
  html += `<table class="ls-period-table">
    <thead><tr>
      <th></th>
      <th class="team-a-col">${_escHtml(ls.teamA.name)}</th>
      <th class="team-b-col">${_escHtml(ls.teamB.name)}</th>
    </tr></thead><tbody>`;

  ls.periods.forEach((p, i) => {
    const isActive = i === ls.currentPeriod && ls.status !== 'finished';
    const aLeading = p.scoreA > p.scoreB;
    const bLeading = p.scoreB > p.scoreA;
    html += `<tr class="${isActive ? 'active-period' : ''}">
      <td>${_getPeriodLabel(i)}</td>
      <td class="score-cell${aLeading ? ' leading' : ''}">${p.scoreA}</td>
      <td class="score-cell${bLeading ? ' leading' : ''}">${p.scoreB}</td>
    </tr>`;
  });

  // Totals row (for quarter/half based sports)
  if (!cfg.setsToWin) {
    html += `<tr style="font-weight:900;background:rgba(16,24,40,0.04)"><td><strong>TOTAL</strong></td><td class="score-cell">${ls.totalA}</td><td class="score-cell">${ls.totalB}</td></tr>`;
  }

  html += `</tbody></table>`;

  // Win by 2 note
  if (cfg.winBy >= 2) {
    html += `<div style="text-align:center;margin-top:6px;font-size:0.78rem;font-weight:700;color:#22c55e">WIN BY ${cfg.winBy} ›</div>`;
  }

  // Last scoring feed
  if (ls.feed.length > 0) {
    html += `<div style="margin-top:12px"><strong style="font-size:0.85rem">LAST SCORING</strong></div>`;
    html += '<div class="ls-feed">';
    ls.feed.slice(0, 5).forEach(f => {
      const cls = f.team === 'a' ? 'team-a' : 'team-b';
      const sign = f.points > 0 ? '+' + f.points : String(f.points);
      html += `<div class="ls-feed-item"><span class="feed-badge ${cls}">${sign}</span> ${_escHtml(f.name)} <span style="color:var(--muted-text);font-size:0.7rem">${f.time}</span></div>`;
    });
    html += '</div>';
  }

  // Finish match button
  if (ls.status !== 'finished') {
    html += `<button class="ls-finish-btn" style="margin-top:16px" onclick="lsFinishMatch()">🏁 FINISH MATCH & DECLARE WINNER</button>`;
  }

  return html;
}

function _buildRightPanel() {
  const ls = _liveScore;
  if (!ls) return '';
  const cfg = ls.config;

  let html = '';

  // Game Info card
  html += `<div class="ls-info-card">
    <div class="ls-info-card-title">GAME INFO</div>
    <div class="ls-info-row"><span class="ls-info-icon">📍</span><div><div class="ls-info-label">Venue</div><div class="ls-info-value">${_escHtml(ls.venue || 'TBD')}</div></div></div>
    <div class="ls-info-row"><span class="ls-info-icon">📅</span><div><div class="ls-info-label">Date</div><div class="ls-info-value">${ls.date ? _formatDateNice(ls.date) : 'TBD'}</div></div></div>
    <div class="ls-info-row"><span class="ls-info-icon">🕐</span><div><div class="ls-info-label">Time</div><div class="ls-info-value">${ls.time ? _formatTimeAmPm(ls.time) : 'TBD'}</div></div></div>
  </div>`;

  // Game Status card
  html += `<div class="ls-info-card">
    <div class="ls-info-card-title">GAME STATUS</div>
    <div style="padding:14px;text-align:center">
      <span class="ls-game-status-badge">${_escHtml(_getGameStatusText())}</span>
      <div class="ls-timer-display" id="lsTimerValue" style="margin-top:8px">${_formatTimer(ls.timerSeconds)}</div>
      <div class="ls-timer-label">TIME ELAPSED</div>
      <div style="display:flex;gap:6px;justify-content:center;margin-top:8px">
        <button id="lsTimerToggle" class="ls-action-btn" style="padding:6px 16px;font-size:0.9rem" onclick="toggleLiveTimer()">${ls.timerRunning ? '⏸' : '▶'}</button>
        <button class="ls-action-btn" style="padding:6px 16px;font-size:0.9rem" onclick="resetLiveTimer()">↻</button>
      </div>
    </div>
  </div>`;

  // Sets won (for set-based sports)
  if (cfg.setsToWin) {
    let sA = 0, sB = 0;
    ls.periods.forEach((p, i) => {
      if (i <= ls.currentPeriod) {
        if (i < ls.currentPeriod || (p.scoreA !== p.scoreB)) {
          if (p.scoreA > p.scoreB) sA++;
          else if (p.scoreB > p.scoreA) sB++;
        }
      }
    });
    html += `<div class="ls-info-card">
      <div class="ls-info-card-title">SETS WON</div>
      <div style="display:flex;align-items:center;justify-content:space-around;padding:14px">
        <div style="text-align:center"><div style="font-size:2rem;font-weight:900;color:#1c2b4a">${sA}</div><div style="font-size:0.72rem;color:var(--muted-text)">${_escHtml(ls.teamA.name)}</div></div>
        <div style="font-weight:900;color:var(--muted-text)">-</div>
        <div style="text-align:center"><div style="font-size:2rem;font-weight:900;color:#22c55e">${sB}</div><div style="font-size:0.72rem;color:var(--muted-text)">${_escHtml(ls.teamB.name)}</div></div>
      </div>
    </div>`;
  }

  // Winning Team card
  html += `<div class="ls-info-card">
    <div class="ls-info-card-title">WINNING TEAM</div>
    <div class="ls-winner-card">
      <div class="ls-winner-trophy">🏆</div>`;
  if (ls.winner) {
    const winnerName = ls.winner === ls.teamA.id ? ls.teamA.name : ls.teamB.name;
    html += `<div class="ls-winner-name">${_escHtml(winnerName)}</div>`;
  } else {
    html += `<div class="ls-winner-tbd">TBD</div>`;
  }
  html += `</div></div>`;

  return html;
}

function _updateLiveScoringUI() {
  const center = document.getElementById('lsCenterPanel');
  if (center) center.innerHTML = _buildCenterPanel();
  const right = document.getElementById('lsRightPanel');
  if (right) right.innerHTML = _buildRightPanel();
  // Update period selector
  const sel = document.getElementById('lsPeriodSelect');
  if (sel && _liveScore) {
    let opts = '';
    _liveScore.periods.forEach((p, i) => {
      opts += `<option value="${i}" ${i === _liveScore.currentPeriod ? 'selected' : ''}>${_getPeriodLabel(i)}</option>`;
    });
    sel.innerHTML = opts;
  }
}

function _escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function _formatDateNice(dateStr) {
  if (!dateStr) return 'TBD';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch(e) { return dateStr; }
}

function _formatTimeAmPm(t) {
  if (!t) return 'TBD';
  const parts = t.split(':');
  let h = parseInt(parts[0]), m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  return ((h % 12) || 12) + ':' + m + ' ' + ampm;
}
