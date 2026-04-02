// Utility functions and shared helpers
function formatTime(time) {
  if (!time) return '';
  const [hour, minute] = time.split(':');
  const h = parseInt(hour);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minute} ${ampm}`;
}

// Mutable sports registry — custom sports merged from DB on load
let sports = {
  Basketball: { type: 'team', positions: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'] },
  Soccer: { type: 'team', positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] },
  Volleyball: { type: 'team', positions: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Libero', 'Opposite Hitter'] },
  Tennis: { type: 'racket', positions: ['Singles Player', 'Doubles Player'] },
  Baseball: { type: 'team', positions: ['Pitcher', 'Catcher', 'Infielder', 'Outfielder'] },
  Swimming: { type: 'individual', positions: ['Freestyle Swimmer', 'Backstroke Swimmer', 'Breaststroke Swimmer', 'Butterfly Swimmer', 'Individual Medley Swimmer'] },
  Athletics: { type: 'individual', positions: ['Sprinter', 'Middle Distance Runner', 'Long Distance Runner', 'Jumper', 'Thrower'] },
  TableTennis: { type: 'racket', positions: ['Singles Player', 'Doubles Player'] },
  Badminton: { type: 'racket', positions: ['Singles Player', 'Doubles Player'] },
  Chess: { type: 'individual', positions: ['Player'] },
  Esports: { type: 'team', positions: ['Player', 'Coach'] }
};

// Helper: get sport type ('team', 'racket', 'individual'). Defaults to 'team'.
function getSportType(sportName) {
  const sp = sports[sportName];
  if (!sp) return 'team';
  if (sp.type) return sp.type;
  // Legacy: array format
  return 'team';
}

// Helper: get positions array from sport (handles both old array and new object format)
function getSportPositions(sportName) {
  const sp = sports[sportName];
  if (!sp) return ['Player'];
  if (Array.isArray(sp)) return sp;          // legacy array
  if (sp.positions) return sp.positions;     // new object format
  return ['Player'];
}

// Load custom sports from DB and merge into sports registry
function loadCustomSports() {
  const custom = g('customSports');
  if (custom && typeof custom === 'object') {
    Object.keys(custom).forEach(name => {
      sports[name] = custom[name];
    });
  }
}

// Save a custom sport to DB
function saveCustomSport(name, type, positions) {
  const custom = g('customSports') || {};
  custom[name] = { type: type || 'team', positions: positions && positions.length > 0 ? positions : ['Player'] };
  s('customSports', custom);
  // Also update in-memory
  sports[name] = custom[name];
}

const DEFAULT_CAMPUS = 'Main Campus';

function normalizeCampusValue(campus) {
  const value = String(campus || '').trim().replace(/\s+/g, ' ');
  return value || DEFAULT_CAMPUS;
}

function sanitizeCampusIdPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'na';
}

function buildCampusTeamId(campus, sport, name) {
  return [campus, sport, name].map(sanitizeCampusIdPart).join('__');
}

function getUserCampus(user) {
  return normalizeCampusValue(user && (user.campus || user.assignedCampus || user.campusName));
}

function getCurrentCampus(user) {
  if (!user && typeof currentUser !== 'undefined') user = currentUser;
  return user ? getUserCampus(user) : DEFAULT_CAMPUS;
}

function isCampusScopedRole(user) {
  if (!user && typeof currentUser !== 'undefined') user = currentUser;
  return !!user && user.role === 'organizer';
}

function canManageCampusFeatures(user) {
  if (!user && typeof currentUser !== 'undefined') user = currentUser;
  return !!user && (user.role === 'admin' || user.role === 'organizer');
}

function canManageUsers(user) {
  if (!user && typeof currentUser !== 'undefined') user = currentUser;
  return !!user && user.role === 'admin';
}

// Admin (Sports Coordinator) can add/manage organizers
function canManageOrganizers(user) {
  if (!user && typeof currentUser !== 'undefined') user = currentUser;
  return !!user && user.role === 'admin';
}

function canAccessCampus(campus, user) {
  if (!user && typeof currentUser !== 'undefined') user = currentUser;
  if (!user || !isCampusScopedRole(user)) return true;
  return normalizeCampusValue(campus) === getCurrentCampus(user);
}

function getBigEventCampus(bigEvent) {
  return normalizeCampusValue(bigEvent && bigEvent.campus);
}

function getTeamCampus(team) {
  return normalizeCampusValue(team && team.campus);
}

function getTournamentCampus(tournament) {
  if (!tournament) return DEFAULT_CAMPUS;
  if (tournament.campus) return normalizeCampusValue(tournament.campus);
  if (tournament.bigEventId) {
    const event = (g('bigEvents') || []).find(ev => ev.id === tournament.bigEventId);
    if (event) return getBigEventCampus(event);
  }
  const teams = g('teams') || [];
  const teamId = Array.isArray(tournament.teams) ? tournament.teams.find(Boolean) : null;
  if (teamId) {
    const team = teams.find(item => item.id === teamId);
    if (team) return getTeamCampus(team);
  }
  return DEFAULT_CAMPUS;
}

function getPlayerCampus(player) {
  if (!player) return DEFAULT_CAMPUS;
  if (player.campus) return normalizeCampusValue(player.campus);
  const team = (g('teams') || []).find(item => item.id === player.team);
  return team ? getTeamCampus(team) : DEFAULT_CAMPUS;
}

function getMatchCampus(match) {
  if (!match) return DEFAULT_CAMPUS;
  if (match.campus) return normalizeCampusValue(match.campus);
  const teams = g('teams') || [];
  const teamA = teams.find(item => item.id === match.a);
  const teamB = teams.find(item => item.id === match.b);
  if (teamA) return getTeamCampus(teamA);
  if (teamB) return getTeamCampus(teamB);
  const tournament = (g('tournaments') || []).find(item => item.name === match.tournament);
  return tournament ? getTournamentCampus(tournament) : DEFAULT_CAMPUS;
}

function getAnnouncementCampus(announcement) {
  if (!announcement) return DEFAULT_CAMPUS;
  if (announcement.campus) return normalizeCampusValue(announcement.campus);
  if (announcement.eventId) {
    if (announcement.eventId.startsWith('big_')) {
      const eventId = announcement.eventId.replace('big_', '');
      const event = (g('bigEvents') || []).find(item => item.id === eventId);
      if (event) return getBigEventCampus(event);
    }
    if (announcement.eventId.startsWith('tour_')) {
      const tournamentName = announcement.eventId.replace('tour_', '');
      const tournament = (g('tournaments') || []).find(item => item.name === tournamentName);
      if (tournament) return getTournamentCampus(tournament);
    }
  }
  return DEFAULT_CAMPUS;
}

function canAccessBigEvent(bigEvent, user) {
  if (typeof bigEvent === 'string') {
    bigEvent = (g('bigEvents') || []).find(item => item.id === bigEvent);
  }
  return !!bigEvent && canAccessCampus(getBigEventCampus(bigEvent), user);
}

function canAccessTournament(tournament, user) {
  return !!tournament && canAccessCampus(getTournamentCampus(tournament), user);
}

function canAccessTeam(team, user) {
  return !!team && canAccessCampus(getTeamCampus(team), user);
}

function canAccessPlayer(player, user) {
  return !!player && canAccessCampus(getPlayerCampus(player), user);
}

function canAccessMatch(match, user) {
  return !!match && canAccessCampus(getMatchCampus(match), user);
}

function canAccessAnnouncement(announcement, user) {
  if (!announcement) return false;
  // Admin announcements are visible to everyone
  if (announcement.role === 'admin') return true;
  return canAccessCampus(getAnnouncementCampus(announcement), user);
}

function getVisibleUsers() {
  const users = g('users') || [];
  if (canManageUsers()) {
    return users.filter(user => canAccessCampus(getUserCampus(user)));
  }
  return users.filter(user => canAccessCampus(getUserCampus(user)) && (!currentUser || user.username !== currentUser.username));
}

function getVisibleTeams() {
  let teams = (g('teams') || []).filter(team => canAccessTeam(team));
  // Organizer: only show teams for their assigned sports
  if (currentUser && currentUser.role === 'organizer' && currentUser.assignedSports && currentUser.assignedSports.length > 0) {
    teams = teams.filter(t => currentUser.assignedSports.includes(t.sport));
  }
  return teams;
}

function getVisiblePlayers() {
  let players = (g('players') || []).filter(player => canAccessPlayer(player));
  // Organizer: only show players for their assigned sports
  if (currentUser && currentUser.role === 'organizer' && currentUser.assignedSports && currentUser.assignedSports.length > 0) {
    players = players.filter(p => {
      if (p.sport) return currentUser.assignedSports.includes(p.sport);
      const team = (g('teams') || []).find(t => t.id === p.team);
      return team && currentUser.assignedSports.includes(team.sport);
    });
  }
  return players;
}

function getVisibleTournaments() {
  let tournaments = (g('tournaments') || []).filter(tournament => canAccessTournament(tournament));
  if (currentUser && currentUser.role === 'organizer') {
    // Filter by assigned sports
    if (currentUser.assignedSports && currentUser.assignedSports.length > 0) {
      tournaments = tournaments.filter(t => currentUser.assignedSports.includes(t.sport));
    }
    // Filter by assigned events
    if (currentUser.assignedEvents && currentUser.assignedEvents.length > 0) {
      tournaments = tournaments.filter(t => {
        if (t.bigEventId) return currentUser.assignedEvents.includes(t.bigEventId);
        return true; // standalone tournaments (no bigEventId) pass through
      });
    }
  }
  return tournaments;
}

function getVisibleBigEvents() {
  let events = (g('bigEvents') || []).filter(bigEvent => canAccessBigEvent(bigEvent));
  // Organizer: only show assigned events
  if (currentUser && currentUser.role === 'organizer' && currentUser.assignedEvents && currentUser.assignedEvents.length > 0) {
    events = events.filter(ev => currentUser.assignedEvents.includes(ev.id));
  }
  return events;
}

function getVisibleMatches() {
  let matches = (g('matches') || []).filter(match => canAccessMatch(match));
  if (currentUser && currentUser.role === 'organizer') {
    // Filter by assigned sports
    if (currentUser.assignedSports && currentUser.assignedSports.length > 0) {
      matches = matches.filter(m => {
        if (m.sport) return currentUser.assignedSports.includes(m.sport);
        const allTeams = g('teams') || [];
        const teamA = allTeams.find(t => t.id === m.teamA);
        return teamA && currentUser.assignedSports.includes(teamA.sport);
      });
    }
    // Filter by assigned events — exclude matches from tournaments not in assigned events
    if (currentUser.assignedEvents && currentUser.assignedEvents.length > 0) {
      const allTournaments = g('tournaments') || [];
      matches = matches.filter(m => {
        if (!m.tournamentIdx && m.tournamentIdx !== 0) return true; // no tournament link
        const tour = allTournaments[m.tournamentIdx];
        if (!tour || !tour.bigEventId) return true; // standalone tournament
        return currentUser.assignedEvents.includes(tour.bigEventId);
      });
    }
  }
  return matches;
}

function getVisibleAnnouncements() {
  return (g('announcements') || []).filter(announcement => canAccessAnnouncement(announcement));
}

function findTeamByIdentity(name, sport, campus, excludeId) {
  const normalizedCampus = normalizeCampusValue(campus);
  const normalizedName = String(name || '').trim().toLowerCase();
  return (g('teams') || []).find(team => {
    if (excludeId && team.id === excludeId) return false;
    return String(team.name || '').trim().toLowerCase() === normalizedName &&
      String(team.sport || '') === String(sport || '') &&
      getTeamCampus(team) === normalizedCampus;
  });
}

function getCampusOptionList() {
  return (g('campuses') || []).slice().sort((a, b) => a.localeCompare(b));
}

function populateCampusOptions() {
  // Populate all campus <select> dropdowns with the managed campus list
  const campuses = getCampusOptionList();
  const selectors = document.querySelectorAll('.campus-select');
  selectors.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">Select Campus</option>' + campuses.map(c => `<option value="${c}">${c}</option>`).join('');
    if (current && campuses.includes(current)) sel.value = current;
  });
  // Also populate legacy datalist if present
  const list = document.getElementById('campusOptions');
  if (list) {
    list.innerHTML = campuses.map(c => `<option value="${c}"></option>`).join('');
  }
}

function formatScopeLabel(sport) {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin') {
    return sport ? sport : 'All Sports';
  }
  return sport ? sport : 'All Sports';
}

function migrateLegacyData() {
  let changed = false;

  let users = g('users') || [];
  if (users.length > 0) {
    users = users.reduce((result, user) => {
      if (user.role === 'coach' || user.role === 'player') {
        changed = true;
        return result;
      }
      const normalizedUser = {
        ...user,
        campus: user.role === 'admin' ? '' : getUserCampus(user),
        assignedSports: Array.isArray(user.assignedSports) ? user.assignedSports : [],
        assignedEvents: Array.isArray(user.assignedEvents) ? user.assignedEvents : []
      };
      if (normalizedUser.campus !== user.campus) changed = true;
      result.push(normalizedUser);
      return result;
    }, []);
    s('users', users);
  }

  const bigEvents = (g('bigEvents') || []).map(bigEvent => {
    const campus = normalizeCampusValue(bigEvent.campus);
    if (campus !== bigEvent.campus) changed = true;
    return { ...bigEvent, campus };
  });
  s('bigEvents', bigEvents);

  const teams = (g('teams') || []).map(team => {
    const campus = normalizeCampusValue(team.campus);
    const id = team.id || buildCampusTeamId(campus, team.sport, team.name);
    if (campus !== team.campus || id !== team.id) changed = true;
    return { ...team, campus, id };
  });
  s('teams', teams);

  const tournaments = (g('tournaments') || []).map(tournament => {
    const linkedEvent = tournament.bigEventId ? bigEvents.find(bigEvent => bigEvent.id === tournament.bigEventId) : null;
    const campus = normalizeCampusValue(tournament.campus || (linkedEvent && linkedEvent.campus));
    if (campus !== tournament.campus) changed = true;
    return { ...tournament, campus };
  });
  s('tournaments', tournaments);

  const players = (g('players') || []).map(player => {
    const team = teams.find(item => item.id === player.team);
    const campus = normalizeCampusValue(player.campus || (team && team.campus));
    if (campus !== player.campus) changed = true;
    return { ...player, campus };
  });
  s('players', players);

  const matches = (g('matches') || []).map(match => {
    const tournament = tournaments.find(item => item.name === match.tournament);
    const team = teams.find(item => item.id === match.a) || teams.find(item => item.id === match.b);
    const campus = normalizeCampusValue(match.campus || (tournament && tournament.campus) || (team && team.campus));
    if (campus !== match.campus) changed = true;
    return { ...match, campus };
  });
  s('matches', matches);

  const announcements = (g('announcements') || []).map(announcement => {
    const campus = normalizeCampusValue(getAnnouncementCampus(announcement));
    if (campus !== announcement.campus) changed = true;
    return { ...announcement, campus };
  });
  s('announcements', announcements);

  if (changed) populateCampusOptions();

  // Ensure all campuses found in data are registered in the managed list
  const knownCampuses = new Set(g('campuses') || []);
  let campusListChanged = false;
  [users, teams, players, tournaments, bigEvents, matches, announcements].forEach(arr => {
    (arr || []).forEach(item => {
      const c = item.campus;
      if (c && !knownCampuses.has(c)) { knownCampuses.add(c); campusListChanged = true; }
    });
  });
  if (campusListChanged) {
    s('campuses', Array.from(knownCampuses));
    populateCampusOptions();
  }
}
