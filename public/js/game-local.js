/**
 * Phần 1 — Chế độ local (1 máy, thử luật chơi)
 * Vòng 1: Vô tội lên ray của mình
 * Vòng 2: Có tội lên ray đối phương
 * Vòng 3: Bổ sung lên ray của mình
 * Sau đó: 1 phút thảo luận → Người lái tàu phán quyết
 */

/** Số lá mỗi loại khi bốc tay ban đầu (theo plan.md) */
const CARDS_PER_TYPE = 5;
const MIN_MATCH_CYCLES = 5;
const VERDICT_RESOLVE_MS = 2500;
const HIT_TRACK_SLOTS = {
    top: ['slot-p1-innocent', 'slot-p1-guilty', 'slot-p1-modifier'],
    bottom: ['slot-p2-innocent', 'slot-p2-guilty', 'slot-p2-modifier']
};
const SAVED_TRACK_SLOTS = {
    top: ['slot-p1-innocent', 'slot-p1-guilty', 'slot-p1-modifier'],
    bottom: ['slot-p2-innocent', 'slot-p2-guilty', 'slot-p2-modifier']
};
const SLOT_SAVE_CREDIT = {
    'slot-p1-innocent': 'p1',
    'slot-p1-guilty': 'p1',
    'slot-p2-innocent': 'p2',
    'slot-p2-guilty': 'p2'
};

const PHASES = {
    ROUND1: { id: 1, name: 'Vòng 1 — Khởi đầu vô tội', allowedType: 'innocent', duration: 30 },
    ROUND2: { id: 2, name: 'Vòng 2 — Gieo rắc tai họa', allowedType: 'guilty', duration: 30 },
    ROUND3: { id: 3, name: 'Vòng 3 — Lật kèo', allowedType: 'modifier', duration: 30 },
    DEBATE: { id: 4, name: 'Thảo luận công khai', allowedType: null, duration: 60 },
    VERDICT: { id: 5, name: 'Phán quyết', allowedType: null, duration: 0 }
};

/** Ô bàn cần đủ lá ở 3 vòng đầu (mỗi vòng 2 người đều đã đặt) */
const ROUND_SLOT_IDS = {
    1: ['slot-p1-innocent', 'slot-p2-innocent'],
    2: ['slot-p1-guilty', 'slot-p2-guilty'],
    3: ['slot-p1-modifier', 'slot-p2-modifier']
};

let runtimeDecks = {
    innocent: [...CARD_POOLS.innocent],
    guilty: [...CARD_POOLS.guilty],
    modifier: [...CARD_POOLS.modifier]
};

let playerHands = { p1: [], p2: [] };
let boardCards = {};
let currentPhaseIndex = 0;
let timeRemaining = PHASES.ROUND1.duration;
let timerHandle = null;
let roundAdvanceLock = false;
let confirmedPlayers = { p1: false, p2: false };
let handTabs = { p1: 'all', p2: 'all' };

window.setHandTab = function (pId, type) {
    handTabs[pId] = type;
    renderHandsUI();
};
let cycleCount = 0;
let gameOver = false;
let winner = null;
let verdictPending = false;
let slotDefaultHtml = {};
let savedScores = { p1: 0, p2: 0 };
let rescuedPiles = { top: [], bottom: [] };

const clockWidget = document.getElementById('game-clock');
const statusWidget = document.getElementById('game-status');
const phaseBadge = document.getElementById('phase-badge');
const conductorPanel = document.getElementById('conductor-panel');

function drawCardByType(type) {
    let pool = runtimeDecks[type];
    if (pool.length === 0) {
        runtimeDecks[type] = [...CARD_POOLS[type]];
        pool = runtimeDecks[type];
    }
    const index = Math.floor(Math.random() * pool.length);
    const card = pool.splice(index, 1)[0];
    return { ...card, type };
}

