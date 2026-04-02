// Schedules and Matches module

// ======================== BRACKET MATCH SELECTION ========================
let bracketMatchList = [];

function populateBracketMatchSelect() {
  const sel = document.getElementById('mBracketMatch');
  if (!sel) return;
  const tournaments = getVisibleTournaments();
  const allTeams = getVisibleTeams();
  const matches = getVisibleMatches();
  bracketMatchList = [];

  const getTeamName = (id) => {
    const tm = allTeams.find(x => x.id === id);
    return tm ? tm.name : (id || 'TBD');
  };

  const isAlreadyScheduled = (teamA, teamB) => {
    return matches.some(m =>
      m.status === 'scheduled' &&
      ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA))
    );
  };

  tournaments.forEach((t, tIdx) => {
    if (selectedSport && t.sport !== selectedSport) return;
    if (typeof organizerCanAccessTournament === 'function' && !organizerCanAccessTournament(t)) return;

    // Round Robin
    if (t.format === 'roundrobin' && t.roundRobin) {
      t.roundRobin.forEach((m, i) => {
        if (m.a && m.b && !m.played && !isAlreadyScheduled(m.a, m.b)) {
          bracketMatchList.push({
            tournamentIdx: tIdx, tournamentName: t.name, sport: t.sport,
            teamA: m.a, teamB: m.b,
            teamAName: getTeamName(m.a), teamBName: getTeamName(m.b),
            label: 'Match ' + (i + 1)
          });
        }
      });
    }

    // Group + Knockout
    if (t.format === 'groupknockout' && t.groupStage) {
      Object.keys(t.groupStage).forEach(gname => {
        (t.groupStage[gname] || []).forEach((m, i) => {
          if (m.a && m.b && !m.played && !isAlreadyScheduled(m.a, m.b)) {
            bracketMatchList.push({
              tournamentIdx: tIdx, tournamentName: t.name, sport: t.sport,
              teamA: m.a, teamB: m.b,
              teamAName: getTeamName(m.a), teamBName: getTeamName(m.b),
              label: gname + ' Match ' + (i + 1)
            });
          }
        });
      });
      if (t.bracket && Array.isArray(t.bracket)) {
        t.bracket.forEach((round, rIdx) => {
          (round || []).forEach((m, mIdx) => {
            if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
              bracketMatchList.push({
                tournamentIdx: tIdx, tournamentName: t.name, sport: t.sport,
                teamA: m.a, teamB: m.b,
                teamAName: getTeamName(m.a), teamBName: getTeamName(m.b),
                label: 'Knockout R' + (rIdx + 1) + ' M' + (mIdx + 1)
              });
            }
          });
        });
      }
    }

    // Single elimination
    if (t.format === 'single' && Array.isArray(t.bracket)) {
      t.bracket.forEach((round, rIdx) => {
        (round || []).forEach((m, mIdx) => {
          if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
            const totalRounds = t.bracket.length;
            let roundLabel = 'Round ' + (rIdx + 1);
            if (rIdx === totalRounds - 1) roundLabel = 'Finals';
            else if (rIdx === totalRounds - 2) roundLabel = 'Semi-Finals';
            else if (rIdx === totalRounds - 3) roundLabel = 'Quarter-Finals';
            bracketMatchList.push({
              tournamentIdx: tIdx, tournamentName: t.name, sport: t.sport,
              teamA: m.a, teamB: m.b,
              teamAName: getTeamName(m.a), teamBName: getTeamName(m.b),
              label: roundLabel + ' M' + (mIdx + 1)
            });
          }
        });
      });
    }

    // Double elimination
    if (t.format === 'double' && t.bracket) {
      if (t.bracket.winners) {
        t.bracket.winners.forEach((round, rIdx) => {
          (round || []).forEach((m, mIdx) => {
            if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
              bracketMatchList.push({
                tournamentIdx: tIdx, tournamentName: t.name, sport: t.sport,
                teamA: m.a, teamB: m.b,
                teamAName: getTeamName(m.a), teamBName: getTeamName(m.b),
                label: 'Winners R' + (rIdx + 1) + ' M' + (mIdx + 1)
              });
            }
          });
        });
      }
      if (t.bracket.losers) {
        t.bracket.losers.forEach((round, rIdx) => {
          (round || []).forEach((m, mIdx) => {
            if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
              bracketMatchList.push({
                tournamentIdx: tIdx, tournamentName: t.name, sport: t.sport,
                teamA: m.a, teamB: m.b,
                teamAName: getTeamName(m.a), teamBName: getTeamName(m.b),
                label: 'Losers R' + (rIdx + 1) + ' M' + (mIdx + 1)
              });
            }
          });
        });
      }
      if (t.grandFinal && t.grandFinal.a && t.grandFinal.b && !t.grandFinal.winner && !isAlreadyScheduled(t.grandFinal.a, t.grandFinal.b)) {
        bracketMatchList.push({
          tournamentIdx: tIdx, tournamentName: t.name, sport: t.sport,
          teamA: t.grandFinal.a, teamB: t.grandFinal.b,
          teamAName: getTeamName(t.grandFinal.a), teamBName: getTeamName(t.grandFinal.b),
          label: 'Grand Final'
        });
      }
    }
  });

  let html = '<option value="">Select a bracket match to schedule...</option>';
  if (bracketMatchList.length === 0) {
    html += '<option value="" disabled>No unscheduled bracket matches available</option>';
  } else {
    const byTournament = {};
    bracketMatchList.forEach((bm, i) => {
      if (!byTournament[bm.tournamentName]) byTournament[bm.tournamentName] = [];
      byTournament[bm.tournamentName].push({ index: i, label: bm.label, teamAName: bm.teamAName, teamBName: bm.teamBName, sport: bm.sport });
    });
    Object.keys(byTournament).forEach(tName => {
      const sport = byTournament[tName][0].sport;
      html += '<optgroup label="' + tName + ' (' + sport + ')">';
      byTournament[tName].forEach(bm => {
        html += '<option value="' + bm.index + '">' + bm.label + ': ' + bm.teamAName + ' vs ' + bm.teamBName + '</option>';
      });
      html += '</optgroup>';
    });
  }
  sel.innerHTML = html;
}

function onBracketMatchSelected() {
  const sel = document.getElementById('mBracketMatch');
  const info = document.getElementById('bracketMatchInfo');
  if (!sel || !info) return;
  const idx = parseInt(sel.value);
  if (isNaN(idx) || !bracketMatchList[idx]) {
    info.style.display = 'none';
    return;
  }
  const bm = bracketMatchList[idx];
  const allTeams = g('teams') || [];
  const _logo = function(id) {
    const tm = allTeams.find(x => x.id === id);
    if (tm && tm.logo) return '<img src="' + tm.logo + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle">';
    const initial = tm ? tm.name.charAt(0).toUpperCase() : '?';
    return '<span style="display:inline-flex;width:28px;height:28px;border-radius:50%;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;font-weight:700;font-size:0.7rem;vertical-align:middle">' + initial + '</span>';
  };
  info.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '<span style="font-weight:700;color:var(--primary)">🏆 ' + bm.tournamentName + '</span>'
    + '<span style="padding:2px 10px;border-radius:20px;background:var(--primary);color:#fff;font-size:0.75rem;font-weight:700">' + bm.sport + '</span>'
    + '<span style="font-size:0.85rem;color:var(--muted-text)">' + bm.label + '</span>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;margin-top:10px;font-size:1.05rem;font-weight:700">'
    + _logo(bm.teamA) + ' <span>' + bm.teamAName + '</span>'
    + ' <span style="color:var(--muted-text);font-weight:400;font-size:0.9rem">vs</span> '
    + _logo(bm.teamB) + ' <span>' + bm.teamBName + '</span>'
    + '</div>';
  info.style.display = '';
}

// ======================== TAB SWITCHING ========================
function switchSchedTab(tab) {
  ['single','bulk','auto'].forEach(t => {
    const panel = document.getElementById('schedPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    const btn = document.getElementById('schedTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });
}

// ======================== DURATION & END TIME ========================

/**
 * Parse a user-typed time string into HH:MM (24h) format.
 * Accepts: "8:00 AM", "08:00", "8am", "8:30pm", "14:30", "2:00 PM", "800", etc.
 * Returns null if unparseable.
 */
function parseTimeInput(raw) {
  if (!raw) return null;
  raw = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  let isPM = false, isAM = false;
  if (/pm/.test(raw)) { isPM = true; raw = raw.replace(/\s*pm\s*/, ''); }
  if (/am/.test(raw)) { isAM = true; raw = raw.replace(/\s*am\s*/, ''); }
  raw = raw.trim();
  let h, m;
  if (raw.includes(':')) {
    const parts = raw.split(':');
    h = parseInt(parts[0]); m = parseInt(parts[1]) || 0;
  } else {
    const num = parseInt(raw);
    if (isNaN(num)) return null;
    if (num >= 100) { h = Math.floor(num / 100); m = num % 100; }
    else { h = num; m = 0; }
  }
  if (isNaN(h) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/**
 * Auto-format a time input field on blur: show "HH:MM AM/PM" in the field
 * but keep the internal 24h value accessible via data attribute.
 */
function setupTimeInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el || el._timeSetup) return;
  el._timeSetup = true;
  el.addEventListener('blur', function() {
    const parsed = parseTimeInput(this.value);
    if (parsed) {
      this.dataset.time24 = parsed;
      this.value = formatTime(parsed);
    }
  });
  el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { this.blur(); }
  });
}

/** Get the 24h time value from a time select inputs (hour/minute/ampm) */
function getTimeValue(prefix) {
  const hourEl = document.getElementById(prefix + 'Hour');
  const minuteEl = document.getElementById(prefix + 'Minute');
  const ampmEl = document.getElementById(prefix + 'AMPM');
  
  if (!hourEl || !minuteEl || !ampmEl) return '';
  
  let hour = parseInt(hourEl.value);
  const minute = minuteEl.value;
  const ampm = ampmEl.value;
  
  // Convert to 24h format
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  
  return String(hour).padStart(2, '0') + ':' + minute;
}

