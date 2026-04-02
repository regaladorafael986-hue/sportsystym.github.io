// Teams and Players module

// Handle "Other (type)" custom position selection
function handleCustomPosition(selectEl, sportName) {
  if (selectEl.value !== '__custom__') return;
  const custom = prompt('Enter custom position name:');
  if (!custom || !custom.trim()) {
    selectEl.value = '';
    return;
  }
  const pos = custom.trim();
  // Add as option and select it
  const opt = document.createElement('option');
  opt.value = pos;
  opt.textContent = pos;
  opt.selected = true;
  selectEl.insertBefore(opt, selectEl.querySelector('option[value=\"__custom__\"]'));
  // Save this position to the sport so it appears next time
  if (sportName) {
    const existing = getSportPositions(sportName);
    if (!existing.includes(pos)) {
      existing.push(pos);
      if (sports[sportName]) {
        sports[sportName].positions = existing;
      } else {
        sports[sportName] = { type: 'team', positions: existing };
      }
      saveCustomSport(sportName, sports[sportName].type, existing);
    }
  }
}

// Quick fill team names into textarea
function quickFillTeams(count) {
  const ta = document.getElementById('bulkTeamNames');
  if (!ta) return;
  const names = [];
  for (let i = 1; i <= count; i++) names.push('Unit ' + i);
  ta.value = names.join('\n');
}

// Bulk create teams from textarea
function addTeamsBulk() {
  const teamSportSel = document.getElementById('teamSport');
  const sport = (teamSportSel && teamSportSel.value) ? teamSportSel.value : selectedSport;
  const campusSel = document.getElementById('teamCampus');
  const campus = getCurrentCampus();
  if (!campus) return alert('Campus not set.');
  if (!sport) return alert('Please select a sport first.');

  const raw = document.getElementById('bulkTeamNames').value.trim();
  if (!raw) return alert('Please enter at least one team name.');

  // Parse names: split by newlines or commas
  const names = raw.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
  if (names.length === 0) return alert('No valid team names found.');

  const group = document.getElementById('teamGroup').value.trim();
  const tourSel = document.getElementById('teamTournament');
  const tourIdx = (tourSel && tourSel.value !== '') ? parseInt(tourSel.value) : null;

  const teams = g('teams');
  const tournaments = g('tournaments');
  let added = 0;
  let skipped = [];

  names.forEach(name => {
    const teamId = buildCampusTeamId(campus, sport, name);
    if (findTeamByIdentity(name, sport, campus)) {
      skipped.push(name);
      return;
    }
    teams.push({ id: teamId, name: name, sport: sport, campus: campus, group: group, logo: window.__createTeamLogo || '' });
    // Auto-add to tournament
    if (tourIdx !== null && tournaments[tourIdx]) {
      if (!tournaments[tourIdx].teams) tournaments[tourIdx].teams = [];
      if (!tournaments[tourIdx].teams.includes(teamId)) {
        tournaments[tourIdx].teams.push(teamId);
      }
    }
    added++;
  });

  s('teams', teams);
  if (tourIdx !== null) s('tournaments', tournaments);

  // Remember selections before loadAll resets dropdowns
  const savedSport = sport;
  const savedTourIdx = tourIdx;
  loadAll();

  // Restore sport selection after reload
  const teamSportEl = document.getElementById('teamSport');
  if (teamSportEl && savedSport) {
    teamSportEl.value = savedSport;
    populateTeamTournamentSelect();
    if (savedTourIdx !== null) {
      const tourEl = document.getElementById('teamTournament');
      if (tourEl) tourEl.value = savedTourIdx;
    }
  }
  // Sync sport to Bulk Players form
  syncSportToPlayerForm(savedSport);

  document.getElementById('bulkTeamNames').value = '';
  document.getElementById('teamGroup').value = '';
  clearCreateTeamLogo();

  let msg = `✅ ${added} team${added !== 1 ? 's' : ''} created!`;
  if (skipped.length) msg += `\n⚠️ Skipped (already exist): ${skipped.join(', ')}`;
  alert(msg);
}

// Legacy single addTeam (still callable)
function addTeam() {
  const teamSportSel = document.getElementById('teamSport');
  const sport = (teamSportSel && teamSportSel.value) ? teamSportSel.value : selectedSport;
  const campusSel = document.getElementById('teamCampus');
  const campus = getCurrentCampus();
  if (!campus) return alert('Campus not set.');
  if (!sport) return alert('Please select a sport first.');
  const name = document.getElementById('teamName') ? document.getElementById('teamName').value.trim() : '';
  if (!name) return alert('Please enter a team name.');
  const teamId = buildCampusTeamId(campus, sport, name);
  const t = g('teams');
  if (findTeamByIdentity(name, sport, campus)) return alert('Team already exists in this campus and sport.');
  const group = document.getElementById('teamGroup') ? document.getElementById('teamGroup').value.trim() : '';
  t.push({ id: teamId, name: name, sport: sport, campus: campus, group: group });
  s('teams', t);
  loadAll();
}

