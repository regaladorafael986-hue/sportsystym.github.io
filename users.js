// Users management module

// =================== CAMPUS MANAGEMENT ===================

function addCampus() {
  if (!canManageUsers()) { alert('Only admins can manage campuses.'); return; }
  const input = document.getElementById('newCampusInput');
  const name = (input ? input.value.trim() : '').replace(/\s+/g, ' ');
  if (!name) { alert('Please enter a campus name.'); return; }
  const campuses = g('campuses') || [];
  if (campuses.some(c => c.toLowerCase() === name.toLowerCase())) {
    alert('Campus "' + name + '" already exists.');
    return;
  }
  campuses.push(name);
  s('campuses', campuses);
  if (input) input.value = '';
  populateCampusOptions();
  loadCampusList();
}

function removeCampus(name) {
  if (!canManageUsers()) { 
    alert('Only admins can manage campuses.'); 
    return; 
  }
  
  // Check if any user/team/event is assigned to this campus
  const users = (g('users') || []).filter(u => u.campus === name);
  const teams = (g('teams') || []).filter(t => t.campus === name);
  const events = (g('bigEvents') || []).filter(e => e.campus === name);
  
  if (users.length > 0 || teams.length > 0 || events.length > 0) {
    const msg = `Campus "${name}" has:\n• ${users.length} user(s)\n• ${teams.length} team(s)\n• ${events.length} event(s)\n\nForce delete? All items will be reassigned to DEFAULT campus.`;
    if (!confirm(msg)) return;
    
    // Force delete - reassign everything to DEFAULT_CAMPUS
    const allUsers = g('users') || [];
    allUsers.forEach(u => { if (u.campus === name) u.campus = DEFAULT_CAMPUS; });
    s('users', allUsers);
    
    const allTeams = g('teams') || [];
    allTeams.forEach(t => { if (t.campus === name) t.campus = DEFAULT_CAMPUS; });
    s('teams', allTeams);
    
    const allEvents = g('bigEvents') || [];
    allEvents.forEach(e => { if (e.campus === name) e.campus = DEFAULT_CAMPUS; });
    s('bigEvents', allEvents);
  } else {
    if (!confirm('Delete campus "' + name + '"?')) return;
  }
  
  const campuses = (g('campuses') || []).filter(c => c !== name);
  s('campuses', campuses);
  populateCampusOptions();
  loadCampusList();
  alert('Campus deleted successfully!');
}

function editCampus(oldName) {
  if (!canManageUsers()) { alert('Only admins can manage campuses.'); return; }
  document.getElementById('editCampusOldName').value = oldName;
  document.getElementById('editCampusNewName').value = oldName;
  document.getElementById('editCampusModal').style.display = 'block';
}

function closeEditCampusModal() {
  document.getElementById('editCampusModal').style.display = 'none';
}

function saveEditCampus() {
  const oldName = document.getElementById('editCampusOldName').value;
  const newName = document.getElementById('editCampusNewName').value;
  
  if (!newName || newName.trim() === '') {
    alert('Please enter a campus name.');
    return;
  }
  
  const trimmedName = newName.trim().replace(/\s+/g, ' ');
  if (trimmedName === oldName) {
    closeEditCampusModal();
    return;
  }
  
  const campuses = g('campuses') || [];
  if (campuses.some(c => c.toLowerCase() === trimmedName.toLowerCase() && c !== oldName)) {
    alert('Campus "' + trimmedName + '" already exists.');
    return;
  }
  
  // Update campus name everywhere
  const updatedCampuses = campuses.map(c => c === oldName ? trimmedName : c);
  s('campuses', updatedCampuses);
  
  // Update in users
  const users = g('users') || [];
  users.forEach(u => { if (u.campus === oldName) u.campus = trimmedName; });
  s('users', users);
  
  // Update in teams
  const teams = g('teams') || [];
  teams.forEach(t => { if (t.campus === oldName) t.campus = trimmedName; });
  s('teams', teams);
  
  // Update in big events
  const events = g('bigEvents') || [];
  events.forEach(e => { if (e.campus === oldName) e.campus = trimmedName; });
  s('bigEvents', events);
  
  populateCampusOptions();
  loadCampusList();
  closeEditCampusModal();
  alert('Campus renamed successfully!');
}

