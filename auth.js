// Authentication and main initialization
const LOGIN_SESSION_KEY = 'sportsSysSession';

function persistLoginSession(user, sport, section) {
  const sessionUser = user || currentUser;
  if (!sessionUser || !sessionUser.username) {
    sessionStorage.removeItem(LOGIN_SESSION_KEY);
    return;
  }

  const activeBtn = document.querySelector('.nav-btn[data-section].active');
  const activeSection = activeBtn ? activeBtn.getAttribute('data-section') : 'dash';
  let resolvedSection = (section === undefined) ? activeSection : section;
  if (resolvedSection === 'tournaments' && document.getElementById('bigEventDash') && document.getElementById('bigEventDash').style.display === 'block') {
    resolvedSection = 'bigEventDash';
  }

  // Determine the sport value to persist.
  // Use '__all__' marker when user is inside the app with no specific sport (admin "Manage All" mode).
  let sportVal = (sport === undefined) ? selectedSport : sport;
  const isInsideApp = document.getElementById('app') && document.getElementById('app').style.display !== 'none';
  if (sportVal === null && isInsideApp && resolvedSection) {
    sportVal = '__all__';
  }

  const payload = {
    username: sessionUser.username,
    sport: sportVal,
    section: resolvedSection || 'dash',
    timestamp: Date.now()
  };
  sessionStorage.setItem(LOGIN_SESSION_KEY, JSON.stringify(payload));
}

function clearLoginSession() {
  sessionStorage.removeItem(LOGIN_SESSION_KEY);
}

function restoreLoginSession() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(LOGIN_SESSION_KEY);
  } catch (e) {
    return false;
  }
  if (!raw) return false;

  let session = null;
  try {
    session = JSON.parse(raw);
  } catch (e) {
    clearLoginSession();
    return false;
  }
  if (!session || !session.username) {
    clearLoginSession();
    return false;
  }

  const users = g('users') || [];
  const usr = users.find(u => u.username === session.username);
  if (!usr) {
    clearLoginSession();
    return false;
  }

  currentUser = usr;
  window.currentUser = usr;
  updateProfileBtn(usr.username);

  let restoreSection = session.section || 'dash';
  if (usr.role === 'organizer' && restoreSection === 'standings') restoreSection = 'dash';

  const loginEl = document.getElementById('login');
  const sportSelectEl = document.getElementById('sportSelect');
  const appEl = document.getElementById('app');
  if (loginEl) loginEl.style.display = 'none';

  // Organizer with one assigned sport can be restored straight to dashboard.
  if (!session.sport && usr.role === 'organizer' && Array.isArray(usr.assignedSports) && usr.assignedSports.length === 1) {
    selectedSport = usr.assignedSports[0];
    isViewOnly = false;
    hideLoginWelcome();
    if (sportSelectEl) sportSelectEl.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';
    const scopeEl = document.getElementById('currentSportDisplay');
    if (scopeEl) scopeEl.textContent = formatScopeLabel(selectedSport);
    loadAll();
    show(restoreSection);
    persistLoginSession(usr, selectedSport, restoreSection);
    return true;
  }

  // Restore selected sport if still allowed for the user.
  if (session.sport && session.sport !== '__all__') {
    const assigned = Array.isArray(usr.assignedSports) ? usr.assignedSports : [];
    const isAllowed = usr.role !== 'organizer' || assigned.length === 0 || assigned.includes(session.sport);
    if (isAllowed) {
      selectedSport = session.sport;
      isViewOnly = false;
      hideLoginWelcome();
      if (sportSelectEl) sportSelectEl.style.display = 'none';
      if (appEl) appEl.style.display = 'flex';
      const scopeEl = document.getElementById('currentSportDisplay');
      if (scopeEl) scopeEl.textContent = formatScopeLabel(selectedSport);
      loadAll();
      show(restoreSection);
      persistLoginSession(usr, selectedSport, restoreSection);
      return true;
    }
  }

  // Admin/organizer "Manage All Sports" mode — restore into app with no sport filter
  if (session.sport === '__all__') {
    selectedSport = null;
    isViewOnly = false;
    hideLoginWelcome();
    if (sportSelectEl) sportSelectEl.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';
    const scopeEl = document.getElementById('currentSportDisplay');
    if (scopeEl) scopeEl.textContent = formatScopeLabel(null);
    loadAll();
    show(restoreSection);
    persistLoginSession(usr, null, restoreSection);
    return true;
  }

  // Fall back to sport picker while keeping user logged in.
  if (appEl) appEl.style.display = 'none';
  if (sportSelectEl) sportSelectEl.style.display = 'flex';
  showLoginWelcome(usr);
  loadSportSelect();
  persistLoginSession(usr, null, null);
  return true;
}

