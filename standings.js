// Standings module

// ===== Sport icon map =====
const standingSportIcons = {
  Basketball:'🏀', Soccer:'⚽', Volleyball:'🏐', Tennis:'🎾', Baseball:'⚾',
  Swimming:'🏊', Athletics:'🏃',
  TableTennis:'🏓', Badminton:'🏸', Chess:'♟️', Esports:'🎮',
  Softball:'🥎', Futsal:'⚽', Sepaktakraw:'🦶', Arnis:'⚔️'
};
function getSportIcon(sport) {
  if (!sport) return '🏆';
  return standingSportIcons[sport] || standingSportIcons[Object.keys(standingSportIcons).find(k => k.toLowerCase() === sport.toLowerCase())] || '🏆';
}
function getSportIndicatorClass(sport) {
  if (!sport) return 'sport-indicator-default';
  const s = sport.toLowerCase();
  if (s.includes('basketball')) return 'sport-indicator-basketball';
  if (s.includes('soccer') || s.includes('futsal') || s.includes('football')) return 'sport-indicator-soccer';
  if (s.includes('volleyball')) return 'sport-indicator-volleyball';
  if (s.includes('tennis')) return 'sport-indicator-tennis';
  if (s.includes('badminton')) return 'sport-indicator-badminton';
  return 'sport-indicator-default';
}

// Helper: collect team IDs from a tournament's bracket/roundRobin data
function getTeamIdsFromTournament(t) {
  const ids = new Set();
  if (t.teams) t.teams.forEach(id => ids.add(id));
  function fromMatch(m) { if (m && m.a) ids.add(m.a); if (m && m.b) ids.add(m.b); }
  if (t.roundRobin) t.roundRobin.forEach(fromMatch);
  if (t.format === 'double' && t.bracket && t.bracket.winners) {
    t.bracket.winners.forEach(r => r.forEach(fromMatch));
    if (t.bracket.losers) t.bracket.losers.forEach(r => r.forEach(fromMatch));
  }
  if (Array.isArray(t.bracket)) t.bracket.forEach(r => r.forEach(fromMatch));
  if (t.groupStage) Object.values(t.groupStage).forEach(arr => arr.forEach(fromMatch));
  return ids;
}

// Helper: process tournament bracket matches into a standings object
function processTournamentStandings(t, standings) {
  function processMatch(match) {
    if (!match || !match.winner || !match.a || !match.b) return;
    if (standings[match.winner]) { standings[match.winner].wins++; standings[match.winner].points += 3; }
    const loser = match.a === match.winner ? match.b : match.a;
    if (standings[loser]) standings[loser].losses++;
  }
  if (t.format === 'roundrobin' && t.roundRobin) t.roundRobin.forEach(processMatch);
  else if (t.format === 'double' && t.bracket && t.bracket.winners) {
    t.bracket.winners.forEach(r => r.forEach(processMatch));
    if (t.bracket.losers) t.bracket.losers.forEach(r => r.forEach(processMatch));
  } else if (Array.isArray(t.bracket)) t.bracket.forEach(r => r.forEach(processMatch));
  if (t.format === 'groupknockout' && t.groupStage) {
    Object.values(t.groupStage).forEach(arr => arr.forEach(processMatch));
  }
}