/** Set time select inputs from 24h time string */
function setTimeValue(prefix, time24) {
  if (!time24) return;
  const [h, m] = time24.split(':');
  const hour24 = parseInt(h);
  const minute = m || '00';
  
  const hourEl = document.getElementById(prefix + 'Hour');
  const minuteEl = document.getElementById(prefix + 'Minute');
  const ampmEl = document.getElementById(prefix + 'AMPM');
  
  if (!hourEl || !minuteEl || !ampmEl) return;
  
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  
  hourEl.value = hour12;
  minuteEl.value = minute;
  ampmEl.value = ampm;
}

function updateEndTimeFromDuration() {
  const sel = document.getElementById('mDuration');
  const row = document.getElementById('customEndTimeRow');
  if (!sel) return;
  if (sel.value === 'custom') {
    if (row) row.style.display = '';
  } else {
    if (row) row.style.display = 'none';
    // Auto-calculate endTime when startTime changes
    calcEndTime();
  }
}

function calcEndTime() {
  const durSel = document.getElementById('mDuration');
  if (!durSel || durSel.value === 'custom') return;
  const startVal = getTimeValue('m');
  if (!startVal) return;
  const dur = parseInt(durSel.value);
  const [h, m] = startVal.split(':').map(Number);
  const totalMin = h * 60 + m + dur;
  const eh = Math.floor(totalMin / 60) % 24;
  const em = totalMin % 60;
  const end24 = String(eh).padStart(2, '0') + ':' + String(em).padStart(2, '0');
  setTimeValue('mEnd', end24);
}

// ======================== COURT CHIPS ========================
function renderCourtChips() {
  const container = document.getElementById('courtChips');
  if (!container) return;
  const matches = getVisibleMatches();
  const courts = [...new Set(matches.map(m => m.court).filter(Boolean))];
  if (courts.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = courts.map(c =>
    `<button type="button" onclick="document.getElementById('mCourt').value='${c.replace(/'/g, "\\'")}';" style="padding:4px 10px;font-size:0.78rem;border:1px solid rgba(16,24,40,0.12);border-radius:20px;background:var(--surface);cursor:pointer;color:var(--text);transition:all 0.15s" onmouseover="this.style.background='var(--primary)';this.style.color='#fff'" onmouseout="this.style.background='var(--surface)';this.style.color='var(--text)'">${c}</button>`
  ).join('');
}

// ======================== SPORT BADGE & AUTO-LINEUP ========================
function updateMatchSportBadge(teamA, teamB) {
  const badge = document.getElementById('matchSportBadge');
  if (!badge) return;
  const sport = (teamA && teamA.sport) || (teamB && teamB.sport) || null;
  if (!sport) { badge.style.display = 'none'; return; }
  const sportType = getSportType(sport);
  const typeLabel = sportType === 'team' ? '👥 Team Sport' : sportType === 'racket' ? '🏸 Racket Sport' : '🏃 Individual Sport';
  const positions = getSportPositions(sport);
  badge.innerHTML = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <span style="font-weight:800;font-size:1rem;color:var(--primary)">🏅 ${sport}</span>
    <span style="padding:3px 10px;border-radius:20px;background:var(--primary);color:#fff;font-size:0.75rem;font-weight:700">${typeLabel}</span>
    ${positions.length > 0 ? `<span style="font-size:0.8rem;color:var(--muted-text)">Positions: ${positions.join(', ')}</span>` : ''}
  </div>`;
  badge.style.display = '';
}

function updateAutoLineupPreview(teamA, teamB) {
  const container = document.getElementById('matchAutoLineup');
  if (!container) return;
  if (!teamA && !teamB) { container.style.display = 'none'; return; }

  const allPlayers = g('players');
  let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';

  [{ team: teamA, label: 'Team A' }, { team: teamB, label: 'Team B' }].forEach(({ team, label }) => {
    if (!team) {
      html += `<div style="padding:12px;background:#fafafa;border-radius:10px;border:1px solid rgba(16,24,40,0.06)">
        <div style="font-size:0.8rem;color:var(--muted-text);text-align:center">Select ${label}</div>
      </div>`;
      return;
    }
    const players = allPlayers.filter(p => p.team === team.id);
    const sport = team.sport || '';
    const sportType = getSportType(sport);

    html += `<div style="padding:12px;background:#fafafa;border-radius:10px;border:1px solid rgba(16,24,40,0.06)">
      <div style="font-weight:700;font-size:0.95rem;color:var(--text);margin-bottom:6px;display:flex;align-items:center;gap:6px">
        <span style="color:var(--primary)">⚡</span> ${team.name}
      </div>
      <div style="font-size:0.78rem;color:var(--muted-text);margin-bottom:8px">${sport} • ${players.length} player${players.length !== 1 ? 's' : ''} registered</div>`;

    if (players.length === 0) {
      html += '<div style="font-size:0.82rem;color:var(--danger);padding:6px 0">⚠ No players added to this team yet</div>';
    } else {
      if (sportType === 'racket') {
        // Show racket lineup: singles + doubles slots
        const singlesA = players.find(p => (p.position || '').toLowerCase().includes('singles'));
        const doubles = players.filter(p => (p.position || '').toLowerCase().includes('doubles'));
        html += `<div style="font-size:0.82rem">
          <div style="margin-bottom:4px"><strong style="color:var(--accent)">Singles A:</strong> ${singlesA ? singlesA.name : '<span style=color:var(--muted-text)>—</span>'}</div>
          <div style="margin-bottom:4px"><strong style="color:var(--accent)">Singles B:</strong> ${players.filter(p => (p.position||'').toLowerCase().includes('singles'))[1]?.name || '<span style=color:var(--muted-text)>—</span>'}</div>
          <div><strong style="color:var(--accent)">Doubles:</strong> ${doubles.length > 0 ? doubles.map(p => p.name).join(' & ') : '<span style=color:var(--muted-text)>—</span>'}</div>
        </div>`;
      } else {
        // Show team lineup grouped by position
        const byPos = {};
        players.forEach(p => {
          const pos = p.position || 'Unassigned';
          if (!byPos[pos]) byPos[pos] = [];
          byPos[pos].push(p.name);
        });
        html += '<div style="font-size:0.82rem;display:grid;gap:3px">';
        Object.keys(byPos).forEach(pos => {
          html += `<div><strong style="color:var(--accent)">${pos}:</strong> ${byPos[pos].join(', ')}</div>`;
        });
        html += '</div>';
      }
    }
    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
  container.style.display = '';
}

// ======================== SINGLE MATCH ========================
function addMatch() {
  const bmSel = document.getElementById('mBracketMatch');
  const bmIdx = bmSel ? parseInt(bmSel.value) : NaN;
  if (isNaN(bmIdx) || !bracketMatchList[bmIdx]) return alert('Please select a bracket match to schedule.');

  const bm = bracketMatchList[bmIdx];
  const date = document.getElementById('mDate').value;
  const startTime = getTimeValue('m');
  const court = document.getElementById('mCourt').value.trim();

  if (!date) return alert('Please select a date.');
  if (!startTime) return alert('Please enter a valid start time.');
  if (!court) return alert('Please enter a court / venue.');

  // Calculate end time
  const durSel = document.getElementById('mDuration');
  let endTime;
  if (durSel && durSel.value !== 'custom') {
    calcEndTime();
    endTime = getTimeValue('mEnd');
  } else {
    endTime = getTimeValue('mEnd');
  }
  if (!endTime) return alert('Please set an end time.');
  if (endTime <= startTime) return alert('End time must be after start time.');

  const matches = g('matches');
  const teamA = getVisibleTeams().find(team => team.id === bm.teamA);
  const newMatch = { a: bm.teamA, b: bm.teamB, sa: 0, sb: 0, date, time: startTime, endTime, court, status: 'scheduled', sport: bm.sport, tournament: bm.tournamentName, campus: teamA ? getTeamCampus(teamA) : getCurrentCampus() };

  // Conflict check
  const conflict = matches.find(m => m.date === newMatch.date && m.court === newMatch.court &&
    m.time < newMatch.endTime && m.endTime > newMatch.time);
  if (conflict) return alert('Conflict: Another match overlaps at the same court/time.');

  matches.push(newMatch);
  s('matches', matches);
  loadAll();

  // Notify sports coordinators via SMS
  if (typeof notifySportsCoordinatorsForNewMatch === 'function') notifySportsCoordinatorsForNewMatch(newMatch);

  renderCourtChips();
}

// ======================== BULK SCHEDULE ========================
function bulkFillFromTeams() {
  const teams = getVisibleTeams().filter(t => !selectedSport || t.sport == selectedSport);
  if (teams.length < 2) return alert('Need at least 2 teams');
  const lines = [];
  for (let i = 0; i < teams.length - 1; i += 2) {
    lines.push(teams[i].name + ' vs ' + teams[i + 1].name);
  }
  document.getElementById('bulkMatchList').value = lines.join('\n');
}

function bulkFillRoundRobin() {
  const teams = getVisibleTeams().filter(t => !selectedSport || t.sport == selectedSport);
  if (teams.length < 2) return alert('Need at least 2 teams');
  const lines = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      lines.push(teams[i].name + ' vs ' + teams[j].name);
    }
  }
  document.getElementById('bulkMatchList').value = lines.join('\n');
}

function bulkFillFromBrackets() {
  // Ensure bracket match list is populated
  if (typeof populateBracketMatchSelect === 'function') populateBracketMatchSelect();
  
  if (!bracketMatchList || bracketMatchList.length === 0) {
    return alert('No unscheduled bracket matches available. Create tournament brackets first.');
  }
  
  const lines = [];
  bracketMatchList.forEach(bm => {
    lines.push(`${bm.teamAName} vs ${bm.teamBName}`);
  });
  
  document.getElementById('bulkMatchList').value = lines.join('\n');
  alert(`✅ Added ${bracketMatchList.length} bracket match${bracketMatchList.length > 1 ? 'es' : ''} from tournaments!`);
}

function parseBulkLines() {
  const raw = (document.getElementById('bulkMatchList').value || '').trim();
  if (!raw) return [];
  const allTeams = getVisibleTeams();
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = [];

  lines.forEach((line, idx) => {
    // Support: "Team A vs Team B" or "Team A - Team B"
    const parts = line.split(/\s+vs\.?\s+|\s+[-–]\s+/i);
    if (parts.length < 2) {
      parsed.push({ error: `Line ${idx + 1}: Can't parse "${line}". Use "Team A vs Team B" format.` });
      return;
    }
    const nameA = parts[0].trim();
    const nameB = parts[1].trim();
    const teamA = allTeams.find(t => t.name.toLowerCase() === nameA.toLowerCase() && (!selectedSport || t.sport == selectedSport));
    const teamB = allTeams.find(t => t.name.toLowerCase() === nameB.toLowerCase() && (!selectedSport || t.sport == selectedSport));
    if (!teamA) { parsed.push({ error: `Line ${idx + 1}: Team "${nameA}" not found.` }); return; }
    if (!teamB) { parsed.push({ error: `Line ${idx + 1}: Team "${nameB}" not found.` }); return; }
    parsed.push({ a: teamA.id, aName: teamA.name, b: teamB.id, bName: teamB.name });
  });
  return parsed;
}