function buildHandForPlayer() {
    const hand = [];
    ['innocent', 'guilty', 'modifier'].forEach((type) => {
        for (let i = 0; i < CARDS_PER_TYPE; i++) {
            hand.push(drawCardByType(type));
        }
    });
    return hand;
}

function buildStructuredHands() {
    ['p1', 'p2'].forEach((pId) => {
        playerHands[pId] = buildHandForPlayer();
    });
    updateHandPanelTitles();
    renderHandsUI();
}

function updateHandPanelTitles() {
    const label = `${CARDS_PER_TYPE} Vô tội · ${CARDS_PER_TYPE} Có tội · ${CARDS_PER_TYPE} Bổ sung`;
    document.querySelector('#panel-p1 h3')?.replaceChildren(
        document.createTextNode(`Người chơi 1 — Tay bài (${label})`)
    );
    document.querySelector('#panel-p2 h3')?.replaceChildren(
        document.createTextNode(`Người chơi 2 — Tay bài (${label})`)
    );
}

function getCurrentPhase() {
    const keys = Object.keys(PHASES);
    return PHASES[keys[currentPhaseIndex]];
}

function slotIdForCard(playerId, card) {
    const phase = getCurrentPhase();
    if (phase.allowedType === 'innocent') {
        return playerId === 'p1' ? 'slot-p1-innocent' : 'slot-p2-innocent';
    }
    if (phase.allowedType === 'guilty') {
        return playerId === 'p1' ? 'slot-p2-guilty' : 'slot-p1-guilty';
    }
    if (phase.allowedType === 'modifier') {
        return playerId === 'p1' ? 'slot-p1-modifier' : 'slot-p2-modifier';
    }
    return null;
}

function renderCardElement(card) {
    const label = CARD_TYPE_LABELS[card.type];
    return `
        <div class="game-card card-${card.type}">
            <div class="card-title">${card.title}</div>
            <div class="card-desc">${card.desc}</div>
            <div class="card-type-badge">${label}</div>
        </div>
    `;
}

function highlightActiveSlots() {
    document.querySelectorAll('.card-slot').forEach((el) => el.classList.remove('slot-active'));
    const phase = getCurrentPhase();
    if (!phase.allowedType) return;

    const slotIds = ROUND_SLOT_IDS[phase.id] || [];
    slotIds.forEach((id) => {
        if (!boardCards[id]) {
            document.getElementById(id)?.classList.add('slot-active');
        }
    });
}

function refreshSlotElement(slotId) {
    const el = document.getElementById(slotId);
    if (!el) return;
    const card = boardCards[slotId];
    el.classList.remove('slot-saved');
    if (card) {
        el.innerHTML = renderCardElement(card);
    } else {
        el.innerHTML = slotDefaultHtml[slotId] || el.innerHTML;
    }
}

function renderRescuedPiles() {
    ['top', 'bottom'].forEach((track) => {
        const container = document.getElementById(`rescued-${track}-cards`);
        if (!container) return;
        const entries = rescuedPiles[track] || [];
        if (entries.length === 0) {
            container.innerHTML = '<span class="rescued-empty">Chưa có lá nào được cứu</span>';
            return;
        }
        container.innerHTML = entries
            .map((entry) => {
                const scores = entry.credit ? `+${entry.credit.toUpperCase()}` : '';
                return `
            <div class="rescued-card card-${entry.card.type}" title="PQ ${entry.cycle}">
                <div class="rescued-card-title">${entry.card.title}</div>
                <div class="rescued-card-meta">
                    <span class="rescued-card-cycle">PQ ${entry.cycle}</span>
                    ${scores ? `<span class="rescued-card-credit">${scores}</span>` : ''}
                </div>
            </div>`;
            })
            .join('');
    });
}

function refreshAllSlotsUI() {
    Object.keys(slotDefaultHtml).forEach((id) => refreshSlotElement(id));
}

