// Tournaments module
function addTournament() {
  let sport;
  if (selectedSport === null) {
    sport = document.getElementById('tSport').value;
    if (!sport) return alert('Select a sport');
  } else {
    sport = selectedSport;
  }
  if (!sport) return alert('No sport selected. Please select a sport first or contact admin.');
  // support both legacy checkbox UI and new team-card UI
  let teams = [];
  const cardSel = Array.from(document.querySelectorAll('#tTeams .team-card.selected'));
  if (cardSel && cardSel.length > 0) teams = cardSel.map(c => c.getAttribute('data-id'));
  else teams = Array.from(document.querySelectorAll('#tTeams input:checked')).map(cb => cb.value);
  const name = document.getElementById('tName').value.trim();
  const startDate = document.getElementById('tStartDate').value;
  const endDate = document.getElementById('tEndDate') ? document.getElementById('tEndDate').value : '';
  if (!name || !startDate) {
    alert('Please fill all required fields (Tournament Name and Start Date).');
    return;
  }
  if (endDate && new Date(endDate) < new Date(startDate)) {
    alert('End Date cannot be before Start Date.');
    return;
  }
  const format = document.getElementById('tFormat') ? document.getElementById('tFormat').value : 'single';
  const autoSeed = document.getElementById('tAutoSeed') ? !!document.getElementById('tAutoSeed').checked : true;
  const bestOf = document.getElementById('tBestOf') ? Number(document.getElementById('tBestOf').value) : 1;
  const twiceToBeat = (format === 'double' && document.getElementById('tTwiceToBeat')) ? !!document.getElementById('tTwiceToBeat').checked : false;
  const t = g('tournaments');
  const campusSel = document.getElementById('tournCampus');
  const campus = getCurrentCampus();
  if (!campus) { alert('Campus not set.'); return; }
  // Save tournament without generating bracket — bracket is generated in Bracketing section
  t.push({ name: name, sport: sport, teams: teams, startDate: startDate, endDate: endDate, format: format, autoSeed: autoSeed, bestOf: bestOf, twiceToBeat: twiceToBeat, campus: campus });
  s('tournaments', t);
  loadAll();
  document.getElementById('tName').value = '';
  document.getElementById('tStartDate').value = '';
}

// Generate standard tournament seeding order for bracket of size n (must be power of 2).
// Returns array like [1, 8, 4, 5, 3, 6, 2, 7] for n=8.
// This ensures: top seeds get byes, seed 1 and 2 are on opposite halves, byes are spread evenly.
function bracketSeeds(n) {
  if (n === 1) return [1];
  var half = bracketSeeds(n / 2);
  var result = [];
  for (var i = 0; i < half.length; i++) {
    result.push(half[i]);
    result.push(n + 1 - half[i]);
  }
  return result;
}

function createBracket(teamIds, format, options = {}) {
  if (format === 'groupknockout') return createGroupKnockout(teamIds, options);
  if (format === 'roundrobin') {
    // simple round robin pairings (each pair once)
    const teams = teamIds.slice();
    const matches = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({ a: teams[i], b: teams[j], played: false, winner: null });
      }
    }
    return matches;
  }
  // single or double-elimination base bracket (winners bracket)
  // support auto-seeding (random shuffle) if requested
  const teams = teamIds.slice();
  if (options.autoSeed) {
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = teams[i]; teams[i] = teams[j]; teams[j] = tmp;
    }
  }
  // compute next power of two
  let nextPow = 1;
  while (nextPow < teams.length) nextPow <<= 1;
  const roundsCount = Math.log2(nextPow);

  // Use standard tournament seeding to distribute byes evenly.
  // This ensures top seeds get byes and no two byes face each other.
  const seededOrder = bracketSeeds(nextPow);
  const slots = seededOrder.map(seed => seed <= teams.length ? teams[seed - 1] : null);

  const rounds = new Array(roundsCount).fill(null).map(() => []);
  // first round pairings using seeded positions
  const first = [];
  for (let i = 0; i < slots.length; i += 2) {
    first.push({ a: slots[i], b: slots[i + 1], winner: null });
  }
  rounds[0] = first;

  // subsequent rounds
  let prev = first;
  for (let r = 1; r < roundsCount; r++) {
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push({ a: null, b: null, winner: null });
    }
    rounds[r] = next;
    prev = next;
  }

  if (format === 'double') {
    // Proper double-elim losers bracket:
    // Losers bracket has 2*(winnersRounds-1) rounds
    // Even rounds (0,2,4...) = internal pairing (survivors play each other)
    // Odd rounds (1,3,5...) = drop-down (receive losers from winners bracket)
    const N = first.length; // first-round match count
    const losersRoundCount = Math.max(1, 2 * (roundsCount - 1));
    const losers = [];
    for (let lr = 0; lr < losersRoundCount; lr++) {
      const pairIdx = Math.floor(lr / 2);
      const matchCount = Math.max(1, Math.ceil(N / Math.pow(2, pairIdx + 1)));
      const arr = [];
      for (let j = 0; j < matchCount; j++) arr.push({ a: null, b: null, winner: null });
      losers.push(arr);
    }
    autoResolveByes(rounds);
    return { winners: rounds, losers: losers };
  }

  autoResolveByes(rounds);
  return rounds;
}

// Create group stage + knockout structure
function createGroupKnockout(teamIds, options = {}) {
  const teams = teamIds.slice();
  if (options.autoSeed) {
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = teams[i]; teams[i] = teams[j]; teams[j] = tmp;
    }
  }
  // determine groups: use team.group when available, otherwise split into groups of 4
  const teamsObj = g('teams');
  const groupsMap = {};
  teams.forEach(tid => {
    const tm = teamsObj.find(x => x.id === tid) || { group: null };
    const grp = (tm.group && tm.group.trim()) ? tm.group.trim() : null;
    if (grp) {
      groupsMap[grp] = groupsMap[grp] || [];
      groupsMap[grp].push(tid);
    }
  });
  const groups = Object.keys(groupsMap).length ? groupsMap : {};
  if (Object.keys(groups).length === 0) {
    // create dynamic groups of size 4
    const size = 4;
    let gIdx = 0;
    for (let i = 0; i < teams.length; i += size) {
      groups[`Group ${++gIdx}`] = teams.slice(i, i + size);
    }
  }

  const groupStage = {};
  Object.keys(groups).forEach(gname => {
    const arr = groups[gname];
    const matches = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        matches.push({ a: arr[i], b: arr[j], played: false, winner: null });
      }
    }
    groupStage[gname] = matches;
  });

  // Knockout: TBD slots initially — populated when group stage is finalized
  const groupNames = Object.keys(groups);
  const qualifierCount = Math.max(2, groupNames.length);
  let nextPow = 1; while (nextPow < qualifierCount) nextPow <<= 1;
  const roundsCount = Math.max(1, Math.log2(nextPow));
  const rounds = [];
  const first = [];
  for (let i = 0; i < nextPow; i += 2) first.push({ a: null, b: null, winner: null });
  rounds.push(first);
  let prev = first;
  for (let r = 1; r < roundsCount; r++) {
    const next = [];
    for (let i = 0; i < prev.length; i += 2) next.push({ a: null, b: null, winner: null });
    rounds.push(next); prev = next;
  }
  return { groupStage, knockout: rounds };
}

