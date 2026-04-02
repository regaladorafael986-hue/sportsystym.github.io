// Data management module — helper functions
// NOTE: clearAllData() and initDemo() are defined in auth.js (loaded earlier)
// exportAllData() and importAllData() are also in auth.js
// This file only contains generateReport() and generateCertificate()

function generateReport(){
  const teams = getVisibleTeams();
  const players = getVisiblePlayers();
  const tournaments = getVisibleTournaments();
  const matches = getVisibleMatches();
  const completedMatches = matches.filter(m => m.status === 'completed' || m.status === 'finished');
  const activeMatches = matches.filter(m => m.status !== 'completed' && m.status !== 'finished');
  const bigEvents = getVisibleBigEvents();

  // Compute real attendance: unique player names from teams/players that have been in completed matches
  const completedTeamIds = new Set();
  completedMatches.forEach(m => { if(m.a) completedTeamIds.add(m.a); if(m.b) completedTeamIds.add(m.b); });
  const attendingPlayers = players.filter(p => completedTeamIds.has(p.team));
  const attendanceStr = players.length > 0
    ? `${attendingPlayers.length} of ${players.length} registered players participated in completed matches`
    : 'No players registered yet';

  // Sports breakdown
  const sportSet = new Set(teams.map(t => t.sport).filter(Boolean));
  const sportsList = Array.from(sportSet).join(', ') || 'None';

  // Top scorer by wins
  const winCount = {};
  completedMatches.forEach(m => {
    const sa = Number(m.sa)||0, sb = Number(m.sb)||0;
    if(sa > sb && m.a) winCount[m.a] = (winCount[m.a]||0)+1;
    else if(sb > sa && m.b) winCount[m.b] = (winCount[m.b]||0)+1;
  });
  let topTeam = 'N/A', topWins = 0;
  Object.entries(winCount).forEach(([id,w]) => { if(w > topWins){ topWins = w; const t = teams.find(x=>x.id===id); topTeam = t ? t.name : id; }});

  const now = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});

  const report = `
    <div style="background:var(--surface); border:1px solid rgba(16,24,40,0.06); border-radius:12px; padding:24px; margin-top:16px; box-shadow:0 2px 8px rgba(16,24,40,0.02)">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(16,24,40,0.06);padding-bottom:12px;margin-bottom:16px">
        <h4 style="color:var(--primary); margin:0;">📊 System Report</h4>
        <div style="display:flex;gap:8px">
          <span style="font-size:0.82rem;color:var(--muted-text)">Generated: ${now}</span>
          <button class="form-btn secondary-btn" style="padding:4px 12px;font-size:0.78rem;margin:0" onclick="printReport()">🖨️ Print</button>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px">
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Total Teams</div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--primary)">${teams.length}</div>
        </div>
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Total Players</div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--primary)">${players.length}</div>
        </div>
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Tournaments</div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--primary)">${tournaments.length}</div>
        </div>
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Big Events</div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--primary)">${bigEvents.length}</div>
        </div>
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Total Matches</div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--primary)">${matches.length}</div>
        </div>
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Completed</div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--success)">${completedMatches.length}</div>
        </div>
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Active / Scheduled</div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--warning,orange)">${activeMatches.length}</div>
        </div>
        <div style="background:var(--bg); padding:14px; border-radius:8px; border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem; color:var(--muted-text); margin-bottom:4px">Top Team (Wins)</div>
          <div style="font-size:1.1rem; font-weight:bold; color:var(--primary)">${topTeam} ${topWins ? '('+topWins+')' : ''}</div>
        </div>
      </div>
      <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px" class="resp-grid-2">
        <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem;color:var(--muted-text);margin-bottom:4px">Sports</div>
          <div style="font-size:0.95rem;font-weight:600;color:var(--text)">${sportsList}</div>
        </div>
        <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid rgba(16,24,40,0.04)">
          <div style="font-size:0.82rem;color:var(--muted-text);margin-bottom:4px">Attendance</div>
          <div style="font-size:0.95rem;font-weight:600;color:var(--text)">${attendanceStr}</div>
        </div>
      </div>
    </div>
  `;
  const reportOutput = document.getElementById('reportOutput');
  if(reportOutput) reportOutput.innerHTML = report;
}