function doLogin() {
  initDemo();
  const user = document.getElementById('user').value.trim();
  const pass = document.getElementById('pass').value.trim();
  if (!user || !pass) {
    alert('Please enter both username and password.');
    return;
  }
  const usr = g('users').find(x => x.username === user && x.password === pass);
  if (!usr) return alert("Invalid login");
  currentUser = usr;
  window.currentUser = usr;
  document.getElementById('login').style.display = "none";

  // Update profile button with user initials
  updateProfileBtn(usr.username);

  document.getElementById('app').style.display = "none";
  document.getElementById('sportSelect').style.display = "flex";
  showLoginWelcome(usr);
  loadSportSelect();
  persistLoginSession(usr, null, null);

  // Auto-select if organizer has exactly 1 assigned sport
  if (usr.role === 'organizer' && usr.assignedSports && usr.assignedSports.length === 1) {
    selectSport(usr.assignedSports[0]);
  }
}

function showLoginWelcome(usr) {
  const safeName = (usr && usr.username) ? usr.username : 'User';
  const banner = document.getElementById('loginWelcomeBanner');
  const welcomeText = document.getElementById('loginWelcomeText');
  const topbarSubText = document.getElementById('topbarSubText');

  const isOrganizer = usr && usr.role === 'organizer';
  if (welcomeText) {
    welcomeText.textContent = isOrganizer
      ? `Welcome, ${safeName}! Select a sport to manage your events.`
      : `Welcome, ${safeName}! Select a sport to start managing events.`;
  }
  if (banner) {
    banner.style.display = 'flex';
    banner.classList.remove('hide');
  }
  if (topbarSubText) {
    const roleLabel = isOrganizer ? 'Organizer Panel' : 'Sports Coordinator Panel';
    topbarSubText.textContent = `Welcome, ${safeName} — ${roleLabel}`;
  }
}

function hideLoginWelcome() {
  const banner = document.getElementById('loginWelcomeBanner');
  if (banner) banner.style.display = 'none';
}

function logout() {
  clearLoginSession();
  location.reload();
}

function show(id) {
  if (id === 'users' && !canManageOrganizers()) {
    alert('Access denied');
    return;
  }
  // Organizer cannot access standings section
  if (currentUser && currentUser.role === 'organizer' && id === 'standings') {
    alert('Access denied');
    return;
  }
  document.querySelectorAll('.section').forEach(s => { if (s && s.style) s.style.display = 'none'; });
  const el = document.getElementById(id);
  if (!el) {
    console.warn('show(): element not found', id);
    return;
  }
  if (el && el.style) {
    // #login uses display:flex for centering; all other sections use block
    el.style.display = (id === 'login') ? 'flex' : 'block';
  }
  if (id === 'standings') loadStandings();
  if (id === 'settings' && typeof loadSettings === 'function') loadSettings();
  if (id === 'reports' && typeof generateReport === 'function') generateReport();
  if (id === 'messages' && typeof loadConversations === 'function') { loadConversations(); }
  if (id === 'announcements' && typeof populateAnnEventSelect === 'function') populateAnnEventSelect();
  if (id === 'schedules' && typeof populateBracketMatchSelect === 'function') populateBracketMatchSelect();

  // Update active sidebar button
  // bigEventDash maps to tournaments sidebar button
  const mapSection = id === 'bigEventDash' ? 'tournaments' : id;
  document.querySelectorAll('.nav-btn[data-section]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-section') === mapSection);
  });

  if (currentUser && id !== 'login') {
    persistLoginSession(currentUser, selectedSport, id);
  }
}

function clearAllData() {
  if (!canManageUsers()) {
    alert('Only the Sports Coordinator (Admin) can clear system data.');
    return;
  }
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    dbClearAll().then(function() {
      clearLoginSession();
      alert('All data cleared. Page will reload.');
      location.reload();
    }).catch(function() {
      // Fallback if DB not available
      localStorage.clear();
      alert('All data cleared. Page will reload.');
      location.reload();
    });
  }
}

function forgotPassword() {
  const username = prompt('Enter your username to reset password:');
  if (username) {
    const users = g('users');
    const user = users.find(u => u.username === username);
    if (user) {
      user.password = 'reset123';
      s('users', users);
      alert('Password reset to "reset123". Please login and change it.');
    } else {
      alert('Username not found.');
    }
  }
}

