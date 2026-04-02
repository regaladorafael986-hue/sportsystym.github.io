/**
 * Database Bridge — replaces localStorage with MySQL via PHP API
 * 
 * Uses an in-memory cache loaded from the database on startup.
 * g(key) reads from cache synchronously (same as before).
 * s(key, value) writes to cache AND syncs to DB in background.
 * 
 * This file MUST be loaded BEFORE all other JS files.
 */

// API base URL — auto-detected relative to current page
const DB_API_URL = './api/index.php';

// In-memory data cache — mirrors what was in localStorage
const _dbCache = {};

// Track pending saves to debounce rapid writes to the same key
const _dbPendingSaves = {};
const DB_SAVE_DELAY = 300; // ms debounce

// Whether the database is connected and cache is loaded
let _dbReady = false;
let _dbFailed = false;

/**
 * g(key) — Get data by key (synchronous, reads from cache)
 * Returns a parsed copy, defaulting to empty array
 */
function g(key) {
    if (key in _dbCache) {
        const val = _dbCache[key];
        // Return a deep copy to match localStorage parse behavior
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return []; }
        }
        if (val === null || val === undefined) return [];
        // For arrays/objects, return a deep copy
        return JSON.parse(JSON.stringify(val));
    }
    return [];
}

/**
 * s(key, value) — Save data by key (writes to cache + async DB save)
 */
function s(key, value) {
    // Update cache immediately (synchronous)
    _dbCache[key] = JSON.parse(JSON.stringify(value));
    
    // Also keep localStorage as a fallback
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // localStorage might be full, ignore
    }
    
    // Debounced async save to database
    if (_dbPendingSaves[key]) {
        clearTimeout(_dbPendingSaves[key]);
    }
    _dbPendingSaves[key] = setTimeout(() => {
        _dbSyncToServer(key, value);
        delete _dbPendingSaves[key];
    }, DB_SAVE_DELAY);
}

/**
 * Sync a single key to the server
 */
function _dbSyncToServer(key, value) {
    fetch(DB_API_URL + '?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, value: value })
    })
    .then(r => {
        if (!r.ok) {
            return r.text().then(t => {
                console.error('[DB] Save FAILED for key:', key, '| Status:', r.status, '| Response:', t);
                _dbShowStatus(false, 'Save failed: ' + key);
            });
        }
        return r.json().then(data => {
            if (data.success) {
                console.log('[DB] Saved key:', key);
                _dbShowStatus(true);
            } else {
                console.error('[DB] Save error for key:', key, data.error || data);
                _dbShowStatus(false, data.error || 'Unknown error');
            }
        });
    })
    .catch(err => {
        console.error('[DB] Failed to sync key:', key, err);
        _dbShowStatus(false, 'Network error: ' + err.message);
    });
}

/**
 * Show a small DB sync status indicator
 */
function _dbShowStatus(ok, msg) {
    let el = document.getElementById('dbSyncStatus');
    if (!el) {
        el = document.createElement('div');
        el.id = 'dbSyncStatus';
        el.style.cssText = 'position:fixed;bottom:10px;right:10px;padding:8px 14px;border-radius:6px;font-size:13px;z-index:99999;transition:opacity .5s;pointer-events:none;';
        document.body.appendChild(el);
    }
    if (ok) {
        el.style.background = '#27ae60';
        el.style.color = '#fff';
        el.textContent = '\u2713 DB Synced';
    } else {
        el.style.background = '#e74c3c';
        el.style.color = '#fff';
        el.textContent = '\u2717 DB Error: ' + (msg || '');
    }
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, ok ? 2000 : 5000);
}

/**
 * Load all data from database into cache
 * Returns a Promise that resolves when ready
 */