function buildTimeSlots(startTime, duration, breakMin, count) {
  const slots = [];
  let [h, m] = startTime.split(':').map(Number);
  const dur = parseInt(duration);
  const brk = parseInt(breakMin);
  for (let i = 0; i < count; i++) {
    const sH = String(h).padStart(2, '0');
    const sM = String(m).padStart(2, '0');
    const total = h * 60 + m + dur;
    const eH = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const eM = String(total % 60).padStart(2, '0');
    slots.push({ time: sH + ':' + sM, endTime: eH + ':' + eM });
    // Next slot
    const next = h * 60 + m + dur + brk;
    h = Math.floor(next / 60) % 24;
    m = next % 60;
  }
  return slots;
}

function previewBulkSchedule() {
  const parsed = parseBulkLines();
  const previewEl = document.getElementById('bulkPreview');
  if (!previewEl) return;
  if (parsed.length === 0) { previewEl.style.display = 'none'; return; }

  const date = document.getElementById('bulkDate').value || 'TBD';
  const startTime = getTimeValue('bulk') || '08:00';
  const duration = document.getElementById('bulkDuration').value;
  const breakMin = document.getElementById('bulkBreak').value;
  const court = document.getElementById('bulkCourt').value || 'TBD';

  const errors = parsed.filter(p => p.error);
  const valid = parsed.filter(p => !p.error);
  const slots = buildTimeSlots(startTime, duration, breakMin, valid.length);

  let html = '';
  if (errors.length > 0) {
    html += `<div style="color:var(--danger);margin-bottom:8px;font-weight:600">⚠ Issues:</div>`;
    errors.forEach(e => { html += `<div style="color:var(--danger);font-size:0.8rem;margin-bottom:2px">${e.error}</div>`; });
    html += '<hr style="margin:8px 0;border-color:rgba(0,0,0,0.06)">';
  }
  if (valid.length > 0) {
    html += `<div style="font-weight:600;margin-bottom:6px;color:var(--success)">✅ ${valid.length} match${valid.length > 1 ? 'es' : ''} to schedule:</div>`;
    html += '<table style="width:100%;font-size:0.82rem;border-collapse:collapse">';
    html += '<tr style="font-weight:700;color:var(--muted-text);text-align:left"><td style="padding:4px">Time</td><td style="padding:4px">Match</td><td style="padding:4px">Court</td></tr>';
    valid.forEach((m, i) => {
      const slot = slots[i];
      html += `<tr style="border-top:1px solid rgba(0,0,0,0.04)"><td style="padding:4px">${formatTime(slot.time)} - ${formatTime(slot.endTime)}</td><td style="padding:4px;font-weight:600">${m.aName} vs ${m.bName}</td><td style="padding:4px">${court}</td></tr>`;
    });
    html += '</table>';
  }
  previewEl.innerHTML = html;
  previewEl.style.display = '';
}

function addBulkSchedule() {
  const parsed = parseBulkLines();
  const errors = parsed.filter(p => p.error);
  const valid = parsed.filter(p => !p.error);
  if (valid.length === 0) return alert(errors.length > 0 ? errors.map(e => e.error).join('\n') : 'No matches to schedule. Enter matches in the format "Team A vs Team B".');

  const date = document.getElementById('bulkDate').value;
  if (!date) return alert('Please select a date.');
  const startTime = getTimeValue('bulk') || '08:00';
  const duration = document.getElementById('bulkDuration').value;
  const breakMin = document.getElementById('bulkBreak').value;
  const court = document.getElementById('bulkCourt').value.trim();
  if (!court) return alert('Please enter a court.');

  const slots = buildTimeSlots(startTime, duration, breakMin, valid.length);
  const matches = g('matches');
  let conflicts = 0;

  valid.forEach((m, i) => {
    const slot = slots[i];
    const teamA = getVisibleTeams().find(team => team.id === m.a);
    const newMatch = { a: m.a, b: m.b, sa: 0, sb: 0, date, time: slot.time, endTime: slot.endTime, court, status: 'scheduled', sport: teamA ? teamA.sport : '', campus: teamA ? getTeamCampus(teamA) : getCurrentCampus() };
    const conflict = matches.find(ex => ex.date === date && ex.court === court && ex.time < slot.endTime && ex.endTime > slot.time);
    if (conflict) { conflicts++; return; }
    matches.push(newMatch);
    // Notify sports coordinators via SMS for each match
    if (typeof notifySportsCoordinatorsForNewMatch === 'function') notifySportsCoordinatorsForNewMatch(newMatch);
  });

  s('matches', matches);
  loadAll();
  renderCourtChips();

  const scheduled = valid.length - conflicts;
  alert(`✅ ${scheduled} match${scheduled > 1 ? 'es' : ''} scheduled!` + (conflicts > 0 ? `\n⚠ ${conflicts} skipped due to court conflicts.` : ''));
  if (errors.length > 0) alert('⚠ Some lines had errors:\n' + errors.map(e => e.error).join('\n'));

  document.getElementById('bulkMatchList').value = '';
  document.getElementById('bulkPreview').style.display = 'none';
}

// ======================== AUTO-GENERATE FROM TOURNAMENT ========================
function populateAutoTournamentSelect() {
  const sel = document.getElementById('autoTournament');
  if (!sel) return;
  const allTournaments = g('tournaments') || [];
  let options = '<option value="">Select a tournament...</option>';
  allTournaments.forEach((t, idx) => {
    if (!canAccessTournament(t)) return;
    if (selectedSport && t.sport != selectedSport) return;
    const teamCount = t.teams ? t.teams.length : 0;
    options += `<option value="${idx}">${t.name} (${t.format}, ${teamCount} teams)</option>`;
  });
  sel.innerHTML = options;
}