function initDemo() {
  // Use g() instead of direct localStorage.getItem to work with DB cache
  var existingUsers = g('users');
  if (!existingUsers || existingUsers.length === 0) {
    s('users', [
      { username: 'admin', password: 'admin123', role: 'admin', campus: '', sport: null },
      { username: 'organizer1', password: 'org123', role: 'organizer', campus: DEFAULT_CAMPUS, sport: null, assignedSports: [], assignedEvents: [] }
    ]);
  }
  var keys = ['teams', 'players', 'tournaments', 'matches', 'announcements', 'bigEvents', 'messages'];
  keys.forEach(function(key) {
    var data = g(key);
    if (!data || data.length === 0) s(key, []);
  });
  var campuses = g('campuses');
  if (!campuses || campuses.length === 0)
    s('campuses', [DEFAULT_CAMPUS]);
  migrateLegacyData();
  populateCampusOptions();
}

function loadSportSelect() {
  const sportIcons = {
    Basketball: '🏀', Soccer: '⚽', Volleyball: '🏐', Tennis: '🎾', Baseball: '⚾',
    Swimming: '🏊', Athletics: '🏃',
    TableTennis: '🏓', Badminton: '🏸', Chess: '♟️', Esports: '🎮'
  };
  let sportList = Object.keys(sports);
  // Organizer: restrict to assigned sports only — never show full admin-like list
  if (currentUser && currentUser.role === 'organizer') {
    const assigned = Array.isArray(currentUser.assignedSports) ? currentUser.assignedSports : [];
    sportList = assigned.length > 0 ? sportList.filter(sp => assigned.includes(sp)) : [];
  }
  const div = document.getElementById('sportButtons');
  if (!div) return;
  if (sportList.length === 0 && currentUser && currentUser.role === 'organizer') {
    div.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted-text);font-size:0.95rem">No sports assigned yet.<br>Contact your Sports Coordinator.</div>';
    const allBtn = document.getElementById('manageAllBtn');
    if (allBtn) allBtn.style.display = 'none';
    return;
  }
  div.innerHTML = sportList.map(s => `
    <div class="sport-card" tabindex="0" onclick="selectSport('${s}')" onkeydown="if(event.key==='Enter'){selectSport('${s}')}" aria-label="${s}">
      <div class="sport-icon">${sportIcons[s] || '🏆'}</div>
      <div class="sport-name">${s}</div>
    </div>
  `).join('');
  // Hide "Manage All Sports" for all organizers
  const allBtn = document.getElementById('manageAllBtn');
  if (allBtn) {
    const showAll = canManageCampusFeatures() && !(currentUser && currentUser.role === 'organizer');
    allBtn.style.display = showAll ? 'block' : 'none';
  }}

// Ensure slider works on page load if sportSelect is visible
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('sportSelect') && document.getElementById('sportSelect').style.display !== 'none') {
    loadSportSelect();
  }
});

function scrollSports(dir) {
  const slider = document.querySelector('.sport-slider');
  if (!slider) return;
  const card = slider.querySelector('.sport-card');
  const cardWidth = card ? card.offsetWidth + 20 : 240;
  slider.scrollBy({ left: dir * cardWidth * 2, behavior: 'smooth' });
}

function selectSport(sport) {
  selectedSport = sport;
  isViewOnly = false;
  hideLoginWelcome();
  document.getElementById('sportSelect').style.display = "none";
  document.getElementById('app').style.display = "flex";
  document.getElementById('currentSportDisplay').textContent = formatScopeLabel(sport);
  show('dash');
  persistLoginSession(currentUser, sport, 'dash');
  loadAll();
}

function showAll() {
  // Organizer with assigned sports cannot view all sports
  if (currentUser && currentUser.role === 'organizer' && currentUser.assignedSports && currentUser.assignedSports.length > 0) {
    alert('You can only access your assigned sports.');
    return;
  }
  selectedSport = null;
  isViewOnly = false;
  hideLoginWelcome();
  document.getElementById('sportSelect').style.display = "none";
  document.getElementById('app').style.display = "flex";
  document.getElementById('currentSportDisplay').textContent = formatScopeLabel();
  show('dash');
  persistLoginSession(currentUser, null, 'dash');
  loadAll();
}

function changeSport() {
  document.getElementById('app').style.display = "none";
  document.getElementById('sportSelect').style.display = "flex";
  persistLoginSession(currentUser, null, null);
  loadSportSelect();
}