function loadCampusList() {
  const container = document.getElementById('campusListContainer');
  if (!container) return;
  const campuses = g('campuses') || [];
  if (campuses.length === 0) {
    container.innerHTML = '<div style="color:var(--muted-text);font-size:0.85rem;padding:8px 0">No campuses added yet.</div>';
    return;
  }
  const users = g('users') || [];
  const teams = g('teams') || [];
  container.innerHTML = campuses.sort((a, b) => a.localeCompare(b)).map(c => {
    const userCount = users.filter(u => u.campus === c).length;
    const teamCount = teams.filter(t => t.campus === c).length;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border:1px solid rgba(16,24,40,0.06);border-radius:8px;margin-bottom:6px">
      <div>
        <span style="font-weight:600;font-size:0.95rem">\ud83c\udfeb ${c}</span>
        <span style="font-size:0.75rem;color:var(--muted-text);margin-left:8px">${userCount} user(s) \u2022 ${teamCount} team(s)</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="form-btn" style="margin:0;padding:4px 10px;font-size:0.75rem;background:var(--primary)" onclick="editCampus('${c.replace(/'/g, "\\'")}')">Edit</button>
        <button class="form-btn danger-btn" style="margin:0;padding:4px 10px;font-size:0.75rem" onclick="removeCampus('${c.replace(/'/g, "\\'")}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

// =================== USER REGISTRATION ===================

function registerUser() {
  if (!canManageOrganizers()) {
    alert('Access denied.');
    return;
  }
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value.trim();
  const role = 'organizer'; // Only organizers can be registered

  const campus = getCurrentCampus();

  if (!username || !password) {
    alert('Please fill all required fields.');
    return;
  }

  const u = g('users');
  if (u.some(user => user.username === username)) {
    alert('Username already exists.');
    return;
  }
  const newUser = {
    username,
    password,
    role,
    campus,
    sport: null,
    assignedSports: [],
    assignedEvents: []
  };

  // Collect assigned sports/events for organizer
  if (role === 'organizer') {
    const sportChecks = document.querySelectorAll('#regOrgSportsContainer input[type=checkbox]:checked');
    newUser.assignedSports = Array.from(sportChecks).map(cb => cb.value);
    const eventChecks = document.querySelectorAll('#regOrgEventsContainer input[type=checkbox]:checked');
    newUser.assignedEvents = Array.from(eventChecks).map(cb => cb.value);
  }
  u.push(newUser);
  s('users', u);

  alert('Organizer \"' + username + '\" registered successfully.');

  document.getElementById('regUser').value = '';
  document.getElementById('regPass').value = '';
  if (document.getElementById('regCampus')) document.getElementById('regCampus').value = '';
  refreshCampusOptions();
  loadUsers();
}

function refreshCampusOptions() {
  populateCampusOptions();
  const campusDiv = document.getElementById('regCampusDiv');
  const sportsDiv = document.getElementById('regOrgSportsDiv');
  const eventsDiv = document.getElementById('regOrgEventsDiv');

  // Always registering organizers - hide campus (auto-set), show sport/event pickers
  if (campusDiv) campusDiv.style.display = 'none';
  if (sportsDiv) sportsDiv.style.display = 'block';
  if (eventsDiv) eventsDiv.style.display = 'block';
  populateOrgSportCheckboxes();
  populateOrgEventCheckboxes();
}

function populateOrgSportCheckboxes() {
  const container = document.getElementById('regOrgSportsContainer');
  if (!container) return;
  const sportList = Object.keys(sports);
  container.innerHTML = sportList.map(s => `<label style="display:inline-flex;align-items:center;gap:4px;margin:4px 8px 4px 0;font-size:0.85rem"><input type="checkbox" value="${s}"> ${s}</label>`).join('');
}

function populateOrgEventCheckboxes() {
  const container = document.getElementById('regOrgEventsContainer');
  if (!container) return;
  const events = getVisibleBigEvents();
  if (events.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--muted-text)">No events created yet.</span>';
    return;
  }
  container.innerHTML = events.map(ev => `<label style="display:inline-flex;align-items:center;gap:4px;margin:4px 8px 4px 0;font-size:0.85rem"><input type="checkbox" value="${ev.id}"> ${ev.name}</label>`).join('');
}

function loadUsers() {
  let u;
  // Admin (Sports Coordinator) sees all users
  u = getVisibleUsers();
  const container = document.getElementById('usersListContainer');
  if (!container) return;
  if (u.length === 0) {
    container.innerHTML = '<div style="padding:16px; color:var(--muted-text); text-align:center; background:var(--surface); border-radius:var(--radius); border:1px solid rgba(16,24,40,0.04)">No users found.</div>';
    return;
  }
  const isSC = false; // Sports coordinator role removed; admin is the coordinator
  container.innerHTML = '<div style="display:flex; flex-direction:column; gap:8px;">' + u.map((user, i) => {
    const roleColor = user.role === 'admin' ? 'var(--primary)' : 'var(--warning, #e67e22)';
    const roleLabel = user.role === 'admin' ? 'Sports Coordinator' : 'Organizer';
    const assignedInfo = user.role === 'organizer' ? `<div style="font-size:0.8rem;color:var(--muted-text);margin-top:2px">Sports: ${(user.assignedSports || []).join(', ') || 'All'} | Events: ${(user.assignedEvents || []).length || 'All'}</div>` : '';
    const canEdit = canManageUsers();
    const canDelete = user.username !== 'admin' && canManageUsers();
    return `
      <div class="match-card" style="background:var(--surface); border:1px solid rgba(16,24,40,0.06); border-radius:8px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(16,24,40,0.02)">
        <div>
          <div style="font-weight:600; font-size:1.05rem">${user.username}</div>
          <div style="font-size:0.85rem; color:var(--muted-text); margin-top:4px">${user.role === 'admin' ? 'All Sports' : 'Organizer'}</div>
          ${assignedInfo}
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end">
          <span style="background:${roleColor}15; color:${roleColor}; padding:4px 10px; border-radius:999px; font-size:0.8rem; font-weight:700; text-transform:uppercase">${roleLabel}</span>
          ${canEdit ? `<button class="form-btn" style="margin:0;padding:4px 10px;font-size:0.75rem" onclick="openEditUser('${user.username}')">✏️ Edit</button>` : ''}
          ${canDelete ? `<button class="form-btn danger-btn" style="margin:0; padding:6px 10px; font-size:0.8rem" onclick="deleteUser('${user.username}')">Delete</button>` : ''}
        </div>
      </div>
    `;
  }).join('') + '</div>';

}

function deleteUser(usernameOrIndex) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  const allUsers = g('users') || [];
  let target;
  if (typeof usernameOrIndex === 'string') {
    target = allUsers.find(u => u.username === usernameOrIndex);
  } else {
    const visibleUsers = getVisibleUsers();
    target = visibleUsers[usernameOrIndex];
  }
  if (!target) return;
  if (!canManageUsers()) {
    alert('Access denied.');
    return;
  }
  const u = allUsers.filter(user => user.username !== target.username);
  s('users', u);
  loadUsers();
}