// Helper: render a team standings card list
function renderTeamStandingsCards(sortedTeams) {
  if (sortedTeams.length === 0) return '<div style="text-align:center;padding:40px;color:var(--muted-text);background:#fafafa;border-radius:12px">No team data available yet</div>';
  let html = '<div style="display:grid;gap:12px">';
  sortedTeams.forEach((team, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
    const rankBg = idx === 0 ? 'linear-gradient(135deg,#ffd700,#ffed4a)' : idx === 1 ? 'linear-gradient(135deg,#c0c0c0,#e8e8e8)' : idx === 2 ? 'linear-gradient(135deg,#cd7f32,#daa06d)' : 'var(--bg)';
    const highlight = idx < 3 ? 'box-shadow:0 4px 12px rgba(0,0,0,0.08);' : '';
    const winRate = team.wins + team.losses > 0 ? Math.round((team.wins / (team.wins + team.losses)) * 100) : 0;
    const sportIcon = getSportIcon(team.sport);
    const sportClass = getSportIndicatorClass(team.sport);
    const teamLogo = team.logo ? `<img src="${team.logo}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:1px solid rgba(0,0,0,0.08)">` : '';
    html += `<div class="stand-team-card" style="display:grid;grid-template-columns:60px 1fr auto;align-items:center;gap:16px;padding:16px 20px;background:var(--surface);border:1px solid rgba(16,24,40,0.06);border-radius:12px;${highlight}">
      <div class="stand-team-rank" style="display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:12px;background:${rankBg};font-weight:800;font-size:1.2rem;color:${idx < 3 ? '#333' : 'var(--text)'}">
        ${medal || '#' + (idx + 1)}
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${teamLogo}
          <span style="font-weight:700;font-size:1.1rem;color:var(--text)">${team.name}</span>
          <span class="sport-indicator ${sportClass}">${sportIcon} ${team.sport || 'N/A'}</span>
        </div>
        <div style="display:flex;gap:12px;margin-top:4px;font-size:0.85rem;color:var(--muted-text);flex-wrap:wrap">
          <span style="display:flex;align-items:center;gap:4px">📍 ${team.group}</span>
          <span style="display:flex;align-items:center;gap:4px">📊 ${winRate}% win rate</span>
        </div>
      </div>
      <div class="stand-team-stats" style="display:flex;gap:16px;align-items:center">
        <div style="text-align:center">
          <div style="font-size:0.7rem;color:var(--muted-text);text-transform:uppercase;letter-spacing:0.5px">Wins</div>
          <div style="font-size:1.3rem;font-weight:700;color:var(--success)">${team.wins}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.7rem;color:var(--muted-text);text-transform:uppercase;letter-spacing:0.5px">Losses</div>
          <div style="font-size:1.3rem;font-weight:700;color:var(--danger)">${team.losses}</div>
        </div>
        <div style="text-align:center;padding:8px 16px;background:var(--primary);border-radius:8px">
          <div style="font-size:0.7rem;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:0.5px">Points</div>
          <div style="font-size:1.4rem;font-weight:800;color:#fff">${team.points}</div>
        </div>
      </div>
    </div>`;
  });
  html += '</div>';
  return html;
}

// Helper: render group standings cards
function renderGroupStandingsCards(sortedGroups) {
  if (sortedGroups.length === 0) return '<div style="text-align:center;padding:40px;color:var(--muted-text);background:#fafafa;border-radius:12px">No group data available</div>';
  let html = '<div class="stand-group-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';
  sortedGroups.forEach((grp, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
    const borderColor = idx === 0 ? 'var(--success)' : idx === 1 ? 'var(--accent)' : idx === 2 ? '#cd7f32' : 'rgba(16,24,40,0.08)';
    html += `<div style="padding:20px;background:var(--surface);border:2px solid ${borderColor};border-radius:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1.5rem">${medal || '🏷️'}</span>
          <span style="font-weight:700;font-size:1.1rem">${grp.name}</span>
        </div>
        <span style="background:var(--bg);padding:4px 10px;border-radius:20px;font-size:0.8rem;color:var(--muted-text)">#${idx + 1}</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <span style="flex:1;text-align:center;padding:8px;background:rgba(40,167,69,0.1);border-radius:8px">
          <div style="font-size:0.7rem;color:var(--muted-text)">WINS</div>
          <div style="font-size:1.2rem;font-weight:700;color:var(--success)">${grp.wins}</div>
        </span>
        <span style="flex:1;text-align:center;padding:8px;background:rgba(231,76,60,0.1);border-radius:8px">
          <div style="font-size:0.7rem;color:var(--muted-text)">LOSSES</div>
          <div style="font-size:1.2rem;font-weight:700;color:var(--danger)">${grp.losses}</div>
        </span>
        <span style="flex:1;text-align:center;padding:8px;background:rgba(31,60,136,0.1);border-radius:8px">
          <div style="font-size:0.7rem;color:var(--muted-text)">POINTS</div>
          <div style="font-size:1.2rem;font-weight:700;color:var(--primary)">${grp.points}</div>
        </span>
      </div>
      <div style="font-size:0.85rem;color:var(--muted-text);display:flex;align-items:center;gap:6px">
        👥 ${grp.teams} team${grp.teams !== 1 ? 's' : ''} in this group
      </div>
    </div>`;
  });
  html += '</div>';
  return html;
}