// Bulk add players from textarea
function addPlayersBulk() {
  const teamId = document.getElementById('playerTeam').value;
  const position = document.getElementById('playerPosition').value;
  if (!teamId) return alert('Please select a team.');
  if (!position) return alert('Please select a default position.');

  const raw = document.getElementById('bulkPlayerNames').value.trim();
  if (!raw) return alert('Please enter at least one player name.');

  const names = raw.split(/\n+/).map(n => n.trim()).filter(Boolean);
  if (names.length === 0) return alert('No valid player names found.');

  const teamObj = g('teams').find(t => t.id === teamId);
  if (!teamObj) return alert('Team not found.');

  const players = g('players');
  let added = 0;
  names.forEach(name => {
    players.push({ name: name, team: teamId, position: position, sport: teamObj.sport, campus: getTeamCampus(teamObj) });
    added++;
  });
  s('players', players);

  // Remember selections before loadAll resets dropdowns
  const savedSport = teamObj.sport;
  const savedTeamId = teamId;
  loadAll();

  // Restore sport + team selection after reload
  syncSportToPlayerForm(savedSport, savedTeamId);

  document.getElementById('bulkPlayerNames').value = '';
  alert(`✅ ${added} player${added !== 1 ? 's' : ''} added to ${teamObj.name}!`);
}

// Quick add single player from inline form on team card
function quickAddPlayer(teamId) {
  const safeId = teamId.replace(/[^a-zA-Z0-9_]/g, '_');
  const nameEl = document.getElementById('qp_name_' + safeId);
  const posEl = document.getElementById('qp_pos_' + safeId);
  if (!nameEl || !posEl) return;
  const name = nameEl.value.trim();
  let position = posEl.value;
  if (!name) return alert('Enter a player name.');
  // Handle custom position
  if (position === '__custom__') {
    const teamObj = g('teams').find(t => t.id === teamId);
    const custom = prompt('Enter custom position name:');
    if (!custom || !custom.trim()) return;
    position = custom.trim();
    if (teamObj) {
      const existing = getSportPositions(teamObj.sport);
      if (!existing.includes(position)) {
        existing.push(position);
        sports[teamObj.sport].positions = existing;
        saveCustomSport(teamObj.sport, sports[teamObj.sport].type, existing);
      }
    }
  }
  if (!position) return alert('Select a position.');
  const teamObj = g('teams').find(t => t.id === teamId);
  if (!teamObj) return;
  const p = g('players');
  p.push({ name: name, team: teamId, position: position, sport: teamObj.sport, campus: getTeamCampus(teamObj) });
  s('players', p);
  loadAll();
}

function populateTeamSportSelect() {
  const sel = document.getElementById('teamSport');
  if (!sel) return;
  let sportList = Object.keys(sports);
  // Organizer: only show assigned sports
  if (currentUser && currentUser.role === 'organizer' && currentUser.assignedSports && currentUser.assignedSports.length > 0) {
    sportList = sportList.filter(sp => currentUser.assignedSports.includes(sp));
  }
  const current = sel.value;
  sel.innerHTML = '<option value="">Select Sport</option>' + sportList.map(sp => `<option value="${sp}"${sp === selectedSport ? ' selected' : ''}>${sp}</option>`).join('');
  if (current && sportList.includes(current)) sel.value = current;
  // Auto-cascade: if a sport is pre-selected (from sidebar), update tournament dropdown
  if (sel.value) populateTeamTournamentSelect();
}

function populatePlayerSportSelect() {
  const sel = document.getElementById('playerSport');
  if (!sel) return;
  let sportList = Object.keys(sports);
  // Organizer: only show assigned sports
  if (currentUser && currentUser.role === 'organizer' && currentUser.assignedSports && currentUser.assignedSports.length > 0) {
    sportList = sportList.filter(sp => currentUser.assignedSports.includes(sp));
  }
  const current = sel.value;
  sel.innerHTML = '<option value="">Select Sport</option>' + sportList.map(sp => `<option value="${sp}"${sp === selectedSport ? ' selected' : ''}>${sp}</option>`).join('');
  if (current && sportList.includes(current)) sel.value = current;
  // Auto-cascade: if a sport is pre-selected (from sidebar), update team & position dropdowns
  if (sel.value) onPlayerSportChange();
}

