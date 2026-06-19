// Minimal WebSocket server to sync sala state between clients
// Run: node server/ws-server.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const os = require('os');

const PORT = process.env.PORT ||3001;
const STATE_FILE = path.join(__dirname, 'state.json');
const ARCHIVE_DIR = path.join(__dirname, 'archive');

let currentState = { salasActivas: [] };

// Try load persisted state
try {
 if (fs.existsSync(STATE_FILE)) {
 const raw = fs.readFileSync(STATE_FILE, 'utf8');
 currentState = JSON.parse(raw) || { salasActivas: [] };
 }
} catch (e) {
 console.warn('Could not load persisted state:', e.message);
}

function persistState() {
 try {
 fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null,2), 'utf8');
 } catch (e) {
 console.error('Failed to persist state:', e.message);
 }
}

// Ensure archive dir exists
try {
 if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
} catch (e) {
 console.warn('Could not ensure archive dir:', e.message);
}

// Cleanup helper: returns { removed, kept }
function cleanupInactiveRooms(days =30, dryRun = true) {
 const now = Date.now();
 const cutoff = days *24 *60 *60 *1000;
 const removed = [];
 const kept = [];
 (currentState.salasActivas || []).forEach(s => {
 const last = s.updatedAt ?? s.createdAt ??0;
 // treat missing timestamp as 'old' conservatively only when explicitly set in config; here assume missing == keep
 if (!last) {
 kept.push(s);
 return;
 }
 if ((now - last) > cutoff) removed.push(s); else kept.push(s);
 });
 if (!dryRun && removed.length >0) {
 // create backup of removed
 try {
 const ts = Date.now();
 const backupName = path.join(ARCHIVE_DIR, `state-removed-${ts}.json`);
 fs.writeFileSync(backupName, JSON.stringify({ removed, keptBefore: currentState.salasActivas }, null,2), 'utf8');
 } catch (e) {
 console.error('Failed to write archive for cleanup:', e.message);
 }
 // persist new state
 currentState.salasActivas = kept;
 persistState();
 // broadcast new state to WS clients
 try {
 const out = JSON.stringify({ type: 'state', state: currentState, clientId: 'server-cleanup' });
 wss && wss.clients && wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(out); });
 } catch (e) {
 console.error('Failed to broadcast state after cleanup:', e.message);
 }
 }
 return { removed, kept };
}

// HTTP API (fallback for clients without WS or to fetch state)
const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
 if (req.method === 'OPTIONS') return res.sendStatus(200);
 next();
});

app.get('/state', (req, res) => {
 res.json(currentState);
});

// Optional: allow HTTP clients to post a sync to the server
app.post('/sync', (req, res) => {
 try {
 const body = req.body;
 if (body && body.state) {
 currentState = body.state;
 persistState();
 const out = JSON.stringify({ type: 'state', state: currentState, clientId: body.clientId || null });
 // broadcast to WS clients
 wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(out); });
 return res.json({ ok: true });
 }
 return res.status(400).json({ ok: false, error: 'invalid payload' });
 } catch (e) {
 return res.status(500).json({ ok: false, error: e.message });
 }
});

// Cleanup endpoint: supports dryRun and days query param
// POST /cleanup?days=1&dryRun=true
app.post('/cleanup', (req, res) => {
 try {
 const days = Number(req.query.days) || Number(req.body.days) ||30;
 const dryRunQ = String(req.query.dryRun || req.body.dryRun || 'true').toLowerCase();
 const dryRun = dryRunQ === 'true' || dryRunQ === '1' || dryRunQ === 'yes';
 const result = cleanupInactiveRooms(days, dryRun);
 return res.json({ ok: true, dryRun, days, eliminadas: result.removed.length, removedCodes: result.removed.map(r => r.codigo) });
 } catch (e) {
 return res.status(500).json({ ok: false, error: e.message });
 }
});

// Start server bound to all interfaces so LAN clients can connect
const server = app.listen(PORT, '0.0.0.0', () => {
 // list network addresses
 const ifaces = os.networkInterfaces();
 const addrs = [];
 Object.keys(ifaces).forEach((ifname) => {
 ifaces[ifname].forEach((iface) => {
 if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
 });
 });
 const addrList = addrs.length ? addrs.map(a => `http://${a}:${PORT}`).join(', ') : `http://localhost:${PORT}`;
 console.log(`HTTP+WS server listening on ${addrList}`);
 // perform a dry-run cleanup at startup to log how many rooms would be removed (does not modify state)
 try {
 const startupDry = cleanupInactiveRooms(Number(process.env.CLEANUP_DAYS_DEFAULT) ||30, true);
 if (startupDry.removed.length) console.log(`Startup dry-run cleanup: ${startupDry.removed.length} rooms would be removed (use /cleanup to execute).`);
 } catch (e) { console.error('Startup cleanup dry-run failed:', e.message); }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
 ws.on('message', (msg) => {
 try {
 const data = JSON.parse(msg.toString());
 if (data.type === 'requestState') {
 // send current state to requester
 ws.send(JSON.stringify({ type: 'state', state: currentState, clientId: data.clientId }));
 }
 if (data.type === 'syncState' && data.state) {
 // update server state and broadcast
 currentState = data.state;
 // persist to disk
 persistState();
 const out = JSON.stringify({ type: 'state', state: currentState, clientId: data.clientId });
 wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(out); });
 }
 } catch (e) {
 console.error('Invalid WS message', e);
 }
 });

 // send current state on new connection
 ws.send(JSON.stringify({ type: 'state', state: currentState, clientId: null }));
});

// show one canonical WS URL in logs (if possible)
(function printWsUrls() {
 const ifaces = os.networkInterfaces();
 const wsAddrs = [];
 Object.keys(ifaces).forEach((ifname) => {
 ifaces[ifname].forEach((iface) => {
 if (iface.family === 'IPv4' && !iface.internal) wsAddrs.push(`ws://${iface.address}:${PORT}`);
 });
 });
 if (wsAddrs.length) console.log(`WS server running on ${wsAddrs.join(', ')} (state file: ${STATE_FILE})`);
 else console.log(`WS server running on ws://localhost:${PORT} (state file: ${STATE_FILE})`);
})();

// Periodic cleanup job: run non-dry cleanup every CLEANUP_INTERVAL_HOURS hours (default24)
const CLEANUP_DAYS_DEFAULT = Number(process.env.CLEANUP_DAYS_DEFAULT) ||30;
const CLEANUP_INTERVAL_HOURS = Number(process.env.CLEANUP_INTERVAL_HOURS) ||24;
setInterval(() => {
 try {
 console.log('Running periodic cleanup job...');
 const res = cleanupInactiveRooms(CLEANUP_DAYS_DEFAULT, false);
 if (res.removed.length) console.log(`Periodic cleanup removed ${res.removed.length} inactive rooms.`);
 } catch (e) { console.error('Periodic cleanup failed:', e.message); }
}, CLEANUP_INTERVAL_HOURS *60 *60 *1000);
