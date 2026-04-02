// ─── Messenger-style Chat System ───
let activeChat = null; // username of current chat partner
let chatRefreshTimer = null;

// Get all conversations for current user, grouped by partner
function getConversations() {
  if (!currentUser) return [];
  const msgs = g('messages') || [];
  const me = currentUser.username;
  const convMap = {};

  msgs.forEach(m => {
    if (m.from !== me && m.to !== me) return;
    const partner = m.from === me ? m.to : m.from;
    if (!convMap[partner]) convMap[partner] = { partner, messages: [], lastTime: m.time, unread: 0 };
    convMap[partner].messages.push(m);
    if (new Date(m.time) > new Date(convMap[partner].lastTime)) convMap[partner].lastTime = m.time;
    if (m.to === me && !m.read) convMap[partner].unread++;
  });

  return Object.values(convMap).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
}

// Get user initials for avatar
function chatInitials(username) {
  if (!username) return '?';
  return username.slice(0, 2).toUpperCase();
}

// Get avatar color from username
function chatAvatarColor(username) {
  const colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4'];
  let hash = 0;
  for (let i = 0; i < (username || '').length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Load conversation list in sidebar
function loadConversations() {
  if (!currentUser) return;
  const convs = getConversations();
  const list = document.getElementById('conversationList');
  if (!list) return;

  if (convs.length === 0) {
    list.innerHTML = `<div style="padding:30px 16px;text-align:center;color:var(--muted-text)">
      <div style="font-size:1.8rem;margin-bottom:8px">💭</div>
      <div style="font-size:0.85rem">No conversations yet</div>
    </div>`;
    return;
  }

  list.innerHTML = convs.map(c => {
    const lastMsg = c.messages.sort((a, b) => new Date(b.time) - new Date(a.time))[0];
    const preview = lastMsg ? (lastMsg.from === currentUser.username ? 'You: ' : '') + lastMsg.text.slice(0, 40) + (lastMsg.text.length > 40 ? '...' : '') : '';
    const timeStr = getTimeAgo(new Date(c.lastTime));
    const isActive = activeChat === c.partner;
    const users = g('users') || [];
    const partnerUser = users.find(u => u.username === c.partner);
    const role = partnerUser ? partnerUser.role : '';
    const color = chatAvatarColor(c.partner);

    return `<div class="conv-item${isActive ? ' active' : ''}${c.unread > 0 ? ' unread' : ''}" onclick="openChat('${c.partner}')">
      <div class="conv-avatar" style="background:${color}">${chatInitials(c.partner)}</div>
      <div class="conv-info">
        <div class="conv-top-row">
          <span class="conv-name">${c.partner}</span>
          <span class="conv-time">${timeStr}</span>
        </div>
        <div class="conv-preview">${preview.replace(/</g,'&lt;')}</div>
      </div>
      ${c.unread > 0 ? `<div class="conv-badge">${c.unread > 9 ? '9+' : c.unread}</div>` : ''}
    </div>`;
  }).join('');
}

// Filter conversations by search
function filterConversations(query) {
  const items = document.querySelectorAll('.conv-item');
  const q = (query || '').toLowerCase();
  items.forEach(item => {
    const name = (item.querySelector('.conv-name') || {}).textContent || '';
    item.style.display = name.toLowerCase().includes(q) ? '' : 'none';
  });
}

// Open a chat with a specific user
function openChat(username) {
  if (!currentUser) return;
  activeChat = username;

  // Show chat panel, hide placeholder
  document.getElementById('chatPlaceholder').style.display = 'none';
  const chatView = document.getElementById('activeChatView');
  chatView.style.display = 'flex';

  // Set header
  const users = g('users') || [];
  const partner = users.find(u => u.username === username);
  const color = chatAvatarColor(username);
  document.getElementById('chatAvatar').textContent = chatInitials(username);
  document.getElementById('chatAvatar').style.background = color;
  document.getElementById('chatPartnerName').textContent = username;
  document.getElementById('chatPartnerRole').textContent = partner ? (partner.role.charAt(0).toUpperCase() + partner.role.slice(1)) : '';

  // Mark messages as read
  markConversationRead(username);

  // Render messages
  renderChatMessages(username);

  // Re-render sidebar to update active state + unread
  loadConversations();

  // Focus input
  const input = document.getElementById('chatInput');
  if (input) { input.value = ''; input.style.height = 'auto'; input.focus(); }

  // Auto-refresh chat every 3s
  clearInterval(chatRefreshTimer);
  chatRefreshTimer = setInterval(() => {
    if (activeChat === username) {
      renderChatMessages(username);
      loadConversations();
    }
  }, 3000);
}

// Render chat bubbles for a conversation
function renderChatMessages(username) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  const msgs = g('messages') || [];
  const me = currentUser.username;
  const chatMsgs = msgs.filter(m =>
    (m.from === me && m.to === username) || (m.from === username && m.to === me)
  ).sort((a, b) => new Date(a.time) - new Date(b.time));

  if (chatMsgs.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted-text);font-size:0.88rem">
      <div style="font-size:2.5rem;margin-bottom:8px">👋</div>
      Start a conversation with <strong>${username}</strong>
    </div>`;
    return;
  }

  const color = chatAvatarColor(username);
  let html = '';
  let lastDate = '';

  chatMsgs.forEach(m => {
    const dt = new Date(m.time);
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (dateStr !== lastDate) {
      html += `<div class="chat-date-divider"><span>${dateStr}</span></div>`;
      lastDate = dateStr;
    }

    const isMine = m.from === me;
    const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const broadcastBadge = m.broadcast ? ' <span class="chat-broadcast-tag">📢 Broadcast</span>' : '';

    if (isMine) {
      html += `<div class="chat-row mine">
        <div class="chat-bubble mine">
          <div class="chat-bubble-text">${m.text.replace(/</g,'&lt;').replace(/\n/g,'<br>')}${broadcastBadge}</div>
          <div class="chat-bubble-time">${timeStr}</div>
        </div>
      </div>`;
    } else {
      html += `<div class="chat-row theirs">
        <div class="chat-avatar-sm" style="background:${color}">${chatInitials(username)}</div>
        <div class="chat-bubble theirs">
          <div class="chat-bubble-text">${m.text.replace(/</g,'&lt;').replace(/\n/g,'<br>')}${broadcastBadge}</div>
          <div class="chat-bubble-time">${timeStr}</div>
        </div>
      </div>`;
    }
  });

  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  el.innerHTML = html;
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

// Mark all messages in a conversation as read
function markConversationRead(username) {
  const msgs = g('messages') || [];
  let changed = false;
  msgs.forEach(m => {
    if (m.from === username && m.to === currentUser.username && !m.read) {
      m.read = true;
      changed = true;
    }
  });
  if (changed) {
    s('messages', msgs);
    updateMsgBadge();
  }
}

// Send a message in the active chat
function sendChatMessage() {
  if (!currentUser || !activeChat) return;
  const input = document.getElementById('chatInput');
  const text = (input ? input.value : '').trim();
  if (!text) return;

  const msgs = g('messages') || [];
  msgs.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    from: currentUser.username,
    to: activeChat,
    text: text,
    time: new Date().toISOString(),
    read: false
  });
  s('messages', msgs);

  input.value = '';
  input.style.height = 'auto';
  renderChatMessages(activeChat);
  loadConversations();
  updateMsgBadge();

  // Scroll to bottom
  const el = document.getElementById('chatMessages');
  if (el) el.scrollTop = el.scrollHeight;
}

// Handle Enter key to send (Shift+Enter for newline)
function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

// Auto-grow textarea
function autoGrowChat(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// Open new chat modal
function openNewChat() {
  const users = g('users') || [];
  const others = users.filter(u => currentUser && u.username !== currentUser.username && canAccessCampus(getUserCampus(u)));

  const overlay = document.createElement('div');
  overlay.id = 'newChatOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:0;max-width:380px;width:90vw;box-shadow:0 12px 36px rgba(16,24,40,0.15);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(16,24,40,0.06);display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:700;font-size:1rem">✏️ New Message</div>
        <button class="secondary-btn" style="padding:4px 10px;font-size:0.78rem" onclick="document.getElementById('newChatOverlay').remove()">✕</button>
      </div>
      <div style="padding:12px 20px;border-bottom:1px solid rgba(16,24,40,0.04)">
        <input type="text" id="newChatSearch" placeholder="🔍 Search people..." oninput="filterNewChatList(this.value)" style="width:100%;padding:8px 12px;border:1px solid rgba(16,24,40,0.1);border-radius:8px;font-size:0.88rem;background:var(--bg)">
      </div>
      <div id="newChatUserList" style="max-height:300px;overflow-y:auto;padding:8px 12px">
        ${others.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--muted-text)">No other users found</div>' :
          others.map(u => {
            const color = chatAvatarColor(u.username);
            return `<div class="new-chat-user" data-name="${u.username.toLowerCase()}" onclick="startChatWith('${u.username}')">
              <div class="conv-avatar" style="background:${color};width:36px;height:36px;font-size:0.75rem">${chatInitials(u.username)}</div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:0.88rem">${u.username}</div>
                <div style="font-size:0.72rem;color:var(--muted-text)">${u.role}</div>
              </div>
            </div>`;
          }).join('')
        }
      </div>
      <div style="padding:12px 20px;border-top:1px solid rgba(16,24,40,0.04)">
        <div style="font-size:0.78rem;color:var(--muted-text);margin-bottom:8px">Or broadcast to all users:</div>
        <button class="form-btn accent-btn" style="width:100%;margin:0;padding:8px" onclick="openBroadcast()">📢 Broadcast Message</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => { const s = document.getElementById('newChatSearch'); if (s) s.focus(); }, 100);
}

// Filter user list in new chat modal
function filterNewChatList(query) {
  const q = (query || '').toLowerCase();
  document.querySelectorAll('.new-chat-user').forEach(el => {
    const name = el.getAttribute('data-name') || '';
    el.style.display = name.includes(q) ? '' : 'none';
  });
}

// Start chat with a specific user
function startChatWith(username) {
  const overlay = document.getElementById('newChatOverlay');
  if (overlay) overlay.remove();
  openChat(username);
}

// Broadcast modal
function openBroadcast() {
  const overlay = document.getElementById('newChatOverlay');
  if (overlay) overlay.remove();

  const bOverlay = document.createElement('div');
  bOverlay.id = 'broadcastOverlay';
  bOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
  bOverlay.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:24px;max-width:420px;width:90vw;box-shadow:0 12px 36px rgba(16,24,40,0.15)">
      <div style="font-weight:700;font-size:1.05rem;margin-bottom:12px">📢 Broadcast Message</div>
      <p style="font-size:0.82rem;color:var(--muted-text);margin:0 0 12px">This will send a message to all users.</p>
      <textarea id="broadcastText" rows="4" placeholder="Type your broadcast message..." style="width:100%;resize:vertical;font-family:inherit;padding:10px;border:1px solid rgba(16,24,40,0.1);border-radius:8px;font-size:0.88rem"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
        <button class="form-btn secondary-btn" style="margin:0" onclick="document.getElementById('broadcastOverlay').remove()">Cancel</button>
        <button class="form-btn" style="margin:0" onclick="sendBroadcast()">📩 Send Broadcast</button>
      </div>
    </div>
  `;
  document.body.appendChild(bOverlay);
  bOverlay.addEventListener('click', e => { if (e.target === bOverlay) bOverlay.remove(); });
}

// Send broadcast to all users
function sendBroadcast() {
  if (!currentUser) return;
  const text = (document.getElementById('broadcastText') || {}).value;
  if (!text || !text.trim()) return alert('Please enter a message.');

  const msgs = g('messages') || [];
  const users = g('users') || [];
  const timestamp = new Date().toISOString();

  users.forEach(u => {
    if (u.username !== currentUser.username && canAccessCampus(getUserCampus(u))) {
      msgs.push({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        from: currentUser.username,
        to: u.username,
        text: text.trim(),
        time: timestamp,
        read: false,
        broadcast: true
      });
    }
  });

  s('messages', msgs);
  const overlay = document.getElementById('broadcastOverlay');
  if (overlay) overlay.remove();
  loadConversations();
  updateMsgBadge();
  alert('Broadcast sent to all users!');
}

// Delete entire conversation
function deleteConversation() {
  if (!activeChat || !currentUser) return;
  if (!confirm(`Delete all messages with ${activeChat}?`)) return;
  let msgs = g('messages') || [];
  const me = currentUser.username;
  msgs = msgs.filter(m => !((m.from === me && m.to === activeChat) || (m.from === activeChat && m.to === me)));
  s('messages', msgs);
  activeChat = null;
  clearInterval(chatRefreshTimer);
  document.getElementById('activeChatView').style.display = 'none';
  document.getElementById('chatPlaceholder').style.display = '';
  loadConversations();
  updateMsgBadge();
}

// Update unread badge on sidebar
function updateMsgBadge() {
  if (!currentUser) return;
  const msgs = g('messages') || [];
  const unread = msgs.filter(m => m.to === currentUser.username && !m.read).length;
  const badge = document.getElementById('msgSidebarBadge');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread > 0 ? 'inline-block' : 'none';
  }
}