// =================== EDIT USER ===================

function openEditUser(username) {
  const users = g('users');
  const index = users.findIndex(item => item.username === username);
  const user = users[index];
  if (!user) return;

  document.getElementById('editUserIndex').value = index;
  document.getElementById('editUserName').value = user.username;
  document.getElementById('editUserPass').value = '';
  document.getElementById('editUserRole').value = user.role;
  toggleEditOrgSports();
  // Set campus after toggleEditOrgSports repopulates the select options
  document.getElementById('editUserCampus').value = user.role === 'admin' ? '' : (user.campus || '');

  // Disable username edit for the default 'admin' account
  const nameInput = document.getElementById('editUserName');
  if (user.username === 'admin') {
    nameInput.disabled = true;
    nameInput.style.opacity = '0.6';
  } else {
    nameInput.disabled = false;
    nameInput.style.opacity = '1';
  }

  document.getElementById('editUserModal').style.display = 'block';
}

function closeEditUser() {
  document.getElementById('editUserModal').style.display = 'none';
}

function toggleEditOrgSports() {
  populateCampusOptions();
  const role = document.getElementById('editUserRole').value;
  const campusDiv = document.getElementById('editCampusDiv');
  const sportsDiv = document.getElementById('editOrgSportsDiv');
  const eventsDiv = document.getElementById('editOrgEventsDiv');

  if (campusDiv) campusDiv.style.display = 'none'; // Campus management removed
  if (sportsDiv) sportsDiv.style.display = (role === 'organizer') ? 'block' : 'none';
  if (eventsDiv) eventsDiv.style.display = (role === 'organizer') ? 'block' : 'none';
  if (role === 'organizer') {
    populateEditOrgSportCheckboxes();
    populateEditOrgEventCheckboxes();
  }
}

