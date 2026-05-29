const { createGameForRoom } = require('./game-engine');

const ROLES = ['p1', 'p2', 'conductor'];
const ROLE_LABELS = {
    p1: 'Người chơi 1 (Ray trên)',
    p2: 'Người chơi 2 (Ray dưới)',
    conductor: 'Người lái tàu'
};

const rooms = new Map();

function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (rooms.has(code)) return randomCode();
    return code;
}

function newPlayerId() {
    return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createRoom(hostName) {
    const code = randomCode();
    const hostId = newPlayerId();
    const room = {
        code,
        hostId,
        status: 'waiting',
        players: [
            {
                id: hostId,
                name: (hostName || 'Host').trim().slice(0, 24) || 'Host',
                role: null
            }
        ],
        createdAt: Date.now()
    };
    rooms.set(code, room);
    return { room: publicRoom(room), playerId: hostId };
}

function publicRoom(room) {
    return {
        code: room.code,
        status: room.status,
        hostId: room.hostId,
        players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role
        })),
        rolesTaken: room.players.filter((p) => p.role).map((p) => p.role),
        allRolesFilled: ROLES.every((r) => room.players.some((p) => p.role === r)),
        canStart:
            room.status === 'waiting' &&
            ROLES.every((r) => room.players.some((p) => p.role === r))
    };
}

function getRoom(code) {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return null;
    return publicRoom(room);
}

function getRoomInternal(code) {
    return rooms.get((code || '').toUpperCase()) || null;
}

function findPlayer(room, playerId) {
    return room.players.find((p) => p.id === playerId);
}

function joinRoom(code, playerName, playerId) {
    const key = (code || '').toUpperCase();
    const room = rooms.get(key);
    if (!room) return { error: 'Không tìm thấy phòng.' };
    if (room.status !== 'waiting') return { error: 'Trận đã bắt đầu.' };

    if (playerId) {
        const existing = findPlayer(room, playerId);
        if (existing) {
            if (playerName && playerName.trim()) {
                existing.name = playerName.trim().slice(0, 24);
            }
            return { room: publicRoom(room), playerId };
        }
    }

    if (room.players.length >= 3) {
        return { error: 'Phòng đã đủ 3 người.' };
    }

    const id = newPlayerId();
    room.players.push({
        id,
        name: (playerName || 'Khách').trim().slice(0, 24) || 'Khách',
        role: null
    });
    return { room: publicRoom(room), playerId: id };
}

function setRole(code, playerId, role) {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return { error: 'Không tìm thấy phòng.' };
    if (room.status !== 'waiting') return { error: 'Trận đã bắt đầu.' };
    if (!ROLES.includes(role)) return { error: 'Vai không hợp lệ.' };

    const player = findPlayer(room, playerId);
    if (!player) return { error: 'Bạn chưa ở trong phòng.' };

    const takenByOther = room.players.some((p) => p.id !== playerId && p.role === role);
    if (takenByOther) return { error: 'Vai này đã có người chọn.' };

    player.role = role;
    return { room: publicRoom(room) };
}

function startGame(code, playerId) {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return { error: 'Không tìm thấy phòng.' };
    if (room.hostId !== playerId) return { error: 'Chỉ host mới được bắt đầu.' };
    if (!ROLES.every((r) => room.players.some((p) => p.role === r))) {
        return { error: 'Cần đủ 3 vai trước khi bắt đầu.' };
    }
    room.status = 'playing';
    room.startedAt = Date.now();
    room.sockets = room.sockets || new Map();
    room.game = createGameForRoom(room);
    return { room: publicRoom(room) };
}

module.exports = {
    ROLES,
    ROLE_LABELS,
    createRoom,
    getRoom,
    getRoomInternal,
    joinRoom,
    setRole,
    startGame
};