// Build standings object for a set of tournaments and their teams
function buildStandingsForTournaments(filteredTournaments, allTeams) {
  // Collect team IDs that participate in these tournaments
  const teamIdSet = new Set();
  filteredTournaments.forEach(t => {
    getTeamIdsFromTournament(t).forEach(id => teamIdSet.add(id));
  });

  const standings = {};
  const groupStandings = {};

  // Only include teams that belong to these tournaments
  allTeams.filter(t => teamIdSet.has(t.id)).forEach(team => {
    standings[team.id] = { name: team.name, group: team.group || 'No Group', sport: team.sport || '', logo: team.logo || '', wins: 0, losses: 0, points: 0 };
  });

  // Process tournament bracket data
  filteredTournaments.forEach(t => processTournamentStandings(t, standings));

  // Aggregate group standings
  Object.values(standings).forEach(team => {
    if (!groupStandings[team.group]) {
      groupStandings[team.group] = { name: team.group, wins: 0, losses: 0, points: 0, teams: 0 };
    }
    groupStandings[team.group].wins += team.wins;
    groupStandings[team.group].losses += team.losses;
    groupStandings[team.group].points += team.points;
    groupStandings[team.group].teams++;
  });

  const sortedTeams = Object.values(standings).sort((a, b) => b.points - a.points || b.wins - a.wins);
  const sortedGroups = Object.values(groupStandings).sort((a, b) => b.points - a.points || b.wins - a.wins);
  return { sortedTeams, sortedGroups };
}

