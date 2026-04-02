<?php
/**
 * Main API endpoint for Sports Management System
 * Handles: load-all, get (by key), save (by key), login, setup
 * 
 * All data is stored in MySQL and served as JSON arrays
 * to match the localStorage g()/s() pattern exactly.
 */
define('API_ACCESS', true);
require_once __DIR__ . '/db.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

try {
    switch ($action) {
        case 'setup':
            handleSetup();
            break;
        case 'load':
            handleLoadAll();
            break;
        case 'get':
            handleGet();
            break;
        case 'save':
            handleSave();
            break;
        case 'login':
            handleLogin();
            break;
        case 'clear':
            handleClear();
            break;
        default:
            jsonError('Unknown action: ' . $action);
    }
} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    jsonError($e->getMessage(), 500);
}

// ============================================
// SETUP: Auto-create database and tables
// ============================================
function handleSetup() {
    try {
        // First connect without selecting a database
        $dsn = 'mysql:host=' . DB_HOST . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);
        
        // Read and execute the SQL file
        $sqlFile = __DIR__ . '/../database/sports_management.sql';
        if (!file_exists($sqlFile)) {
            jsonError('SQL schema file not found at: ' . $sqlFile);
        }
        
        $sql = file_get_contents($sqlFile);
        // Split by semicolons, filter empty
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            function($s) { return !empty($s) && $s !== ''; }
        );
        
        foreach ($statements as $stmt) {
            if (!empty(trim($stmt))) {
                $pdo->exec($stmt);
            }
        }
        
        jsonResponse(['success' => true, 'message' => 'Database setup complete']);
    } catch (PDOException $e) {
        jsonError('Setup failed: ' . $e->getMessage(), 500);
    }
}

// ============================================
// LOAD ALL: Returns all data keys at once
// ============================================
function handleLoadAll() {
    $db = getDB();
    $data = [];
    
    // Users
    $data['users'] = loadUsers($db);
    
    // Teams
    $data['teams'] = loadTeams($db);
    
    // Players
    $data['players'] = loadPlayers($db);
    
    // Tournaments
    $data['tournaments'] = loadTournaments($db);
    
    // Matches
    $data['matches'] = loadMatches($db);
    
    // Announcements
    $data['announcements'] = loadAnnouncements($db);
    
    // Big Events
    $data['bigEvents'] = loadBigEvents($db);
    
    // Campuses
    $data['campuses'] = loadCampuses($db);
    
    // Messages
    $data['messages'] = loadMessages($db);
    
    // SMS Notifications
    $data['smsNotifications'] = loadSmsNotifications($db);
    
    // SMS Sent Log
    $data['smsSentLog'] = loadSmsSentLog($db);
    
    // Settings
    $data['systemLogo'] = getSettingRaw($db, 'systemLogo');
    $data['darkMode'] = getSettingRaw($db, 'darkMode');
    $data['customSports'] = getSettingRaw($db, 'customSports') ?: new \stdClass();
    
    jsonResponse(['success' => true, 'data' => $data]);
}

// ============================================
// GET: Load single key
// ============================================
function handleGet() {
    $key = $_GET['key'] ?? '';
    if (!$key) jsonError('Missing key parameter');
    
    $db = getDB();
    $result = loadByKey($db, $key);
    jsonResponse(['success' => true, 'data' => $result]);
}

// ============================================
// SAVE: Save data for a specific key
// ============================================
function handleSave() {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input || !isset($input['key'])) {
        jsonError('Missing key in request body. Raw input length: ' . strlen($raw));
    }
    
    $key = $input['key'];
    $value = $input['value'] ?? [];
    
    $db = getDB();
    $db->beginTransaction();
    try {
        saveByKey($db, $key, $value);
        $db->commit();
        jsonResponse(['success' => true, 'key' => $key]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Save failed for key [' . $key . ']: ' . $e->getMessage(), 500);
    }
}