function autoTournamentChanged() {
  const sel = document.getElementById('autoTournament');
  const info = document.getElementById('autoTournamentInfo');
  if (!sel || !info) return;
  const idx = parseInt(sel.value);
  const tournaments = g('tournaments');
  if (isNaN(idx) || !tournaments[idx]) { info.style.display = 'none'; return; }
  const t = tournaments[idx];
  if (!canAccessTournament(t)) { info.style.display = 'none'; return; }
  const teamCount = (t.teams || []).length;
  const allTeams = getVisibleTeams();
  const teamNames = (t.teams || []).map(id => { const tm = allTeams.find(x => x.id === id); return tm ? tm.name : id; });

  // Calculate estimated matches
  const useBrackets = document.getElementById('autoUseBrackets');
  let estMatches = 0;
  let matchType = 'estimated';
  
  if (useBrackets && useBrackets.checked) {
    const bracketMatches = getBracketMatchupsForTournament(t);
    estMatches = bracketMatches.length;
    matchType = 'unscheduled bracket';
  } else {
    if (t.format === 'roundrobin') estMatches = teamCount * (teamCount - 1) / 2;
    else if (t.format === 'single') estMatches = teamCount - 1;
    else if (t.format === 'double') estMatches = teamCount * 2 - 1;
    else if (t.format === 'groupknockout') estMatches = teamCount * 2; // rough estimate
    matchType = 'estimated';
  }

  info.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div><strong>Format:</strong> ${t.format}</div>
      <div><strong>Teams:</strong> ${teamCount}</div>
      <div><strong>${matchType === 'estimated' ? 'Est.' : ''} Matches:</strong> ${matchType === 'estimated' ? '~' : ''}${estMatches}</div>
    </div>
    <div style="margin-top:6px;font-size:0.82rem;color:var(--muted-text)">Teams: ${teamNames.join(', ') || 'None'}</div>
  `;
  info.style.display = '';
  document.getElementById('autoPreview').style.display = 'none';
}

function getBracketMatchupsForTournament(tournament) {
  const t = tournament;
  const allTeams = getVisibleTeams();
  const matches = getVisibleMatches();
  const matchups = [];

  const getTeamName = (id) => {
    const tm = allTeams.find(x => x.id === id);
    return tm ? tm.name : (id || 'TBD');
  };

  const isAlreadyScheduled = (teamA, teamB) => {
    return matches.some(m =>
      m.status === 'scheduled' &&
      ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA))
    );
  };

  // Round Robin
  if (t.format === 'roundrobin' && t.roundRobin) {
    t.roundRobin.forEach((m, i) => {
      if (m.a && m.b && !m.played && !isAlreadyScheduled(m.a, m.b)) {
        matchups.push({ a: m.a, b: m.b });
      }
    });
  }

  // Group + Knockout
  if (t.format === 'groupknockout' && t.groupStage) {
    Object.keys(t.groupStage).forEach(gname => {
      (t.groupStage[gname] || []).forEach((m, i) => {
        if (m.a && m.b && !m.played && !isAlreadyScheduled(m.a, m.b)) {
          matchups.push({ a: m.a, b: m.b });
        }
      });
    });
    if (t.bracket && Array.isArray(t.bracket)) {
      t.bracket.forEach((round, rIdx) => {
        (round || []).forEach((m, mIdx) => {
          if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
            matchups.push({ a: m.a, b: m.b });
          }
        });
      });
    }
  }

  // Single elimination
  if (t.format === 'single' && Array.isArray(t.bracket)) {
    t.bracket.forEach((round, rIdx) => {
      (round || []).forEach((m, mIdx) => {
        if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
          matchups.push({ a: m.a, b: m.b });
        }
      });
    });
  }

  // Double elimination
  if (t.format === 'double' && t.bracket) {
    if (t.bracket.winners) {
      t.bracket.winners.forEach((round, rIdx) => {
        (round || []).forEach((m, mIdx) => {
          if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
            matchups.push({ a: m.a, b: m.b });
          }
        });
      });
    }
    if (t.bracket.losers) {
      t.bracket.losers.forEach((round, rIdx) => {
        (round || []).forEach((m, mIdx) => {
          if (m && m.a && m.b && !m.winner && !isAlreadyScheduled(m.a, m.b)) {
            matchups.push({ a: m.a, b: m.b });
          }
        });
      });
    }
    if (t.bracket.grandFinal && t.bracket.grandFinal.a && t.bracket.grandFinal.b && !t.bracket.grandFinal.winner && !isAlreadyScheduled(t.bracket.grandFinal.a, t.bracket.grandFinal.b)) {
      matchups.push({ a: t.bracket.grandFinal.a, b: t.bracket.grandFinal.b });
    }
  }

  return matchups;
}

function generateAutoMatchups(tournament) {
  const t = tournament;
  const teams = t.teams || [];
  if (teams.length < 2) return [];

  if (t.format === 'roundrobin') {
    // All vs All
    const matchups = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matchups.push({ a: teams[i], b: teams[j] });
      }
    }
    return matchups;
  }

  if (t.format === 'single') {
    // First round matchups
    const matchups = [];
    for (let i = 0; i < teams.length - 1; i += 2) {
      matchups.push({ a: teams[i], b: teams[i + 1] });
    }
    return matchups;
  }

  if (t.format === 'double') {
    // First round of winners bracket
    const matchups = [];
    for (let i = 0; i < teams.length - 1; i += 2) {
      matchups.push({ a: teams[i], b: teams[i + 1] });
    }
    return matchups;
  }

  if (t.format === 'groupknockout') {
    // Group stage round robin within each group
    const matchups = [];
    if (t.groupStage) {
      Object.values(t.groupStage).forEach(gMatches => {
        gMatches.forEach(m => {
          if (m && m.a && m.b) matchups.push({ a: m.a, b: m.b });
        });
      });
    } else {
      // Create pairs from teams list
      for (let i = 0; i < teams.length - 1; i += 2) {
        matchups.push({ a: teams[i], b: teams[i + 1] });
      }
    }
    return matchups;
  }

  return [];
}

function previewAutoSchedule() {
  const sel = document.getElementById('autoTournament');
  const previewEl = document.getElementById('autoPreview');
  if (!sel || !previewEl) return;
  const idx = parseInt(sel.value);
  const tournaments = g('tournaments');
  if (isNaN(idx) || !tournaments[idx]) return alert('Please select a tournament.');

  const t = tournaments[idx];
  if (!canAccessTournament(t)) return alert('This tournament belongs to another campus.');
  if (!t.teams || t.teams.length < 2) return alert('This tournament has less than 2 teams.');

  // Check if we should use bracket matches only
  const useBrackets = document.getElementById('autoUseBrackets');
  const matchups = (useBrackets && useBrackets.checked) ? getBracketMatchupsForTournament(t) : generateAutoMatchups(t);
  if (matchups.length === 0) {
    const msg = (useBrackets && useBrackets.checked) 
      ? 'No unscheduled bracket matches available for this tournament.'
      : 'No matchups could be generated for this tournament format.';
    return alert(msg);
  }

  const startDate = document.getElementById('autoStartDate').value;
  if (!startDate) return alert('Please select a start date.');
  const startTime = getTimeValue('auto') || '08:00';
  const duration = document.getElementById('autoDuration').value;
  const breakMin = document.getElementById('autoBreak').value;
  const gamesPerDay = parseInt(document.getElementById('autoGamesPerDay').value);
  const courtsStr = document.getElementById('autoCourts').value.trim();
  const courts = courtsStr ? courtsStr.split(',').map(c => c.trim()).filter(Boolean) : ['Court 1'];

  const allTeams = getVisibleTeams();
  const schedule = distributeMatchups(matchups, startDate, startTime, duration, breakMin, gamesPerDay, courts);

  let html = `<div style="font-weight:700;margin-bottom:8px;color:var(--success)">📅 ${matchups.length} matches across ${schedule.days} day${schedule.days > 1 ? 's' : ''}</div>`;
  let currentDate = '';
  html += '<table style="width:100%;font-size:0.82rem;border-collapse:collapse">';
  html += '<tr style="font-weight:700;color:var(--muted-text);text-align:left;border-bottom:2px solid rgba(0,0,0,0.08)"><td style="padding:6px">Date</td><td style="padding:6px">Time</td><td style="padding:6px">Match</td><td style="padding:6px">Court</td></tr>';
  schedule.matches.forEach(m => {
    const aName = allTeams.find(t => t.id === m.a)?.name || m.a;
    const bName = allTeams.find(t => t.id === m.b)?.name || m.b;
    const showDate = m.date !== currentDate;
    currentDate = m.date;
    html += `<tr style="border-top:1px solid rgba(0,0,0,${showDate ? '0.08' : '0.03'})">
      <td style="padding:4px 6px;font-weight:${showDate ? '700' : '400'};color:${showDate ? 'var(--text)' : 'var(--muted-text)'}">${showDate ? m.date : ''}</td>
      <td style="padding:4px 6px">${formatTime(m.time)} - ${formatTime(m.endTime)}</td>
      <td style="padding:4px 6px;font-weight:600">${aName} vs ${bName}</td>
      <td style="padding:4px 6px">${m.court}</td>
    </tr>`;
  });
  html += '</table>';
  previewEl.innerHTML = html;
  previewEl.style.display = '';
}

function distributeMatchups(matchups, startDate, startTime, duration, breakMin, gamesPerDay, courts) {
  const dur = parseInt(duration);
  const brk = parseInt(breakMin);
  const result = [];
  let currentDate = startDate;
  let dayCount = 0;
  let gameInDay = 0;

  // Per-court time tracker
  let courtTimes = {};
  courts.forEach(c => { courtTimes[c] = startTime; });

  function nextDay() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    currentDate = d.toISOString().split('T')[0];
    dayCount++;
    gameInDay = 0;
    courts.forEach(c => { courtTimes[c] = startTime; });
  }

  matchups.forEach(mu => {
    if (gameInDay >= gamesPerDay) nextDay();

    // Find court with earliest available time
    let bestCourt = courts[0];
    let bestTime = courtTimes[courts[0]];
    courts.forEach(c => {
      if (courtTimes[c] < bestTime) { bestTime = courtTimes[c]; bestCourt = c; }
    });

    const [h, m] = bestTime.split(':').map(Number);
    const total = h * 60 + m + dur;
    const eH = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const eM = String(total % 60).padStart(2, '0');
    const endTimeStr = eH + ':' + eM;

    result.push({ a: mu.a, b: mu.b, date: currentDate, time: bestTime, endTime: endTimeStr, court: bestCourt });

    // Update court time to next available slot
    const nextTotal = h * 60 + m + dur + brk;
    const nH = String(Math.floor(nextTotal / 60) % 24).padStart(2, '0');
    const nM = String(nextTotal % 60).padStart(2, '0');
    courtTimes[bestCourt] = nH + ':' + nM;
    gameInDay++;
  });

  return { matches: result, days: dayCount + 1 };
}

function addAutoSchedule() {
  const sel = document.getElementById('autoTournament');
  if (!sel) return;
  const idx = parseInt(sel.value);
  const tournaments = g('tournaments');
  if (isNaN(idx) || !tournaments[idx]) return alert('Please select a tournament.');

  const t = tournaments[idx];
  if (!canAccessTournament(t)) return alert('This tournament belongs to another campus.');
  if (!t.teams || t.teams.length < 2) return alert('This tournament has less than 2 teams.');

  // Check if we should use bracket matches only
  const useBrackets = document.getElementById('autoUseBrackets');
  const matchups = (useBrackets && useBrackets.checked) ? getBracketMatchupsForTournament(t) : generateAutoMatchups(t);
  if (matchups.length === 0) {
    const msg = (useBrackets && useBrackets.checked) 
      ? 'No unscheduled bracket matches available for this tournament.'
      : 'No matchups generated.';
    return alert(msg);
  }

  const startDate = document.getElementById('autoStartDate').value;
  if (!startDate) return alert('Please select a start date.');
  const startTime = getTimeValue('auto') || '08:00';
  const duration = document.getElementById('autoDuration').value;
  const breakMin = document.getElementById('autoBreak').value;
  const gamesPerDay = parseInt(document.getElementById('autoGamesPerDay').value);
  const courtsStr = document.getElementById('autoCourts').value.trim();
  const courts = courtsStr ? courtsStr.split(',').map(c => c.trim()).filter(Boolean) : ['Court 1'];

  const schedule = distributeMatchups(matchups, startDate, startTime, duration, breakMin, gamesPerDay, courts);
  const matches = g('matches');
  let added = 0, skipped = 0;

  schedule.matches.forEach(m => {
    const conflict = matches.find(ex => ex.date === m.date && ex.court === m.court && ex.time < m.endTime && ex.endTime > m.time);
    if (conflict) { skipped++; return; }
    const teamA = getVisibleTeams().find(team => team.id === m.a);
    const newMatch = { a: m.a, b: m.b, sa: 0, sb: 0, date: m.date, time: m.time, endTime: m.endTime, court: m.court, status: 'scheduled', tournament: t.name, sport: t.sport, campus: teamA ? getTeamCampus(teamA) : getTournamentCampus(t) };
    matches.push(newMatch);
    added++;
    // Notify sports coordinators via SMS
    if (typeof notifySportsCoordinatorsForNewMatch === 'function') notifySportsCoordinatorsForNewMatch(newMatch);
  });

  s('matches', matches);
  loadAll();
  renderCourtChips();

  alert(`⚡ Auto-generated ${added} match${added > 1 ? 'es' : ''} for "${t.name}"!` + (skipped > 0 ? `\n⚠ ${skipped} skipped due to court conflicts.` : ''));
  document.getElementById('autoPreview').style.display = 'none';
}

function loadMatches() {
  const storedMatches = g('matches');
  const rawMatches = storedMatches.filter(m => canAccessMatch(m));
  const allMatches = rawMatches.filter(m => {
    const ta = g('teams').find(t => t.id == m.a);
    const tb = g('teams').find(t => t.id == m.b);
    return !selectedSport || (ta && tb && ta.sport == selectedSport && tb.sport == selectedSport);
  });
  
  // Split into active and finished
  const activeMatches = allMatches.filter(m => m.status !== 'completed');
  const finishedMatches = allMatches.filter(m => m.status === 'completed');
  
  const list = document.getElementById('matchList');
  if (allMatches.length === 0) {
    list.innerHTML = '<div style="padding:16px; color:var(--muted-text); text-align:center; background:var(--surface); border-radius:var(--radius); border:1px solid rgba(16,24,40,0.04)">No matches scheduled yet.</div>';
    return;
  }
  
  // Active matches section
  let html = '';
  if (activeMatches.length > 0) {
    html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;" class="match-grid resp-grid-3">' + activeMatches.map((m, i) => {
      const globalIdx = storedMatches.indexOf(m);
      return renderMatchCard(m, globalIdx, false);
    }).join('') + '</div>';
  } else {
    html += '<div style="padding:16px; color:var(--muted-text); text-align:center; background:var(--surface); border-radius:var(--radius); border:1px solid rgba(16,24,40,0.04)">No upcoming matches. All matches are finished!</div>';
  }
  
  // Finished matches history section — always visible so user can review
  if (finishedMatches.length > 0) {
    html += `<div class="history-section" style="margin-top:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(135deg,rgba(40,167,69,0.06),rgba(31,60,136,0.04));border:1px solid rgba(40,167,69,0.15);border-radius:12px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.5rem">📜</span>
          <div>
            <div style="font-weight:800;font-size:1rem;color:var(--text)">Match History</div>
            <div style="font-size:0.78rem;color:var(--muted-text)">${finishedMatches.length} completed match${finishedMatches.length !== 1 ? 'es' : ''} — tap any match to review</div>
          </div>
        </div>
        <button class="form-btn secondary-btn" style="padding:5px 12px;font-size:0.78rem;margin:0" onclick="toggleMatchHistory()">
          <span id="historyChevron" style="display:inline-block;transition:transform 0.2s;transform:rotate(90deg)">▸</span> ${finishedMatches.length > 6 ? 'Collapse' : 'Toggle'}
        </button>
      </div>
      <div id="matchHistoryContainer" style="display:block;margin-top:0">
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;" class="match-grid resp-grid-3">
          ${finishedMatches.map((m, i) => {
            const globalIdx = storedMatches.indexOf(m);
            return renderMatchCard(m, globalIdx, true);
          }).join('')}
        </div>
      </div>
    </div>`;
  }
  
  list.innerHTML = html;
}

function toggleMatchHistory() {
  const container = document.getElementById('matchHistoryContainer');
  const chevron = document.getElementById('historyChevron');
  if (!container) return;
  const isVisible = container.style.display !== 'none';
  container.style.display = isVisible ? 'none' : 'block';
  if (chevron) chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
}

function scrollToMatchHistory() {
  const historySection = document.querySelector('.history-section');
  if (historySection) {
    // Make sure it's visible
    const container = document.getElementById('matchHistoryContainer');
    const chevron = document.getElementById('historyChevron');
    if (container && container.style.display === 'none') {
      container.style.display = 'block';
      if (chevron) chevron.style.transform = 'rotate(90deg)';
    }
    historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    alert('No match history yet. Finish some matches first using the ✅ Finish button on each match card.');
  }
}

// Get bracket scores for a scheduled match (looks up tournament bracket data)
function getBracketScoresForMatch(teamA, teamB) {
  if (!teamA || !teamB) return null;
  const tournaments = g('tournaments') || [];
  for (const t of tournaments) {
    if (!t) continue;
    // Check round robin
    if (t.format === 'roundrobin' && t.roundRobin) {
      for (const m of t.roundRobin) {
        if (m && ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA)) && (m.scoreA !== undefined || m.scoreB !== undefined)) {
          const isSwapped = (m.a === teamB);
          return { scoreA: isSwapped ? Number(m.scoreB) || 0 : Number(m.scoreA) || 0, scoreB: isSwapped ? Number(m.scoreA) || 0 : Number(m.scoreB) || 0 };
        }
      }
    }
    // Check group+knockout
    if (t.format === 'groupknockout' && t.groupStage) {
      for (const gname of Object.keys(t.groupStage)) {
        for (const m of (t.groupStage[gname] || [])) {
          if (m && ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA)) && (m.scoreA !== undefined || m.scoreB !== undefined)) {
            const isSwapped = (m.a === teamB);
            return { scoreA: isSwapped ? Number(m.scoreB) || 0 : Number(m.scoreA) || 0, scoreB: isSwapped ? Number(m.scoreA) || 0 : Number(m.scoreB) || 0 };
          }
        }
      }
    }
    // Check elimination brackets
    const checkRounds = (rounds) => {
      if (!rounds || !Array.isArray(rounds)) return null;
      for (const round of rounds) {
        for (const m of (round || [])) {
          if (m && ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA)) && (m.scoreA !== undefined || m.scoreB !== undefined)) {
            const isSwapped = (m.a === teamB);
            return { scoreA: isSwapped ? Number(m.scoreB) || 0 : Number(m.scoreA) || 0, scoreB: isSwapped ? Number(m.scoreA) || 0 : Number(m.scoreB) || 0 };
          }
        }
      }
      return null;
    };
    if (t.format === 'double' && t.bracket && t.bracket.winners) {
      const res = checkRounds(t.bracket.winners) || checkRounds(t.bracket.losers);
      if (res) return res;
      if (t.grandFinal && ((t.grandFinal.a === teamA && t.grandFinal.b === teamB) || (t.grandFinal.a === teamB && t.grandFinal.b === teamA)) && (t.grandFinal.scoreA !== undefined || t.grandFinal.scoreB !== undefined)) {
        const isSwapped = (t.grandFinal.a === teamB);
        return { scoreA: isSwapped ? Number(t.grandFinal.scoreB) || 0 : Number(t.grandFinal.scoreA) || 0, scoreB: isSwapped ? Number(t.grandFinal.scoreA) || 0 : Number(t.grandFinal.scoreB) || 0 };
      }
    } else if (Array.isArray(t.bracket)) {
      const res = checkRounds(t.bracket);
      if (res) return res;
    }
  }
  return null;
}

function finishMatch(matchIndex) {
  const matches = g('matches');
  const m = matches[matchIndex];
  if (!m) return alert('Match not found');
  const ta = g('teams').find(t => t.id == m.a);
  const tb = g('teams').find(t => t.id == m.b);
  const nameA = ta ? ta.name : m.a;
  const nameB = tb ? tb.name : m.b;

  // Try to get scores from bracket if they exist (auto-fill from bracketing)
  let preScoreA = Number(m.sa) || 0;
  let preScoreB = Number(m.sb) || 0;
  const bracketScores = getBracketScoresForMatch(m.a, m.b);
  if (bracketScores) {
    preScoreA = bracketScores.scoreA;
    preScoreB = bracketScores.scoreB;
  }

  // Build score prompt overlay
  const overlay = document.createElement('div');
  overlay.id = 'finishMatchOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:24px;width:380px;max-width:94vw;box-shadow:0 16px 48px rgba(0,0,0,0.15)">
      <div style="font-weight:800;font-size:1.1rem;margin-bottom:16px;text-align:center">\u2705 Finish Match</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px">
        <div style="text-align:center;flex:1">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:6px">${nameA}</div>
          <input id="finScore_a" type="number" min="0" value="${preScoreA}" style="width:60px;text-align:center;padding:8px;font-size:1.1rem;font-weight:700;border:2px solid rgba(16,24,40,0.12);border-radius:8px">
        </div>
        <div style="font-weight:900;font-size:1.2rem;color:var(--muted-text)">vs</div>
        <div style="text-align:center;flex:1">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:6px">${nameB}</div>
          <input id="finScore_b" type="number" min="0" value="${preScoreB}" style="width:60px;text-align:center;padding:8px;font-size:1.1rem;font-weight:700;border:2px solid rgba(16,24,40,0.12);border-radius:8px">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="form-btn secondary-btn" style="padding:8px 16px" onclick="document.getElementById('finishMatchOverlay').remove()">Cancel</button>
        <button class="form-btn" style="padding:8px 16px;background:var(--success)" onclick="confirmFinishMatch(${matchIndex})">\u2705 Confirm & Finish</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>{ const el=document.getElementById('finScore_a'); if(el) el.focus(); },100);
}

function confirmFinishMatch(matchIndex) {
  const matches = g('matches');
  const m = matches[matchIndex];
  if (!m) return;
  m.sa = parseInt(document.getElementById('finScore_a').value) || 0;
  m.sb = parseInt(document.getElementById('finScore_b').value) || 0;
  m.status = 'completed';
  if (m.lineup) { delete m.lineup; }
  s('matches', matches);
  const ov = document.getElementById('finishMatchOverlay');
  if (ov) ov.remove();

  // Auto-sync final score to bracketing: find matching bracket match and apply scores
  syncScoreToBracketing(m);

  loadAll();
}

// Reverse sync: bracket scores → scheduled match
// When bracket scores are saved or winner is picked, update the corresponding scheduled match
function syncBracketToSchedule(teamA, teamB, scoreA, scoreB, markCompleted) {
  if (!teamA || !teamB) return;
  const matches = g('matches') || [];
  const idx = matches.findIndex(m =>
    m.status !== 'completed' &&
    ((m.a === teamA && m.b === teamB) || (m.a === teamB && m.b === teamA))
  );
  if (idx === -1) return;
  const m = matches[idx];
  const isSwapped = (m.a === teamB);
  m.sa = isSwapped ? Number(scoreB) || 0 : Number(scoreA) || 0;
  m.sb = isSwapped ? Number(scoreA) || 0 : Number(scoreB) || 0;
  if (markCompleted) {
    m.status = 'completed';
    if (m.lineup) delete m.lineup;
  }
  s('matches', matches);
}

// Sync completed match scores into the tournament bracket
function syncScoreToBracketing(match) {
  if (!match || !match.a || !match.b) return;
  const tournaments = g('tournaments') || [];
  const scoreA = Number(match.sa) || 0;
  const scoreB = Number(match.sb) || 0;
  const winnerId = scoreA > scoreB ? match.a : (scoreB > scoreA ? match.b : null);

  for (let tIdx = 0; tIdx < tournaments.length; tIdx++) {
    const t = tournaments[tIdx];
    if (!t) continue;

    // Check round robin
    if (t.format === 'roundrobin' && t.roundRobin) {
      t.roundRobin.forEach((m, i) => {
        if (m && !m.played && ((m.a === match.a && m.b === match.b) || (m.a === match.b && m.b === match.a))) {
          const isSwapped = (m.a === match.b);
          m.scoreA = isSwapped ? scoreB : scoreA;
          m.scoreB = isSwapped ? scoreA : scoreB;
          if (winnerId) {
            m.played = true;
            m.winner = winnerId;
          }
        }
      });
      s('tournaments', tournaments);
      continue;
    }

    // Check group+knockout
    if (t.format === 'groupknockout' && t.groupStage) {
      Object.keys(t.groupStage).forEach(gname => {
        (t.groupStage[gname] || []).forEach(m => {
          if (m && !m.played && ((m.a === match.a && m.b === match.b) || (m.a === match.b && m.b === match.a))) {
            const isSwapped = (m.a === match.b);
            m.scoreA = isSwapped ? scoreB : scoreA;
            m.scoreB = isSwapped ? scoreA : scoreB;
            if (winnerId) {
              m.played = true;
              m.winner = winnerId;
            }
          }
        });
      });
    }

    // Check elimination brackets (single or double)
    function findAndUpdateBracketMatch(rounds, bracketType) {
      if (!rounds || !Array.isArray(rounds)) return false;
      for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
        const round = rounds[rIdx] || [];
        for (let mIdx = 0; mIdx < round.length; mIdx++) {
          const bm = round[mIdx];
          if (!bm || bm.winner) continue;
          if ((bm.a === match.a && bm.b === match.b) || (bm.a === match.b && bm.b === match.a)) {
            const isSwapped = (bm.a === match.b);
            bm.scoreA = isSwapped ? scoreB : scoreA;
            bm.scoreB = isSwapped ? scoreA : scoreB;
            if (winnerId) {
              // Use chooseWinner to handle bracket advancement
              s('tournaments', tournaments);
              chooseWinner(tIdx, rIdx, mIdx, winnerId, bracketType);
              return true;
            }
          }
        }
      }
      return false;
    }

    if (t.format === 'double' && t.bracket && t.bracket.winners) {
      if (!findAndUpdateBracketMatch(t.bracket.winners, 'w')) {
        findAndUpdateBracketMatch(t.bracket.losers, 'l');
      }
      // Check grand final
      if (t.grandFinal && !t.grandFinal.winner && t.grandFinal.a && t.grandFinal.b) {
        if ((t.grandFinal.a === match.a && t.grandFinal.b === match.b) || (t.grandFinal.a === match.b && t.grandFinal.b === match.a)) {
          const isSwapped = (t.grandFinal.a === match.b);
          t.grandFinal.scoreA = isSwapped ? scoreB : scoreA;
          t.grandFinal.scoreB = isSwapped ? scoreA : scoreB;
          if (winnerId) {
            s('tournaments', tournaments);
            chooseWinner(tIdx, 0, 0, winnerId, 'gf');
          }
        }
      }
    } else if (Array.isArray(t.bracket)) {
      findAndUpdateBracketMatch(t.bracket, 's');
    }

    s('tournaments', tournaments);
  }
}

function updateMatchScore(matchIndex, side, value) {
  const matches = g('matches');
  const m = matches[matchIndex];
  if (!m) return;
  if (side === 'a') m.sa = parseInt(value) || 0;
  else m.sb = parseInt(value) || 0;
  s('matches', matches);
}

function deleteFinishedMatch(matchIndex) {
  if (!confirm('Permanently delete this finished match from history?')) return;
  const matches = g('matches');
  matches.splice(matchIndex, 1);
  s('matches', matches);
  loadAll();
}

function reviewMatch(matchIndex) {
  const matches = g('matches');
  const m = matches[matchIndex];
  if (!m) return alert('Match not found');
  const ta = g('teams').find(t => t.id == m.a);
  const tb = g('teams').find(t => t.id == m.b);
  const teamAName = ta ? ta.name : m.a;
  const teamBName = tb ? tb.name : m.b;
  const logoA = ta && ta.logo ? `<img src="${ta.logo}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;border:2px solid rgba(16,24,40,0.08)">` : `<div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.2rem">${teamAName.charAt(0).toUpperCase()}</div>`;
  const logoB = tb && tb.logo ? `<img src="${tb.logo}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;border:2px solid rgba(16,24,40,0.08)">` : `<div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.2rem">${teamBName.charAt(0).toUpperCase()}</div>`;
  const dateStr = m.date || 'N/A';
  const timeStr = m.time ? `${formatTime(m.time)} - ${formatTime(m.endTime)}` : 'N/A';
  const courtStr = m.court || 'N/A';
  const scoreA = Number(m.sa) || 0;
  const scoreB = Number(m.sb) || 0;
  const winner = scoreA > scoreB ? teamAName : scoreB > scoreA ? teamBName : 'Draw';
  const sportName = m.sport || (ta ? ta.sport : '') || '';

  const overlay = document.createElement('div');
  overlay.id = 'reviewMatchOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;animation:fadeIn 0.2s';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:24px;width:440px;max-width:94vw;box-shadow:0 16px 48px rgba(0,0,0,0.15);max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-weight:800;font-size:1.15rem;display:flex;align-items:center;gap:8px"><span style="font-size:1.4rem">📋</span> Match Review</div>
        <button onclick="document.getElementById('reviewMatchOverlay').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--muted-text);padding:4px">✕</button>
      </div>
      <div style="background:linear-gradient(135deg,rgba(40,167,69,0.08),rgba(31,60,136,0.06));border:1px solid rgba(40,167,69,0.15);border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="text-align:center;margin-bottom:8px">
          <span class="finished-badge" style="font-size:0.8rem;padding:4px 14px">✅ COMPLETED</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:12px 0">
          <div style="text-align:center">
            ${logoA}
            <div style="font-weight:800;font-size:0.95rem;margin-top:6px;color:${scoreA > scoreB ? 'var(--success)' : 'var(--text)'}">${teamAName}</div>
          </div>
          <div style="text-align:center">
            <div style="background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;padding:8px 18px;border-radius:12px;font-weight:900;font-size:1.4rem;letter-spacing:2px">${scoreA} - ${scoreB}</div>
          </div>
          <div style="text-align:center">
            ${logoB}
            <div style="font-weight:800;font-size:0.95rem;margin-top:6px;color:${scoreB > scoreA ? 'var(--success)' : 'var(--text)'}">${teamBName}</div>
          </div>
        </div>
        ${winner !== 'Draw' ? `<div style="text-align:center;font-size:0.85rem;color:var(--success);font-weight:700">🏆 Winner: ${winner}</div>` : '<div style="text-align:center;font-size:0.85rem;color:var(--muted-text);font-weight:600">🤝 Draw</div>'}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">
          <div style="font-size:0.7rem;color:var(--muted-text);text-transform:uppercase;font-weight:600;margin-bottom:2px">📅 Date</div>
          <div style="font-weight:700;font-size:0.9rem">${dateStr}</div>
        </div>
        <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">
          <div style="font-size:0.7rem;color:var(--muted-text);text-transform:uppercase;font-weight:600;margin-bottom:2px">🕐 Time</div>
          <div style="font-weight:700;font-size:0.9rem">${timeStr}</div>
        </div>
        <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">
          <div style="font-size:0.7rem;color:var(--muted-text);text-transform:uppercase;font-weight:600;margin-bottom:2px">📍 Court</div>
          <div style="font-weight:700;font-size:0.9rem">${courtStr}</div>
        </div>
        <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">
          <div style="font-size:0.7rem;color:var(--muted-text);text-transform:uppercase;font-weight:600;margin-bottom:2px">🏅 Sport</div>
          <div style="font-weight:700;font-size:0.9rem">${sportName || 'N/A'}</div>
        </div>
      </div>
      ${m.tournament ? `<div style="padding:8px 12px;background:rgba(31,60,136,0.06);border-radius:8px;margin-bottom:16px;font-size:0.85rem;display:flex;align-items:center;gap:6px"><span>🏆</span> <strong>Tournament:</strong> ${m.tournament}</div>` : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="form-btn danger-btn" style="padding:6px 14px;font-size:0.82rem;margin:0" onclick="document.getElementById('reviewMatchOverlay').remove();deleteFinishedMatch(${matchIndex})">🗑️ Delete</button>
        <button class="form-btn secondary-btn" style="padding:6px 14px;font-size:0.82rem;margin:0" onclick="document.getElementById('reviewMatchOverlay').remove()">Close</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

function renderMatchCard(m, i, isHistory) {
    const ta = g('teams').find(t => t.id == m.a);
    const tb = g('teams').find(t => t.id == m.b);
    const teamAName = ta ? ta.name.toUpperCase() : String(m.a).toUpperCase();
    const teamBName = tb ? tb.name.toUpperCase() : String(m.b).toUpperCase();
    const timeStr = m.time ? `${formatTime(m.time)} - ${formatTime(m.endTime)}` : 'TBD';
    const dateStr = m.date || 'TBD';
    const courtStr = m.court || 'TBD';
    const isCompleted = m.status === 'completed';
    const isLive = m.status === 'live';
    const statusColor = isCompleted ? 'var(--success)' : (isLive ? 'var(--danger)' : 'var(--primary)');
    const statusText = isCompleted ? 'FINISHED' : (m.status || 'scheduled').toUpperCase();
    const borderAccent = isLive ? 'var(--danger)' : (isCompleted ? 'var(--success)' : 'var(--primary)');
    const historyClass = isHistory ? ' history-match' : '';
    
    // Team logos in schedule
    const logoA = ta && ta.logo 
      ? `<img src="${ta.logo}" class="team-logo-xs" style="width:24px;height:24px;border-radius:6px;object-fit:cover;margin:0 auto 2px;display:block">`
      : '';
    const logoB = tb && tb.logo 
      ? `<img src="${tb.logo}" class="team-logo-xs" style="width:24px;height:24px;border-radius:6px;object-fit:cover;margin:0 auto 2px;display:block">`
      : '';
    
    return `
      <div class="match-card${historyClass}" style="background:var(--surface); border:1px solid rgba(16,24,40,0.08); border-left:3px solid ${borderAccent}; border-radius:10px; padding:0; box-shadow:0 1px 6px rgba(16,24,40,0.04); overflow:hidden; transition:all 0.2s ease;" onmouseover="this.style.boxShadow='0 3px 14px rgba(16,24,40,0.1)';this.style.transform='translateY(-1px)'" onmouseout="this.style.boxShadow='0 1px 6px rgba(16,24,40,0.04)';this.style.transform='none'">
        <!-- Match Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:rgba(16,24,40,0.02); border-bottom:1px solid rgba(16,24,40,0.04);">
          <div style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--muted-text); font-weight:600; letter-spacing:0.2px; flex-wrap:wrap;">
            <span>📅 ${dateStr}</span>
            <span style="opacity:0.4">•</span>
            <span>🕐 ${timeStr}</span>
            <span style="opacity:0.4">•</span>
            <span>📍 ${courtStr}</span>
          </div>
          ${isCompleted 
            ? '<span class="finished-badge">✅ FINISHED</span>'
            : `<span style="font-size:0.62rem; padding:2px 7px; border-radius:14px; background:${statusColor}; color:#fff; font-weight:700; letter-spacing:0.4px; flex-shrink:0;">${statusText}</span>`
          }
        </div>
        <!-- Match Body -->
        <div style="padding:8px 10px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div style="flex:1; display:flex; align-items:center; gap:6px; justify-content:center; min-width:0;">
            <div style="flex:1; text-align:center; min-width:0;">
              ${logoA}
              <div style="font-weight:800; font-size:0.85rem; color:var(--text); letter-spacing:0.3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${teamAName}</div>
            </div>
            <div style="flex-shrink:0;">
              <div style="background:linear-gradient(135deg, var(--primary), var(--accent)); color:#fff; padding:4px 10px; border-radius:8px; font-weight:800; font-size:0.78rem; min-width:44px; text-align:center;">${isCompleted
                ? `${m.sa} - ${m.sb}`
                : `<span style="display:inline-flex;align-items:center;gap:2px"><input type="number" min="0" value="${Number(m.sa)||0}" oninput="updateMatchScore(${i},'a',this.value)" style="width:28px;text-align:center;border:none;background:rgba(255,255,255,0.25);color:#fff;font-weight:800;font-size:0.78rem;border-radius:4px;padding:1px 0" onclick="event.stopPropagation()"> - <input type="number" min="0" value="${Number(m.sb)||0}" oninput="updateMatchScore(${i},'b',this.value)" style="width:28px;text-align:center;border:none;background:rgba(255,255,255,0.25);color:#fff;font-weight:800;font-size:0.78rem;border-radius:4px;padding:1px 0" onclick="event.stopPropagation()"></span>`
              }</div>
            </div>
            <div style="flex:1; text-align:center; min-width:0;">
              ${logoB}
              <div style="font-weight:800; font-size:0.85rem; color:var(--text); letter-spacing:0.3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${teamBName}</div>
            </div>
          </div>
          ${isCompleted 
            ? `<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0;">
                <button class="form-btn secondary-btn" style="padding:3px 7px; font-size:0.62rem; border-radius:6px;" onclick="reviewMatch(${i})">📋 Review</button>
                <button class="form-btn danger-btn" style="padding:3px 7px; font-size:0.62rem; border-radius:6px;" onclick="deleteFinishedMatch(${i})">🗑️</button>
              </div>`
            : `<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0;">
                <button class="form-btn secondary-btn" style="padding:3px 7px; font-size:0.62rem; border-radius:6px;" onclick="openLineupEditor(${i})">Lineup</button>
                <button class="form-btn" style="padding:3px 7px; font-size:0.62rem; border-radius:6px; background:var(--accent)" onclick="openReschedule(${i})">📅 Resched</button>
                <button class="form-btn" style="padding:3px 7px; font-size:0.62rem; border-radius:6px; background:var(--success)" onclick="finishMatch(${i})">✅ Finish</button>
              </div>`
          }
        </div>
        <!-- Match Footer -->
        <div style="padding:4px 10px 6px; display:flex; justify-content:center; gap:6px; align-items:center; flex-wrap:wrap; font-size:0.68rem; color:var(--muted-text);">
          ${m.sport ? '<span style="padding:1px 7px;border-radius:10px;background:rgba(31,60,136,0.08);color:var(--primary);font-weight:600;font-size:0.65rem;">🏅 ' + m.sport + '</span>' : ''}
          <span>${m.tournament || 'Manual'}</span>
          ${m.tournament && m.tournament !== 'Manual' ? `<button class="form-btn secondary-btn" style="padding:1px 7px;font-size:0.62rem;border-radius:8px;margin:0" onclick="event.stopPropagation();viewScheduleTournamentBracket('${m.tournament.replace(/'/g,"\\'")}')">🏆 Bracket</button>` : ''}
        </div>
      </div>
    `;
}

// View read-only bracket overlay from schedule
function viewScheduleTournamentBracket(tournamentName) {
  const tournaments = getVisibleTournaments();
  const tIdx = tournaments.findIndex(t => t.name === tournamentName);
  if (tIdx < 0) return alert('Tournament not found');
  const t = tournaments[tIdx];
  if (!t.bracket && !t.roundRobin && !t.groupStage) return alert('No bracket generated for this tournament yet.');

  const overlay = document.createElement('div');
  overlay.id = 'bracketViewOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const allTeams = getVisibleTeams();
  const getName = (id) => id ? (allTeams.find(x => x.id === id) || { name: id }).name : 'TBD';
  const getLogo = (id) => {
    if (!id) return '';
    const tm = allTeams.find(x => x.id === id);
    if (tm && tm.logo) return `<img src="${tm.logo}" class="bracket-team-logo">`;
    const initial = tm ? tm.name.charAt(0).toUpperCase() : '?';
    return `<span class="bracket-team-logo" style="display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;font-weight:700;font-size:0.65rem">${initial}</span>`;
  };

  let bracketHtml = '';
  if (Array.isArray(t.bracket)) {
    bracketHtml = typeof renderClassicBracket === 'function' ? renderClassicBracket(t.bracket, tIdx, 'ro', t) : '';
  } else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    bracketHtml = '<div style="margin-bottom:12px"><strong>Winners Bracket</strong></div>';
    bracketHtml += typeof renderClassicBracket === 'function' ? renderClassicBracket(t.bracket.winners, tIdx, 'ro', t) : '';
  } else if (t.format === 'roundrobin' && t.roundRobin) {
    bracketHtml = '<div class="rr-grid" style="pointer-events:none">';
    (t.roundRobin || []).forEach((m, i) => {
      const aName = m.a ? getName(m.a) : 'TBD';
      const bName = m.b ? getName(m.b) : 'TBD';
      bracketHtml += `<div class="rr-match"><div class="rr-match-header">Match ${i+1}</div><div class="rr-match-teams"><div class="rr-team"><span class="rr-team-name">${getLogo(m.a)}${aName}</span></div><div class="rr-team"><span class="rr-team-name">${getLogo(m.b)}${bName}</span></div></div></div>`;
    });
    bracketHtml += '</div>';
  }

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:24px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);position:relative">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-weight:800;font-size:1.15rem;display:flex;align-items:center;gap:8px"><span>🏆</span> ${t.name} — Bracket <span style="font-size:0.75rem;padding:2px 10px;background:rgba(31,60,136,0.08);border-radius:999px;color:var(--muted-text);font-weight:600">View Only</span></div>
        <button onclick="this.closest('#bracketViewOverlay').remove()" style="border:none;background:none;font-size:1.3rem;cursor:pointer;color:var(--muted-text);padding:4px 8px">✕</button>
      </div>
      <div style="overflow-x:auto;pointer-events:none">${bracketHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function populateMatchTeamSelect() {
  // Populate bracket match dropdown for single match scheduling
  populateBracketMatchSelect();

  // Setup time text inputs with auto-formatting
  setupTimeInput('mTime');
  setupTimeInput('mEndTime');
  setupTimeInput('bulkStartTime');
  setupTimeInput('autoStartTime');

  // Wire up start time → auto-calc end time on blur
  const mTime = document.getElementById('mTime');
  if (mTime) {
    mTime.removeEventListener('blur', calcEndTime);
    mTime.addEventListener('blur', calcEndTime);
  }

  // Populate auto-generate tournament select
  populateAutoTournamentSelect();

  // Render court quick-pick chips
  renderCourtChips();
}

// Lineup editor functions
function openLineupEditor(matchIndex) {
  const matches = g('matches');
  const m = matches[matchIndex];
  if (!m) return alert('Match not found');
  const body = document.getElementById('lineupEditorBody');
  if (!body) return;
  const ta = g('teams').find(t => t.id === m.a) || { id: m.a, name: m.a, sport: '' };
  const tb = g('teams').find(t => t.id === m.b) || { id: m.b, name: m.b, sport: '' };
  const sportName = ta.sport || tb.sport || '';
  const sportType = getSportType(sportName);
  const playersA = getVisiblePlayers().filter(p => p.team === ta.id);
  const playersB = getVisiblePlayers().filter(p => p.team === tb.id);

  function playerOpts(players) {
    return '<option value="">-- Select --</option>' + players.map(p => `<option value="${p.name}">${p.name} (${p.position || 'N/A'})</option>`).join('');
  }

  let html;
  if (sportType === 'racket') {
    // Racket sport: Singles A, Singles B, Doubles pair
    html = `<div style="display:flex;gap:12px">
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:6px;color:var(--primary)">${ta.name}</div>
        <label style="font-size:0.85rem;font-weight:600">Singles A</label>
        <select id="editor_sA_a" style="width:100%">${playerOpts(playersA)}</select>
        <label style="display:block;margin-top:6px;font-size:0.85rem;font-weight:600">Singles B</label>
        <select id="editor_sB_a" style="width:100%">${playerOpts(playersA)}</select>
        <label style="display:block;margin-top:6px;font-size:0.85rem;font-weight:600">Doubles Player 1</label>
        <select id="editor_d1_a" style="width:100%">${playerOpts(playersA)}</select>
        <label style="display:block;margin-top:6px;font-size:0.85rem;font-weight:600">Doubles Player 2</label>
        <select id="editor_d2_a" style="width:100%">${playerOpts(playersA)}</select>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:6px;color:var(--primary)">${tb.name}</div>
        <label style="font-size:0.85rem;font-weight:600">Singles A</label>
        <select id="editor_sA_b" style="width:100%">${playerOpts(playersB)}</select>
        <label style="display:block;margin-top:6px;font-size:0.85rem;font-weight:600">Singles B</label>
        <select id="editor_sB_b" style="width:100%">${playerOpts(playersB)}</select>
        <label style="display:block;margin-top:6px;font-size:0.85rem;font-weight:600">Doubles Player 1</label>
        <select id="editor_d1_b" style="width:100%">${playerOpts(playersB)}</select>
        <label style="display:block;margin-top:6px;font-size:0.85rem;font-weight:600">Doubles Player 2</label>
        <select id="editor_d2_b" style="width:100%">${playerOpts(playersB)}</select>
      </div>
    </div>`;
  } else {
    // Team sport: Captain + Starting Players (checkboxes)
    function starterChecklist(players, side) {
      if (!players.length) return '<span style="color:var(--muted-text);font-size:0.85rem">No players</span>';
      return players.map(p => `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer"><input type="checkbox" class="editor-starter-${side}" value="${p.name}"> <span>${p.name}</span> <span style="color:var(--muted-text);font-size:0.8rem">(${p.position || 'N/A'})</span></label>`).join('');
    }
    html = `<div style="display:flex;gap:12px">
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:6px;color:var(--primary)">${ta.name}</div>
        <label style="font-size:0.85rem;font-weight:600">Captain</label>
        <select id="editor_captain_a" style="width:100%">${playerOpts(playersA)}</select>
        <label style="display:block;margin-top:8px;font-size:0.85rem;font-weight:600">Starting Players</label>
        <div id="editor_starters_a" style="max-height:150px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:6px">
          ${starterChecklist(playersA, 'a')}
        </div>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:6px;color:var(--primary)">${tb.name}</div>
        <label style="font-size:0.85rem;font-weight:600">Captain</label>
        <select id="editor_captain_b" style="width:100%">${playerOpts(playersB)}</select>
        <label style="display:block;margin-top:8px;font-size:0.85rem;font-weight:600">Starting Players</label>
        <div id="editor_starters_b" style="max-height:150px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:6px">
          ${starterChecklist(playersB, 'b')}
        </div>
      </div>
    </div>`;
  }

  body.innerHTML = html;
  window.__editingSportType = sportType;

  // Prefill from existing lineup
  if (m.lineup && m.lineup.a) {
    if (sportType === 'racket') {
      try { document.getElementById('editor_sA_a').value = m.lineup.a.singleA || ''; } catch(e){}
      try { document.getElementById('editor_sB_a').value = m.lineup.a.singleB || ''; } catch(e){}
      try { document.getElementById('editor_d1_a').value = (m.lineup.a.doubles||[])[0]||''; } catch(e){}
      try { document.getElementById('editor_d2_a').value = (m.lineup.a.doubles||[])[1]||''; } catch(e){}
    } else {
      try { document.getElementById('editor_captain_a').value = m.lineup.a.captain || ''; } catch(e){}
      (m.lineup.a.starters||[]).forEach(name => {
        const cb = document.querySelector(`.editor-starter-a[value="${name}"]`);
        if (cb) cb.checked = true;
      });
    }
  }
  if (m.lineup && m.lineup.b) {
    if (sportType === 'racket') {
      try { document.getElementById('editor_sA_b').value = m.lineup.b.singleA || ''; } catch(e){}
      try { document.getElementById('editor_sB_b').value = m.lineup.b.singleB || ''; } catch(e){}
      try { document.getElementById('editor_d1_b').value = (m.lineup.b.doubles||[])[0]||''; } catch(e){}
      try { document.getElementById('editor_d2_b').value = (m.lineup.b.doubles||[])[1]||''; } catch(e){}
    } else {
      try { document.getElementById('editor_captain_b').value = m.lineup.b.captain || ''; } catch(e){}
      (m.lineup.b.starters||[]).forEach(name => {
        const cb = document.querySelector(`.editor-starter-b[value="${name}"]`);
        if (cb) cb.checked = true;
      });
    }
  }

  window.__editingMatchIndex = matchIndex;
  document.getElementById('lineupEditor').style.display = 'block';
}