function onTeamSportChange() {
  // When sport changes, filter the tournament dropdown
  populateTeamTournamentSelect();
  // Sync sport to Bulk Players form so user doesn't have to re-pick
  const teamSportSel = document.getElementById('teamSport');
  if (teamSportSel && teamSportSel.value) {
    syncSportToPlayerForm(teamSportSel.value);
  }
}

// Sync sport selection to the Bulk Players form and cascade team/position dropdowns
function syncSportToPlayerForm(sport, teamId) {
  const playerSportSel = document.getElementById('playerSport');
  if (!playerSportSel || !sport) return;
  playerSportSel.value = sport;
  onPlayerSportChange();
  // If a specific team is requested, select it after teams are populated
  if (teamId) {
    const playerTeamSel = document.getElementById('playerTeam');
    if (playerTeamSel) {
      playerTeamSel.value = teamId;
      populatePositionSelect();
    }
  }
}

function populateTeamTournamentSelect() {
  const sel = document.getElementById('teamTournament');
  if (!sel) return;
  const sportSel = document.getElementById('teamSport');
  const sport = (sportSel && sportSel.value) ? sportSel.value : selectedSport;
  const allTournaments = g('tournaments') || [];
  let options = '<option value="">No Tournament (standalone)</option>';
  allTournaments.forEach((t, idx) => {
    if (!canAccessTournament(t)) return;
    if (sport && t.sport !== sport) return;
    options += `<option value="${idx}">${t.name} (${t.sport})</option>`;
  });
  sel.innerHTML = options;
}

function onPlayerSportChange() {
  // Filter team dropdown based on selected sport in player form
  const sportSel = document.getElementById('playerSport');
  const sport = sportSel ? sportSel.value : null;
  const teams = getVisibleTeams().filter(t => sport ? t.sport === sport : (!selectedSport || t.sport == selectedSport));
  const sel = document.getElementById('playerTeam');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select Team</option>' + teams.map(t => `<option value="${t.id}">${t.name} (${t.sport})</option>`).join('');
  sel.onchange = populatePositionSelect;
  populatePositionSelect();
}

function addPlayer() {
  const name = document.getElementById('playerName').value.trim();
  const teamId = document.getElementById('playerTeam').value;
  const position = document.getElementById('playerPosition').value;
  if (!name || !teamId || !position) {
    alert('Please fill all required fields.');
    return;
  }
  const teamObj = g('teams').find(t => t.id === teamId);
  if (!teamObj) {
    alert('Team not found.');
    return;
  }
  const p = g('players');
  p.push({ name: name, team: teamId, position: position, sport: teamObj.sport, campus: getTeamCampus(teamObj) });
  s('players', p);
  loadAll();
  document.getElementById('playerName').value = '';
  document.getElementById('playerTeam').value = '';
  document.getElementById('playerPosition').value = '';
}