// ============================================
// LOGIN: Authenticate user
// ============================================
function handleLogin() {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');
    
    if (!$username || !$password) {
        jsonError('Username and password required');
    }
    
    $db = getDB();
    $stmt = $db->prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    $stmt->execute([$username, $password]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonError('Invalid login', 401);
    }
    
    // Return user object matching the JS format
    jsonResponse([
        'success' => true,
        'user' => [
            'username' => $user['username'],
            'password' => $user['password'],
            'role' => $user['role'],
            'campus' => $user['campus'] ?? '',
            'sport' => $user['sport'],
            'assignedSports' => json_decode($user['assigned_sports'] ?? '[]', true) ?: [],
            'assignedEvents' => json_decode($user['assigned_events'] ?? '[]', true) ?: []
        ]
    ]);
}

// ============================================
// CLEAR: Reset all data
// ============================================
function handleClear() {
    $db = getDB();
    $tables = ['teams', 'players', 'tournaments', 'matches_table', 
               'announcements', 'big_events', 'messages', 
               'sms_notifications', 'sms_sent_log'];
    
    foreach ($tables as $table) {
        $db->exec("DELETE FROM `$table`");
    }
    
    // Reset users to defaults
    $db->exec("DELETE FROM users");
    $db->exec("DELETE FROM campuses");
    $db->exec("DELETE FROM settings");
    
    // Re-insert defaults
    $db->exec("INSERT INTO campuses (name) VALUES ('Main Campus')");
    $db->exec("INSERT INTO users (username, password, role, campus) VALUES 
        ('admin', 'admin123', 'admin', '')");
    $db->exec("INSERT INTO settings (setting_key, setting_value) VALUES ('darkMode', '\"light\"')");
    
    jsonResponse(['success' => true, 'message' => 'All data cleared']);
}

// ============================================
// DATA LOADERS — Convert DB rows to JS format
// ============================================

function loadByKey($db, $key) {
    switch ($key) {
        case 'users': return loadUsers($db);
        case 'teams': return loadTeams($db);
        case 'players': return loadPlayers($db);
        case 'tournaments': return loadTournaments($db);
        case 'matches': return loadMatches($db);
        case 'announcements': return loadAnnouncements($db);
        case 'bigEvents': return loadBigEvents($db);
        case 'campuses': return loadCampuses($db);
        case 'messages': return loadMessages($db);
        case 'smsNotifications': return loadSmsNotifications($db);
        case 'smsSentLog': return loadSmsSentLog($db);
        case 'systemLogo': return getSettingRaw($db, 'systemLogo');
        case 'darkMode': return getSettingRaw($db, 'darkMode');
        case 'customSports': return getSettingRaw($db, 'customSports') ?: new \stdClass();
        default: return [];
    }
}

function loadUsers($db) {
    $rows = $db->query('SELECT * FROM users ORDER BY id')->fetchAll();
    return array_map(function($r) {
        return [
            'username' => $r['username'],
            'password' => $r['password'],
            'role' => $r['role'],
            'campus' => $r['campus'] ?? '',
            'sport' => $r['sport'],
            'assignedSports' => json_decode($r['assigned_sports'] ?? '[]', true) ?: [],
            'assignedEvents' => json_decode($r['assigned_events'] ?? '[]', true) ?: []
        ];
    }, $rows);
}

function loadTeams($db) {
    $rows = $db->query('SELECT * FROM teams ORDER BY id')->fetchAll();
    return array_map(function($r) {
        $team = [
            'id' => $r['team_id'],
            'name' => $r['name'],
            'sport' => $r['sport'],
            'campus' => $r['campus'],
            'group' => $r['team_group'] ?? ''
        ];
        if ($r['logo']) $team['logo'] = $r['logo'];
        if ($r['lineup_presets']) {
            $presets = json_decode($r['lineup_presets'], true);
            if ($presets) $team['lineupPresets'] = $presets;
        }
        return $team;
    }, $rows);
}

function loadPlayers($db) {
    $rows = $db->query('SELECT * FROM players ORDER BY id')->fetchAll();
    return array_map(function($r) {
        return [
            'name' => $r['name'],
            'team' => $r['team'],
            'position' => $r['position'] ?? '',
            'sport' => $r['sport'] ?? '',
            'campus' => $r['campus'] ?? ''
        ];
    }, $rows);
}

function loadTournaments($db) {
    $rows = $db->query('SELECT * FROM tournaments ORDER BY id')->fetchAll();
    return array_map(function($r) {
        $t = [
            'name' => $r['name'],
            'sport' => $r['sport'],
            'teams' => json_decode($r['teams'] ?? '[]', true) ?: [],
            'startDate' => $r['start_date'] ?? '',
            'endDate' => $r['end_date'] ?? '',
            'format' => $r['format'] ?? 'single',
            'autoSeed' => (bool)$r['auto_seed'],
            'bestOf' => (int)$r['best_of'],
            'twiceToBeat' => (bool)$r['twice_to_beat'],
            'campus' => $r['campus'] ?? ''
        ];
        if ($r['big_event_id']) $t['bigEventId'] = $r['big_event_id'];
        if ($r['bracket']) {
            $bracket = json_decode($r['bracket'], true);
            if ($bracket !== null) $t['bracket'] = $bracket;
        }
        if ($r['round_robin']) {
            $rr = json_decode($r['round_robin'], true);
            if ($rr !== null) $t['roundRobin'] = $rr;
        }
        if ($r['group_stage']) {
            $gs = json_decode($r['group_stage'], true);
            if ($gs !== null) $t['groupStage'] = $gs;
        }
        if ($r['grand_final']) {
            $gf = json_decode($r['grand_final'], true);
            if ($gf !== null) $t['grandFinal'] = $gf;
        }
        if ($r['winner']) $t['winner'] = $r['winner'];
        if ($r['status'] && $r['status'] !== 'upcoming') $t['status'] = $r['status'];
        return $t;
    }, $rows);
}

function loadMatches($db) {
    $rows = $db->query('SELECT * FROM matches_table ORDER BY id')->fetchAll();
    return array_map(function($r) {
        $m = [
            'a' => $r['team_a'],
            'b' => $r['team_b'],
            'sa' => (int)$r['score_a'],
            'sb' => (int)$r['score_b'],
            'date' => $r['match_date'] ?? '',
            'time' => $r['match_time'] ?? '',
            'endTime' => $r['end_time'] ?? '',
            'court' => $r['court'] ?? '',
            'status' => $r['status'] ?? 'scheduled',
            'sport' => $r['sport'] ?? '',
            'tournament' => $r['tournament'] ?? '',
            'campus' => $r['campus'] ?? ''
        ];
        if ($r['played']) $m['played'] = true;
        if ($r['winner']) $m['winner'] = $r['winner'];
        if ($r['lineups']) {
            $lineups = json_decode($r['lineups'], true);
            if ($lineups) $m['lineups'] = $lineups;
        }
        if ($r['reschedule_history']) {
            $hist = json_decode($r['reschedule_history'], true);
            if ($hist) $m['rescheduleHistory'] = $hist;
        }
        return $m;
    }, $rows);
}

function loadAnnouncements($db) {
    $rows = $db->query('SELECT * FROM announcements ORDER BY id')->fetchAll();
    return array_map(function($r) {
        $a = [
            'id' => (int)$r['announcement_id'],
            'user' => $r['user'],
            'role' => $r['role'] ?? '',
            'campus' => $r['campus'] ?? '',
            'text' => $r['text'],
            'time' => $r['time'] ?? ''
        ];
        if ($r['event_id']) $a['eventId'] = $r['event_id'];
        if ($r['event_name']) $a['eventName'] = $r['event_name'];
        return $a;
    }, $rows);
}

function loadBigEvents($db) {
    $rows = $db->query('SELECT * FROM big_events ORDER BY id')->fetchAll();
    return array_map(function($r) {
        $ev = [
            'id' => $r['event_id'],
            'name' => $r['name'],
            'campus' => $r['campus'],
            'startDate' => $r['start_date'] ?? '',
            'endDate' => $r['end_date'] ?? ''
        ];
        if ($r['sports']) {
            $sports = json_decode($r['sports'], true);
            if ($sports) $ev['sports'] = $sports;
        }
        if ($r['units']) {
            $units = json_decode($r['units'], true);
            if ($units) $ev['units'] = $units;
        }
        if ($r['unit_standings']) {
            $us = json_decode($r['unit_standings'], true);
            if ($us) $ev['unitStandings'] = $us;
        }
        return $ev;
    }, $rows);
}

function loadCampuses($db) {
    $rows = $db->query('SELECT name FROM campuses ORDER BY id')->fetchAll();
    return array_map(function($r) { return $r['name']; }, $rows);
}

function loadMessages($db) {
    $rows = $db->query('SELECT * FROM messages ORDER BY id')->fetchAll();
    return array_map(function($r) {
        return [
            'id' => $r['message_id'],
            'from' => $r['sender'],
            'to' => $r['recipient'],
            'text' => $r['text'],
            'time' => $r['time'] ?? '',
            'read' => (bool)$r['is_read'],
            'broadcast' => (bool)$r['broadcast']
        ];
    }, $rows);
}

function loadSmsNotifications($db) {
    $rows = $db->query('SELECT * FROM sms_notifications ORDER BY id DESC')->fetchAll();
    return array_map(function($r) {
        return [
            'recipient' => $r['recipient'] ?? '',
            'phone' => $r['phone'] ?? '',
            'message' => $r['message'] ?? '',
            'type' => $r['type'] ?? 'schedule',
            'timestamp' => $r['timestamp'] ?? '',
            'read' => (bool)($r['is_read'] ?? 0),
            'sent' => (bool)($r['sent'] ?? 0)
        ];
    }, $rows);
}

function loadSmsSentLog($db) {
    $rows = $db->query('SELECT * FROM sms_sent_log ORDER BY id DESC LIMIT 500')->fetchAll();
    return array_map(function($r) {
        return [
            'phone' => $r['phone'],
            'message' => $r['message'],
            'matchId' => $r['match_id'],
            'sentAt' => $r['sent_at'],
            'status' => $r['status']
        ];
    }, $rows);
}

function getSettingRaw($db, $key) {
    $stmt = $db->prepare('SELECT setting_value FROM settings WHERE setting_key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return json_decode($row['setting_value'], true);
}

// ============================================
// DATA SAVERS — Convert JS format to DB rows
// ============================================

function saveByKey($db, $key, $value) {
    switch ($key) {
        case 'users': return saveUsers($db, $value);
        case 'teams': return saveTeams($db, $value);
        case 'players': return savePlayers($db, $value);
        case 'tournaments': return saveTournaments($db, $value);
        case 'matches': return saveMatches($db, $value);
        case 'announcements': return saveAnnouncements($db, $value);
        case 'bigEvents': return saveBigEvents($db, $value);
        case 'campuses': return saveCampuses($db, $value);
        case 'messages': return saveMessages($db, $value);
        case 'smsNotifications': return saveSmsNotifications($db, $value);
        case 'smsSentLog': return saveSmsSentLog($db, $value);
        case 'systemLogo': return saveSetting($db, 'systemLogo', $value);
        case 'darkMode': return saveSetting($db, 'darkMode', $value);
        case 'customSports': return saveSetting($db, 'customSports', $value);
        default: return;
    }
}

function saveUsers($db, $users) {
    $db->exec('DELETE FROM users');
    if (empty($users)) return;
    $stmt = $db->prepare('INSERT INTO users (username, password, role, campus, sport, assigned_sports, assigned_events) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($users as $u) {
        $stmt->execute([
            $u['username'] ?? '',
            $u['password'] ?? '',
            $u['role'] ?? 'organizer',
            $u['campus'] ?? '',
            $u['sport'] ?? null,
            json_encode($u['assignedSports'] ?? []),
            json_encode($u['assignedEvents'] ?? [])
        ]);
    }
}

function saveTeams($db, $teams) {
    $db->exec('DELETE FROM teams');
    if (empty($teams)) return;
    $stmt = $db->prepare('INSERT INTO teams (team_id, name, sport, campus, team_group, logo, lineup_presets) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($teams as $t) {
        $stmt->execute([
            $t['id'] ?? '',
            $t['name'] ?? '',
            $t['sport'] ?? '',
            $t['campus'] ?? '',
            $t['group'] ?? '',
            $t['logo'] ?? null,
            isset($t['lineupPresets']) ? json_encode($t['lineupPresets']) : null
        ]);
    }
}

function savePlayers($db, $players) {
    $db->exec('DELETE FROM players');
    if (empty($players)) return;
    $stmt = $db->prepare('INSERT INTO players (name, team, position, sport, campus) VALUES (?, ?, ?, ?, ?)');
    foreach ($players as $p) {
        $stmt->execute([
            $p['name'] ?? '',
            $p['team'] ?? '',
            $p['position'] ?? '',
            $p['sport'] ?? '',
            $p['campus'] ?? ''
        ]);
    }
}

function saveTournaments($db, $tournaments) {
    $db->exec('DELETE FROM tournaments');
    if (empty($tournaments)) return;
    $stmt = $db->prepare('INSERT INTO tournaments (name, sport, teams, start_date, end_date, format, auto_seed, best_of, twice_to_beat, campus, big_event_id, bracket, round_robin, group_stage, grand_final, winner, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($tournaments as $t) {
        $startDate = !empty($t['startDate']) ? $t['startDate'] : null;
        $endDate = !empty($t['endDate']) ? $t['endDate'] : null;
        $stmt->execute([
            $t['name'] ?? '',
            $t['sport'] ?? '',
            json_encode($t['teams'] ?? []),
            $startDate,
            $endDate,
            $t['format'] ?? 'single',
            isset($t['autoSeed']) ? ($t['autoSeed'] ? 1 : 0) : 1,
            $t['bestOf'] ?? 1,
            isset($t['twiceToBeat']) ? ($t['twiceToBeat'] ? 1 : 0) : 0,
            $t['campus'] ?? '',
            $t['bigEventId'] ?? null,
            isset($t['bracket']) ? json_encode($t['bracket']) : null,
            isset($t['roundRobin']) ? json_encode($t['roundRobin']) : null,
            isset($t['groupStage']) ? json_encode($t['groupStage']) : null,
            isset($t['grandFinal']) ? json_encode($t['grandFinal']) : null,
            $t['winner'] ?? null,
            $t['status'] ?? 'upcoming'
        ]);
    }
}

function saveMatches($db, $matches) {
    $db->exec('DELETE FROM matches_table');
    if (empty($matches)) return;
    $stmt = $db->prepare('INSERT INTO matches_table (team_a, team_b, score_a, score_b, match_date, match_time, end_time, court, status, sport, tournament, campus, played, winner, lineups, reschedule_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($matches as $m) {
        $matchDate = !empty($m['date']) ? $m['date'] : null;
        $stmt->execute([
            $m['a'] ?? null,
            $m['b'] ?? null,
            $m['sa'] ?? 0,
            $m['sb'] ?? 0,
            $matchDate,
            $m['time'] ?? null,
            $m['endTime'] ?? null,
            $m['court'] ?? '',
            $m['status'] ?? 'scheduled',
            $m['sport'] ?? '',
            $m['tournament'] ?? '',
            $m['campus'] ?? '',
            !empty($m['played']) ? 1 : 0,
            $m['winner'] ?? null,
            isset($m['lineups']) ? json_encode($m['lineups']) : null,
            isset($m['rescheduleHistory']) ? json_encode($m['rescheduleHistory']) : null
        ]);
    }
}

function saveAnnouncements($db, $announcements) {
    $db->exec('DELETE FROM announcements');
    if (empty($announcements)) return;
    $stmt = $db->prepare('INSERT INTO announcements (announcement_id, user, role, campus, text, time, event_id, event_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($announcements as $a) {
        $stmt->execute([
            $a['id'] ?? time(),
            $a['user'] ?? '',
            $a['role'] ?? '',
            $a['campus'] ?? '',
            $a['text'] ?? '',
            $a['time'] ?? '',
            $a['eventId'] ?? '',
            $a['eventName'] ?? ''
        ]);
    }
}

function saveBigEvents($db, $events) {
    $db->exec('DELETE FROM big_events');
    if (empty($events)) return;
    $stmt = $db->prepare('INSERT INTO big_events (event_id, name, campus, start_date, end_date, sports, units, unit_standings) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($events as $ev) {
        $startDate = !empty($ev['startDate']) ? $ev['startDate'] : null;
        $endDate = !empty($ev['endDate']) ? $ev['endDate'] : null;
        $stmt->execute([
            $ev['id'] ?? '',
            $ev['name'] ?? '',
            $ev['campus'] ?? '',
            $startDate,
            $endDate,
            isset($ev['sports']) ? json_encode($ev['sports']) : null,
            isset($ev['units']) ? json_encode($ev['units']) : null,
            isset($ev['unitStandings']) ? json_encode($ev['unitStandings']) : null
        ]);
    }
}

function saveCampuses($db, $campuses) {
    $db->exec('DELETE FROM campuses');
    if (empty($campuses)) return;
    $stmt = $db->prepare('INSERT INTO campuses (name) VALUES (?)');
    foreach ($campuses as $name) {
        if (!empty($name)) {
            $stmt->execute([$name]);
        }
    }
}

function saveMessages($db, $messages) {
    $db->exec('DELETE FROM messages');
    if (empty($messages)) return;
    $stmt = $db->prepare('INSERT INTO messages (message_id, sender, recipient, text, time, is_read, broadcast) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($messages as $m) {
        $stmt->execute([
            $m['id'] ?? '',
            $m['from'] ?? '',
            $m['to'] ?? '',
            $m['text'] ?? '',
            $m['time'] ?? '',
            !empty($m['read']) ? 1 : 0,
            !empty($m['broadcast']) ? 1 : 0
        ]);
    }
}

function saveSmsNotifications($db, $notifications) {
    $db->exec('DELETE FROM sms_notifications');
    if (empty($notifications)) return;
    $stmt = $db->prepare('INSERT INTO sms_notifications (recipient, phone, message, type, timestamp, is_read, sent) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($notifications as $n) {
        $stmt->execute([
            $n['recipient'] ?? '',
            $n['phone'] ?? '',
            $n['message'] ?? '',
            $n['type'] ?? 'schedule',
            $n['timestamp'] ?? '',
            !empty($n['read']) ? 1 : 0,
            !empty($n['sent']) ? 1 : 0
        ]);
    }
}

function saveSmsSentLog($db, $logs) {
    $db->exec('DELETE FROM sms_sent_log');
    if (empty($logs)) return;
    $stmt = $db->prepare('INSERT INTO sms_sent_log (phone, message, match_id, sent_at, status) VALUES (?, ?, ?, ?, ?)');
    foreach (array_slice($logs, 0, 500) as $l) {
        $stmt->execute([
            $l['phone'] ?? '',
            $l['message'] ?? '',
            $l['matchId'] ?? null,
            $l['sentAt'] ?? '',
            $l['status'] ?? 'pending'
        ]);
    }
}

function saveSetting($db, $key, $value) {
    $stmt = $db->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?');
    $encoded = json_encode($value);
    $stmt->execute([$key, $encoded, $encoded]);
}