function dbLoadAll() {
    return fetch(DB_API_URL + '?action=load')
        .then(r => r.json())
        .then(result => {
            if (result.success && result.data) {
                const data = result.data;
                // Populate cache with all keys from the database
                for (const key in data) {
                    if (data[key] !== null && data[key] !== undefined) {
                        _dbCache[key] = data[key];
                        // Also sync to localStorage as fallback
                        try {
                            localStorage.setItem(key, JSON.stringify(data[key]));
                        } catch (e) { /* ignore */ }
                    }
                }
                _dbReady = true;
                console.log('[DB] Database loaded successfully');
                return true;
            } else {
                throw new Error(result.error || 'Failed to load data');
            }
        })
        .catch(err => {
            console.warn('[DB] Database not available, falling back to localStorage:', err.message);
            _dbFailed = true;
            // Load from localStorage as fallback
            _dbLoadFromLocalStorage();
            return false;
        });
}

/**
 * Fallback: populate cache from localStorage
 */
function _dbLoadFromLocalStorage() {
    const keys = ['users', 'teams', 'players', 'tournaments', 'matches',
                  'announcements', 'bigEvents', 'campuses', 'messages',
                  'smsNotifications', 'smsSentLog', 'customSports'];
    keys.forEach(key => {
        try {
            const raw = localStorage.getItem(key);
            if (raw) _dbCache[key] = JSON.parse(raw);
        } catch (e) { /* ignore */ }
    });
    // Special string values
    ['systemLogo', 'darkMode'].forEach(key => {
        const raw = localStorage.getItem(key);
        if (raw !== null) _dbCache[key] = raw;
    });
}

/**
 * Setup: auto-create database and tables
 */
function dbSetup() {
    return fetch(DB_API_URL + '?action=setup')
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                console.log('[DB] Setup complete:', result.message);
                return true;
            } else {
                throw new Error(result.error || 'Setup failed');
            }
        });
}

/**
 * Clear all data via API
 */
function dbClearAll() {
    return fetch(DB_API_URL + '?action=clear')
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                // Clear local cache
                for (const key in _dbCache) {
                    delete _dbCache[key];
                }
                localStorage.clear();
                return true;
            }
            throw new Error(result.error || 'Clear failed');
        });
}

/**
 * Login via API
 */
function dbLogin(username, password) {
    return fetch(DB_API_URL + '?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(r => r.json());
}

// ============================================
// Override direct localStorage calls used in the codebase
// ============================================

// Store original localStorage methods
const _origGetItem = localStorage.getItem.bind(localStorage);
const _origSetItem = localStorage.setItem.bind(localStorage);
const _origRemoveItem = localStorage.removeItem.bind(localStorage);
const _origClear = localStorage.clear.bind(localStorage);

// Override localStorage.getItem to read from cache first
const _lsProxy = {
    getItem: function(key) {
        if (key in _dbCache) {
            const val = _dbCache[key];
            if (typeof val === 'string') return val;
            if (val === null || val === undefined) return null;
            return JSON.stringify(val);
        }
        return _origGetItem(key);
    },
    setItem: function(key, value) {
        // Update cache
        try {
            _dbCache[key] = JSON.parse(value);
        } catch {
            _dbCache[key] = value;
        }
        // Save to original localStorage
        try { _origSetItem(key, value); } catch(e) { /* ignore */ }
        // Sync to DB (debounced) for known data keys
        const dataKeys = ['users', 'teams', 'players', 'tournaments', 'matches',
                          'announcements', 'bigEvents', 'campuses', 'messages',
                          'smsNotifications', 'smsSentLog', 'systemLogo', 'darkMode'];
        if (dataKeys.includes(key)) {
            if (_dbPendingSaves[key]) clearTimeout(_dbPendingSaves[key]);
            _dbPendingSaves[key] = setTimeout(() => {
                let val;
                try { val = JSON.parse(value); } catch { val = value; }
                _dbSyncToServer(key, val);
                delete _dbPendingSaves[key];
            }, DB_SAVE_DELAY);
        }
    },
    removeItem: function(key) {
        delete _dbCache[key];
        _origRemoveItem(key);
    },
    clear: function() {
        for (const key in _dbCache) delete _dbCache[key];
        _origClear();
    }
};

// Apply proxy to localStorage
Object.defineProperty(window, 'localStorage', {
    value: new Proxy(localStorage, {
        get(target, prop) {
            if (prop in _lsProxy) return _lsProxy[prop];
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
        }
    }),
    configurable: true,
    writable: true
});
