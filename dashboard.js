// Dashboard module
function loadDash() {
  const teams = getVisibleTeams().filter(t => !selectedSport || t.sport == selectedSport);
  const players = getVisiblePlayers().filter(p => {
    if (p.sport) return !selectedSport || p.sport == selectedSport;
    const team = g('teams').find(t => t.id == p.team);
    return !selectedSport || (team && team.sport == selectedSport);
  });
  const tournaments = getVisibleTournaments().filter(t => {
    if (selectedSport && t.sport !== selectedSport) return false;
    if (typeof organizerCanAccessTournament === 'function' && !organizerCanAccessTournament(t)) return false;
    return true;
  }).length;
  const matches = getVisibleMatches().filter(m => {
    const ta = g('teams').find(t => t.id == m.a);
    const tb = g('teams').find(t => t.id == m.b);
    return !selectedSport || (ta && tb && ta.sport == selectedSport && tb.sport == selectedSport);
  }).length;

  document.getElementById('dTour').innerText = tournaments;
  document.getElementById('dTeam').innerText = teams.length;
  document.getElementById('dPlayer').innerText = players.length;
  document.getElementById('dMatch').innerText = matches;
  
  loadUpcomingMatches();
  renderIntramuralsChart();
  initDashCarousel();
  setupOrganizerDashboardBracketPreview();
}

function setupOrganizerDashboardBracketPreview() {
  const searchEl = document.getElementById('overviewSearch');
  const selectEl = document.getElementById('overviewBracketSelect');
  const previewEl = document.getElementById('overviewBracketPreview');
  if (!previewEl) return;

  const isOrganizer = !!(currentUser && currentUser.role === 'organizer');

  // Default UI for admin/coordinator: keep manual search + dropdown preview.
  if (!isOrganizer) {
    if (searchEl && searchEl.parentElement) searchEl.parentElement.style.display = '';
    if (selectEl) selectEl.style.display = '';
    return;
  }

  // Organizer: remove manual picker and auto-show bracket for assigned sport view.
  if (searchEl && searchEl.parentElement) searchEl.parentElement.style.display = 'none';
  if (selectEl) selectEl.style.display = 'none';

  const tournaments = getVisibleTournaments();
  const candidates = tournaments
    .map(function(t, i) { return { t: t, i: i }; })
    .filter(function(item) {
      const t = item.t;
      if (selectedSport && t.sport !== selectedSport) return false;
      if (typeof organizerCanAccessTournament === 'function' && !organizerCanAccessTournament(t)) return false;
      return !!(t.bracket || t.roundRobin || t.groupStage);
    });

  if (candidates.length === 0) {
    previewEl.innerHTML = '<div style="color:var(--muted-text);padding:12px">No bracket available yet for your assigned sport.</div>';
    return;
  }

  const target = candidates[0];
  if (selectEl) selectEl.value = String(target.i);
  if (typeof renderBracketPreview === 'function') {
    renderBracketPreview(target.i);
  }
}