// Keep old function names as aliases so nothing breaks
function loadMessages() { loadConversations(); }
function populateMsgRecipients() { /* no-op, replaced by new chat modal */ }

// Logo upload functions
function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 204800) { alert('Logo must be under 200KB.'); event.target.value = ''; return; }
  if (!file.type.startsWith('image/')) { alert('Please select an image file.'); event.target.value = ''; return; }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    localStorage.setItem('systemLogo', base64);
    applySystemLogo();
    alert('Logo updated!');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeSystemLogo() {
  localStorage.removeItem('systemLogo');
  applySystemLogo();
}

function applySystemLogo() {
  const logo = localStorage.getItem('systemLogo');
  
  // Sidebar logo
  const sidebarLogo = document.querySelector('.sidebar-logo');
  if (sidebarLogo) {
    if (logo) {
      sidebarLogo.innerHTML = `<img src="${logo}" class="sidebar-logo-img" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;margin:0">`;
    } else {
      sidebarLogo.innerHTML = '🏆';
    }
  }
  
  // Login logo
  const loginLogo = document.querySelector('.brand .logo');
  if (loginLogo) {
    if (logo) {
      loginLogo.innerHTML = `<img src="${logo}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    } else {
      loginLogo.innerHTML = '🏆';
    }
  }
  
  // Settings preview
  const preview = document.getElementById('logoPreview');
  if (preview) {
    if (logo) {
      preview.innerHTML = `<img src="${logo}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    } else {
      preview.innerHTML = '🏆';
    }
  }
}