function populateEditOrgSportCheckboxes() {
  const container = document.getElementById('editOrgSportsContainer');
  if (!container) return;
  const sportList = Object.keys(sports);
  const idx = parseInt(document.getElementById('editUserIndex').value);
  const users = g('users');
  const user = users[idx];
  const assigned = user ? (user.assignedSports || []) : [];
  container.innerHTML = sportList.map(s => `<label style="display:inline-flex;align-items:center;gap:4px;margin:4px 8px 4px 0;font-size:0.85rem"><input type="checkbox" value="${s}" ${assigned.includes(s) ? 'checked' : ''}> ${s}</label>`).join('');
}

function populateEditOrgEventCheckboxes() {
  const container = document.getElementById('editOrgEventsContainer');
  if (!container) return;
  const events = getVisibleBigEvents();
  const idx = parseInt(document.getElementById('editUserIndex').value);
  const users = g('users');
  const user = users[idx];
  const assigned = user ? (user.assignedEvents || []) : [];
  if (events.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--muted-text)">No events created yet.</span>';
    return;
  }
  container.innerHTML = events.map(ev => `<label style="display:inline-flex;align-items:center;gap:4px;margin:4px 8px 4px 0;font-size:0.85rem"><input type="checkbox" value="${ev.id}" ${assigned.includes(ev.id) ? 'checked' : ''}> ${ev.name}</label>`).join('');
}

function saveEditUser() {
  const index = parseInt(document.getElementById('editUserIndex').value);
  const users = g('users');
  if (isNaN(index) || !users[index]) return alert('User not found.');

  const user = users[index];

  if (!canManageUsers()) {
    return alert('Access denied.');
  }

  const newName = document.getElementById('editUserName').value.trim();
  const newPass = document.getElementById('editUserPass').value.trim();
  const newRole = document.getElementById('editUserRole').value;

  const newCampus = (newRole === 'admin') ? '' : getCurrentCampus();

  if (!newName) return alert('Username is required.');
  if (newRole !== 'admin' && newRole !== 'organizer') return alert('Only Sports Coordinator (Admin) and Organizer roles are allowed.');

  // Check for duplicate username (exclude current)
  const duplicate = users.find((u, i) => i !== index && u.username === newName);
  if (duplicate) return alert('Username "' + newName + '" is already taken.');

  const wasCurrentUser = currentUser && currentUser.username === user.username;

  // Collect assigned sports/events for organizer
  let assignedSports = [];
  let assignedEvents = [];
  if (newRole === 'organizer') {
    const sportChecks = document.querySelectorAll('#editOrgSportsContainer input[type=checkbox]:checked');
    assignedSports = Array.from(sportChecks).map(cb => cb.value);
    const eventChecks = document.querySelectorAll('#editOrgEventsContainer input[type=checkbox]:checked');
    assignedEvents = Array.from(eventChecks).map(cb => cb.value);
  }

  // Update user
  user.username = newName;
  if (newPass) user.password = newPass;
  user.role = newRole;
  user.campus = newCampus;
  user.sport = null;
  user.assignedSports = assignedSports;
  user.assignedEvents = assignedEvents;

  s('users', users);

  // If editing the currently logged-in user, update currentUser
  if (wasCurrentUser) {
    currentUser.username = user.username;
    if (newPass) currentUser.password = newPass;
    currentUser.role = user.role;
    currentUser.campus = user.campus;
    currentUser.sport = null;
    currentUser.assignedSports = assignedSports;
    currentUser.assignedEvents = assignedEvents;
  }

  closeEditUser();
  populateCampusOptions();
  loadUsers();
  alert('User "' + newName + '" updated successfully!');
}