const HAND_TABS = [
    { key: 'all',      label: 'Tất cả' },
    { key: 'innocent', label: 'Thiên Thần' },
    { key: 'guilty',   label: 'Ác Quỷ' },
    { key: 'modifier', label: 'Bổ Sung' },
];

function renderHandsUI() {
    const phase = getCurrentPhase();
    ['p1', 'p2'].forEach((pId) => {
        /* ── Tab bar ── */
        const tabBar = document.getElementById(`${pId}-tab-bar`);
        if (tabBar) {
            tabBar.innerHTML = HAND_TABS.map((t) => {
                const active = handTabs[pId] === t.key ? ' active' : '';
                return `<button class="hand-tab hand-tab-${t.key}${active}"
                            onclick="setHandTab('${pId}','${t.key}')">${t.label}</button>`;
            }).join('');
        }

        /* ── Cards (filtered by active tab) ── */
        const container = document.getElementById(`${pId}-hand-area`);
        container.innerHTML = '';
        const activeTab = handTabs[pId];

        playerHands[pId].forEach((card, origIndex) => {
            if (activeTab !== 'all' && card.type !== activeTab) return;

            const cardDiv = document.createElement('div');
            cardDiv.className = `game-card card-${card.type}`;
            const canPlay = phase.allowedType && card.type === phase.allowedType;
            if (!canPlay) cardDiv.classList.add('card-disabled');

            cardDiv.innerHTML = `
                <div class="card-title">${card.title}</div>
                <div class="card-desc">${card.desc}</div>
                <div class="card-type-badge">${CARD_TYPE_LABELS[card.type]}</div>
            `;

            if (canPlay) {
                cardDiv.onclick = () => playCard(pId, origIndex, card);
            }
            container.appendChild(cardDiv);
        });
    });
    highlightActiveSlots();
    renderConfirmButtons();
}

function isCurrentRoundComplete() {
    const phase = getCurrentPhase();
    const slotIds = ROUND_SLOT_IDS[phase.id];
    if (!slotIds) return false;
    return slotIds.every((id) => boardCards[id]);
}

function syncClockDisplay() {
    const phase = getCurrentPhase();
    if (verdictPending) {
        clockWidget.textContent = '→ TÀU ĐANG CHẠY...';
        return;
    }
    if (phase.id === 5) {
        clockWidget.textContent = 'PHÁN QUYẾT — BẺ GHI';
        return;
    }
    if (timeRemaining >= 60) {
        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        clockWidget.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
        clockWidget.textContent = `${timeRemaining}s`;
    }
}

/* Exposed to global scope for onclick in HTML */
window.confirmPlacement = function (pId) {
    const phase = getCurrentPhase();
    if (phase.id > 3 || gameOver || verdictPending || roundAdvanceLock) return;
    const slotId = slotIdForPlayer(pId, phase.allowedType);
    if (!slotId || !boardCards[slotId]) return;
    confirmedPlayers[pId] = true;
    renderConfirmButtons();
    checkBothConfirmed();
};

function slotIdForPlayer(pId, type) {
    if (type === 'innocent') return pId === 'p1' ? 'slot-p1-innocent' : 'slot-p2-innocent';
    if (type === 'guilty')   return pId === 'p1' ? 'slot-p2-guilty'   : 'slot-p1-guilty';
    if (type === 'modifier') return pId === 'p1' ? 'slot-p1-modifier'  : 'slot-p2-modifier';
    return null;
}

function checkBothConfirmed() {
    if (!confirmedPlayers.p1 || !confirmedPlayers.p2 || roundAdvanceLock) return;
    roundAdvanceLock = true;
    statusWidget.textContent = '✓ Cả hai đã xác nhận — chuyển vòng!';
    setTimeout(() => {
        roundAdvanceLock = false;
        advancePhase();
        const next = getCurrentPhase();
        if (next.duration > 0) {
            timeRemaining = next.duration;
            syncClockDisplay();
        }
    }, 400);
}

