const STORAGE_PLAYER = 'trolley_player_id';
const STORAGE_ROOM = 'trolley_room_code';

const els = {
    panel: document.getElementById('room-panel'),
    codeLabel: document.getElementById('room-code-label'),
    playerList: document.getElementById('player-list'),
    btnStart: document.getElementById('btn-start'),
    btnSettings: document.getElementById('btn-settings'),
    btnCopy: document.getElementById('btn-copy-code'),
    error: document.getElementById('lobby-error'),
    roomHint: document.getElementById('room-hint'),
    roleBtns: document.querySelectorAll('.role-btn'),
    settingsSummary: document.getElementById('settings-summary'),
    settingsModal: document.getElementById('settings-modal'),
    settingsBackdrop: document.getElementById('settings-modal-backdrop'),
    settingsHint: document.getElementById('settings-hint'),
    setRoundDuration: document.getElementById('set-round-duration'),
    setDebateDuration: document.getElementById('set-debate-duration'),
    setCardsPerType: document.getElementById('set-cards-per-type'),
    setMatchCycles: document.getElementById('set-match-cycles'),
    btnSettingsSave: document.getElementById('btn-settings-save'),
    btnSettingsCancel: document.getElementById('btn-settings-cancel')
};

let state = {
    roomCode: null,
    playerId: localStorage.getItem(STORAGE_PLAYER) || null,
    isHost: false,
    pollTimer: null,
    settingsLimits: null,
    roomSettings: null
};

function showLobbySetup() {
    document.body.classList.remove('lobby-prestart');
    document.body.classList.add('lobby-setup');
}

function formatSettingsSummary(settings) {
    const s = settings || {};
    return `Cấu hình: ${s.roundDuration ?? 30}s/vòng đặt bài · ${s.debateDuration ?? 60}s thảo luận · ${s.cardsPerType ?? 5} lá/loại (lẻ) · ${s.matchCycles ?? 5} vòng PQ (lẻ, ≤ lá)`;
}

function applyLimitsToForm(limits) {
    if (!limits) return;
    els.setRoundDuration.min = limits.minRoundDuration;
    els.setRoundDuration.max = limits.maxRoundDuration;
    els.setDebateDuration.min = limits.minDebateDuration;
    els.setDebateDuration.max = limits.maxDebateDuration;
    els.setCardsPerType.min = limits.minCardsPerType;
    els.setCardsPerType.max = limits.maxCardsPerType;
    els.setCardsPerType.step = 2;
    els.setMatchCycles.min = limits.minMatchCycles;
    els.setMatchCycles.step = 2;
    syncMatchCyclesToCards();
}

function syncMatchCyclesToCards() {
    const cards = Number(els.setCardsPerType.value) || 1;
    const maxCycles = cards % 2 === 1 ? cards : Math.max(1, cards - 1);
    els.setMatchCycles.max = maxCycles;
    let cycles = Number(els.setMatchCycles.value) || 1;
    if (cycles > maxCycles) cycles = maxCycles;
    if (cycles % 2 === 0) cycles = Math.max(1, cycles - 1);
    els.setMatchCycles.value = cycles;
    els.settingsHint.textContent =
        'Số lá và số vòng trận đều phải lẻ (tránh hòa). Số vòng trận ≤ số lá mỗi loại.';
}

function fillSettingsForm(settings) {
    const s = settings || {};
    els.setRoundDuration.value = s.roundDuration ?? 30;
    els.setDebateDuration.value = s.debateDuration ?? 60;
    els.setCardsPerType.value = s.cardsPerType ?? 5;
    els.setMatchCycles.value = s.matchCycles ?? 5;
    syncMatchCyclesToCards();
}

function openSettingsModal(settings) {
    fillSettingsForm(settings);
    els.settingsModal.hidden = false;
}

function closeSettingsModal() {
    els.settingsModal.hidden = true;
}

function showError(msg) {
    els.error.hidden = !msg;
    els.error.textContent = msg || '';
}