function populateRegSport() {
  populateCampusOptions();
  refreshCampusOptions();
}

// =================== SMS NOTIFICATION SYSTEM ===================

// Send test SMS to a sports coordinator
function sendTestSMS(username) {
  const users = g('users');
  const user = users.find(item => item.username === username);
  if (!user || !user.phone) return alert('This user has no phone number.');
  const msg = `Hi ${user.username}! This is a test SMS from SportsSys for ${getUserCampus(user)}.`;
  triggerSMS(user.phone, msg);
  addNotification(user.username, user.phone, msg, 'test');
  alert('Test notification logged for ' + user.username + '!');
}

// Trigger SMS — stores in notification log
function triggerSMS(phone, message) {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^+\d]/g, '');
  const notifications = g('smsNotifications') || [];
  notifications.unshift({
    phone: cleanPhone,
    message: message,
    timestamp: new Date().toISOString(),
    sent: true
  });
  if (notifications.length > 50) notifications.length = 50;
  s('smsNotifications', notifications);
  updateNotifBadge();
}

// Add a notification entry
function addNotification(recipientName, phone, message, type) {
  const notifs = g('smsNotifications') || [];
  notifs.unshift({
    recipient: recipientName,
    phone: phone,
    message: message,
    type: type || 'schedule',
    timestamp: new Date().toISOString(),
    read: false
  });
  if (notifs.length > 100) notifs.length = 100;
  s('smsNotifications', notifs);
  updateNotifBadge();
  renderNotifPanel();
}

// Toggle notification panel
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  const isOpen = panel.style.display === 'block';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    renderNotifPanel();
    // Mark all as read
    const notifs = g('smsNotifications') || [];
    notifs.forEach(n => n.read = true);
    s('smsNotifications', notifs);
    updateNotifBadge();
  }
}

// Close notif panel when clicking outside
document.addEventListener('click', function(e) {
  const panel = document.getElementById('notifPanel');
  const bell = document.querySelector('.notif-bell');
  if (!panel || !bell) return;
  if (!panel.contains(e.target) && !bell.contains(e.target)) {
    panel.style.display = 'none';
  }
});

// Render notification panel contents
function renderNotifPanel() {
  const list = document.getElementById('notifList');
  if (!list) return;
  const notifs = g('smsNotifications') || [];
  if (notifs.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted-text);font-size:0.9rem">No notifications yet.<br><span style="font-size:0.8rem">SMS alerts will appear here when matches are scheduled.</span></div>';
    return;
  }
  list.innerHTML = notifs.slice(0, 20).map(n => {
    const dt = new Date(n.timestamp);
    const timeAgo = getTimeAgo(dt);
    const typeIcon = n.type === 'test' ? '🧪' : n.type === 'tomorrow' ? '⏰' : n.type === 'today' ? '🔴' : '📅';
    const typeBg = n.type === 'today' ? 'rgba(231,76,60,0.08)' : n.type === 'tomorrow' ? 'rgba(255,193,7,0.08)' : 'rgba(31,60,136,0.04)';
    return `
      <div style="padding:10px 12px;border-bottom:1px solid rgba(16,24,40,0.04);background:${typeBg};border-radius:6px;margin-bottom:4px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:600;font-size:0.85rem">${typeIcon} ${n.recipient || 'Unknown'}</span>
          <span style="font-size:0.7rem;color:var(--muted-text)">${timeAgo}</span>
        </div>
        <div style="font-size:0.82rem;color:var(--text);line-height:1.4">${n.message}</div>
        <div style="font-size:0.72rem;color:var(--accent);margin-top:4px">📱 ${n.phone || 'N/A'}</div>
      </div>
    `;
  }).join('');
}

// Update badge count
function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const notifs = g('smsNotifications') || [];
  const unread = notifs.filter(n => !n.read).length;
  badge.textContent = unread > 9 ? '9+' : unread;
  badge.style.display = unread > 0 ? 'block' : 'none';
}

