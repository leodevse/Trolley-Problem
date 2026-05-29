const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const {
    ROLE_LABELS,
    createRoom,
    getRoom,
    getRoomInternal,
    joinRoom,
    setRole,
    startGame
} = require('./server/rooms');
const { attachSocketHandlers } = require('./server/socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

attachSocketHandlers(io, { getRoomInternal });

app.use(express.json());

/* Route trang trước static — nếu không, / sẽ trả index.html (redirect sang local) */
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lobby.html'));
});

app.get('/play', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/rooms', (req, res) => {
    const { hostName } = req.body || {};
    const result = createRoom(hostName);
    res.json(result);
});

app.get('/api/rooms/:code', (req, res) => {
    const room = getRoom(req.params.code);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng.' });
    res.json({ room });
});

app.post('/api/rooms/:code/join', (req, res) => {
    const { playerName, playerId } = req.body || {};
    const result = joinRoom(req.params.code, playerName, playerId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

app.patch('/api/rooms/:code/role', (req, res) => {
    const { playerId, role } = req.body || {};
    const result = setRole(req.params.code, playerId, role);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

app.post('/api/rooms/:code/start', (req, res) => {
    const { playerId } = req.body || {};
    const result = startGame(req.params.code, playerId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

app.get('/api/role-labels', (_req, res) => {
    res.json({ labels: ROLE_LABELS });
});

server.listen(PORT, () => {
    console.log(`Trolley Problem — Lobby: http://localhost:${PORT}`);
    console.log(`Chơi local: http://localhost:${PORT}/play?mode=local`);
    console.log(`Socket.io: đồng bộ realtime (Giai đoạn 3)`);
});
