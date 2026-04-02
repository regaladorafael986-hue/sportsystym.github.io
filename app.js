// Main application orchestration

// Organizer access: filtered by assigned sports/events.
// Admin (Sports Coordinator) bypasses the sport/event filter (they manage everything).
function organizerCanAccessEvent(eventId) {
  if (!canAccessBigEvent(eventId)) return false;
  if (!currentUser || currentUser.role !== 'organizer') return true;
  // If organizer has no assigned events, allow all events in their campus
  if (!currentUser.assignedEvents || currentUser.assignedEvents.length === 0) return true;
  const id = typeof eventId === 'string' ? eventId : (eventId && eventId.id);
  return currentUser.assignedEvents.includes(id);
}

function organizerCanAccessTournament(tournament) {
  if (!canAccessTournament(tournament)) return false;
  if (!currentUser || currentUser.role !== 'organizer') return true;
  const t = typeof tournament === 'object' ? tournament : (getVisibleTournaments().find(x => x.name === tournament));
  if (!t) return false;
  // Check assigned sports
  if (currentUser.assignedSports && currentUser.assignedSports.length > 0) {
    if (!currentUser.assignedSports.includes(t.sport)) return false;
  }
  // Check assigned events
  if (currentUser.assignedEvents && currentUser.assignedEvents.length > 0) {
    if (t.bigEventId && !currentUser.assignedEvents.includes(t.bigEventId)) return false;
  }
  return true;
}

function loadAll() {
  migrateLegacyData();
  loadCustomSports();
  populateCampusOptions();
  // Migrate old teams to have id
  const teams = g('teams');
  teams.forEach(t => {
    if (!t.id) {
      t.id = buildCampusTeamId(t.campus || DEFAULT_CAMPUS, t.sport, t.name);
    }
  });
  s('teams', teams);

  loadDash();
  loadTeams();
  loadTournaments();
  loadMatches();
  populateSportSelect();
  populateRegSport();
  populateTeamSportSelect();
  populateTeamTournamentSelect();
  populatePlayerSportSelect();
  populateTeamSelect();
  populateMatchTeamSelect();
  populateTournamentTeams();
  populateScoringTournaments();
  if (typeof populateCertTournaments === 'function') populateCertTournaments();
  loadStandings();
  loadAnn();
  if (typeof loadUsers === 'function') loadUsers();
  if (typeof loadCampusList === 'function') loadCampusList();
  if (typeof populateBigEventUI === 'function') populateBigEventUI();
  if (typeof loadBigEvents === 'function') loadBigEvents();
  if (typeof applySystemLogo === 'function') applySystemLogo();
  if (typeof updateMsgBadge === 'function') updateMsgBadge();
  if (typeof populateBracketMatchSelect === 'function') populateBracketMatchSelect();
  if (typeof populateAnnEventSelect === 'function') populateAnnEventSelect();
  setPermissions();
  const dMatch = document.getElementById('dMatch');
  if (dMatch) dMatch.innerText = g('matches').length;

  // Check upcoming matches and notify sports coordinators via SMS
  if (typeof checkAndNotifySportsCoordinators === 'function') checkAndNotifySportsCoordinators();
  if (typeof updateNotifBadge === 'function') updateNotifBadge();
}