// Clear all notifications
function clearNotifications() {
  s('smsNotifications', []);
  updateNotifBadge();
  renderNotifPanel();
}

// Helper: time ago
function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return date.toLocaleDateString();
}

// =================== SCHEDULE SMS ALERTS ===================

// Check upcoming matches and notify sports coordinators.
function checkAndNotifySportsCoordinators() {
  const matches = getVisibleMatches();
  const teams = getVisibleTeams();
  const users = g('users');
  const sentLog = g('smsSentLog') || [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const coordinators = users.filter(u => (u.role === 'admin' || u.role === 'organizer') && u.phone && canAccessCampus(getUserCampus(u)));
  if (coordinators.length === 0) return;

  let newNotifCount = 0;

  matches.forEach(m => {
    if (m.status === 'completed') return;
    if (m.date !== todayStr && m.date !== tomorrowStr) return;

    const teamA = teams.find(t => t.id === m.a);
    const teamB = teams.find(t => t.id === m.b);
    if (!teamA || !teamB) return;
    const matchSport = teamA.sport || m.sport || '';

    coordinators.forEach(org => {
      if (getUserCampus(org) !== getMatchCampus(m)) return;

      // If organizer has assigned sports, only notify for those sports
      if (org.role === 'organizer' && org.assignedSports && org.assignedSports.length > 0) {
        if (!org.assignedSports.includes(matchSport)) return;
      }

      // Check if we already sent for this match+coordinator today
      const logKey = `${m.date}_${m.time}_${m.a}_${m.b}_${org.username}`;
      if (sentLog.includes(logKey)) return;

      // Build SMS message
      const isToday = m.date === todayStr;
      const dayLabel = isToday ? 'TODAY' : 'TOMORROW';
      const matchDate = new Date(m.date + 'T00:00:00');
      const dateFormatted = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeFormatted = formatTime(m.time);

      const msg = `📢 SportsSys Alert!\n\nHi ${org.username}, you have a ${matchSport} match ${dayLabel}!\n\n🏆 ${teamA.name} vs ${teamB.name}\n📅 ${dateFormatted}\n🕐 ${timeFormatted}\n📍 ${m.court || 'TBD'}\n\nPlease prepare accordingly!`;

      // Trigger SMS
      triggerSMS(org.phone, msg);
      addNotification(org.username, org.phone, `[${dayLabel}] ${matchSport}: ${teamA.name} vs ${teamB.name} at ${timeFormatted} — ${m.court || 'TBD'}`, isToday ? 'today' : 'tomorrow');

      // Log as sent
      sentLog.push(logKey);
      newNotifCount++;
    });
  });

  // Save sent log (clear entries older than 3 days)
  s('smsSentLog', sentLog.slice(-500));

  if (newNotifCount > 0) {
    updateNotifBadge();
  }
}

// Notify sports coordinators immediately when a match is scheduled.
function notifySportsCoordinatorsForNewMatch(matchObj) {
  const teams = getVisibleTeams();
  const users = g('users');
  const teamA = teams.find(t => t.id === matchObj.a);
  const teamB = teams.find(t => t.id === matchObj.b);
  if (!teamA || !teamB) return;
  const matchSport = teamA.sport || matchObj.sport || '';

  const coordinators = users.filter(u => (u.role === 'admin' || u.role === 'organizer') && u.phone && getUserCampus(u) === getMatchCampus(matchObj));
  if (coordinators.length === 0) return;

  const matchDate = new Date(matchObj.date + 'T00:00:00');
  const dateFormatted = matchDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeFormatted = formatTime(matchObj.time);

  coordinators.forEach(org => {
    const msg = `📅 New ${matchSport} Match Scheduled!\n\n${teamA.name} vs ${teamB.name}\n📅 ${dateFormatted}\n🕐 ${timeFormatted}\n📍 ${matchObj.court || 'TBD'}\n\n— SportsSys`;

    triggerSMS(org.phone, msg);
    addNotification(org.username, org.phone, `New match: ${teamA.name} vs ${teamB.name} on ${dateFormatted} at ${timeFormatted}`, 'schedule');
  });
}