function loadUpcomingMatches() {
  const allTeams = getVisibleTeams();
  const today = new Date().toISOString().split('T')[0];
  
  // Get matches filtered by sport and sort by date/time
  let matches = getVisibleMatches().filter(m => {
    const ta = allTeams.find(t => t.id == m.a);
    const tb = allTeams.find(t => t.id == m.b);
    if (!ta || !tb) return false;
    if (selectedSport && (ta.sport !== selectedSport || tb.sport !== selectedSport)) return false;
    return m.status !== 'completed' && m.date >= today;
  });
  
  matches.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '').localeCompare(b.time || '');
  });
  
  matches = matches.slice(0, 10);
  
  const container = document.getElementById('upcomingMatchesList');
  const dotsContainer = document.getElementById('dashCarouselDots');
  if (!container) return;
  
  if (matches.length === 0) {
    container.innerHTML = '<div class="carousel-slide"><div style="text-align:center; padding:40px 20px; color:var(--muted-text); width:100%; font-size:0.9rem;">No upcoming matches scheduled</div></div>';
    if (dotsContainer) dotsContainer.innerHTML = '';
    return;
  }
  
  container.innerHTML = matches.map(function(m) {
    var teamA = allTeams.find(function(t){ return t.id == m.a; });
    var teamB = allTeams.find(function(t){ return t.id == m.b; });
    var teamAName = teamA ? teamA.name.toUpperCase() : 'TBD';
    var teamBName = teamB ? teamB.name.toUpperCase() : 'TBD';
    var sport = teamA ? teamA.sport : '';
    
    var matchDate = new Date(m.date + 'T00:00:00');
    var dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    var timeStr = formatTime(m.time);
    var endTimeStr = m.endTime ? formatTime(m.endTime) : '';
    var isToday = m.date === today;
    var isLive = m.status === 'live';
    var statusColor = isLive ? 'var(--danger)' : (isToday ? 'var(--success)' : 'var(--primary)');
    var statusText = isLive ? 'LIVE' : (isToday ? 'TODAY' : 'UPCOMING');
    var borderColor = isLive ? 'var(--danger)' : (isToday ? 'var(--success)' : 'var(--primary)');
    
    var teamALogo = teamA && teamA.logo ? '<img src="' + teamA.logo + '" style="width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid rgba(0,0,0,0.08);margin-bottom:4px">' : '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1rem;margin-bottom:4px">' + teamAName.charAt(0) + '</div>';
    var teamBLogo = teamB && teamB.logo ? '<img src="' + teamB.logo + '" style="width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid rgba(0,0,0,0.08);margin-bottom:4px">' : '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1rem;margin-bottom:4px">' + teamBName.charAt(0) + '</div>';

    return '<div class="carousel-slide">' +
      '<div style="background:var(--surface); border:1px solid rgba(16,24,40,0.08); border-left:4px solid ' + borderColor + '; border-radius:12px; overflow:hidden;">' +
        '<!-- Header -->' +
        '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:rgba(16,24,40,0.02); border-bottom:1px solid rgba(16,24,40,0.04);">' +
          '<div style="display:flex; align-items:center; gap:6px; font-size:0.78rem; color:var(--muted-text); font-weight:600;">' +
            '<span>📅 ' + dateStr + '</span>' +
            '<span style="opacity:0.4">•</span>' +
            '<span>🕐 ' + timeStr + (endTimeStr ? ' - ' + endTimeStr : '') + '</span>' +
            '<span style="opacity:0.4">•</span>' +
            '<span>📍 ' + (m.court || 'TBD') + '</span>' +
          '</div>' +
          '<span style="font-size:0.7rem; padding:2px 10px; border-radius:20px; background:' + statusColor + '; color:#fff; font-weight:700; letter-spacing:0.5px;">' + statusText + '</span>' +
        '</div>' +
        '<!-- Body -->' +
        '<div style="padding:14px 16px; display:flex; align-items:center; justify-content:center; gap:16px;">' +
          '<div style="flex:1; text-align:center; display:flex; flex-direction:column; align-items:center;">' +
            teamALogo +
            '<div style="font-weight:800; font-size:1.15rem; color:var(--text); letter-spacing:0.5px;">' + teamAName + '</div>' +
          '</div>' +
          '<div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0;">' +
            '<div style="background:linear-gradient(135deg, var(--primary), var(--accent)); color:#fff; padding:6px 18px; border-radius:12px; font-weight:800; font-size:0.9rem; min-width:60px; text-align:center;">' + m.sa + ' - ' + m.sb + '</div>' +
          '</div>' +
          '<div style="flex:1; text-align:center; display:flex; flex-direction:column; align-items:center;">' +
            teamBLogo +
            '<div style="font-weight:800; font-size:1.15rem; color:var(--text); letter-spacing:0.5px;">' + teamBName + '</div>' +
          '</div>' +
        '</div>' +
        '<!-- Footer -->' +
        '<div style="padding:4px 14px 8px; display:flex; justify-content:center; gap:10px; align-items:center; font-size:0.78rem; color:var(--muted-text);">' +
          (sport ? '<span style="padding:2px 10px;border-radius:14px;background:rgba(31,60,136,0.08);color:var(--primary);font-weight:600;font-size:0.73rem;">🏅 ' + sport + '</span>' : '') +
          '<span>Tournament: <strong>' + (m.tournament || 'Manual') + '</strong></span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // Build dots
  if (dotsContainer) {
    dotsContainer.innerHTML = matches.map(function(_, i) {
      return '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" onclick="dashCarouselGoTo(' + i + ')"></button>';
    }).join('');
  }
}

// ===== INTRAMURALS CHART CAROUSEL =====
var chartCarouselData = []; // array of { name, standings }
var chartCarouselIdx = 0;

function renderIntramuralsChart() {
  // Build per-Big-Event data
  const bigEvents = getVisibleBigEvents();
  chartCarouselData = [];

  bigEvents.forEach(ev => {
    const st = computeChartUnitStandingsForEvent(ev.id);
    if (st.length > 0) {
      chartCarouselData.push({ name: ev.name, standings: st });
    }
  });

  if (chartCarouselData.length === 0) {
    const container = document.getElementById('intramuralsChartContainer');
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted-text)">No intramurals data yet.<br>Create a Big Event to see standings.</div>';
    const legendDiv = document.getElementById('intramuralsChartLegend');
    if (legendDiv) legendDiv.innerHTML = '';
    const titleEl = document.getElementById('chartTitle');
    if (titleEl) titleEl.textContent = 'Intramurals Unit Standings';
    const indEl = document.getElementById('chartIndicator');
    if (indEl) indEl.textContent = '0/0';
    var btns = document.querySelectorAll('#chartPrevBtn, #chartNextBtn');
    btns.forEach(function(b){ b.style.display = 'none'; });
    return;
  }

  // Show nav buttons
  var btns = document.querySelectorAll('#chartPrevBtn, #chartNextBtn');
  btns.forEach(function(b){ b.style.display = chartCarouselData.length > 1 ? '' : 'none'; });

  chartCarouselIdx = 0;
  drawChartSlide();
}