function loadTeams() {
  const teams = getVisibleTeams().filter(t => !selectedSport || t.sport == selectedSport);
  const players = getVisiblePlayers().filter(p => {
    if (p.sport) return !selectedSport || p.sport == selectedSport;
    const team = g('teams').find(t => t.id == p.team);
    return !selectedSport || (team && team.sport == selectedSport);
  });
  const tournaments = getVisibleTournaments();
  const container = document.getElementById('teamsContainer');
  if (teams.length === 0) {
    container.innerHTML = '<div style="padding:16px; color:var(--muted-text); text-align:center; background:var(--surface); border-radius:var(--radius); border:1px solid rgba(16,24,40,0.04)">No teams found. Create teams first or switch to "All Sports" view.</div>';
    document.getElementById('dTeam').innerText = 0;
    document.getElementById('dPlayer').innerText = 0;
    return;
  }
  container.innerHTML = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">' + teams.map(t => {
    const teamPlayers = players.filter(p => p.team == t.id);
    const groupDisplay = t.group ? `<span style="background:var(--success); color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem; margin-left:8px">${t.group}</span>` : '';
    
    // Find tournaments this team is in
    const teamTournaments = tournaments.filter(tour => tour.teams && tour.teams.includes(t.id));
    const tournamentBadges = teamTournaments.length > 0 
      ? teamTournaments.slice(0, 3).map(tour => `<span style="background:rgba(31,60,136,0.1);color:var(--primary);padding:2px 6px;border-radius:4px;font-size:0.7rem;white-space:nowrap">🏆 ${tour.name.length > 15 ? tour.name.substring(0,15)+'...' : tour.name}</span>`).join(' ')
      : '<span style="color:var(--muted-text);font-size:0.75rem">Not in any tournament</span>';
    
    // Position options for quick-add
    const positions = getSportPositions(t.sport);
    const posOpts = '<option value="">Position</option>' + positions.map(p => `<option value="${p}">${p}</option>`).join('') + '<option value="__custom__">Other (type)</option>';
    // Escape team ID for HTML attributes
    const safeId = t.id.replace(/[^a-zA-Z0-9_]/g, '_');
    
    return `
      <div class="team-section" style="background:var(--surface); border:1px solid rgba(16,24,40,0.06); border-radius:12px; padding:16px; box-shadow:0 2px 8px rgba(16,24,40,0.02)">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
          <h4 style="margin:0; display:flex; align-items:center; gap:8px; color:var(--primary); font-size:1.1rem">
            ${t.logo ? `<img src="${t.logo}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.08)">` : ''}
            ${t.name} ${groupDisplay}
          </h4>
          <span style="font-size:0.8rem; font-weight:500; color:var(--muted-text); background:rgba(16,24,40,0.04); padding:4px 8px; border-radius:4px">${t.sport}</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px; min-height:24px">
          ${tournamentBadges}
          ${teamTournaments.length > 3 ? `<span style="color:var(--muted-text);font-size:0.7rem">+${teamTournaments.length - 3} more</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:8px; background:var(--bg); border-radius:8px">
          <span style="font-size:1.2rem">👥</span>
          <span style="font-weight:600; color:var(--text)">${teamPlayers.length}</span>
          <span style="color:var(--muted-text); font-size:0.85rem">player${teamPlayers.length !== 1 ? 's' : ''}</span>
        </div>

        <!-- Quick Add Player Row -->
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;padding:8px;background:rgba(31,60,136,0.03);border:1px dashed rgba(31,60,136,0.15);border-radius:8px">
          <input id="qp_name_${safeId}" placeholder="Player name" style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.85rem;margin:0">
          <select id="qp_pos_${safeId}" style="width:110px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.85rem;margin:0">${posOpts}</select>
          <button onclick="quickAddPlayer('${t.id}')" style="background:var(--primary);color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:0.85rem;white-space:nowrap" title="Add Player">+ Add</button>
        </div>

        <div style="max-height:180px; overflow-y:auto; border:1px solid #eee; border-radius:8px">
          <table style="width:100%; border-collapse:collapse; font-size:0.9rem">
            <thead style="position:sticky; top:0; background:#fafbfd; z-index:1">
              <tr><th style="padding:10px; border-bottom:1px solid #eee; text-align:left">Player</th><th style="padding:10px; border-bottom:1px solid #eee; text-align:left">Position</th><th style="padding:10px; border-bottom:1px solid #eee; text-align:right; width:80px">Actions</th></tr>
            </thead>
            <tbody>
              ${teamPlayers.length ? teamPlayers.map((p, pi) => {
                const pIdx = g('players').findIndex(pp => pp.name === p.name && pp.team === p.team && pp.sport === p.sport);
                return `<tr>
                  <td style="padding:8px 10px; border-bottom:1px solid #eee"><strong>${p.name}</strong></td>
                  <td style="padding:8px 10px; border-bottom:1px solid #eee; color:var(--muted-text)">${p.position || 'N/A'}</td>
                  <td style="padding:8px 10px; border-bottom:1px solid #eee; text-align:right; white-space:nowrap">
                    <button onclick="openEditPlayer(${pIdx})" title="Edit" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:0.85rem;padding:2px 4px">✏️</button>
                    <button onclick="deletePlayer(${pIdx})" title="Delete" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:0.85rem;padding:2px 4px">🗑️</button>
                  </td>
                </tr>`;
              }).join('') : '<tr><td colspan="3" style="padding:16px; text-align:center; color:var(--muted-text)">No players — use the row above to add</td></tr>'}
            </tbody>
          </table>
        </div>
        <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:6px">
          <button class="form-btn" style="padding:4px 10px; font-size:0.8rem; background:var(--primary)" onclick="openEditTeam('${t.id}')">Edit</button>
          <button class="form-btn danger-btn" style="padding:4px 10px; font-size:0.8rem" onclick="deleteTeam('${t.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('') + '</div>';
  document.getElementById('dTeam').innerText = teams.length;
  document.getElementById('dPlayer').innerText = players.length;
  populatePresetTeamSelect();
}

function deleteTeam(teamId) {
  if (!confirm('Delete this team? Players will remain but be unassigned.')) return;
  let teams = g('teams');
  teams = teams.filter(t => t.id !== teamId);
  s('teams', teams);
  // Remove team from tournament rosters
  let tournaments = g('tournaments');
  tournaments.forEach(t => {
    if (t.teams) t.teams = t.teams.filter(id => id !== teamId);
  });
  s('tournaments', tournaments);
  loadAll();
}