function renderConfirmButtons() {
    const phase = getCurrentPhase();
    ['p1', 'p2'].forEach((pId) => {
        const area = document.getElementById(`${pId}-confirm-area`);
        if (!area) return;
        if (phase.id > 3 || gameOver || verdictPending) { area.innerHTML = ''; return; }
        const slotId  = slotIdForPlayer(pId, phase.allowedType);
        const hasCard = !!(slotId && boardCards[slotId]);
        const done    = confirmedPlayers[pId];
        if (done) {
            area.innerHTML = '<div class="confirm-done">✓ Đã xác nhận</div>';
        } else if (hasCard) {
            area.innerHTML = `<button class="confirm-btn" onclick="confirmPlacement('${pId}')">Xác nhận đặt bài</button>`;
        } else {
            area.innerHTML = '<div class="confirm-hint">Chọn 1 thẻ để đặt xuống</div>';
        }
    });
}

function saveSlotDefaults() {
    document.querySelectorAll('.card-slot').forEach((el) => {
        slotDefaultHtml[el.id] = el.innerHTML;
    });
}

function oppositeTrack(track) {
    return track === 'top' ? 'bottom' : 'top';
}

function addSavedScoresForTrack(savedTrack) {
    SAVED_TRACK_SLOTS[savedTrack].forEach((slotId) => {
        const card = boardCards[slotId];
        if (!card || (card.type !== 'innocent' && card.type !== 'guilty')) return;
        const player = SLOT_SAVE_CREDIT[slotId];
        if (player) savedScores[player] += 1;
    });
}

function resolveVerdictLocal(track) {
    const savedTrack = oppositeTrack(track);
    addSavedScoresForTrack(savedTrack);

    HIT_TRACK_SLOTS[track].forEach((id) => delete boardCards[id]);
    SAVED_TRACK_SLOTS[savedTrack].forEach((slotId) => {
        const card = boardCards[slotId];
        if (!card) return;
        const credit =
            card.type === 'innocent' || card.type === 'guilty' ? SLOT_SAVE_CREDIT[slotId] : null;
        rescuedPiles[savedTrack].push({
            slotId,
            cycle: cycleCount + 1,
            credit,
            card: { title: card.title, desc: card.desc, type: card.type }
        });
        delete boardCards[slotId];
    });

    cycleCount += 1;

    if (cycleCount >= MIN_MATCH_CYCLES) {
        gameOver = true;
        if (savedScores.p1 > savedScores.p2) winner = 'p1';
        else if (savedScores.p2 > savedScores.p1) winner = 'p2';
        else winner = null;
    }

    refreshAllSlotsUI();
    renderRescuedPiles();

    if (!gameOver) {
        currentPhaseIndex = 0;
        timeRemaining = PHASES.ROUND1.duration;
        roundAdvanceLock = false;
        confirmedPlayers = { p1: false, p2: false };
        handTabs = { p1: 'innocent', p2: 'innocent' };
        const locomotive = document.getElementById('trolley-car');
        if (locomotive) locomotive.style.transform = '';
        conductorPanel.style.display = 'none';
        document.querySelectorAll('.btn-choice').forEach((b) => (b.disabled = false));
        syncClockDisplay();
        if (timerHandle) clearInterval(timerHandle);
        startTimer();
    } else {
        clearInterval(timerHandle);
    }

    verdictPending = false;
    updatePhaseUI();
}

function playCard(playerId, indexInHand, card) {
    if (gameOver || verdictPending) return;

    const phase = getCurrentPhase();
    if (!phase.allowedType || card.type !== phase.allowedType) return;

    const slotId = slotIdForCard(playerId, card);
    if (!slotId) return;

    // Remove new card from hand first (preserve index integrity)
    playerHands[playerId].splice(indexInHand, 1);

    // If slot already had a card, return it to hand and unconfirm
    if (boardCards[slotId]) {
        playerHands[playerId].push(boardCards[slotId]);
        confirmedPlayers[playerId] = false;
        // Restore display order: innocent → guilty → modifier
        const ORDER = { innocent: 0, guilty: 1, modifier: 2 };
        playerHands[playerId].sort((a, b) => (ORDER[a.type] ?? 0) - (ORDER[b.type] ?? 0));
    }

    boardCards[slotId] = card;
    refreshSlotElement(slotId);

    renderHandsUI();
    renderConfirmButtons();
}

