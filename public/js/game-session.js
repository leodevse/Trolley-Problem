/** Đọc phiên từ URL — local hoặc online (Giai đoạn 2) */
(function initGameSession() {
    const params = new URLSearchParams(window.location.search);
    const room = (params.get('room') || '').toUpperCase();
    const player = params.get('player') || '';
    const role = params.get('role') || '';
    const modeParam = params.get('mode');

    const ROLE_LABELS = {
        p1: 'Người chơi 1 (Ray trên)',
        p2: 'Người chơi 2 (Ray dưới)',
        conductor: 'Người lái tàu'
    };

    let mode = 'local';
    if (room && player && role && ROLE_LABELS[role]) {
        mode = 'online';
    } else if (modeParam !== 'local' && room) {
        window.location.href = '/';
        return;
    }

    window.GAME_SESSION = {
        mode,
        room,
        playerId: player,
        role,
        roleLabel: ROLE_LABELS[role] || '',
        isConductor: role === 'conductor',
        isRailPlayer: role === 'p1' || role === 'p2'
    };
})();