function closeLineupEditor() { document.getElementById('lineupEditor').style.display = 'none'; window.__editingMatchIndex = null; }

function saveMatchLineup() {
  const idx = window.__editingMatchIndex;
  if (idx === undefined || idx === null) return;
  const matches = g('matches');
  const m = matches[idx];
  if (!m) return alert('Match not found');
  const sportType = window.__editingSportType || 'team';
  let a, b;

  if (sportType === 'racket') {
    a = {
      type: 'racket',
      singleA: (document.getElementById('editor_sA_a') || {}).value || null,
      singleB: (document.getElementById('editor_sB_a') || {}).value || null,
      doubles: [(document.getElementById('editor_d1_a') || {}).value || null, (document.getElementById('editor_d2_a') || {}).value || null].filter(Boolean)
    };
    b = {
      type: 'racket',
      singleA: (document.getElementById('editor_sA_b') || {}).value || null,
      singleB: (document.getElementById('editor_sB_b') || {}).value || null,
      doubles: [(document.getElementById('editor_d1_b') || {}).value || null, (document.getElementById('editor_d2_b') || {}).value || null].filter(Boolean)
    };
  } else {
    a = {
      type: 'team',
      captain: (document.getElementById('editor_captain_a') || {}).value || null,
      starters: Array.from(document.querySelectorAll('.editor-starter-a:checked')).map(cb => cb.value)
    };
    b = {
      type: 'team',
      captain: (document.getElementById('editor_captain_b') || {}).value || null,
      starters: Array.from(document.querySelectorAll('.editor-starter-b:checked')).map(cb => cb.value)
    };
  }

  m.lineup = { a: a, b: b };
  s('matches', matches);
  closeLineupEditor();
  loadMatches();
  alert('Lineup saved for match');
}