function sessionPrefix() {
    const s = window.GAME_SESSION;
    if (!s || s.mode === 'local') return 'Giai đoạn 1 — Local';
    return `Giai đoạn 2 — Phòng ${s.room} | ${s.roleLabel}`;
}

function updatePhaseUI() {
    const phase = getCurrentPhase();
    const cycleLabel = `PQ: ${cycleCount}/${MIN_MATCH_CYCLES}+ · Điểm cứu P1:${savedScores.p1} P2:${savedScores.p2}`;
    phaseBadge.textContent = `${sessionPrefix()} | ${phase.name} | ${cycleLabel}`;

    if (gameOver) {
        showEndgameOverlay({
            cycleCount,
            scores: { ...savedScores },
            winner,
            isTie: !winner
        });
        if (winner) {
            const winnerName = winner === 'p1' ? 'Người chơi 1' : 'Người chơi 2';
            const loserName = winner === 'p1' ? 'Người chơi 2' : 'Người chơi 1';
            statusWidget.innerHTML =
                `<span class="status-accent">✦ KẾT THÚC:</span> ${winnerName} thắng — cứu ${savedScores[winner]} người vs ${savedScores[winner === 'p1' ? 'p2' : 'p1']} của ${loserName}!`;
        } else {
            statusWidget.innerHTML =
                `<span class="status-accent">✦ KẾT THÚC:</span> Hòa ${savedScores.p1}–${savedScores.p2} — cùng số người được cứu!`;
        }
        clockWidget.textContent = '✦ KẾT THÚC TRẬN';
        phaseBadge.textContent = `${sessionPrefix()} | Kết thúc | PQ: ${cycleCount}/${MIN_MATCH_CYCLES}`;
        document.getElementById('hands-grid').style.display = 'none';
        conductorPanel.style.display = 'none';
        return;
    }

    if (phase.id <= 3) {
        statusWidget.textContent =
            `${phase.name}: mỗi người đặt 1 lá "${CARD_TYPE_LABELS[phase.allowedType]}" vào ô sáng đỏ — đủ cả hai sẽ chuyển vòng ngay (tối đa ${phase.duration}s).`;
    } else if (phase.id === 4) {
        statusWidget.textContent = 'Hết lượt đặt bài! Hai phe tranh luận — Người lái tàu (bạn) nghe rồi chọn ray.';
        clockWidget.classList.add('clock-urgent');
    } else {
        statusWidget.textContent = 'Thời gian khép lại! Người lái tàu hãy bẻ ghi.';
    }

    renderHandsUI(); // also calls renderConfirmButtons internally
}

function advancePhase() {
    const keys = Object.keys(PHASES);
    if (currentPhaseIndex >= keys.length - 1) return;

    roundAdvanceLock = false;
    confirmedPlayers = { p1: false, p2: false };
    currentPhaseIndex++;
    const phase = getCurrentPhase();
    const autoTab = phase.allowedType || 'all';
    handTabs = { p1: autoTab, p2: autoTab };
    timeRemaining = phase.duration;

    if (phase.id === 5 && !gameOver) {
        clearInterval(timerHandle);
        syncClockDisplay();
        if (canUseConductorControls() && !verdictPending) {
            conductorPanel.style.display = 'block';
        }
    }

    updatePhaseUI();
}