// ===== SETTINGS =====
function loadSettings() {
  if (!currentUser) return;

  // Account info
  const un = document.getElementById('settingsUsername');
  const rl = document.getElementById('settingsRole');
  const sp = document.getElementById('settingsSport');
  if (un) un.textContent = currentUser.username;
  if (rl) {
    const roleLabel = currentUser.role === 'admin' ? 'Sports Coordinator' : 'Organizer';
    rl.textContent = roleLabel;
    rl.className = 'status-badge ' + (currentUser.role === 'admin' ? 'live' : 'ongoing');
  }
  if (sp) sp.textContent = currentUser.role === 'admin' ? 'All Sports' : 'Organizer';
  // Dark mode toggle
  const toggle = document.getElementById('settingsDarkToggle');
  if (toggle) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    toggle.classList.toggle('on', isDark);
  }

  // Logo preview
  if (typeof applySystemLogo === 'function') applySystemLogo();

  // Data Management — admin only
  const dataCard = document.getElementById('settingsDataCard');
  if (dataCard) {
    dataCard.style.display = canManageUsers() ? 'block' : 'none';
  }

  // Admin panel — admin only
  const adminCard = document.getElementById('settingsAdminCard');
  if (adminCard) {
    adminCard.style.display = (currentUser.role === 'admin') ? 'block' : 'none';
  }

  // Stats
  const tt = document.getElementById('settingsTotalTournaments');
  const ts = document.getElementById('settingsTotalTeams');
  const tu = document.getElementById('settingsTotalUsers');
  const su = document.getElementById('settingsStorageUsed');
  if (tt) tt.textContent = getVisibleTournaments().length;
  if (ts) ts.textContent = getVisibleTeams().length;
  if (tu) tu.textContent = getVisibleUsers().length;
  if (su) {
    let total = 0;
    const dataKeys = ['users', 'teams', 'players', 'tournaments', 'matches',
                      'announcements', 'bigEvents', 'campuses', 'messages',
                      'smsNotifications', 'smsSentLog', 'systemLogo', 'darkMode'];
    dataKeys.forEach(key => {
      const val = g(key);
      total += JSON.stringify(val).length;
    });
    const kb = (total / 1024).toFixed(1);
    su.textContent = kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(2) + ' MB';
  }
}

function changePassword() {
  if (!currentUser) return;
  const oldP = document.getElementById('settingsOldPass').value.trim();
  const newP = document.getElementById('settingsNewPass').value.trim();
  const confP = document.getElementById('settingsConfirmPass').value.trim();

  if (!oldP || !newP || !confP) { alert('Please fill in all password fields.'); return; }
  if (oldP !== currentUser.password) { alert('Current password is incorrect.'); return; }
  if (newP.length < 4) { alert('New password must be at least 4 characters.'); return; }
  if (newP !== confP) { alert('New password and confirmation do not match.'); return; }

  const users = g('users');
  const u = users.find(x => x.username === currentUser.username);
  if (u) {
    u.password = newP;
    s('users', users);
    currentUser.password = newP;
    window.currentUser = currentUser;
    document.getElementById('settingsOldPass').value = '';
    document.getElementById('settingsNewPass').value = '';
    document.getElementById('settingsConfirmPass').value = '';
    alert('Password updated successfully!');
  }
}

function exportAllData() {
  if (!canManageUsers()) {
    alert('Only the Sports Coordinator (Admin) can export system backups.');
    return;
  }
  const dataKeys = ['users', 'teams', 'players', 'tournaments', 'matches',
                    'announcements', 'bigEvents', 'campuses', 'messages',
                    'smsNotifications', 'smsSentLog', 'systemLogo', 'darkMode'];
  const data = {};
  dataKeys.forEach(key => {
    data[key] = g(key);
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sportssys-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importAllData(event) {
  if (!canManageUsers()) {
    alert('Only the Sports Coordinator (Admin) can import system backups.');
    event.target.value = '';
    return;
  }
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm('This will OVERWRITE all current data. Continue?')) { event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      Object.keys(data).forEach(key => {
        s(key, data[key]);
      });
      clearLoginSession();
      alert('Data imported successfully! Page will reload.');
      location.reload();
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function updateProfileBtn(name) {
  const btn = document.getElementById('userMenuBtn');
  const nameEl = document.getElementById('userMenuName');
  if (btn && name) {
    const parts = name.trim().split(/\s+/);
    btn.textContent = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  if (nameEl && name) nameEl.textContent = name;
}

function backupToFile() {
  exportAllData();
}