async function api(path, options = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Lỗi máy chủ.');
    return data;
}

function saveSession(roomCode, playerId) {
    state.roomCode = roomCode;
    state.playerId = playerId;
    localStorage.setItem(STORAGE_PLAYER, playerId);
    localStorage.setItem(STORAGE_ROOM, roomCode);
}

function playUrl(room, playerId, role) {
    const q = new URLSearchParams({ room, player: playerId, role });
    return `/play?${q.toString()}`;
}

function renderRoom(room) {
    els.panel.hidden = false;
    els.codeLabel.textContent = room.code;
    state.isHost = room.hostId === state.playerId;

    els.playerList.innerHTML = room.players
        .map((p) => {
            const roleText = p.role
                ? { p1: 'P1', p2: 'P2', conductor: 'Lái tàu' }[p.role]
                : 'Chưa chọn vai';
            const tagClass = p.role ? 'role-tag' : 'role-tag empty';
            const you = p.id === state.playerId ? ' (bạn)' : '';
            return `<li><span>${p.name}${you}</span><span class="${tagClass}">${roleText}</span></li>`;
        })
        .join('');

    const taken = new Set(room.rolesTaken);
    els.roleBtns.forEach((btn) => {
        const role = btn.dataset.role;
        const mine = room.players.find((p) => p.id === state.playerId);
        const isMine = mine && mine.role === role;
        btn.disabled = taken.has(role) && !isMine;
        btn.classList.toggle('selected', isMine);
    });

    els.btnStart.disabled = !state.isHost || !room.canStart;

    const inWaiting = room.status === 'waiting';
    els.btnSettings.hidden = !inWaiting;
    els.btnSettings.disabled = !state.isHost;
    els.btnSettings.textContent = state.isHost ? 'Cài đặt trận' : 'Cài đặt (chỉ Host)';

    if (room.settings) {
        state.roomSettings = room.settings;
        els.settingsSummary.hidden = false;
        els.settingsSummary.textContent = formatSettingsSummary(room.settings);
    }
    if (room.settingsLimits) {
        state.settingsLimits = room.settingsLimits;
        applyLimitsToForm(room.settingsLimits);
    }

    els.roomHint.textContent = room.canStart
        ? 'Đủ 3 vai — Host có thể bắt đầu!'
        : `Còn thiếu vai: ${['p1', 'p2', 'conductor'].filter((r) => !taken.has(r)).map((r) => ({ p1: 'P1', p2: 'P2', conductor: 'Lái tàu' }[r])).join(', ') || '—'}`;

    const resumeEl = document.getElementById('resume-game-wrap');
    if (room.status === 'playing') {
        const me = room.players.find((p) => p.id === state.playerId);
        if (me && me.role && resumeEl) {
            resumeEl.hidden = false;
            resumeEl.querySelector('a').href = playUrl(room.code, state.playerId, me.role);
            els.roomHint.textContent = 'Trận đang diễn ra — bấm "Tiếp tục trận" hoặc chờ người chơi mới.';
        }
    } else if (resumeEl) {
        resumeEl.hidden = true;
    }
}

async function refreshRoom() {
    if (!state.roomCode) return;
    try {
        const { room } = await api(`/api/rooms/${state.roomCode}`);
        renderRoom(room);
        showError('');
    } catch (e) {
        showError(e.message);
    }
}

function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(refreshRoom, 2000);
}

async function enterRoom(code, playerName, isCreate) {
    showError('');
    try {
        let data;
        if (isCreate) {
            data = await api('/api/rooms', {
                method: 'POST',
                body: JSON.stringify({ hostName: playerName })
            });
        } else {
            data = await api(`/api/rooms/${code}/join`, {
                method: 'POST',
                body: JSON.stringify({
                    playerName,
                    playerId: state.playerId
                })
            });
        }
        saveSession(data.room.code, data.playerId);
        renderRoom(data.room);
        startPolling();
        showLobbySetup();
        document.querySelector('.lobby-grid').style.display = 'none';
        const tabsNav = document.getElementById('lobby-tabs-nav');
        if (tabsNav) tabsNav.style.display = 'none';
    } catch (e) {
        showError(e.message);
    }
}