function printReport() {
  const content = document.getElementById('reportOutput');
  if (!content) return;
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write('<html><head><title>System Report</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#1f2937}h4{color:#1f3c88}div{box-sizing:border-box}</style></head><body>');
  w.document.write(content.innerHTML);
  w.document.write('</body></html>');
  w.document.close();
  w.print();
}

function generateCertificate(){
  const certName = document.getElementById('certName');
  const certType = document.getElementById('certType');
  const certTournamentSel = document.getElementById('certTournament');
  const certOutput = document.getElementById('certOutput');
  const name = certName.value.trim();
  const type = certType.value;
  if(!name || !type) {
    alert('Please fill all required fields.');
    return;
  }
  const tournamentName = certTournamentSel && certTournamentSel.value ? certTournamentSel.value : '';
  const eventLabel = tournamentName || 'the tournament';
  let certTitle = '';
  let certText = '';
  if (type === 'participation') {
    certTitle = 'Certificate of Participation';
    certText = `Awarded to <strong>${name}</strong><br>For participating in ${eventLabel}.`;
  } else if (type === 'winner') {
    certTitle = 'Winner Certificate';
    certText = `Congratulations <strong>${name}</strong><br>Champion of ${eventLabel}!`;
  } else if (type === 'mvp') {
    certTitle = 'MVP Certificate';
    certText = `<strong>${name}</strong> is the Most Valuable Player of ${eventLabel}!`;
  }
  if(certOutput) certOutput.innerHTML = `
    <div id="certPreview" style="margin-top:16px; background:linear-gradient(135deg, var(--surface), var(--bg)); border:2px solid var(--primary); border-radius:12px; padding:32px; text-align:center; box-shadow:0 8px 24px rgba(31,60,136,0.08); position:relative; overflow:hidden">
      <div style="position:absolute; top:-20px; left:-20px; font-size:100px; opacity:0.03; transform:rotate(-15deg)">🏆</div>
      <div style="position:absolute; bottom:-20px; right:-20px; font-size:100px; opacity:0.03; transform:rotate(15deg)">🏅</div>
      <h2 style="color:var(--primary); margin:0 0 16px 0; font-family:serif; font-size:2rem; text-transform:uppercase; letter-spacing:1px">${certTitle}</h2>
      <div style="font-size:1.2rem; line-height:1.6; color:var(--text)">${certText}</div>
      <div style="margin-top:32px; display:flex; justify-content:space-around; align-items:flex-end">
        <div style="border-top:1px solid rgba(16,24,40,0.2); width:120px; padding-top:8px; font-size:0.85rem; color:var(--muted-text)">${new Date().toLocaleDateString()}</div>
        <div style="font-size:3rem; line-height:1">🏅</div>
        <div style="border-top:1px solid rgba(16,24,40,0.2); width:120px; padding-top:8px; font-size:0.85rem; color:var(--muted-text)">Signature</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
      <button class="form-btn" onclick="printCertificate()" style="padding:8px 20px">🖨️ Print Certificate</button>
      <button class="form-btn secondary-btn" onclick="downloadCertificate()" style="padding:8px 20px">📥 Download</button>
    </div>
  `;
  certName.value = '';
  certType.value = 'participation';
}

function printCertificate() {
  const cert = document.getElementById('certPreview');
  if (!cert) return;
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write('<html><head><title>Certificate</title><style>body{font-family:serif;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh}div{box-sizing:border-box}@media print{body{padding:20px}}</style></head><body>');
  w.document.write(cert.outerHTML);
  w.document.write('</body></html>');
  w.document.close();
  w.print();
}

function downloadCertificate() {
  const cert = document.getElementById('certPreview');
  if (!cert) return;
  const html = `<html><head><title>Certificate</title><style>body{font-family:serif;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}div{box-sizing:border-box}</style></head><body>${cert.outerHTML}</body></html>`;
  const blob = new Blob([html], {type: 'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'certificate.html';
  a.click();
  URL.revokeObjectURL(url);
}

function populateCertTournaments() {
  const sel = document.getElementById('certTournament');
  if (!sel) return;
  const tournaments = getVisibleTournaments();
  let html = '<option value="">General</option>';
  tournaments.forEach(t => {
    if (selectedSport && t.sport !== selectedSport) return;
    html += `<option value="${t.name}">${t.name} (${t.sport || ''})</option>`;
  });
  sel.innerHTML = html;
}