// ══════════════════════════════════════════════════════════
// Bye Auto-Resolution & Group Finalization Utilities
// ══════════════════════════════════════════════════════════

// Auto-resolve bye matches in a standard bracket (single-elim or winners bracket)
// NEVER auto-resolve the LAST round (Finals) — user must always pick the champion
function autoResolveByes(rounds) {
  if (!rounds || !rounds.length) return;
  const lastRound = rounds.length - 1;
  let changed = true;
  while (changed) {
    changed = false;
    for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
      const round = rounds[rIdx] || [];
      for (let mIdx = 0; mIdx < round.length; mIdx++) {
        const m = round[mIdx];
        if (!m || m.winner) continue;
        // SKIP the finals — user must always decide the champion
        if (rIdx === lastRound) continue;
        const hasA = !!m.a;
        const hasB = !!m.b;
        if (hasA && !hasB) {
          if (!canSlotReceiveTeam(rounds, rIdx, mIdx, 'b')) {
            m.winner = m.a;
            advanceWinnerInBracket(rounds, rIdx, mIdx, m.a);
            changed = true;
          }
        } else if (!hasA && hasB) {
          if (!canSlotReceiveTeam(rounds, rIdx, mIdx, 'a')) {
            m.winner = m.b;
            advanceWinnerInBracket(rounds, rIdx, mIdx, m.b);
            changed = true;
          }
        }
      }
    }
  }
}

// Check if a null slot at [rIdx][mIdx][slot] can still receive a team from a prior match
function canSlotReceiveTeam(rounds, rIdx, mIdx, slot) {
  if (rIdx === 0) return false; // R0 slots are set at creation
  const feederIdx = (slot === 'a') ? mIdx * 2 : mIdx * 2 + 1;
  const prevRound = rounds[rIdx - 1] || [];
  if (feederIdx >= prevRound.length) return false;
  const fm = prevRound[feederIdx];
  if (!fm) return false;
  if (fm.winner) return false; // winner already decided, should have advanced
  return !!(fm.a || fm.b); // has real teams that can still produce a winner
}

// Advance winner to next round in a standard bracket
function advanceWinnerInBracket(rounds, rIdx, mIdx, winnerId) {
  if (rIdx + 1 < rounds.length) {
    const nm = Math.floor(mIdx / 2);
    const sl = (mIdx % 2 === 0) ? 'a' : 'b';
    if (!rounds[rIdx + 1][nm]) rounds[rIdx + 1][nm] = { a: null, b: null, winner: null };
    rounds[rIdx + 1][nm][sl] = winnerId;
  }
}

// Auto-resolve byes in the losers bracket of double-elimination
// NEVER auto-resolve the LAST losers round — user must decide who goes to Grand Final
function autoResolveLoserByes(winners, losers) {
  if (!losers || !losers.length) return;
  const lastLR = losers.length - 1;
  let changed = true;
  while (changed) {
    changed = false;
    for (let rIdx = 0; rIdx < losers.length; rIdx++) {
      const round = losers[rIdx] || [];
      for (let mIdx = 0; mIdx < round.length; mIdx++) {
        const m = round[mIdx];
        if (!m || m.winner) continue;
        // SKIP the last losers round — user must decide
        if (rIdx === lastLR) continue;
        const hasA = !!m.a;
        const hasB = !!m.b;
        if (hasA && !hasB) {
          if (!canLoserSlotReceiveTeam(winners, losers, rIdx, mIdx, 'b')) {
            m.winner = m.a;
            advanceInLosers(losers, rIdx, mIdx, m.a);
            changed = true;
          }
        } else if (!hasA && hasB) {
          if (!canLoserSlotReceiveTeam(winners, losers, rIdx, mIdx, 'a')) {
            m.winner = m.b;
            advanceInLosers(losers, rIdx, mIdx, m.b);
            changed = true;
          }
        }
      }
    }
  }
}

// Check if a losers bracket slot can still receive a team
function canLoserSlotReceiveTeam(winners, losers, rIdx, mIdx, slot) {
  if (rIdx % 2 === 0) {
    // Even losers rounds
    if (rIdx === 0) {
      // L-R0 fed by W-R0 losers: slot 'a' from W-R0[mIdx*2], slot 'b' from W-R0[mIdx*2+1]
      const wfi = (slot === 'a') ? mIdx * 2 : mIdx * 2 + 1;
      if (!winners[0] || wfi >= winners[0].length) return false;
      const wm = winners[0][wfi];
      if (!wm) return false;
      if (wm.winner) return false;
      return !!(wm.a || wm.b);
    } else {
      // L-R(2k) fed by L-R(2k-1) odd round: slot 'a' from [mIdx*2], slot 'b' from [mIdx*2+1]
      const fi = (slot === 'a') ? mIdx * 2 : mIdx * 2 + 1;
      const pr = losers[rIdx - 1] || [];
      if (fi >= pr.length) return false;
      const fm = pr[fi];
      if (!fm) return false;
      if (fm.winner) return false;
      return !!(fm.a || fm.b);
    }
  } else {
    // Odd losers rounds
    if (slot === 'a') {
      // Fed by L-R(rIdx-1) even round, same mIdx
      const pr = losers[rIdx - 1] || [];
      if (mIdx >= pr.length) return false;
      const fm = pr[mIdx];
      if (!fm) return false;
      if (fm.winner) return false;
      return !!(fm.a || fm.b);
    } else {
      // slot 'b' from W-R(k) loser, k = (rIdx+1)/2
      const wRound = Math.floor((rIdx + 1) / 2);
      if (!winners[wRound] || mIdx >= winners[wRound].length) return false;
      const wm = winners[wRound][mIdx];
      if (!wm) return false;
      if (wm.winner) return false;
      return !!(wm.a || wm.b);
    }
  }
}

// Advance winner within the losers bracket
function advanceInLosers(losers, rIdx, mIdx, winnerId) {
  const nextR = rIdx + 1;
  if (nextR >= losers.length) return; // goes to grand final
  if (rIdx % 2 === 0) {
    // Even→Odd: winner → next[mIdx].a
    if (losers[nextR] && losers[nextR][mIdx]) {
      losers[nextR][mIdx].a = winnerId;
    }
  } else {
    // Odd→Even: winner → next[floor(mIdx/2)][mIdx%2==0 ? 'a' : 'b']
    const nm = Math.floor(mIdx / 2);
    const sl = (mIdx % 2 === 0) ? 'a' : 'b';
    if (losers[nextR] && losers[nextR][nm]) {
      losers[nextR][nm][sl] = winnerId;
    }
  }
}