document.getElementById('btn-create').addEventListener('click', () => {
    const name = document.getElementById('host-name').value;
    enterRoom(null, name, true);
});

document.getElementById('btn-join').addEventListener('click', () => {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    const name = document.getElementById('join-name').value;
    if (code.length !== 4) {
        showError('Mã phòng phải đủ 4 ký tự.');
        return;
    }
    enterRoom(code, name, false);
});

document.getElementById('btn-show-lobby')?.addEventListener('click', showLobbySetup);

els.roleBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
        if (!state.roomCode || btn.disabled) return;
        try {
            const { room } = await api(`/api/rooms/${state.roomCode}/role`, {
                method: 'PATCH',
                body: JSON.stringify({
                    playerId: state.playerId,
                    role: btn.dataset.role
                })
            });
            renderRoom(room);
            showError('');
        } catch (e) {
            showError(e.message);
        }
    });
});

els.btnSettings.addEventListener('click', () => {
    if (!state.isHost) return;
    openSettingsModal(state.roomSettings);
});

els.setCardsPerType.addEventListener('input', syncMatchCyclesToCards);
els.setCardsPerType.addEventListener('change', syncMatchCyclesToCards);

els.btnSettingsCancel.addEventListener('click', closeSettingsModal);
els.settingsBackdrop.addEventListener('click', closeSettingsModal);

els.btnSettingsSave.addEventListener('click', async () => {
    if (!state.roomCode || !state.isHost) return;
    const settings = {
        roundDuration: Number(els.setRoundDuration.value),
        debateDuration: Number(els.setDebateDuration.value),
        cardsPerType: Number(els.setCardsPerType.value),
        matchCycles: Number(els.setMatchCycles.value)
    };
    try {
        const { room } = await api(`/api/rooms/${state.roomCode}/settings`, {
            method: 'PATCH',
            body: JSON.stringify({ playerId: state.playerId, settings })
        });
        renderRoom(room);
        closeSettingsModal();
        showError('');
    } catch (e) {
        showError(e.message);
    }
});

els.btnStart.addEventListener('click', async () => {
    try {
        await api(`/api/rooms/${state.roomCode}/start`, {
            method: 'POST',
            body: JSON.stringify({ playerId: state.playerId })
        });
        await refreshRoom();
    } catch (e) {
        showError(e.message);
    }
});

els.btnCopy.addEventListener('click', () => {
    if (!state.roomCode) return;
    navigator.clipboard.writeText(state.roomCode).then(() => {
        els.btnCopy.textContent = '✓';
        setTimeout(() => {
            els.btnCopy.textContent = '📋';
        }, 1500);
    });
});

document.getElementById('btn-clear-session')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_PLAYER);
    localStorage.removeItem(STORAGE_ROOM);
    location.reload();
});

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const { limits } = await api('/api/game-settings/limits');
        state.settingsLimits = limits;
        applyLimitsToForm(limits);
    } catch {
        /* giới hạn sẽ lấy từ phòng khi vào */
    }

    const savedRoom = localStorage.getItem(STORAGE_ROOM);
    if (savedRoom && state.playerId) {
        try {
            const { room } = await api(`/api/rooms/${savedRoom}/join`, {
                method: 'POST',
                body: JSON.stringify({ playerId: state.playerId })
            });
            saveSession(room.code, state.playerId);
            renderRoom(room);
            startPolling();
            showLobbySetup();
            document.querySelector('.lobby-grid').style.display = 'none';
            const tabsNav = document.getElementById('lobby-tabs-nav');
            if (tabsNav) tabsNav.style.display = 'none';
        } catch {
            localStorage.removeItem(STORAGE_ROOM);
        }
    }
});