function setPermissions() {
  // Basic UI permission toggles based on role
  if (!currentUser) return;
  const role = currentUser.role;
  // Users section: admin (Sports Coordinator) sees everything and can manage organizers
  const usersBtn = document.getElementById('usersBtn');
  if (usersBtn) usersBtn.style.display = canManageOrganizers() ? 'block' : 'none';

  isViewOnly = false;

  // Organizer: hide Standings nav; show only their allowed sections
  const standingsBtn = document.getElementById('standingsBtn');
  if (standingsBtn) standingsBtn.style.display = (role !== 'organizer') ? 'block' : 'none';

  const tournamentsBtn = document.getElementById('tournamentsBtn');
  if (tournamentsBtn) tournamentsBtn.style.display = 'block';

  // Hide standings chart on dashboard for organizer
  const dashStandingsChart = document.getElementById('dashStandingsChart');
  if (dashStandingsChart) dashStandingsChart.style.display = (role !== 'organizer') ? 'block' : 'none';

  // Public viewer: only admin (Sports Coordinator)
  const publicViewerBtn = document.getElementById('publicViewerBtn');
  if (publicViewerBtn) publicViewerBtn.style.display = (role === 'admin') ? 'inline-flex' : 'none';

  // Sports remain switchable for both admins and coordinators.
  const changeSportBtn = document.getElementById('changeSportBtn');
  if (changeSportBtn) {
    changeSportBtn.style.display = canManageCampusFeatures() ? 'inline-block' : 'none';
  }

  const settingsAdminCard = document.getElementById('settingsAdminCard');
  const settingsDataCard = document.getElementById('settingsDataCard');
  if (settingsAdminCard) settingsAdminCard.style.display = canManageUsers() ? 'block' : 'none';
  if (settingsDataCard) settingsDataCard.style.display = canManageUsers() ? 'block' : 'none';

  const campusCard = document.getElementById('campusManagementCard');
  if (campusCard) campusCard.style.display = 'none'; // Campus management removed

  // Campus dropdowns removed — not using multiple campuses

  // Lock sport dropdowns for organizer based on assigned sports
  if (role === 'organizer' && currentUser.assignedSports && currentUser.assignedSports.length > 0) {
    if (currentUser.assignedSports.length === 1) {
      lockSportDropdowns(currentUser.assignedSports[0]);
    }
    // For any count, also filter the main sport selector (sidebar)
    filterOrganizerSportOptions();
  }
}

// Filter the main sport picker so organizer only sees their assigned sports
function filterOrganizerSportOptions() {
  if (!currentUser || currentUser.role !== 'organizer') return;
  const assigned = currentUser.assignedSports || [];
  if (assigned.length === 0) return;
  // Filter the sport selection modal options
  document.querySelectorAll('.sport-option, .sport-card').forEach(el => {
    const sportName = (el.getAttribute('data-sport') || el.textContent || '').trim();
    if (sportName && !assigned.some(s => sportName.toLowerCase().includes(s.toLowerCase()))) {
      el.style.display = 'none';
    }
  });
}

// Auto-set and disable sport selectors for organizer
function lockSportDropdowns(sport) {
  const ids = ['teamSport', 'playerSport'];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    // Check if the sport option exists
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === sport) { sel.selectedIndex = i; found = true; break; }
    }
    if (found) {
      sel.disabled = true;
      sel.style.opacity = '0.7';
      sel.style.cursor = 'not-allowed';
      // Trigger change events so dependent dropdowns update
      sel.dispatchEvent(new Event('change'));
    }
  });
}

function initApp() {
  // Check if user is logged in
  if (!currentUser && typeof restoreLoginSession === 'function') {
    if (restoreLoginSession()) return;
  }
  if (!currentUser) {
    var loginEl = document.getElementById('login');
    if (loginEl) loginEl.style.display = 'flex';
  } else {
    show('dash');
    loadAll();
  }
}

// ===== DARK MODE =====
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('darkMode', 'light');
    updateDarkModeIcon(false);
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('darkMode', 'dark');
    updateDarkModeIcon(true);
  }
}

function updateDarkModeIcon(isDark) {
  const icon = isDark ? '☀️' : '🌙';
  // Update topbar dark mode button icon
  const dmBtn = document.getElementById('darkModeToggle');
  if (dmBtn) {
    const iconEl = dmBtn.querySelector('.topbar-btn-icon');
    if (iconEl) iconEl.textContent = icon;
    else dmBtn.textContent = icon;
  }
  // Also update any legacy toggles
  document.querySelectorAll('.dark-mode-toggle').forEach(btn => btn.textContent = icon);
  // Sync settings toggle
  const toggle = document.getElementById('settingsDarkToggle');
  if (toggle) toggle.classList.toggle('on', isDark);
}

function applyDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateDarkModeIcon(true);
  } else {
    document.documentElement.removeAttribute('data-theme');
    updateDarkModeIcon(false);
  }
}

// Initialize app on page load — load database first
window.addEventListener('load', function() {
  // Try to setup and load from database, then init
  dbSetup()
    .then(function() { return dbLoadAll(); })
    .catch(function() {
      // DB not available — dbLoadAll falls back to localStorage
      return dbLoadAll();
    })
    .finally(function() {
      applyDarkMode();
      initApp();
      // Remove splash after app is ready
      var splash = document.getElementById('appSplash');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(function() { splash.remove(); }, 400);
      }
    });
});
