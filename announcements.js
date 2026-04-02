// Announcements module

// Populate Event select for announcements
function populateAnnEventSelect() {
  const sel = document.getElementById('annEvent');
  if (!sel) return;
  const bigEvents = getVisibleBigEvents();
  const tournaments = getVisibleTournaments();
  let html = '<option value="">General (All Events)</option>';
  if (bigEvents.length > 0) {
    html += '<optgroup label="Big Events">';
    bigEvents.forEach(ev => {
      html += `<option value="big_${ev.id}">${ev.name}</option>`;
    });
    html += '</optgroup>';
  }
  const soloTournaments = tournaments.filter(t => !t.bigEventId && (!selectedSport || t.sport === selectedSport));
  if (soloTournaments.length > 0) {
    html += '<optgroup label="Tournaments">';
    soloTournaments.forEach(t => {
      html += `<option value="tour_${t.name}">${t.name} (${t.sport})</option>`;
    });
    html += '</optgroup>';
  }
  sel.innerHTML = html;
}

function postAnn() {
  const annText = document.getElementById('annText');
  if (!annText || !annText.value.trim()) return;

  const eventSel = document.getElementById('annEvent');
  const eventId = eventSel ? eventSel.value : '';

  // Determine event name for display
  let eventName = '';
  if (eventId) {
    const bigEvents = g('bigEvents') || [];
    const tournaments = g('tournaments') || [];
    if (eventId.startsWith('big_')) {
      const ev = bigEvents.find(e => e.id === eventId.replace('big_', ''));
      eventName = ev ? ev.name : eventId;
    } else if (eventId.startsWith('tour_')) {
      eventName = eventId.replace('tour_', '');
    }
  }

  const ann = {
    id: Date.now(),
    user: currentUser ? currentUser.username : 'Unknown',
    role: currentUser ? currentUser.role : 'unknown',
    campus: getCurrentCampus(),
    text: annText.value.trim(),
    time: new Date().toLocaleString(),
    eventId: eventId || '',
    eventName: eventName || ''
  };

  const anns = g('announcements');
  anns.push(ann);
  s('announcements', anns);
  annText.value = '';
  if (eventSel) eventSel.value = '';
  loadAnn();
}

function deleteAnn(index) {
  if (!confirm('Delete this announcement?')) return;
  const anns = g('announcements');
  anns.splice(index, 1);
  s('announcements', anns);
  loadAnn();
}

function loadAnn() {
  let anns = getVisibleAnnouncements();
  const annListEl = document.getElementById('annList');
  const isAdmin = canManageCampusFeatures();

  if (annListEl) {
    if (anns.length === 0) {
      annListEl.innerHTML = '<div style="padding:16px; color:var(--muted-text); text-align:center; background:var(--surface); border-radius:var(--radius); border:1px solid rgba(16,24,40,0.04)">No announcements yet.</div>';
      return;
    }
    annListEl.innerHTML = '<div style="display:flex; flex-direction:column; gap:12px;">' + anns.map((a, i) => `
      <div style="background:var(--surface); border:1px solid rgba(16,24,40,0.06); border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(16,24,40,0.02)">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <strong style="color:var(--primary); font-size:1.05rem">${a.user}</strong>
            ${a.role ? `<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:rgba(31,60,136,0.08);color:var(--primary);font-weight:600">${a.role}</span>` : ''}
            ${a.eventName ? `<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:rgba(40,167,69,0.1);color:var(--success);font-weight:600">\ud83c\udfc6 ${a.eventName}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:0.85rem; color:var(--muted-text)">${a.time}</span>
            ${isAdmin ? `<button onclick="deleteAnn(${i})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--danger);padding:2px 4px" title="Delete">&times;</button>` : ''}
          </div>
        </div>
        <div style="color:var(--text); line-height:1.5;white-space:pre-wrap">${a.text}</div>
      </div>
    `).join('') + '</div>';
  }
}
