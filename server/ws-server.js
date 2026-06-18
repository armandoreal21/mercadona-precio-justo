// Minimal WebSocket server to sync sala state between clients
// Run: node server/ws-server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port:3001 });
let currentState = { salasActivas: [] };

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

console.log('WS server running on ws://localhost:3001');