function loadStandings() {
  const allTeams = getVisibleTeams().filter(t => !selectedSport || t.sport == selectedSport);
  const allTournaments = getVisibleTournaments().filter(t => !selectedSport || t.sport == selectedSport);
  const bigEvents = getVisibleBigEvents();

  // Split tournaments into solo vs Big Event
  const soloTournaments = allTournaments.filter(t => !t.bigEventId);

  // Build separate standings
  const solo = buildStandingsForTournaments(soloTournaments, allTeams);

  const standListEl = document.getElementById('standList');
  if (!standListEl) return;
  let html = '';

  // Collect all unique sports across solo tournaments for pill indicators
  const soloSports = [...new Set(soloTournaments.map(t => t.sport).filter(Boolean))];
  const soloSportPills = soloSports.length > 0
    ? soloSports.map(sp => `<span class="sport-indicator ${getSportIndicatorClass(sp)}" style="font-size:0.65rem">${getSportIcon(sp)} ${sp}</span>`).join(' ')
    : '';

  // Build quick-nav buttons
  const navEl = document.getElementById('standingsNav');
  if (navEl) {
    let navHtml = `<button class="form-btn secondary-btn" style="padding:5px 12px;font-size:0.75rem;border-radius:8px;" data-target="stand-solo">🏅 Solo</button>`;
    bigEvents.forEach((ev, idx) => {
      const evTournaments = allTournaments.filter(t => t.bigEventId === ev.id);
      if (evTournaments.length === 0 && !ev.sports) return;
      // Collect sports for this event
      const evSports = [...new Set(evTournaments.map(t => t.sport).filter(Boolean))];
      const evSportIcons = evSports.slice(0, 4).map(sp => getSportIcon(sp)).join('');
      navHtml += `<button class="form-btn secondary-btn" style="padding:5px 12px;font-size:0.75rem;border-radius:8px;" data-target="stand-event-${idx}">🏆 ${ev.name} ${evSportIcons ? '<span style="margin-left:2px">' + evSportIcons + '</span>' : ''}</button>`;
    });
    navEl.innerHTML = navHtml;
    // Add history nav button if there are completed matches
    const hasCompleted = (g('matches') || []).some(m => m.status === 'completed' || m.status === 'finished');
    if (hasCompleted) {
      navEl.innerHTML += '<button class="form-btn secondary-btn" style="padding:5px 12px;font-size:0.75rem;border-radius:8px;" data-target="stand-history">📜 History</button>';
    }
    // Attach event listeners for smooth scroll + active state
    Array.from(navEl.querySelectorAll('button[data-target]')).forEach(btn => {
      btn.addEventListener('click', function() {
        navEl.querySelectorAll('.active-stand-tab').forEach(b => b.classList.remove('active-stand-tab'));
        this.classList.add('active-stand-tab');
        const target = document.getElementById(this.getAttribute('data-target'));
        if (target) target.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
  }

  // ============================================================
  // SECTION 1: SOLO TOURNAMENT STANDINGS
  // ============================================================
  html += `<div id="stand-solo" class="stand-section-wrap" style="margin-bottom:40px;padding:28px;background:linear-gradient(135deg,rgba(31,60,136,0.04),rgba(52,152,219,0.04));border:2px solid rgba(31,60,136,0.12);border-radius:20px;scroll-margin-top:70px">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid rgba(31,60,136,0.08)">
      <span style="font-size:2.5rem">🏅</span>
      <div>
        <h2 style="margin:0;color:var(--primary);font-size:1.5rem;font-weight:800">Solo Tournament Standings</h2>
        <p style="margin:4px 0 0;color:var(--muted-text);font-size:0.9rem">Performance from standalone/individual tournaments only</p>
        ${soloSportPills ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${soloSportPills}</div>` : ''}
      </div>
    </div>`;

  html += `<div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <span style="font-size:1.4rem">👥</span>
      <h3 style="margin:0;color:var(--primary);font-size:1.15rem">Team Standings</h3>
    </div>`;
  html += renderTeamStandingsCards(solo.sortedTeams);
  html += '</div>';

  html += `<div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <span style="font-size:1.4rem">📊</span>
      <h3 style="margin:0;color:var(--accent);font-size:1.15rem">Group Standings</h3>
    </div>`;
  html += renderGroupStandingsCards(solo.sortedGroups);
  html += '</div>';
  html += '</div>';

  // ============================================================
  // SECTION 2+: EACH BIG EVENT gets its own standings section
  // ============================================================
  const eventColors = [
    { bg1: 'rgba(40,167,69,0.04)', bg2: 'rgba(255,215,0,0.04)', border: 'rgba(40,167,69,0.12)', borderLine: 'rgba(40,167,69,0.08)', color: 'var(--success)' },
    { bg1: 'rgba(124,58,237,0.04)', bg2: 'rgba(99,102,241,0.04)', border: 'rgba(124,58,237,0.12)', borderLine: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
    { bg1: 'rgba(234,88,12,0.04)', bg2: 'rgba(245,158,11,0.04)', border: 'rgba(234,88,12,0.12)', borderLine: 'rgba(234,88,12,0.08)', color: '#ea580c' },
    { bg1: 'rgba(6,182,212,0.04)', bg2: 'rgba(59,130,246,0.04)', border: 'rgba(6,182,212,0.12)', borderLine: 'rgba(6,182,212,0.08)', color: '#06b6d4' },
  ];

  bigEvents.forEach((ev, evIdx) => {
    const evTournaments = allTournaments.filter(t => t.bigEventId === ev.id);
    if (evTournaments.length === 0 && !ev.sports) return;
    const evStandings = buildStandingsForTournaments(evTournaments, allTeams);
    const evUnit = computeUnitStandingsForEvent(ev.id);
    const c = eventColors[evIdx % eventColors.length];

    // Collect sport pills for this event
    const evSportsUnique = [...new Set(evTournaments.map(t => t.sport).filter(Boolean))];
    const evSportPills = evSportsUnique.map(sp => `<span class="sport-indicator ${getSportIndicatorClass(sp)}" style="font-size:0.65rem">${getSportIcon(sp)} ${sp}</span>`).join(' ');

    html += `<div id="stand-event-${evIdx}" class="stand-section-wrap" style="margin-bottom:40px;padding:28px;background:linear-gradient(135deg,${c.bg1},${c.bg2});border:2px solid ${c.border};border-radius:20px;scroll-margin-top:70px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${c.borderLine}">
        <span style="font-size:2.5rem">🏆</span>
        <div>
          <h2 style="margin:0;color:${c.color};font-size:1.5rem;font-weight:800">${ev.name}</h2>
          <p style="margin:4px 0 0;color:var(--muted-text);font-size:0.9rem">${ev.sports ? ev.sports.length + ' sport(s)' : ''} ${ev.startDate ? '• ' + ev.startDate + ' to ' + (ev.endDate || '?') : ''}</p>
          ${evSportPills ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${evSportPills}</div>` : ''}
        </div>
      </div>`;

    // Team standings
    html += `<div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:1.4rem">👥</span>
        <h3 style="margin:0;color:${c.color};font-size:1.15rem">Team Standings</h3>
      </div>`;
    html += renderTeamStandingsCards(evStandings.sortedTeams);
    html += '</div>';

    // Group standings
    html += `<div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:1.4rem">📊</span>
        <h3 style="margin:0;color:var(--accent);font-size:1.15rem">Group Standings</h3>
      </div>`;
    html += renderGroupStandingsCards(evStandings.sortedGroups);
    html += '</div>';

    // Unit standings for this Big Event
    html += `<div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:1.4rem">🏆</span>
        <h3 style="margin:0;color:${c.color};font-size:1.15rem">Overall Unit Standings — ${ev.name}</h3>
        <span style="font-size:0.8rem;color:var(--muted-text);margin-left:auto">Combined across all sports in this event</span>
      </div>`;
    if (evUnit.length === 0) {
      html += `<div style="text-align:center;padding:40px;color:var(--muted-text);background:linear-gradient(180deg,${c.bg1},transparent);border:2px dashed ${c.color};border-radius:12px">No unit data for this event yet. Generate brackets and play matches to see standings.</div>`;
    } else {
      const champion = evUnit[0];
      html += `<div class="stand-champion-box" style="background:linear-gradient(135deg,rgba(255,215,0,0.15),${c.bg1});border:2px solid ${c.color};border-radius:16px;padding:24px;margin-bottom:20px;text-align:center">
        <div style="font-size:3rem;margin-bottom:8px">🏆</div>
        <div style="font-size:0.9rem;color:var(--muted-text);text-transform:uppercase;letter-spacing:1px">Current Leader</div>
        <div style="font-size:2rem;font-weight:800;color:var(--text);margin:8px 0">${champion.unit}</div>
        <div style="display:flex;justify-content:center;gap:24px;margin-top:12px">
          <span style="font-size:1.1rem"><strong style="color:var(--success)">${champion.wins}</strong> Wins</span>
          <span style="font-size:1.1rem"><strong style="color:var(--danger)">${champion.losses}</strong> Losses</span>
          <span style="font-size:1.1rem"><strong style="color:var(--primary)">${champion.points}</strong> Points</span>
        </div>
        <div style="margin-top:8px;font-size:0.85rem;color:var(--muted-text)">Competing in: ${champion.sports.join(', ') || 'N/A'}</div>
      </div>`;
      html += '<div style="display:grid;gap:12px">';
      evUnit.forEach((unit, idx) => {
        if (idx === 0) return;
        const medal = idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
        const bw = champion.points > 0 ? Math.round((unit.points / champion.points) * 100) : 0;
        html += `<div class="stand-unit-card" style="display:grid;grid-template-columns:50px 1fr auto;align-items:center;gap:16px;padding:16px 20px;background:var(--surface);border:1px solid rgba(16,24,40,0.06);border-radius:12px">
          <div style="text-align:center">
            <div style="font-size:1.5rem">${medal || ''}</div>
            <div style="font-weight:800;color:var(--muted-text)">#${idx + 1}</div>
          </div>
          <div>
            <div style="font-weight:700;font-size:1.05rem;color:var(--text);margin-bottom:4px">${unit.unit}</div>
            <div style="height:8px;background:#eee;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${bw}%;background:linear-gradient(90deg,${c.color},var(--accent));border-radius:4px"></div>
            </div>
            <div style="font-size:0.8rem;color:var(--muted-text);margin-top:4px">${unit.sports.join(', ') || 'No sports'}</div>
          </div>
          <div class="stand-unit-stats" style="display:flex;gap:12px;align-items:center">
            <div style="text-align:center">
              <div style="font-size:1.2rem;font-weight:700;color:var(--success)">${unit.wins}</div>
              <div style="font-size:0.65rem;color:var(--muted-text)">W</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:1.2rem;font-weight:700;color:var(--danger)">${unit.losses}</div>
              <div style="font-size:0.65rem;color:var(--muted-text)">L</div>
            </div>
            <div style="text-align:center;padding:6px 12px;background:${c.color};border-radius:8px">
              <div style="font-size:1.2rem;font-weight:800;color:#fff">${unit.points}</div>
              <div style="font-size:0.65rem;color:rgba(255,255,255,0.8)">PTS</div>
            </div>
          </div>
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>'; // end unit standings

    html += '</div>'; // end this Big Event section
  });

  // ============================================================
  // MATCH HISTORY SECTION — Review completed matches
  // ============================================================
  const allMatchesRaw = getVisibleMatches();
  const completedMatches = allMatchesRaw.filter(m => {
    if (m.status !== 'completed' && m.status !== 'finished') return false;
    if (!selectedSport) return true;
    const ta = g('teams').find(t => t.id == m.a);
    const tb = g('teams').find(t => t.id == m.b);
    return ta && tb && ta.sport == selectedSport && tb.sport == selectedSport;
  });

  if (completedMatches.length > 0) {
    html += `<div id="stand-history" class="stand-section-wrap" style="margin-bottom:40px;padding:28px;background:linear-gradient(135deg,rgba(40,167,69,0.04),rgba(16,185,129,0.04));border:2px solid rgba(40,167,69,0.15);border-radius:20px;scroll-margin-top:70px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid rgba(40,167,69,0.08)">
        <span style="font-size:2.5rem">📜</span>
        <div>
          <h2 style="margin:0;color:var(--success);font-size:1.5rem;font-weight:800">Match History</h2>
          <p style="margin:4px 0 0;color:var(--muted-text);font-size:0.9rem">${completedMatches.length} completed match${completedMatches.length !== 1 ? 'es' : ''} — tap Review to see details</p>
        </div>
      </div>
      <div style="display:grid;gap:10px">`;

    completedMatches.forEach((m, idx) => {
      const ta = g('teams').find(t => t.id == m.a);
      const tb = g('teams').find(t => t.id == m.b);
      const teamAName = ta ? ta.name : m.a;
      const teamBName = tb ? tb.name : m.b;
      const scoreA = Number(m.sa) || 0;
      const scoreB = Number(m.sb) || 0;
      const winner = scoreA > scoreB ? teamAName : scoreB > scoreA ? teamBName : null;
      const globalIdx = allMatchesRaw.indexOf(m);
      const logoA = ta && ta.logo ? `<img src="${ta.logo}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid rgba(16,24,40,0.08)">` : `<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.85rem">${teamAName.charAt(0).toUpperCase()}</div>`;
      const logoB = tb && tb.logo ? `<img src="${tb.logo}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid rgba(16,24,40,0.08)">` : `<div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.85rem">${teamBName.charAt(0).toUpperCase()}</div>`;
      const dateStr = m.date || '';
      const sportStr = m.sport || (ta ? ta.sport : '') || '';

      html += `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface);border:1px solid rgba(16,24,40,0.06);border-left:3px solid var(--success);border-radius:10px;transition:all 0.15s" onmouseover="this.style.boxShadow='0 2px 10px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='none'">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          ${logoA}
          <div style="font-weight:700;font-size:0.92rem;color:${scoreA > scoreB ? 'var(--success)' : 'var(--text)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${teamAName}</div>
          <div style="background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;padding:4px 12px;border-radius:8px;font-weight:800;font-size:0.85rem;flex-shrink:0">${scoreA} - ${scoreB}</div>
          <div style="font-weight:700;font-size:0.92rem;color:${scoreB > scoreA ? 'var(--success)' : 'var(--text)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${teamBName}</div>
          ${logoB}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${sportStr ? `<span class="sport-indicator ${getSportIndicatorClass(sportStr)}" style="font-size:0.68rem">${getSportIcon(sportStr)} ${sportStr}</span>` : ''}
          ${dateStr ? `<span style="font-size:0.72rem;color:var(--muted-text)">📅 ${dateStr}</span>` : ''}
          ${winner ? `<span style="font-size:0.72rem;color:var(--success);font-weight:700">🏆 ${winner}</span>` : '<span style="font-size:0.72rem;color:var(--muted-text)">🤝 Draw</span>'}
          <button class="form-btn secondary-btn" style="padding:4px 10px;font-size:0.72rem;border-radius:6px;margin:0" onclick="reviewMatch(${globalIdx})">📋 Review</button>
        </div>
      </div>`;
    });

    html += '</div></div>';
  }

  standListEl.innerHTML = html;
}

// Compute unit standings for a SPECIFIC Big Event
function computeUnitStandingsForEvent(bigEventId) {
  const allTeams = getVisibleTeams();
  const allTournaments = getVisibleTournaments();

  const evTournaments = allTournaments.filter(t => t.bigEventId === bigEventId);
  if (evTournaments.length === 0) return [];

  const unitMap = {};
  function addWin(teamId) {
    const team = allTeams.find(t => t.id === teamId);
    if (!team || !team.group) return;
    const u = team.group;
    if (!unitMap[u]) unitMap[u] = { wins: 0, losses: 0, points: 0, sports: new Set() };
    unitMap[u].wins++; unitMap[u].points += 3; unitMap[u].sports.add(team.sport);
  }
  function addLoss(teamId) {
    const team = allTeams.find(t => t.id === teamId);
    if (!team || !team.group) return;
    const u = team.group;
    if (!unitMap[u]) unitMap[u] = { wins: 0, losses: 0, points: 0, sports: new Set() };
    unitMap[u].losses++; unitMap[u].sports.add(team.sport);
  }

  evTournaments.forEach(t => {
    function processMatch(match) {
      if (!match || !match.winner || !match.a || !match.b) return;
      addWin(match.winner);
      const loser = match.a === match.winner ? match.b : match.a;
      addLoss(loser);
    }
    if (t.format === 'roundrobin' && t.roundRobin) t.roundRobin.forEach(processMatch);
    if (t.format === 'double' && t.bracket && t.bracket.winners) {
      t.bracket.winners.forEach(r => r.forEach(processMatch));
      if (t.bracket.losers) t.bracket.losers.forEach(r => r.forEach(processMatch));
    }
    if (Array.isArray(t.bracket)) t.bracket.forEach(r => r.forEach(processMatch));
    if (t.format === 'groupknockout' && t.groupStage) Object.values(t.groupStage).forEach(arr => arr.forEach(processMatch));
  });

  return Object.keys(unitMap).map(u => ({
    unit: u, wins: unitMap[u].wins, losses: unitMap[u].losses, points: unitMap[u].points, sports: Array.from(unitMap[u].sports)
  })).sort((a, b) => b.points - a.points || b.wins - a.wins);
}