function chartCarouselNav(dir) {
  if (chartCarouselData.length <= 1) return;
  chartCarouselIdx = (chartCarouselIdx + dir + chartCarouselData.length) % chartCarouselData.length;
  drawChartSlide();
}

function drawChartSlide() {
  var data = chartCarouselData[chartCarouselIdx];
  if (!data) return;

  // Update title & indicator
  var titleEl = document.getElementById('chartTitle');
  if (titleEl) titleEl.textContent = data.name + ' — Unit Standings';
  var indEl = document.getElementById('chartIndicator');
  if (indEl) indEl.textContent = (chartCarouselIdx + 1) + '/' + chartCarouselData.length;

  // Ensure canvas exists
  var container = document.getElementById('intramuralsChartContainer');
  if (!container) return;
  var canvas = document.getElementById('intramuralsChart');
  if (!canvas) {
    container.innerHTML = '<canvas id="intramuralsChart" style="width:100%;height:340px"></canvas>';
    canvas = document.getElementById('intramuralsChart');
  }
  var legendDiv = document.getElementById('intramuralsChartLegend');

  var standings = data.standings;
  standings.sort(function(a, b) { return b.points - a.points; });

  var ctx = canvas.getContext('2d');
  var width = canvas.parentElement.clientWidth - 10;
  var height = 340;
  canvas.width = width;
  canvas.height = height;

  var padding = { top: 28, right: 20, bottom: 75, left: 50 };
  var chartWidth = width - padding.left - padding.right;
  var chartHeight = height - padding.top - padding.bottom;
  var barWidth = Math.min(70, Math.max(35, (chartWidth / standings.length) - 16));
  var barGap = (chartWidth - (barWidth * standings.length)) / (standings.length + 1);

  ctx.clearRect(0, 0, width, height);

  var maxPoints = Math.max.apply(null, standings.map(function(s) { return s.points; }).concat([1]));
  var colors = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6'];

  // Detect dark mode
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var gridColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
  var textColor = isDark ? '#d1d5db' : '#374151';
  var mutedColor = isDark ? '#9ca3af' : '#6b7280';

  // Draw grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  var gridLines = 5;
  for (var i = 0; i <= gridLines; i++) {
    var y = padding.top + (chartHeight / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    var val = Math.round(maxPoints - (maxPoints / gridLines) * i);
    ctx.fillStyle = mutedColor;
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val.toString(), padding.left - 12, y + 5);
  }

  // Draw bars
  standings.forEach(function(unit, idx) {
    var barHeight = (unit.points / maxPoints) * chartHeight;
    var x = padding.left + barGap + idx * (barWidth + barGap);
    var y2 = padding.top + chartHeight - barHeight;

    var gradient = ctx.createLinearGradient(x, y2, x, y2 + barHeight);
    var color = colors[idx % colors.length];
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '99');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y2, barWidth, barHeight, [6, 6, 0, 0]);
    ctx.fill();

    // Value on top
    ctx.fillStyle = textColor;
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unit.points.toString(), x + barWidth / 2, y2 - 10);

    // Unit name below bar
    ctx.save();
    ctx.translate(x + barWidth / 2, height - padding.bottom + 14);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = textColor;
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    var displayName = unit.unit.length > 18 ? unit.unit.substring(0, 17) + '…' : unit.unit;
    ctx.fillText(displayName, 0, 0);
    ctx.restore();
  });

  // Legend
  if (legendDiv) {
    legendDiv.innerHTML = standings.map(function(unit, idx) {
      var color = colors[idx % colors.length];
      var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
      return '<div style="display:inline-flex;align-items:center;gap:8px;margin-right:16px;margin-bottom:8px;font-size:0.92rem;">' +
        '<span style="width:14px;height:14px;background:' + color + ';border-radius:3px;flex-shrink:0"></span>' +
        '<span>' + medal + ' ' + unit.unit + ': <strong>' + unit.wins + 'W-' + unit.losses + 'L (' + unit.points + 'pts)</strong></span>' +
      '</div>';
    }).join('');
  }
}

