// Minimal WebSocket server to sync sala state between clients
// Run: node server/ws-server.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');

const PORT = process.env.PORT ||3001;
const STATE_FILE = path.join(__dirname, 'state.json');

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

// HTTP API (fallback for clients without WS or to fetch state)
const app = express();
app.use(express.json());

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

const server = app.listen(PORT, () => {
 console.log(`HTTP+WS server listening on http://localhost:${PORT}`);
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

console.log(`WS server running on ws://localhost:${PORT} (state file: ${STATE_FILE})`);