function autoFillMissingCards() {
    const phase = getCurrentPhase();
    if (!phase.allowedType) return;
    ['p1', 'p2'].forEach((pId) => {
        const slotId = slotIdForCard(pId, { type: phase.allowedType });
        if (!slotId || boardCards[slotId]) return;
        const candidates = playerHands[pId]
            .map((c, i) => ({ c, i }))
            .filter(({ c }) => c.type === phase.allowedType);
        if (!candidates.length) return;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        boardCards[slotId] = pick.c;
        playerHands[pId].splice(pick.i, 1);
        refreshSlotElement(slotId);
    });
    confirmedPlayers = { p1: true, p2: true };
    renderHandsUI();
}

function startTimer() {
    timerHandle = setInterval(() => {
        if (gameOver || verdictPending) return;
        if (roundAdvanceLock) return;

        if (timeRemaining > 0) {
            timeRemaining--;
            syncClockDisplay();
        } else {
            const phase = getCurrentPhase();
            if (phase.id <= 3) autoFillMissingCards();
            advancePhase();
            const nextPhase = getCurrentPhase();
            if (nextPhase.duration > 0) {
                timeRemaining = nextPhase.duration;
                syncClockDisplay();
            }
        }
    }, 1000);
}

function triggerTrolley(targetTrack) {
    if (!canUseConductorControls() || gameOver || verdictPending) return;
    verdictPending = true;

    const locomotive = document.getElementById('trolley-car');
    if (targetTrack === 'top') {
        locomotive.style.transform = 'translate(220px, -15px)';
        statusWidget.innerHTML =
            "<span class='status-accent'>⚖ PHÁN QUYẾT:</span> Tàu đâm <b>Ray Trên</b> — 2 lá (Vô tội + Có tội) trên ray trên bị loại!";
    } else {
        locomotive.style.transform = 'translate(220px, 155px)';
        statusWidget.innerHTML =
            "<span class='status-accent'>⚖ PHÁN QUYẾT:</span> Tàu đâm <b>Ray Dưới</b> — 2 lá (Vô tội + Có tội) trên ray dưới bị loại!";
    }
    conductorPanel.style.display = 'none';
    document.querySelectorAll('.btn-choice').forEach((b) => (b.disabled = true));

    setTimeout(() => resolveVerdictLocal(targetTrack), VERDICT_RESOLVE_MS);
}

function wireLocalConductorButtons() {
    document.querySelectorAll('#conductor-panel [data-track]').forEach((btn) => {
        btn.addEventListener('click', () => triggerTrolley(btn.dataset.track));
    });
}

function canUseConductorControls() {
    const s = window.GAME_SESSION;
    if (!s || s.mode === 'local') return true;
    return s.isConductor;
}

function applySessionLayout() {
    const s = window.GAME_SESSION || { mode: 'local' };
    const hint = document.getElementById('mode-hint');
    const sessionBar = document.getElementById('session-bar');
    const handsGrid = document.getElementById('hands-grid');

    if (s.mode === 'online') {
        sessionBar.textContent = `Phòng ${s.room} · Bạn: ${s.roleLabel}`;
        sessionBar.classList.add('session-online');

        /* Online: game-socket.js xử lý layout */
    } else {
        sessionBar.textContent = 'Chế độ thử — 1 máy (cả 3 vai)';
        hint.innerHTML =
            '<strong>Chế độ thử (Giai đoạn 1):</strong> P1 ray trên, P2 ray dưới, bạn đóng vai Người lái tàu khi hết giờ. ' +
            `Sau bẻ ghi: ray bị đâm mất bài; ray còn lại chuyển sang vùng cứu, ô bàn reset cho hiệp mới. Sau ${MIN_MATCH_CYCLES} lần PQ, ai cứu được nhiều người (Vô tội+Có tội) hơn thắng.`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const s = window.GAME_SESSION;
    if (s?.mode === 'online') return;

    saveSlotDefaults();
    applySessionLayout();
    wireLocalConductorButtons();
    buildStructuredHands();
    updatePhaseUI();
    clockWidget.textContent = `${timeRemaining}s`;
    startTimer();
});