// =================== RESCHEDULE ===================

function openReschedule(matchIndex) {
  const matches = g('matches');
  const m = matches[matchIndex];
  if (!m) return;
  const teams = g('teams');
  const ta = teams.find(t => t.id == m.a);
  const tb = teams.find(t => t.id == m.b);
  
  document.getElementById('rescheduleIdx').value = matchIndex;
  document.getElementById('rescheduleDate').value = m.date || '';
  if (m.time) {
    setTimeValue('reschedule', m.time);
  }
  document.getElementById('rescheduleCourt').value = m.court || '';
  document.getElementById('rescheduleReason').value = '';
  document.getElementById('rescheduleMatchInfo').innerHTML = 
    `${ta ? ta.name : m.a} <span style="color:var(--muted-text);font-weight:400">vs</span> ${tb ? tb.name : m.b}` +
    (m.date ? `<br><span style="font-size:0.78rem;color:var(--muted-text);font-weight:400">Currently: ${m.date} at ${formatTime(m.time)} — ${m.court || 'No venue'}</span>` : '');
  
  document.getElementById('rescheduleModal').style.display = 'block';
}

function closeReschedule() {
  document.getElementById('rescheduleModal').style.display = 'none';
}

function saveReschedule() {
  const idx = parseInt(document.getElementById('rescheduleIdx').value);
  const matches = g('matches');
  const m = matches[idx];
  if (!m) return alert('Match not found.');
  
  const newDate = document.getElementById('rescheduleDate').value;
  const newTime = getTimeValue('reschedule');
  const newCourt = document.getElementById('rescheduleCourt').value.trim();
  const reason = document.getElementById('rescheduleReason').value.trim();
  
  if (!newDate || !newTime) return alert('Please enter a valid date and time.');
  
  const oldDate = m.date;
  const oldTime = m.time;
  const oldCourt = m.court;
  
  // Update match
  m.date = newDate;
  m.time = newTime;
  if (newCourt) m.court = newCourt;
  
  // Recalculate end time based on duration (default 60 min)
  const [h, min] = newTime.split(':').map(Number);
  const endMin = h * 60 + min + 60;
  m.endTime = String(Math.floor(endMin / 60)).padStart(2, '0') + ':' + String(endMin % 60).padStart(2, '0');
  
  // Store reschedule history
  if (!m.rescheduleHistory) m.rescheduleHistory = [];
  m.rescheduleHistory.push({
    from: { date: oldDate, time: oldTime, court: oldCourt },
    to: { date: newDate, time: newTime, court: newCourt || oldCourt },
    reason: reason,
    timestamp: new Date().toISOString()
  });
  
  s('matches', matches);
  closeReschedule();
  loadMatches();
  
  // Notify organizers about reschedule
  const teams = g('teams');
  const ta = teams.find(t => t.id == m.a);
  const tb = teams.find(t => t.id == m.b);
  if (ta && tb && typeof addNotification === 'function') {
    const msg = `📅 Match rescheduled: ${ta.name} vs ${tb.name} moved to ${newDate} at ${formatTime(newTime)}${newCourt ? ' at ' + newCourt : ''}${reason ? ' — Reason: ' + reason : ''}`;
    addNotification('System', '', msg, 'schedule');
  }
  
  alert('Match rescheduled successfully!');
}