// Public viewer link
function openPublicViewer() {
  const baseUrl = window.location.href.replace(/\/[^\/]*$/, '/viewer.html');
  const bigEvents = g('bigEvents') || [];
  const tournaments = g('tournaments') || [];

  // Build event/tournament options
  let eventOpts = '<option value="">All Events (full view)</option>';
  bigEvents.forEach(ev => {
    eventOpts += `<option value="event_${ev.id}">${ev.name}</option>`;
  });
  // Add standalone tournaments not in any big event
  tournaments.forEach((t, i) => {
    if (!t.bigEventId) eventOpts += `<option value="tournament_${i}">${t.name} (${t.sport})</option>`;
  });

  // Show a modal with the link
  const overlay = document.createElement('div');
  overlay.id = 'publicLinkOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:24px;max-width:560px;width:90vw;box-shadow:0 12px 36px rgba(16,24,40,0.12);text-align:center">
      <div style="font-size:2rem;margin-bottom:8px">🔗</div>
      <h3 style="margin:0 0 8px;color:var(--text)">Generate Public Viewer Link</h3>
      <p style="font-size:0.85rem;color:var(--muted-text);margin:0 0 14px">Share this link with spectators to view brackets, live scores, schedules, and standings — no login required.</p>
      <div style="margin-bottom:14px;text-align:left">
        <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;color:var(--text)">Select Event / Tournament:</label>
        <select id="publicLinkEventSelect" onchange="updatePublicLink()" style="width:100%;padding:10px 14px;border:1px solid rgba(16,24,40,0.12);border-radius:8px;font-size:0.9rem;background:var(--bg);color:var(--text)">
          ${eventOpts}
        </select>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:16px">
        <input id="publicLinkInput" value="${baseUrl}" readonly style="flex:1;padding:10px;border:1px solid rgba(16,24,40,0.12);border-radius:8px;font-size:0.85rem;background:var(--bg);color:var(--text)" onclick="this.select()">
        <button class="form-btn" style="margin:0;padding:10px 16px;white-space:nowrap" onclick="copyPublicLink()">📋 Copy</button>
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="form-btn accent-btn" style="margin:0;padding:8px 20px" onclick="window.open(document.getElementById('publicLinkInput').value,'_blank')">🌐 Open Viewer</button>
        <button class="form-btn secondary-btn" style="margin:0;padding:8px 20px" onclick="document.getElementById('publicLinkOverlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

function updatePublicLink() {
  const sel = document.getElementById('publicLinkEventSelect');
  const input = document.getElementById('publicLinkInput');
  if (!sel || !input) return;
  const baseUrl = window.location.href.replace(/\/[^\/]*$/, '/viewer.html');
  const val = sel.value;
  if (!val) {
    input.value = baseUrl;
  } else {
    input.value = baseUrl + '?' + val;
  }
}

function copyPublicLink() {
  const input = document.getElementById('publicLinkInput');
  if (!input) return;
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = input.nextElementSibling;
    if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); }
  }).catch(() => {
    document.execCommand('copy');
  });
}