// Finalize group stage and populate knockout bracket with actual group winners
function checkAndFinalizeGroups(tIndex) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t || t.format !== 'groupknockout' || !t.groupStage) return;

  // Check if all group matches are played
  const allDone = Object.keys(t.groupStage).every(gname =>
    (t.groupStage[gname] || []).every(m => m.played)
  );
  if (!allDone) return;

  // Calculate group standings and determine qualifiers
  const qualifiers = [];
  Object.keys(t.groupStage).forEach(gname => {
    const matches = t.groupStage[gname];
    const wins = {};
    matches.forEach(m => {
      if (m.a && !wins[m.a]) wins[m.a] = 0;
      if (m.b && !wins[m.b]) wins[m.b] = 0;
      if (m.played && m.winner) wins[m.winner] = (wins[m.winner] || 0) + 1;
    });
    const sorted = Object.keys(wins).sort((a, b) => wins[b] - wins[a]);
    if (sorted.length > 0) qualifiers.push(sorted[0]);
  });

  if (qualifiers.length === 0) return;

  // Build knockout bracket with actual qualifiers
  let nextPow = 1;
  while (nextPow < qualifiers.length) nextPow <<= 1;
  while (qualifiers.length < nextPow) qualifiers.push(null);
  const roundsCount = Math.max(1, Math.log2(nextPow));
  const rounds = [];
  const first = [];
  for (let i = 0; i < qualifiers.length; i += 2) {
    first.push({ a: qualifiers[i], b: qualifiers[i + 1], winner: null });
  }
  rounds.push(first);
  let prev = first;
  for (let r = 1; r < roundsCount; r++) {
    const next = [];
    for (let i = 0; i < prev.length; i += 2) next.push({ a: null, b: null, winner: null });
    rounds.push(next); prev = next;
  }
  // Auto-resolve byes in knockout
  autoResolveByes(rounds);

  t.bracket = rounds;
  tournaments[tIndex] = t;
  s('tournaments', tournaments);
}