// Compute unit standings for chart — for a specific Big Event
function computeChartUnitStandingsForEvent(bigEventId) {
  var tournaments = getVisibleTournaments();
  var allTeams = getVisibleTeams();

  var evTournaments = tournaments.filter(function(t) { return t.bigEventId === bigEventId; });
  if (evTournaments.length === 0) return [];

  var teamIdSet = new Set();
  evTournaments.forEach(function(t) {
    getTeamIdsFromTournament(t).forEach(function(id) { teamIdSet.add(id); });
  });

  var teamStandings = {};
  allTeams.filter(function(t) { return teamIdSet.has(t.id); }).forEach(function(team) {
    teamStandings[team.id] = { name: team.name, group: team.group || null, wins: 0, losses: 0, points: 0 };
  });

  evTournaments.forEach(function(t) { processTournamentStandings(t, teamStandings); });

  var unitMap = {};
  Object.values(teamStandings).forEach(function(team) {
    var unit = team.group;
    if (!unit) return;
    if (!unitMap[unit]) unitMap[unit] = { unit: unit, wins: 0, losses: 0, points: 0 };
    unitMap[unit].wins += team.wins;
    unitMap[unit].losses += team.losses;
    unitMap[unit].points += team.points;
  });

  return Object.values(unitMap).filter(function(u) { return u.wins > 0 || u.losses > 0; });
}

/* ===== DASHBOARD CAROUSEL (Upcoming Matches) ===== */
var dashCarouselIndex = 0;
var dashCarouselTimer = null;
var dashCarouselProgress = null;
var DASH_CAROUSEL_INTERVAL = 4000; // 4 seconds per match

function getCarouselSlides() {
  return document.querySelectorAll('#upcomingMatchesList .carousel-slide');
}

function initDashCarousel() {
  dashCarouselIndex = 0;
  var slides = getCarouselSlides();
  if (slides.length <= 1) {
    // Hide arrows if 0 or 1 slide
    var arrows = document.querySelectorAll('.dash-carousel .carousel-arrow');
    arrows.forEach(function(a){ a.style.display = 'none'; });
    return;
  } else {
    var arrows = document.querySelectorAll('.dash-carousel .carousel-arrow');
    arrows.forEach(function(a){ a.style.display = ''; });
  }
  updateCarouselPosition(false);
  startDashCarouselAuto();

  var carousel = document.querySelector('.dash-carousel');
  if (carousel) {
    carousel.onmouseenter = stopDashCarouselAuto;
    carousel.onmouseleave = startDashCarouselAuto;
  }
}

function dashCarouselNav(dir) {
  var total = getCarouselSlides().length;
  if (total <= 1) return;
  dashCarouselIndex = (dashCarouselIndex + dir + total) % total;
  updateCarouselPosition(true);
  restartDashCarouselAuto();
}

function dashCarouselGoTo(idx) {
  dashCarouselIndex = idx;
  updateCarouselPosition(true);
  restartDashCarouselAuto();
}

function updateCarouselPosition(animate) {
  var track = document.getElementById('dashCarouselTrack');
  if (!track) return;
  if (!animate) track.style.transition = 'none';
  else track.style.transition = 'transform 0.5s cubic-bezier(0.4,0,0.2,1)';
  track.style.transform = 'translateX(-' + (dashCarouselIndex * 100) + '%)';

  var dots = document.querySelectorAll('#dashCarouselDots .carousel-dot');
  dots.forEach(function(d, i) { d.classList.toggle('active', i === dashCarouselIndex); });

  resetCarouselProgress();
}

function startDashCarouselAuto() {
  stopDashCarouselAuto();
  var total = getCarouselSlides().length;
  if (total <= 1) return;
  dashCarouselTimer = setInterval(function() {
    var total = getCarouselSlides().length;
    dashCarouselIndex = (dashCarouselIndex + 1) % total;
    updateCarouselPosition(true);
  }, DASH_CAROUSEL_INTERVAL);
  resetCarouselProgress();
}

function stopDashCarouselAuto() {
  if (dashCarouselTimer) { clearInterval(dashCarouselTimer); dashCarouselTimer = null; }
  if (dashCarouselProgress) { clearInterval(dashCarouselProgress); dashCarouselProgress = null; }
  var bar = document.querySelector('.carousel-progress-bar');
  if (bar) bar.style.width = '0%';
}

function restartDashCarouselAuto() {
  stopDashCarouselAuto();
  startDashCarouselAuto();
}

function resetCarouselProgress() {
  if (dashCarouselProgress) clearInterval(dashCarouselProgress);
  var bar = document.querySelector('.carousel-progress-bar');
  if (!bar) return;
  bar.style.width = '0%';
  var elapsed = 0;
  var step = 50;
  dashCarouselProgress = setInterval(function() {
    elapsed += step;
    bar.style.width = Math.min((elapsed / DASH_CAROUSEL_INTERVAL) * 100, 100) + '%';
    if (elapsed >= DASH_CAROUSEL_INTERVAL) clearInterval(dashCarouselProgress);
  }, step);
}