// --- Edit Team ---
function openEditTeam(teamId) {
  console.log('[EDIT_TEAM_V2] Opening edit for teamId:', teamId);
  const team = g('teams').find(t => t.id === teamId);
  if (!team) return alert('Team not found');
  window.__editingTeamId = teamId;
  window.__editTeamLogo = team.logo || '';
  document.getElementById('editTeamName').value = team.name;
  document.getElementById('editTeamGroup').value = team.group || '';
  // Show logo preview
  const preview = document.getElementById('editTeamLogoPreview');
  if (preview) {
    if (team.logo) {
      preview.innerHTML = `<img src="${team.logo}" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      preview.innerHTML = '<span style="font-size:0.7rem;color:#aaa">No logo</span>';
    }
  }
  if (document.getElementById('editTeamLogoFile')) document.getElementById('editTeamLogoFile').value = '';
  // Populate tournament select filtered by sport — use a single g() call
  // to get correct array indices (indexOf by reference fails across deep copies)
  const allTournaments = g('tournaments') || [];
  const tourSel = document.getElementById('editTeamTournament');
  window.__editTeamOriginalTourIndices = [];
  let options = '<option value="">No Tournament</option>';
  allTournaments.forEach((t, idx) => {
    if (!canAccessTournament(t) || t.sport !== team.sport) return;
    const isMember = t.teams && t.teams.includes(teamId);
    if (isMember) window.__editTeamOriginalTourIndices.push(idx);
    options += `<option value="${idx}"${isMember ? ' selected' : ''}>${t.name}</option>`;
  });
  tourSel.innerHTML = options;
  // Store the initially selected value so we can detect changes on save
  window.__editTeamOriginalTourVal = tourSel.value;
  console.log('[EDIT_TEAM_V2] Tournament indices team is in:', window.__editTeamOriginalTourIndices, 'Dropdown value:', tourSel.value);
  document.getElementById('editTeamModal').style.display = 'block';
}

function closeEditTeam() {
  document.getElementById('editTeamModal').style.display = 'none';
  window.__editingTeamId = null;
}

function saveEditTeam() {
  const oldId = window.__editingTeamId;
  if (!oldId) return;
  const teams = g('teams');
  const team = teams.find(t => t.id === oldId);
  if (!team) return alert('Team not found');
  const newName = document.getElementById('editTeamName').value.trim();
  const newGroup = document.getElementById('editTeamGroup').value.trim();
  if (!newName) return alert('Team name is required');
  if (findTeamByIdentity(newName, team.sport, getTeamCampus(team), oldId)) return alert('A team with that name already exists in this campus and sport.');
  const newId = buildCampusTeamId(getTeamCampus(team), team.sport, newName);
  const idChanged = oldId !== newId;
  console.log('[SAVE_EDIT_V2] oldId:', oldId, '→ newId:', newId, '| idChanged:', idChanged);

  // Update team fields
  team.name = newName;
  team.group = newGroup;
  team.logo = window.__editTeamLogo || '';
  if (idChanged) team.id = newId;
  s('teams', teams);

  // If the ID changed, update ALL references from oldId → newId
  if (idChanged) {
    // Update players
    const players = g('players');
    let pCount = 0;
    players.forEach(p => { if (p.team === oldId) { p.team = newId; pCount++; } });
    s('players', players);
    console.log('[SAVE_EDIT_V2] Updated', pCount, 'players');

    // Update matches
    const matches = g('matches');
    let mCount = 0;
    matches.forEach(m => {
      if (m.a === oldId) { m.a = newId; mCount++; }
      if (m.b === oldId) { m.b = newId; mCount++; }
      if (m.winner === oldId) { m.winner = newId; mCount++; }
    });
    s('matches', matches);
    console.log('[SAVE_EDIT_V2] Updated', mCount, 'match references');
  }

  // Update tournament data — replace old ID with new ID everywhere,
  // preserving all existing tournament memberships and bracket assignments
  let tournaments = g('tournaments');
  if (idChanged) {
    tournaments.forEach((t, ti) => {
      // Update teams roster
      if (t.teams) {
        const idx = t.teams.indexOf(oldId);
        if (idx !== -1) {
          t.teams[idx] = newId;
          console.log('[SAVE_EDIT_V2] Replaced ID in tournament', ti, '(', t.name, ') teams roster at position', idx);
        }
      }
      // Update bracket data (single/double elimination)
      _replaceIdInBracket(t.bracket, oldId, newId);
      // Update round robin matches
      _replaceIdInMatchList(t.roundRobin, oldId, newId);
      // Update group stage matches
      if (t.groupStage) {
        Object.keys(t.groupStage).forEach(gn => {
          _replaceIdInMatchList(t.groupStage[gn], oldId, newId);
        });
      }
      // Update grand final
      if (t.grandFinal) {
        if (t.grandFinal.a === oldId) t.grandFinal.a = newId;
        if (t.grandFinal.b === oldId) t.grandFinal.b = newId;
        if (t.grandFinal.winner === oldId) t.grandFinal.winner = newId;
      }
      // Update tournament winner
      if (t.winner === oldId) t.winner = newId;
    });
  }

  // Handle tournament dropdown — only process explicit add/remove
  const tourSel = document.getElementById('editTeamTournament');
  const selectedTourIdx = tourSel.value !== '' ? parseInt(tourSel.value) : null;
  const currentId = idChanged ? newId : oldId;

  // Only modify tournament membership if the user explicitly changed the dropdown
  const originalTourVal = window.__editTeamOriginalTourVal || '';
  const newTourVal = tourSel.value;
  console.log('[SAVE_EDIT_V2] Tournament dropdown — original:', originalTourVal, '→ current:', newTourVal, '| changed:', newTourVal !== originalTourVal);

  if (newTourVal !== originalTourVal) {
    const originalTourIdx = originalTourVal !== '' ? parseInt(originalTourVal) : null;
    // Remove from previously shown tournament
    if (originalTourIdx !== null && tournaments[originalTourIdx] && tournaments[originalTourIdx].teams) {
      console.log('[SAVE_EDIT_V2] Removing from tournament', originalTourIdx, '(', tournaments[originalTourIdx].name, ')');
      tournaments[originalTourIdx].teams = tournaments[originalTourIdx].teams.filter(id => id !== currentId);
    }
    // Add to newly selected tournament
    if (selectedTourIdx !== null && tournaments[selectedTourIdx]) {
      if (!tournaments[selectedTourIdx].teams) tournaments[selectedTourIdx].teams = [];
      if (!tournaments[selectedTourIdx].teams.includes(currentId)) {
        console.log('[SAVE_EDIT_V2] Adding to tournament', selectedTourIdx, '(', tournaments[selectedTourIdx].name, ')');
        tournaments[selectedTourIdx].teams.push(currentId);
      }
    }
  }
  s('tournaments', tournaments);

  // Verify: log final tournament membership for this team
  const finalTournaments = g('tournaments');
  const memberOf = [];
  finalTournaments.forEach((t, i) => {
    if (t.teams && t.teams.includes(currentId)) memberOf.push(i + ':' + t.name);
  });
  console.log('[SAVE_EDIT_V2] FINAL — team', currentId, 'is now in tournaments:', memberOf.join(', ') || 'NONE');

  closeEditTeam();
  loadAll();
}

/** Replace oldId with newId in bracket rounds (array of arrays of match objects) */
function _replaceIdInBracket(bracket, oldId, newId) {
  if (!bracket) return;
  // Bracket can be { winners: [...], losers: [...] } or just array of rounds
  if (Array.isArray(bracket)) {
    bracket.forEach(round => {
      if (Array.isArray(round)) {
        round.forEach(m => { if (m) _replaceIdInMatch(m, oldId, newId); });
      }
    });
  } else if (typeof bracket === 'object') {
    if (bracket.winners) _replaceIdInBracket(bracket.winners, oldId, newId);
    if (bracket.losers) _replaceIdInBracket(bracket.losers, oldId, newId);
  }
}

/** Replace oldId with newId in match list (array of match objects) */
function _replaceIdInMatchList(matches, oldId, newId) {
  if (!Array.isArray(matches)) return;
  matches.forEach(m => { if (m) _replaceIdInMatch(m, oldId, newId); });
}

/** Replace oldId with newId in a single match object */
function _replaceIdInMatch(m, oldId, newId) {
  if (m.a === oldId) m.a = newId;
  if (m.b === oldId) m.b = newId;
  if (m.winner === oldId) m.winner = newId;
}


// --- Delete Player ---
function deletePlayer(playerIndex) {
  if (!confirm('Delete this player?')) return;
  const players = g('players');
  if (playerIndex < 0 || playerIndex >= players.length) return;
  players.splice(playerIndex, 1);
  s('players', players);
  loadAll();
}

// --- Edit Player ---
function openEditPlayer(playerIndex) {
  const players = g('players');
  if (playerIndex < 0 || playerIndex >= players.length) return;
  const p = players[playerIndex];
  window.__editingPlayerIdx = playerIndex;
  document.getElementById('editPlayerName').value = p.name;

  // Populate team select
  const teams = getVisibleTeams();
  const teamSel = document.getElementById('editPlayerTeam');
  teamSel.innerHTML = '<option value="">Select Team</option>' + teams.map(t => `<option value="${t.id}"${t.id === p.team ? ' selected' : ''}>${t.name} (${t.sport})</option>`).join('');
  teamSel.onchange = function() { populateEditPlayerPositions(); };

  populateEditPlayerPositions(p.position);
  document.getElementById('editPlayerModal').style.display = 'block';
}

function populateEditPlayerPositions(currentPos) {
  const teamId = document.getElementById('editPlayerTeam').value;
  const posSel = document.getElementById('editPlayerPosition');
  if (!teamId) { posSel.innerHTML = '<option value="">Select Position</option>'; return; }
  const team = g('teams').find(t => t.id === teamId);
  if (!team) { posSel.innerHTML = '<option value="">Select Position</option>'; return; }
  const positions = getSportPositions(team.sport);
  const hasCurrentPos = currentPos && positions.includes(currentPos);
  posSel.innerHTML = '<option value="">Select Position</option>' + positions.map(p => `<option value="${p}"${p === currentPos ? ' selected' : ''}>${p}</option>`).join('')
    + (currentPos && !hasCurrentPos ? `<option value="${currentPos}" selected>${currentPos}</option>` : '')
    + '<option value="__custom__">Other (type)</option>';
  posSel.onchange = function() { handleCustomPosition(posSel, team.sport); };
}

function closeEditPlayer() {
  document.getElementById('editPlayerModal').style.display = 'none';
  window.__editingPlayerIdx = null;
}

function saveEditPlayer() {
  const idx = window.__editingPlayerIdx;
  if (idx === null || idx === undefined) return;
  const players = g('players');
  if (idx < 0 || idx >= players.length) return;
  const newName = document.getElementById('editPlayerName').value.trim();
  const newTeam = document.getElementById('editPlayerTeam').value;
  const newPos = document.getElementById('editPlayerPosition').value;
  if (!newName || !newTeam || !newPos) return alert('Please fill all fields');
  const teamObj = g('teams').find(t => t.id === newTeam);
  players[idx].name = newName;
  players[idx].team = newTeam;
  players[idx].position = newPos;
  players[idx].sport = teamObj ? teamObj.sport : players[idx].sport;
  players[idx].campus = teamObj ? getTeamCampus(teamObj) : players[idx].campus;
  s('players', players);
  closeEditPlayer();
  loadAll();
}

function populatePresetTeamSelect() {
  const sel = document.getElementById('presetTeamSelect');
  if (!sel) return;
  const teams = getVisibleTeams().filter(t => !selectedSport || t.sport == selectedSport);
  sel.innerHTML = '<option value="">Select Team</option>' + teams.map(t => `<option value="${t.id}">${t.name} (${t.sport})</option>`).join('');
  renderLineupPresetFields();
}

function renderLineupPresetFields() {
  const container = document.getElementById('lineupPresetFields');
  if (!container) return;
  const teamId = document.getElementById('presetTeamSelect').value;
  if (!teamId) { container.innerHTML = '<span style="color:var(--muted-text);font-size:0.85rem">Select a team to see lineup fields</span>'; return; }
  const team = g('teams').find(t => t.id === teamId);
  if (!team) { container.innerHTML = ''; return; }
  const sportType = getSportType(team.sport);
  const players = g('players').filter(p => p.team === teamId);
  const playerOpts = '<option value="">-- Select --</option>' + players.map(p => `<option value="${p.name}">${p.name} (${p.position || 'N/A'})</option>`).join('');

  if (sportType === 'racket') {
    // Racket sports: Singles A, Singles B, Doubles pair
    container.innerHTML = `
      <label style="display:block;font-size:0.85rem;font-weight:600;margin-top:6px">Singles A</label>
      <select id="slot_single_a" style="width:100%">${playerOpts}</select>
      <label style="display:block;font-size:0.85rem;font-weight:600;margin-top:6px">Singles B</label>
      <select id="slot_single_b" style="width:100%">${playerOpts}</select>
      <label style="display:block;font-size:0.85rem;font-weight:600;margin-top:6px">Doubles Player 1</label>
      <select id="slot_doubles_1" style="width:100%">${playerOpts}</select>
      <label style="display:block;font-size:0.85rem;font-weight:600;margin-top:6px">Doubles Player 2</label>
      <select id="slot_doubles_2" style="width:100%">${playerOpts}</select>
    `;
  } else {
    // Team sports: Captain + Starting Players (checkboxes)
    container.innerHTML = `
      <label style="display:block;font-size:0.85rem;font-weight:600;margin-top:6px">Captain</label>
      <select id="slot_captain" style="width:100%">${playerOpts}</select>
      <label style="display:block;font-size:0.85rem;font-weight:600;margin-top:8px">Starting Players</label>
      <div id="slot_starters" style="max-height:150px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:6px">
        ${players.length ? players.map(p => `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer"><input type="checkbox" class="starter-cb" value="${p.name}"> <span>${p.name}</span> <span style="color:var(--muted-text);font-size:0.8rem">(${p.position || 'N/A'})</span></label>`).join('') : '<span style="color:var(--muted-text);font-size:0.85rem">No players in this team</span>'}
      </div>
    `;
  }
}

function addLineupPreset() {
  const teamId = document.getElementById('presetTeamSelect').value;
  const name = document.getElementById('presetName').value.trim();
  if (!teamId || !name) return alert('Select team and enter preset name');
  const teams = g('teams');
  const t = teams.find(x => x.id === teamId);
  if (!t) return alert('Team not found');
  if (!t.lineupPresets) t.lineupPresets = [];
  const sportType = getSportType(t.sport);
  let slots;

  if (sportType === 'racket') {
    const sA = document.getElementById('slot_single_a');
    const sB = document.getElementById('slot_single_b');
    const d1 = document.getElementById('slot_doubles_1');
    const d2 = document.getElementById('slot_doubles_2');
    slots = {
      type: 'racket',
      singleA: sA ? sA.value || null : null,
      singleB: sB ? sB.value || null : null,
      doubles: [d1 ? d1.value : null, d2 ? d2.value : null].filter(Boolean)
    };
  } else {
    const capSel = document.getElementById('slot_captain');
    const starterCbs = document.querySelectorAll('#slot_starters .starter-cb:checked');
    slots = {
      type: 'team',
      captain: capSel ? capSel.value || null : null,
      starters: Array.from(starterCbs).map(cb => cb.value)
    };
  }

  t.lineupPresets.push({ name: name, slots: slots });
  s('teams', teams);
  document.getElementById('presetName').value = '';
  renderLineupPresetFields();
  loadTeams();
  alert('Preset saved');
}
function populatePositionSelect() {
  const teamSel = document.getElementById('playerTeam');
  const posSel = document.getElementById('playerPosition');
  if (!teamSel || !posSel) return;
  const selectedTeamId = teamSel.value;
  if (!selectedTeamId) {
    posSel.innerHTML = '<option value="">Select Position</option>';
    return;
  }
  const team = g('teams').find(t => t.id === selectedTeamId);
  if (!team) {
    posSel.innerHTML = '<option value="">Select Position</option>';
    return;
  }
  const positions = getSportPositions(team.sport);
  posSel.innerHTML = '<option value="">Select Position</option>' + positions.map(p => `<option value="${p}">${p}</option>`).join('') + '<option value="__custom__">Other (type)</option>';
  posSel.onchange = function() { handleCustomPosition(posSel, team.sport); };
}

function populateTeamSelect() {
  const sportSel = document.getElementById('playerSport');
  const sport = (sportSel && sportSel.value) ? sportSel.value : selectedSport;
  const teams = getVisibleTeams().filter(t => sport ? t.sport === sport : true);
  const sel = document.getElementById('playerTeam');
  if (!sel) return;
  if (teams.length === 0) {
    sel.innerHTML = '<option value="">No teams available</option>';
    sel.onchange = populatePositionSelect;
    populatePositionSelect();
    return;
  }
  sel.innerHTML = '<option value="">Select Team</option>' + teams.map(t => `<option value="${t.id}">${t.name} (${t.sport})</option>`).join('');
  sel.onchange = populatePositionSelect;
  populatePositionSelect();
}

// --- Team Logo helpers for Create Team ---
function previewCreateTeamLogo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    window.__createTeamLogo = e.target.result;
    const preview = document.getElementById('createTeamLogoPreview');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`;
  };
  reader.readAsDataURL(file);
}

function clearCreateTeamLogo() {
  window.__createTeamLogo = '';
  const preview = document.getElementById('createTeamLogoPreview');
  if (preview) preview.innerHTML = '📷';
  if (document.getElementById('createTeamLogoFile')) document.getElementById('createTeamLogoFile').value = '';
}

// --- Team Logo helpers for Edit Team Modal ---
function previewEditTeamLogo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    window.__editTeamLogo = e.target.result;
    const preview = document.getElementById('editTeamLogoPreview');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
}

function clearEditTeamLogo() {
  window.__editTeamLogo = '';
  const preview = document.getElementById('editTeamLogoPreview');
  if (preview) preview.innerHTML = '<span style="font-size:0.7rem;color:#aaa">No logo</span>';
  if (document.getElementById('editTeamLogoFile')) document.getElementById('editTeamLogoFile').value = '';
}