function loadTournaments() {
  const page = arguments.length ? (arguments[0] || 1) : 1;
  const pageSize = 10;
  const all = g('tournaments');
  const search = (document.getElementById('tSearch') ? document.getElementById('tSearch').value : '').toLowerCase();
  const sort = (document.getElementById('tSort') ? document.getElementById('tSort').value : 'name_asc');
  all.forEach(t => {
    if (t.format === 'single' && t.bracket && t.teams) {
      // ensure bracket has the correct number of rounds based on teams
      let nextPow = 1;
      while (nextPow < t.teams.length) nextPow <<= 1;
      const roundsCount = Math.log2(nextPow);
      while (t.bracket.length < roundsCount) t.bracket.push([]);
    }
    if (t.format === 'double' && t.bracket && t.bracket.winners && t.teams) {
      let nextPow = 1;
      while (nextPow < t.teams.length) nextPow <<= 1;
      const roundsCount = Math.log2(nextPow);
      while (t.bracket.winners.length < roundsCount) t.bracket.winners.push([]);
      const losersCount = Math.max(1, 2 * (roundsCount - 1));
      if (!t.bracket.losers) t.bracket.losers = [];
      while (t.bracket.losers.length < losersCount) {
        const pairIdx = Math.floor(t.bracket.losers.length / 2);
        const N = (t.bracket.winners[0] || []).length;
        const size = Math.max(1, Math.ceil(N / Math.pow(2, pairIdx + 1)));
        const arr = [];
        for (let j = 0; j < size; j++) arr.push({ a: null, b: null, winner: null });
        t.bracket.losers.push(arr);
      }
    }
    // remove any manual roundNames stored; labels are generated dynamically now
    if (t.roundNames) delete t.roundNames;
  });
  s('tournaments', all);
  // normalize and filter list
  const filtered = [];
  all.forEach((t, idx) => {
    if (selectedSport && t.sport !== selectedSport) return;
    if (!canAccessTournament(t)) return;
    // basic search: name, sport, format
    const text = `${t.name} ${t.sport} ${t.format || ''}`.toLowerCase();
    if (search && text.indexOf(search) === -1) return;
    filtered.push({ t, idx });
  });

  // sort
  filtered.sort((a, b) => {
    const ta = a.t; const tb = b.t;
    switch (sort) {
      case 'name_asc': return ta.name.localeCompare(tb.name);
      case 'name_desc': return tb.name.localeCompare(ta.name);
      case 'date_asc': return (new Date(ta.startDate || 0)) - (new Date(tb.startDate || 0));
      case 'date_desc': return (new Date(tb.startDate || 0)) - (new Date(ta.startDate || 0));
      case 'teams_asc': return (ta.teams ? ta.teams.length : 0) - (tb.teams ? tb.teams.length : 0);
      case 'teams_desc': return (tb.teams ? tb.teams.length : 0) - (ta.teams ? ta.teams.length : 0);
      default: return 0;
    }
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const tbody = document.getElementById('tournamentList');
  const rowsHtml = pageItems.map(item => {
    const t = item.t; const idx = item.idx;
    const teamCount = t.teams ? t.teams.length : (t.roundRobin ? (function(){ const set=new Set(); (t.roundRobin||[]).forEach(m=>{ if(m.a) set.add(m.a); if(m.b) set.add(m.b);}); return set.size; })() : 0);
    const dateLabel = t.startDate ? (t.endDate ? `${t.startDate} → ${t.endDate}` : t.startDate) : '';
    const fmt = (t.format === 'roundrobin') ? 'Round Robin' : (t.format === 'double' ? 'Double Elim' : (t.format === 'groupknockout' ? 'Group + Knockout' : (t.bracket ? 'Single Elim' : 'N/A')));
    const status = t.winner ? 'Complete' : 'Ongoing';
    return `<tr>
      <td style="padding:12px; border-bottom:1px solid rgba(16,24,40,0.06)">${t.name}</td>
      <td style="padding:12px; border-bottom:1px solid rgba(16,24,40,0.06)">${fmt}</td>
      <td style="padding:12px; border-bottom:1px solid rgba(16,24,40,0.06)">${dateLabel}</td>
      <td style="padding:12px; border-bottom:1px solid rgba(16,24,40,0.06)"><span class="status-badge ${t.winner ? 'complete' : 'ongoing'}">${status}</span></td>
      <td style="padding:12px; border-bottom:1px solid rgba(16,24,40,0.06)">${teamCount}</td>
      <td style="padding:12px; border-bottom:1px solid #eee">
        <button class="form-btn primary-btn" style="margin:0 4px 0 0; padding:6px 12px; font-size:0.85rem" onclick="viewTournamentBracket(${idx})">View</button>
        <button class="form-btn secondary-btn" style="margin:0 4px 0 0; padding:6px 12px; font-size:0.85rem" onclick="editTournament(${idx})">Edit</button>
        <button class="form-btn danger-btn" style="margin:0; padding:6px 12px; font-size:0.85rem" onclick="deleteTournament(${idx})">Delete</button>
      </td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rowsHtml || '<tr><td colspan="6" style="padding:8px;color:#666">No tournaments found</td></tr>';
  document.getElementById('dTour').innerText = total;
  document.getElementById('tShowing').innerText = pageItems.length;
  document.getElementById('tTotal').innerText = total;

  // pagination
  const pag = document.getElementById('tPagination');
  let pagHtml = '';
  if (totalPages > 1) {
    pagHtml += `<button class="form-btn" onclick="loadTournaments(${Math.max(1,current-1)})">Prev</button>`;
    pagHtml += ` <span style="margin:0 8px">Page ${current} / ${totalPages}</span>`;
    pagHtml += `<button class="form-btn" onclick="loadTournaments(${Math.min(totalPages,current+1)})">Next</button>`;
  }
  pag.innerHTML = pagHtml;
}

function editRoundNames(tIndex) {
  alert('Manual round naming has been disabled. Round labels are generated automatically.');
}

// Navigate to Scoring section and auto-select the tournament
function viewTournamentBracket(tIdx) {
  show('scoring');
  const sel = document.getElementById('sTournament');
  if (sel) {
    sel.value = String(tIdx);
    onScoringTournamentChange(tIdx);
  }
}

function editTournament(tIndex) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return alert('Tournament not found');
  document.getElementById('editTournamentIdx').value = tIndex;
  document.getElementById('editTournamentName').value = t.name || '';
  document.getElementById('editTournamentStart').value = t.startDate || '';
  document.getElementById('editTournamentEnd').value = t.endDate || '';
  const statusEl = document.getElementById('editTournamentStatus');
  if (statusEl) statusEl.value = t.status || 'upcoming';
  const fmtEl = document.getElementById('editTournamentFormat');
  if (fmtEl) fmtEl.value = t.format || 'single';
  const autoSeedEl = document.getElementById('editTournamentAutoSeed');
  if (autoSeedEl) autoSeedEl.checked = !!t.autoSeed;
  const bestOfEl = document.getElementById('editTournamentBestOf');
  if (bestOfEl) bestOfEl.value = String(t.bestOf || 1);
  populateEditTournamentTeams(t);
  document.getElementById('editTournamentModal').style.display = 'block';
}

function closeEditTournament() {
  document.getElementById('editTournamentModal').style.display = 'none';
}

function saveEditTournament() {
  const tIndex = parseInt(document.getElementById('editTournamentIdx').value);
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return alert('Tournament not found');
  const newName = document.getElementById('editTournamentName').value.trim();
  if (newName) t.name = newName;
  t.startDate = document.getElementById('editTournamentStart').value;
  t.endDate = document.getElementById('editTournamentEnd').value;
  t.status = document.getElementById('editTournamentStatus').value || t.status;
  // Format — warn if changing and bracket exists
  const newFormat = document.getElementById('editTournamentFormat') ? document.getElementById('editTournamentFormat').value : null;
  if (newFormat && newFormat !== t.format && (t.bracket || t.roundRobin || t.groupStages)) {
    if (!confirm('Changing the format will reset the existing bracket. Continue?')) return;
    t.bracket = null;
    t.roundRobin = null;
    t.groupStages = null;
    t.grandFinal = null;
    t.winner = null;
  }
  if (newFormat) t.format = newFormat;
  // Best-of
  const bestOfEl = document.getElementById('editTournamentBestOf');
  if (bestOfEl) t.bestOf = parseInt(bestOfEl.value) || 1;
  // Auto-seed
  const autoSeedEl = document.getElementById('editTournamentAutoSeed');
  if (autoSeedEl) t.autoSeed = autoSeedEl.checked;
  // Teams — only update if user made selections
  const selectedCards = document.querySelectorAll('#editTournamentTeams .team-card.selected');
  if (selectedCards.length > 0) {
    const newTeams = Array.from(selectedCards).map(c => c.dataset.id);
    const oldTeams = JSON.stringify((t.teams || []).slice().sort());
    const changedTeams = JSON.stringify(newTeams.slice().sort()) !== oldTeams;
    if (changedTeams && (t.bracket || t.roundRobin || t.groupStages)) {
      if (!confirm('Changing teams will reset the existing bracket. Continue?')) return;
      t.bracket = null;
      t.roundRobin = null;
      t.groupStages = null;
      t.grandFinal = null;
      t.winner = null;
    }
    t.teams = newTeams;
  }
  tournaments[tIndex] = t;
  s('tournaments', tournaments);
  closeEditTournament();
  loadTournaments();
}

function populateEditTournamentTeams(t) {
  const sportFilter = (t && t.sport) ? t.sport : selectedSport;
  const teams = getVisibleTeams().filter(tm => !sportFilter || tm.sport == sportFilter);
  const container = document.getElementById('editTournamentTeams');
  if (!container) return;
  if (teams.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted-text);font-size:0.85rem;border:1px dashed rgba(16,24,40,0.12);border-radius:8px;margin-top:4px">No teams available.</div>';
    return;
  }
  const selectedIds = new Set((t.teams || []).map(id => String(id)));
  const grouped = {};
  teams.forEach(tm => {
    const group = tm.group || 'Ungrouped';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(tm);
  });
  const groupKeys = Object.keys(grouped).sort((a, b) => a === 'Ungrouped' ? 1 : b === 'Ungrouped' ? -1 : a.localeCompare(b));
  let html = '<div style="margin-top:4px;border:1px solid rgba(16,24,40,0.08);border-radius:10px;overflow:hidden;background:var(--surface)">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(16,24,40,0.02);border-bottom:1px solid rgba(16,24,40,0.06)">';
  html += '<span id="editTeamCounter" style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:var(--primary);color:#fff;font-weight:600">' + selectedIds.size + ' / ' + teams.length + '</span>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="form-btn secondary-btn" style="padding:4px 10px;font-size:0.75rem;margin:0" onclick="selectAllEditTeams()">Select All</button>';
  html += '<button class="form-btn secondary-btn" style="padding:4px 10px;font-size:0.75rem;margin:0" onclick="deselectAllEditTeams()">Deselect All</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="padding:10px 12px;max-height:200px;overflow-y:auto">';
  groupKeys.forEach(group => {
    if (groupKeys.length > 1 || group !== 'Ungrouped') {
      html += '<div style="font-size:0.75rem;font-weight:700;color:var(--muted-text);text-transform:uppercase;letter-spacing:0.5px;margin:6px 0 4px">' + group + '</div>';
    }
    html += '<div class="team-card-grid" style="margin-bottom:8px">';
    html += grouped[group].map(tm => {
      const sel = selectedIds.has(String(tm.id)) ? ' selected' : '';
      return `<div class="team-card${sel}" data-id="${tm.id}" onclick="toggleEditTeamCard(this)">${tm.name}</div>`;
    }).join('');
    html += '</div>';
  });
  html += '</div></div>';
  container.innerHTML = html;
}

function toggleEditTeamCard(el) {
  if (!el) return;
  el.classList.toggle('selected');
  const selected = document.querySelectorAll('#editTournamentTeams .team-card.selected').length;
  const total = document.querySelectorAll('#editTournamentTeams .team-card').length;
  const counter = document.getElementById('editTeamCounter');
  if (counter) counter.textContent = selected + ' / ' + total;
}

function selectAllEditTeams() {
  document.querySelectorAll('#editTournamentTeams .team-card').forEach(c => c.classList.add('selected'));
  const total = document.querySelectorAll('#editTournamentTeams .team-card').length;
  const counter = document.getElementById('editTeamCounter');
  if (counter) counter.textContent = total + ' / ' + total;
}

function deselectAllEditTeams() {
  document.querySelectorAll('#editTournamentTeams .team-card').forEach(c => c.classList.remove('selected'));
  const total = document.querySelectorAll('#editTournamentTeams .team-card').length;
  const counter = document.getElementById('editTeamCounter');
  if (counter) counter.textContent = '0 / ' + total;
}

function deleteTournament(tIndex) {
  if (!confirm('Delete this tournament? This cannot be undone.')) return;
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return alert('Tournament not found');
  // remove related matches that reference this tournament by name
  const matches = g('matches');
  const filteredMatches = matches.filter(m => {
    // if match explicitly references tournament name, drop it
    if (m && m.tournament && t.name && m.tournament === t.name) return false;
    return true;
  });
  s('matches', filteredMatches);
  // remove tournament record
  tournaments.splice(tIndex, 1);
  s('tournaments', tournaments);
  // fully refresh app state/UI so no cached references remain
  loadAll();
}

function populateTournamentTeams() {
  const tSportEl = document.getElementById('tSport');
  const sportFilter = (tSportEl && tSportEl.value) ? tSportEl.value : selectedSport;
  const teams = getVisibleTeams().filter(t => !sportFilter || t.sport == sportFilter);
  const container = document.getElementById('tTeams');
  if (!container) return;
  if (teams.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted-text);font-size:0.85rem;border:1px dashed rgba(16,24,40,0.12);border-radius:8px;margin-top:8px">No teams available. Create teams first in the Teams section.</div>';
    return;
  }
  // Group teams by their group field
  const grouped = {};
  teams.forEach(t => {
    const group = t.group || 'Ungrouped';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(t);
  });
  const groupKeys = Object.keys(grouped).sort((a, b) => a === 'Ungrouped' ? 1 : b === 'Ungrouped' ? -1 : a.localeCompare(b));

  let html = '<div style="margin-top:8px;border:1px solid rgba(16,24,40,0.08);border-radius:10px;overflow:hidden;background:var(--surface)">';
  // Header bar
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(16,24,40,0.02);border-bottom:1px solid rgba(16,24,40,0.06)">';
  html += '<div style="display:flex;align-items:center;gap:8px">';
  html += '<span style="font-weight:700;font-size:0.85rem;color:var(--text)">Select Teams</span>';
  html += '<span id="tTeamCounter" style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:var(--primary);color:#fff;font-weight:600">0 / ' + teams.length + '</span>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="form-btn secondary-btn" style="padding:4px 10px;font-size:0.75rem;margin:0" onclick="selectAllTeams()">Select All</button>';
  html += '<button class="form-btn secondary-btn" style="padding:4px 10px;font-size:0.75rem;margin:0" onclick="deselectAllTeams()">Deselect All</button>';
  html += '</div>';
  html += '</div>';
  // Team grid per group
  html += '<div style="padding:10px 14px;max-height:220px;overflow-y:auto">';
  groupKeys.forEach(group => {
    if (groupKeys.length > 1 || group !== 'Ungrouped') {
      html += '<div style="font-size:0.75rem;font-weight:700;color:var(--muted-text);text-transform:uppercase;letter-spacing:0.5px;margin:6px 0 4px">' + group + '</div>';
    }
    html += '<div class="team-card-grid" style="margin-bottom:8px">';
    html += grouped[group].map(t => `<div class="team-card" data-id="${t.id}" onclick="toggleTeamCard(this)">${t.name}</div>`).join('');
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';
  container.innerHTML = html;
  if (tSportEl) {
    tSportEl.removeEventListener('change', populateTournamentTeams);
    tSportEl.addEventListener('change', populateTournamentTeams);
  }
}

function updateTeamCounter() {
  const selected = document.querySelectorAll('#tTeams .team-card.selected').length;
  const total = document.querySelectorAll('#tTeams .team-card').length;
  const counter = document.getElementById('tTeamCounter');
  if (counter) counter.textContent = selected + ' / ' + total;
}

function toggleTeamCard(el) {
  if (!el) return;
  el.classList.toggle('selected');
  updateTeamCounter();
}

function selectAllTeams() {
  const cards = document.querySelectorAll('#tTeams .team-card');
  cards.forEach(c => c.classList.add('selected'));
  updateTeamCounter();
}

function deselectAllTeams() {
  const cards = document.querySelectorAll('#tTeams .team-card');
  cards.forEach(c => c.classList.remove('selected'));
  updateTeamCounter();
}

function populateSportSelect() {
  const sportList = Object.keys(sports);
  const sel = document.getElementById('tSport');
  if (!sel) return;
  if (canManageCampusFeatures() && selectedSport === null) {
    sel.style.display = 'block';
    sel.disabled = false;
    sel.style.opacity = '1';
    sel.style.cursor = '';
    sel.innerHTML = '<option value="">Select Sport</option>' + sportList.map(s => `<option value="${s}">${s}</option>`).join('');
  } else {
    sel.style.display = 'none';
  }
}

function getRoundLabel(t, idx, totalRounds) {
  const i = Number(idx);
  const rounds = totalRounds || (t && t.bracket && t.bracket.length) || (t && t.bracket && t.bracket.winners && t.bracket.winners.length) || 0;
  if (rounds > 0) {
    if (i === rounds - 1) return 'Finals';
    if (i === rounds - 2) return 'Semi-Finals';
  }
  return `Round ${i + 1}`;
}

// ==== Big Event (Intramurals) Functions ====
// Store custom games and units for the current big event form
let bigEventCustomGames = [];
let bigEventCustomUnits = [];

function populateBigEventUI() {
  // Reset custom lists
  bigEventCustomGames = [];
  bigEventCustomUnits = [];
  renderBigEventGamesList();
  renderBigEventUnitsList();

  // Populate campus options (visibility handled by setPermissions)
  populateCampusOptions();
  
  // populate sports checkboxes with delete option
  const sportsDiv = document.getElementById('bigEventSports');
  if (sportsDiv) {
    const sportList = Object.keys(sports);
    if (sportList.length === 0) {
      sportsDiv.innerHTML = '<span style="color:var(--muted-text);font-size:0.85rem">No sports defined yet</span>';
    } else {
      sportsDiv.innerHTML = sportList.map(sp => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid rgba(16,24,40,0.15);border-radius:4px;background:var(--surface);color:var(--text)">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--text)"><input type="checkbox" class="big-event-sport" value="${sp}"> ${sp}</label>
        <button onclick="deleteSport('${sp}')" title="Delete ${sp}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.9rem;padding:0 2px;line-height:1">×</button>
      </span>`).join('');
    }
  }
  // populate units from team groups
  const unitsDiv = document.getElementById('bigEventUnits');
  if (unitsDiv) {
    const teams = g('teams');
    const groupsMap = {};
    teams.forEach(t => {
      const grp = (t.group && t.group.trim()) ? t.group.trim() : null;
      if (grp) {
        groupsMap[grp] = groupsMap[grp] || [];
        groupsMap[grp].push(t);
      }
    });
    const groups = Object.keys(groupsMap);
    if (groups.length === 0) {
      unitsDiv.innerHTML = '<p style="color:var(--muted-text);font-size:0.85rem">No existing groups. Add units above.</p>';
    } else {
      unitsDiv.innerHTML = groups.map(grp => {
        const count = groupsMap[grp].length;
        return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.9rem"><input type="checkbox" class="big-event-existing-unit" value="${grp}"> ${grp} <span style="color:var(--muted-text);font-size:0.8rem">(${count} teams)</span></label>`;
      }).join('');
    }
  }
}

// State for new sport positions panel
let __newSportPendingName = '';
let __newSportPendingPositions = [];
let __newSportEditMode = false; // true = editing existing sport positions

function addBigEventGame() {
  const input = document.getElementById('bigEventNewGame');
  const game = input.value.trim();
  if (!game) return;
  if (bigEventCustomGames.includes(game)) return alert('Game already added');
  // If sport already exists, add directly
  if (sports[game]) {
    bigEventCustomGames.push(game);
    input.value = '';
    renderBigEventGamesList();
    return;
  }
  // New sport: show positions panel
  __newSportPendingName = game;
  __newSportPendingPositions = [];
  __newSportEditMode = false;
  input.value = '';
  showNewSportPanel(game, []);
}

function showNewSportPanel(name, positions) {
  const panel = document.getElementById('newSportPanel');
  if (!panel) return;
  document.getElementById('newSportName').textContent = name;
  __newSportPendingPositions = positions.slice();
  renderNewSportPositions();
  panel.style.display = 'block';
  const posInput = document.getElementById('newSportPositionInput');
  if (posInput) { posInput.value = ''; posInput.focus(); }
}

function addNewSportPosition() {
  const input = document.getElementById('newSportPositionInput');
  if (!input) return;
  // Support comma-separated input
  const raw = input.value.trim();
  if (!raw) return;
  const newPositions = raw.split(',').map(p => p.trim()).filter(Boolean);
  newPositions.forEach(pos => {
    if (!__newSportPendingPositions.includes(pos)) {
      __newSportPendingPositions.push(pos);
    }
  });
  input.value = '';
  input.focus();
  renderNewSportPositions();
}

function removeNewSportPosition(pos) {
  __newSportPendingPositions = __newSportPendingPositions.filter(p => p !== pos);
  renderNewSportPositions();
}

function renderNewSportPositions() {
  const container = document.getElementById('newSportPositionsList');
  if (!container) return;
  if (__newSportPendingPositions.length === 0) {
    container.innerHTML = '<span style="color:var(--muted-text);font-size:0.8rem">No positions added yet. Will default to "Player".</span>';
    return;
  }
  container.innerHTML = __newSportPendingPositions.map(pos =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--primary);color:#fff;border-radius:4px;font-size:0.8rem">
      ${pos}
      <button onclick="removeNewSportPosition('${pos.replace(/'/g, "\\'")  }')" style="background:none;border:none;color:#fff;cursor:pointer;font-size:0.9rem;padding:0;line-height:1">×</button>
    </span>`
  ).join('');
}

function confirmNewSport() {
  const name = __newSportPendingName;
  if (!name) return;
  const positions = __newSportPendingPositions.length > 0 ? __newSportPendingPositions : ['Player'];
  saveCustomSport(name, 'team', positions);
  if (!__newSportEditMode) {
    if (!bigEventCustomGames.includes(name)) bigEventCustomGames.push(name);
  }
  document.getElementById('newSportPanel').style.display = 'none';
  __newSportPendingName = '';
  __newSportPendingPositions = [];
  __newSportEditMode = false;
  renderBigEventGamesList();
  // Refresh sport selects
  if (typeof populateBigEventUI === 'function') populateBigEventUI();
}

function cancelNewSport() {
  document.getElementById('newSportPanel').style.display = 'none';
  __newSportPendingName = '';
  __newSportPendingPositions = [];
  __newSportEditMode = false;
}

function removeBigEventGame(game) {
  bigEventCustomGames = bigEventCustomGames.filter(g => g !== game);
  renderBigEventGamesList();
}

function deleteSport(sportName) {
  if (!confirm(`Delete "${sportName}" from the system?\n\nThis will NOT delete existing teams or tournaments, but the sport will no longer appear in selection lists.`)) return;
  if (sports[sportName]) {
    delete sports[sportName];
    // Also remove from customSports in DB
    const custom = g('customSports') || {};
    if (custom[sportName]) {
      delete custom[sportName];
      s('customSports', custom);
    }
    // Refresh the UI
    populateBigEventUI();
    if (typeof populateSportSelect === 'function') populateSportSelect();
    if (typeof populateRegSport === 'function') populateRegSport();
    alert(`Sport "${sportName}" has been deleted.`);
  }
}

function editSportPositions(sportName) {
  const current = getSportPositions(sportName);
  __newSportPendingName = sportName;
  __newSportEditMode = true;
  showNewSportPanel(sportName, current);
}

function renderBigEventGamesList() {
  const container = document.getElementById('bigEventGamesList');
  if (!container) return;
  if (bigEventCustomGames.length === 0) {
    container.innerHTML = '<span style="color:var(--muted-text);font-size:0.85rem">No custom games added yet</span>';
    return;
  }
  container.innerHTML = bigEventCustomGames.map(game => {
    const positions = getSportPositions(game);
    const posLabel = positions.join(', ');
    return `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--primary);color:#fff;border-radius:6px;font-size:0.85rem">
      🎮 ${game}
      <button onclick="editSportPositions('${game}')" title="Edit positions: ${posLabel}" style="background:rgba(255,255,255,0.2);border:none;color:#fff;cursor:pointer;font-size:0.75rem;padding:2px 6px;border-radius:4px">⚙️</button>
      <button onclick="removeBigEventGame('${game}')" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;padding:0;line-height:1">×</button>
    </span>`;
  }).join('');
}

function addBigEventUnit() {
  const input = document.getElementById('bigEventNewUnit');
  const unit = input.value.trim();
  if (!unit) return;
  if (bigEventCustomUnits.includes(unit)) return alert('Unit already added');
  bigEventCustomUnits.push(unit);
  input.value = '';
  renderBigEventUnitsList();
}

function removeBigEventUnit(unit) {
  bigEventCustomUnits = bigEventCustomUnits.filter(u => u !== unit);
  renderBigEventUnitsList();
}

function addQuickUnits(count) {
  for (let i = 1; i <= count; i++) {
    const unit = `Unit ${i}`;
    if (!bigEventCustomUnits.includes(unit)) {
      bigEventCustomUnits.push(unit);
    }
  }
  renderBigEventUnitsList();
}

function renderBigEventUnitsList() {
  const container = document.getElementById('bigEventUnitsList');
  if (!container) return;
  if (bigEventCustomUnits.length === 0) {
    container.innerHTML = '<span style="color:var(--muted-text);font-size:0.85rem">No units added yet</span>';
    return;
  }
  container.innerHTML = bigEventCustomUnits.map(unit => 
    `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--success);color:#fff;border-radius:6px;font-size:0.85rem">
      🏫 ${unit}
      <button onclick="removeBigEventUnit('${unit}')" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;padding:0;line-height:1">×</button>
    </span>`
  ).join('');
}

function createBigEvent() {
  const name = document.getElementById('bigEventName').value.trim();
  const startDate = document.getElementById('bigEventStartDate').value;
  const endDate = document.getElementById('bigEventEndDate').value;
  const campusSel = document.getElementById('bigEventCampus');
  const campus = getCurrentCampus();
  if (!name) return alert('Please enter an event name');
  if (!campus) return alert('Please select a campus for this event');
  if (!startDate) return alert('Please select a start date');
  
  // Gather games: custom games + selected existing sports
  const existingSports = Array.from(document.querySelectorAll('.big-event-sport:checked')).map(cb => cb.value);
  const allGames = [...new Set([...bigEventCustomGames, ...existingSports])];
  if (allGames.length === 0) return alert('Please add at least one game/sport');
  
  // Gather units: custom units + selected existing groups
  const existingUnits = Array.from(document.querySelectorAll('.big-event-existing-unit:checked')).map(cb => cb.value);
  const allUnits = [...new Set([...bigEventCustomUnits, ...existingUnits])];
  if (allUnits.length === 0) return alert('Please add at least one unit');
  
  // Create big event entry
  const bigEvents = g('bigEvents') || [];
  const eventId = 'be_' + Date.now();
  bigEvents.push({
    id: eventId,
    name: name,
    sports: allGames,
    units: allUnits,
    campus: campus,
    startDate: startDate,
    endDate: endDate || '',
    createdAt: new Date().toISOString()
  });
  s('bigEvents', bigEvents);
  
  // Register new sports if they don't exist
  allGames.forEach(game => {
    if (!sports[game]) {
      saveCustomSport(game, 'team', ['Player']);
    }
  });
  
  // Create teams for each unit in each sport (if they don't exist)
  let allTeams = g('teams');
  const newTeamIds = [];
  allUnits.forEach(unit => {
    allGames.forEach(game => {
      const teamId = buildCampusTeamId(campus, game, unit);
      const exists = allTeams.find(t => t.id === teamId || (t.name === unit && t.sport === game && getTeamCampus(t) === campus));
      if (!exists) {
        allTeams.push({
          id: teamId,
          name: unit,
          sport: game,
          campus: campus,
          group: unit
        });
        newTeamIds.push(teamId);
      } else {
        newTeamIds.push(exists.id);
      }
    });
  });
  s('teams', allTeams);
  
  // Re-read teams after save to ensure consistency
  allTeams = g('teams');
  
  // For each game, create a tournament with the units' teams
  const tournaments = g('tournaments');
  let tournamentsCreated = 0;
  allGames.forEach(game => {
    // Get ALL teams for this game that belong to any of the selected units
    const gameTeams = allTeams.filter(t => {
      return t.sport === game && getTeamCampus(t) === campus && allUnits.includes(t.group || t.name);
    }).map(t => t.id);
    
    if (gameTeams.length < 2) {
      console.log(`Skipping ${game}: only ${gameTeams.length} teams found`);
      return;
    }
    
    const tName = `${name} - ${game}`;
    const bracket = createBracket(gameTeams, 'single', { autoSeed: true, bestOf: 1 });
    tournaments.push({
      name: tName,
      sport: game,
      teams: gameTeams,
      startDate: startDate,
      endDate: endDate || '',
      format: 'single',
      bracket: bracket,
      bestOf: 1,
      bigEventId: eventId,
      campus: campus
    });
    tournamentsCreated++;
  });
  s('tournaments', tournaments);
  
  // Clear form
  document.getElementById('bigEventName').value = '';
  document.getElementById('bigEventStartDate').value = '';
  document.getElementById('bigEventEndDate').value = '';
  bigEventCustomGames = [];
  bigEventCustomUnits = [];
  
  // Switch to "All Sports" view so user can see everything
  selectedSport = null;
  const sportDisplay = document.getElementById('currentSportDisplay');
  if (sportDisplay) sportDisplay.textContent = formatScopeLabel();
  
  alert(`Big Event "${name}" created!\n• ${allGames.length} games/sports\n• ${allUnits.length} units\n• ${tournamentsCreated} tournaments generated\n\nSwitched to "All Sports" view.`);
  loadAll();
}

function loadBigEvents() {
  const container = document.getElementById('bigEventsList');
  if (!container) return;
  let bigEvents = getVisibleBigEvents();
  const tournaments = getVisibleTournaments();

  if (bigEvents.length === 0) {
    container.innerHTML = '<p style="color:var(--muted-text);font-size:0.9rem">No big events created yet.</p>';
    return;
  }
  container.innerHTML = bigEvents.map((ev, idx) => {
    const relatedTournaments = tournaments.filter(t => t.bigEventId === ev.id);
    const completedCount = relatedTournaments.filter(t => t.winner).length;
    const dates = ev.startDate ? (ev.endDate ? `${ev.startDate} → ${ev.endDate}` : ev.startDate) : 'No dates';
    return `<div style="border:1px solid rgba(16,24,40,0.1);border-radius:8px;padding:12px;background:var(--surface);color:var(--text)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong style="font-size:1.1rem;color:var(--text)">${ev.name}</strong>
          <div style="color:var(--muted-text);font-size:0.85rem">${dates}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="form-btn" style="padding:4px 12px;font-size:0.8rem" onclick="openBigEvent('${ev.id}')">📋 Manage</button>
          <button class="form-btn danger-btn" style="padding:4px 10px;font-size:0.8rem" onclick="deleteBigEvent('${ev.id}')">Delete</button>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">
        <span style="background:rgba(31,60,136,0.12);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.85rem"><strong>${ev.sports.length}</strong> Sports</span>
        <span style="background:rgba(40,167,69,0.12);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.85rem"><strong>${ev.units.length}</strong> Units</span>
        <span style="background:rgba(255,152,0,0.12);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.85rem"><strong>${completedCount}/${relatedTournaments.length}</strong> Completed</span>
      </div>
      <div style="margin-top:8px;font-size:0.85rem;color:var(--muted-text)">Sports: ${ev.sports.join(', ')}</div>
      <div style="font-size:0.85rem;color:var(--muted-text)">Units: ${ev.units.join(', ')}</div>
    </div>`;
  }).join('');
}

function deleteBigEvent(eventId) {
  if (!confirm('Delete this big event and all its related tournaments?')) return;
  let bigEvents = g('bigEvents') || [];
  bigEvents = bigEvents.filter(ev => ev.id !== eventId);
  s('bigEvents', bigEvents);
  // also delete related tournaments
  let tournaments = g('tournaments');
  tournaments = tournaments.filter(t => t.bigEventId !== eventId);
  s('tournaments', tournaments);
  loadAll();
}

function renderBracket(tIndex) {
  const tournaments = g('tournaments');
  const t = tournaments[tIndex];
  if (!t) return;
  const bracketDisplay = document.getElementById('bracketDisplay');
  if (!bracketDisplay) return;
  const dateLabel = t.startDate ? (t.endDate ? `${t.startDate} → ${t.endDate}` : t.startDate) : '';
  let html = `<h4>${t.name} (${t.sport}) ${dateLabel ? ' - ' + dateLabel : ''}</h4>`;
  // Round Robin
  if (t.format === 'roundrobin' && t.roundRobin) {
    html += '<div>';
    t.roundRobin.forEach((m, i) => {
      const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
      const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
      html += `<div style="margin:6px 0">${aName} vs ${bName}`;
      if (m.played) html += ` - Winner: ${(g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name}`;
      html += `</div>`;
    });
    html += '</div>';
    bracketDisplay.innerHTML = html;
    return;
  }
  // Double Elimination
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    html += '<div style="display:flex; gap:20px; align-items:flex-start">';
    // winners
    html += '<div>';
    html += '<h5>Winners Bracket</h5>';
    t.bracket.winners.forEach((round, rIdx) => {
      html += `<div style="margin-bottom:8px"><strong>${getRoundLabel(t, rIdx, t.bracket.winners.length)}</strong>`;
      round.forEach((m, mIdx) => {
        const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
        const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
        const winner = m.winner ? (g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name : '';
        html += `<div style="margin:4px 0">${aName} vs ${bName}`;
        if (winner) html += ` - Winner: ${winner}`;
        html += `</div>`;
      });
      html += '</div>';
    });
    html += '</div>';
    // losers
    html += '<div>';
    html += '<h5>Losers Bracket</h5>';
    (t.bracket.losers || []).forEach((round, rIdx) => {
      html += `<div style="margin-bottom:8px"><strong>Loser Round ${rIdx+1}</strong>`;
      round.forEach((m, mIdx) => {
        const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
        const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
        const winner = m.winner ? (g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name : '';
        html += `<div style="margin:4px 0">${aName} vs ${bName}`;
        if (winner) html += ` - Winner: ${winner}`;
        html += `</div>`;
      });
      html += '</div>';
    });
    html += '</div>';
    html += '</div>'; // flex
    bracketDisplay.innerHTML = html;
    return;
  }
  // Group + Knockout
  if (t.format === 'groupknockout') {
    html += '<div style="margin-bottom:12px"><h5>Group Stage</h5>';
    if (t.groupStage) {
      Object.keys(t.groupStage).forEach(gname => {
        html += `<div style="margin:8px 0; padding:8px; border:1px solid #f0f0f0; border-radius:6px"><strong>${gname}</strong>`;
        t.groupStage[gname].forEach((m, i) => {
          const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
          const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
          html += `<div style="margin:4px 0">${aName} vs ${bName}`;
          if (m.played) html += ` - Winner: ${(g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name}`;
          html += `</div>`;
        });
        html += `</div>`;
      });
    }
    html += '</div>';
    // knockout bracket below
    if (t.bracket) {
      html += '<div style="margin-top:12px"><h5>Knockout Stage</h5>';
      let htmlK = '<div class="bracket">';
      t.bracket.forEach((round, rIdx) => {
        htmlK += `<div class="bracket-column"><h5>${getRoundLabel(t, rIdx, t.bracket.length)}</h5>`;
        (round || []).forEach((m, mIdx) => {
          const aName = m && m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
          const bName = m && m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
          const winner = m && m.winner ? (g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name : '';
          htmlK += `<div class="match-box"><div class="team">${m.a ? aName : 'TBD'}</div><div class="connector"></div><div class="team">${m.b ? bName : 'TBD'}</div>`;
          if (!winner) {
            htmlK += `<div style="margin-top:6px; display:flex; gap:6px; justify-content:center">`;
            if (m.a) htmlK += `<button class="form-btn" onclick="chooseWinner(${tIndex},${rIdx},${mIdx},'${m.a}')">${aName}</button>`;
            if (m.b) htmlK += `<button class="form-btn" onclick="chooseWinner(${tIndex},${rIdx},${mIdx},'${m.b}')">${bName}</button>`;
            htmlK += `</div>`;
          }
          htmlK += `</div>`;
        });
        htmlK += `</div>`;
      });
      htmlK += '</div>';
      html += htmlK;
    }
    bracketDisplay.innerHTML = html;
    return;
  }
  // Single elimination (legacy)
  if (!t.bracket || !Array.isArray(t.bracket)) {
    return alert('This tournament does not use a bracket.');
  }
  let html2 = `<h4>${t.name} (${t.sport}) ${dateLabel ? ' - ' + dateLabel : ''}</h4>`;
  html2 += '<div class="bracket">';
  t.bracket.forEach((round, rIdx) => {
    html2 += `<div class="bracket-column"><h5>${getRoundLabel(t, rIdx, t.bracket.length)}</h5>`;
    round.forEach((m, mIdx) => {
      const aName = m.a ? (g('teams').find(tm => tm.id === m.a) || { name: m.a }).name : 'TBD';
      const bName = m.b ? (g('teams').find(tm => tm.id === m.b) || { name: m.b }).name : 'TBD';
      const winner = m.winner ? (g('teams').find(tm => tm.id === m.winner) || { name: m.winner }).name : '';
      html2 += `<div class="match-box">`;
      if (winner && m.a && m.winner === m.a) html2 += `<div class="team winner">${aName}</div>`;
      else html2 += `<div class="team">${m.a ? aName : 'TBD'}</div>`;
      html2 += `<div class="connector"></div>`;
      if (winner && m.b && m.winner === m.b) html2 += `<div class="team winner">${bName}</div>`;
      else html2 += `<div class="team">${m.b ? bName : 'TBD'}</div>`;
      // add quick action buttons when no winner set
      if (!winner) {
        html2 += `<div style="margin-top:6px; display:flex; gap:6px; justify-content:center">`;
        if (m.a) html2 += `<button class="form-btn" onclick="chooseWinner(${tIndex},${rIdx},${mIdx},'${m.a}')">${aName}</button>`;
        if (m.b) html2 += `<button class="form-btn" onclick="chooseWinner(${tIndex},${rIdx},${mIdx},'${m.b}')">${bName}</button>`;
        html2 += `</div>`;
      }
      html2 += `</div>`;
    });
    html2 += `</div>`;
  });
  html2 += '</div>';
  bracketDisplay.innerHTML = html2;
}
