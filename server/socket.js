const {
    createGameForRoom,
    tick,
    playCard,
    confirmCard,
    setVerdict,
    serializeState
} = require('./game-engine');

function attachSocketHandlers(io, { getRoomInternal }) {
    const roomTimers = new Map();

    function broadcastRoom(ioServer, room) {
        if (!room.game) return;
        room.players.forEach((p) => {
            const socketId = room.sockets?.get(p.id);
            if (!socketId) return;
            ioServer.to(socketId).emit('game:state', serializeState(room.game, room, p.id));
        });
    }

    function ensureRoomTimer(ioServer, room) {
        const code = room.code;
        if (roomTimers.has(code)) return;

        const intervalId = setInterval(() => {
            const current = getRoomInternal(code);
            if (!current?.game || current.status !== 'playing') {
                clearInterval(intervalId);
                roomTimers.delete(code);
                return;
            }
            tick(current.game, () => broadcastRoom(ioServer, getRoomInternal(code)));
            broadcastRoom(ioServer, getRoomInternal(code));
        }, 1000);

        roomTimers.set(code, intervalId);
    }

    function stopRoomTimer(code) {
        const id = roomTimers.get(code);
        if (id) {
            clearInterval(id);
            roomTimers.delete(code);
        }
    }

    io.on('connection', (socket) => {
        socket.on('join_game', ({ roomCode, playerId }) => {
            const code = (roomCode || '').toUpperCase();
            const room = getRoomInternal(code);
            if (!room) {
                socket.emit('game:error', { message: 'Không tìm thấy phòng.' });
                return;
            }
            if (room.status !== 'playing') {
                socket.emit('game:error', { message: 'Trận chưa bắt đầu.' });
                return;
            }

            const player = room.players.find((p) => p.id === playerId);
            if (!player) {
                socket.emit('game:error', { message: 'Bạn không thuộc phòng này.' });
                return;
            }

            if (!room.sockets) room.sockets = new Map();
            room.sockets.set(playerId, socket.id);
            socket.join(`room:${code}`);
            socket.data.roomCode = code;
            socket.data.playerId = playerId;

            if (!room.game) {
                room.game = createGameForRoom(room);
            }

            ensureRoomTimer(io, room);
            socket.emit('game:state', serializeState(room.game, room, playerId));
        });

        socket.on('play_card', ({ roomCode, playerId, handIndex }) => {
            const code = (roomCode || '').toUpperCase();
            const room = getRoomInternal(code);
            if (!room?.game) {
                socket.emit('game:error', { message: 'Trận chưa sẵn sàng.' });
                return;
            }

            const result = playCard(room.game, room, playerId, handIndex, () => {
                const current = getRoomInternal(code);
                if (current) broadcastRoom(io, current);
            });
            if (result.error) {
                socket.emit('game:error', { message: result.error });
                return;
            }

            broadcastRoom(io, room);
        });

        socket.on('confirm_card', ({ roomCode, playerId }) => {
            const code = (roomCode || '').toUpperCase();
            const room = getRoomInternal(code);
            if (!room?.game) {
                socket.emit('game:error', { message: 'Trận chưa sẵn sàng.' });
                return;
            }

            const result = confirmCard(room.game, room, playerId, () => {
                const current = getRoomInternal(code);
                if (current) broadcastRoom(io, current);
            });
            if (result.error) {
                socket.emit('game:error', { message: result.error });
                return;
            }

            broadcastRoom(io, room);
        });

        socket.on('verdict', ({ roomCode, playerId, track }) => {
            const code = (roomCode || '').toUpperCase();
            const room = getRoomInternal(code);
            if (!room?.game) {
                socket.emit('game:error', { message: 'Trận chưa sẵn sàng.' });
                return;
            }

            const result = setVerdict(room.game, room, playerId, track, () => {
                const current = getRoomInternal(code);
                if (current) broadcastRoom(io, current);
            });
            if (result.error) {
                socket.emit('game:error', { message: result.error });
                return;
            }

            broadcastRoom(io, room);
        });

        socket.on('disconnect', () => {
            const code = socket.data.roomCode;
            const playerId = socket.data.playerId;
            if (!code || !playerId) return;

            const room = getRoomInternal(code);
            if (room?.sockets) {
                room.sockets.delete(playerId);
            }
        });
    });

    return { broadcastRoom, ensureRoomTimer, stopRoomTimer };
}

module.exports = { attachSocketHandlers };
