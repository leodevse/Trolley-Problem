const { CARD_POOLS, CARD_TYPE_LABELS } = require('./cards-data');
const { DEFAULT_GAME_SETTINGS } = require('./game-settings');

const CARDS_PER_TYPE = DEFAULT_GAME_SETTINGS.cardsPerType;
/** Số lần phán quyết mặc định trước khi kết thúc trận */
const MIN_MATCH_CYCLES = DEFAULT_GAME_SETTINGS.matchCycles;
/** Mỗi lần tàu đâm: xóa 2 lá (Vô tội + Có tội) + Bổ sung trên ray bị chọn */
const HIT_TRACK_SLOTS = {
    top: ['slot-p1-innocent', 'slot-p1-guilty', 'slot-p1-modifier'],
    bottom: ['slot-p2-innocent', 'slot-p2-guilty', 'slot-p2-modifier']
};
/** Ray được cứu — chuyển sang vùng riêng, ô bàn được reset */
const SAVED_TRACK_SLOTS = {
    top: ['slot-p1-innocent', 'slot-p1-guilty', 'slot-p1-modifier'],
    bottom: ['slot-p2-innocent', 'slot-p2-guilty', 'slot-p2-modifier']
};
/** Điểm cứu: Vô tội + Có tội trên ray được cứu → thuộc chủ ray đó */
const SLOT_SAVE_CREDIT = {
    'slot-p1-innocent': 'p1',
    'slot-p1-guilty': 'p1',
    'slot-p2-innocent': 'p2',
    'slot-p2-guilty': 'p2'
};
const SCORING_SLOT_TYPES = ['innocent', 'guilty'];
const VERDICT_RESOLVE_MS = 2500;

const PHASE_KEYS = ['ROUND1', 'ROUND2', 'ROUND3', 'DEBATE', 'VERDICT'];
const PHASES = {
    ROUND1: { id: 1, name: 'Vòng 1 — Khởi đầu vô tội', allowedType: 'innocent', duration: 30 },
    ROUND2: { id: 2, name: 'Vòng 2 — Gieo rắc tai họa', allowedType: 'guilty', duration: 30 },
    ROUND3: { id: 3, name: 'Vòng 3 — Lật kèo', allowedType: 'modifier', duration: 30 },
    DEBATE: { id: 4, name: 'Thảo luận công khai', allowedType: null, duration: 60 },
    VERDICT: { id: 5, name: 'Phán quyết', allowedType: null, duration: 0 }
};

const ROUND_SLOT_IDS = {
    1: ['slot-p1-innocent', 'slot-p2-innocent'],
    2: ['slot-p1-guilty', 'slot-p2-guilty'],
    3: ['slot-p1-modifier', 'slot-p2-modifier']
};

const SLOT_PLACEHOLDERS = {
    'slot-p1-innocent': { tag: 'THIÊN THẦN', sub: 'Vô tội', hint: 'P1 tự đặt' },
    'slot-p1-guilty': { tag: 'ÁC QUỶ', sub: 'Có tội', hint: 'P2 đặt hại' },
    'slot-p1-modifier': { tag: 'BỔ SUNG', sub: 'Định hướng', hint: 'P1 bổ sung' },
    'slot-p2-innocent': { tag: 'THIÊN THẦN', sub: 'Vô tội', hint: 'P2 tự đặt' },
    'slot-p2-guilty': { tag: 'ÁC QUỶ', sub: 'Có tội', hint: 'P1 đặt hại' },
    'slot-p2-modifier': { tag: 'BỔ SUNG', sub: 'Định hướng', hint: 'P2 bổ sung' }
};

let uidCounter = 0;
function nextUid() {
    uidCounter += 1;
    return `c_${Date.now().toString(36)}_${uidCounter}`;
}

function getPhase(game) {
    const phases = game.phases || PHASES;
    return phases[PHASE_KEYS[game.phaseIndex]];
}

function buildPhasesForSettings(settings) {
    const roundDuration = settings.roundDuration;
    const debateDuration = settings.debateDuration;
    return {
        ROUND1: { id: 1, name: 'Vòng 1 — Khởi đầu vô tội', allowedType: 'innocent', duration: roundDuration },
        ROUND2: { id: 2, name: 'Vòng 2 — Gieo rắc tai họa', allowedType: 'guilty', duration: roundDuration },
        ROUND3: { id: 3, name: 'Vòng 3 — Lật kèo', allowedType: 'modifier', duration: roundDuration },
        DEBATE: { id: 4, name: 'Thảo luận công khai', allowedType: null, duration: debateDuration },
        VERDICT: { id: 5, name: 'Phán quyết', allowedType: null, duration: 0 }
    };
}

function clonePools() {
    return {
        innocent: CARD_POOLS.innocent.map((c) => ({ ...c })),
        guilty: CARD_POOLS.guilty.map((c) => ({ ...c })),
        modifier: CARD_POOLS.modifier.map((c) => ({ ...c }))
    };
}

function drawCard(game, type) {
    let pool = game.runtimeDecks[type];
    if (pool.length === 0) {
        game.runtimeDecks[type] = CARD_POOLS[type].map((c) => ({ ...c }));
        pool = game.runtimeDecks[type];
    }
    const index = Math.floor(Math.random() * pool.length);
    const card = pool.splice(index, 1)[0];
    return { ...card, type, uid: nextUid() };
}

function buildHand(game) {
    const perType = game.cardsPerType || CARDS_PER_TYPE;
    const hand = [];
    ['innocent', 'guilty', 'modifier'].forEach((type) => {
        for (let i = 0; i < perType; i++) {
            hand.push(drawCard(game, type));
        }
    });
    return hand;
}

function createGameForRoom(room) {
    const settings = { ...DEFAULT_GAME_SETTINGS, ...(room.settings || {}) };
    const phases = buildPhasesForSettings(settings);
    const game = {
        settings,
        phases,
        cardsPerType: settings.cardsPerType,
        matchCycles: settings.matchCycles,
        phaseIndex: 0,
        timeRemaining: phases.ROUND1.duration,
        roundAdvanceLock: false,
        boardCards: {},
        hands: { p1: [], p2: [] },
        runtimeDecks: clonePools(),
        verdict: null,
        lastVerdictTrack: null,
        earlyFinishTimer: null,
        verdictResolveTimer: null,
        cycleCount: 0,
        gameOver: false,
        winner: null,
        savedScores: { p1: 0, p2: 0 },
        rescuedPiles: { top: [], bottom: [] },
        boardRevision: 0,
        confirmed: { p1: false, p2: false }
    };
    game.hands.p1 = buildHand(game);
    game.hands.p2 = buildHand(game);
    return game;
}

function railForPlayer(room, playerId) {
    const p = room.players.find((pl) => pl.id === playerId);
    if (!p || (p.role !== 'p1' && p.role !== 'p2')) return null;
    return p.role;
}

function slotIdForRail(rail, phase) {
    if (phase.allowedType === 'innocent') {
        return rail === 'p1' ? 'slot-p1-innocent' : 'slot-p2-innocent';
    }
    if (phase.allowedType === 'guilty') {
        return rail === 'p1' ? 'slot-p2-guilty' : 'slot-p1-guilty';
    }
    if (phase.allowedType === 'modifier') {
        return rail === 'p1' ? 'slot-p1-modifier' : 'slot-p2-modifier';
    }
    return null;
}

function isRoundComplete(game) {
    const phase = getPhase(game);
    const slots = ROUND_SLOT_IDS[phase.id];
    if (!slots) return false;
    return slots.every((id) => game.boardCards[id]);
}

function advancePhase(game) {
    if (game.phaseIndex >= PHASE_KEYS.length - 1) return;
    if (game.earlyFinishTimer) {
        clearTimeout(game.earlyFinishTimer);
        game.earlyFinishTimer = null;
    }
    game.roundAdvanceLock = false;
    game.confirmed = { p1: false, p2: false };
    game.phaseIndex += 1;
    const phase = getPhase(game);
    game.timeRemaining = phase.duration;
}

function scheduleEarlyFinish(game, onAfter) {
    if (game.earlyFinishTimer) return;
    game.roundAdvanceLock = true;
    game.earlyFinishTimer = setTimeout(() => {
        game.earlyFinishTimer = null;
        advancePhase(game);
        onAfter?.();
    }, 400);
}

function autoFillMissingCards(game) {
    const phase = getPhase(game);
    if (!phase.allowedType) return;
    ['p1', 'p2'].forEach((rail) => {
        const slotId = slotIdForRail(rail, phase);
        if (!slotId || game.boardCards[slotId]) return;
        const hand = game.hands[rail];
        const candidates = hand.map((c, i) => ({ c, i })).filter(({ c }) => c.type === phase.allowedType);
        if (!candidates.length) return;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        game.boardCards[slotId] = pick.c;
        hand.splice(pick.i, 1);
    });
    game.confirmed = { p1: true, p2: true };
    game.boardRevision = (game.boardRevision || 0) + 1;
}

function confirmCard(game, room, playerId, onAfter) {
    if (game.gameOver) return { error: 'Trận đã kết thúc.' };
    if (game.verdict) return { error: 'Đang xử lý phán quyết.' };
    if (game.roundAdvanceLock) return { error: 'Đang chuyển vòng.' };

    const rail = railForPlayer(room, playerId);
    if (!rail) return { error: 'Chỉ người chơi đường ray mới được xác nhận.' };

    const phase = getPhase(game);
    if (phase.id > 3) return { error: 'Không cần xác nhận ở giai đoạn này.' };

    const slotId = slotIdForRail(rail, phase);
    if (!slotId || !game.boardCards[slotId]) return { error: 'Chưa đặt bài vào ô.' };

    game.confirmed[rail] = true;

    if (game.confirmed.p1 && game.confirmed.p2) {
        game.timeRemaining = 0;
        scheduleEarlyFinish(game, onAfter);
    }
    return { ok: true };
}

function playCard(game, room, playerId, handIndex, onAfter) {
    if (game.gameOver) return { error: 'Trận đã kết thúc.' };
    if (game.verdict) return { error: 'Đang xử lý phán quyết, chờ tàu chạy xong.' };
    if (game.roundAdvanceLock) return { error: 'Đang chuyển vòng.' };

    const rail = railForPlayer(room, playerId);
    if (!rail) return { error: 'Chỉ người chơi đường ray mới được đặt bài.' };

    const phase = getPhase(game);
    if (!phase.allowedType) return { error: 'Không thể đặt bài ở giai đoạn này.' };

    const hand = game.hands[rail];
    if (handIndex < 0 || handIndex >= hand.length) return { error: 'Lá bài không hợp lệ.' };

    const card = hand[handIndex];
    if (card.type !== phase.allowedType) {
        return { error: `Vòng này chỉ được đặt lá "${CARD_TYPE_LABELS[phase.allowedType]}".` };
    }

    const slotId = slotIdForRail(rail, phase);
    if (!slotId) return { error: 'Không xác định được ô đặt bài.' };

    hand.splice(handIndex, 1);

    if (game.boardCards[slotId]) {
        // Swap: return old card to hand, unconfirm, re-sort
        hand.push(game.boardCards[slotId]);
        const ORDER = { innocent: 0, guilty: 1, modifier: 2 };
        hand.sort((a, b) => (ORDER[a.type] ?? 0) - (ORDER[b.type] ?? 0));
        game.confirmed[rail] = false;
    }

    game.boardCards[slotId] = card;
    game.boardRevision = (game.boardRevision || 0) + 1;
    return { ok: true };
}

function tick(game, onAfter) {
    if (game.gameOver) return false;
    if (game.verdict) return false;
    if (game.roundAdvanceLock) return false;

    const phase = getPhase(game);
    if (phase.id === 5) return false;

    if (game.timeRemaining > 0) {
        game.timeRemaining -= 1;
        return true;
    }

    if (phase.id <= 3) autoFillMissingCards(game);
    advancePhase(game);
    onAfter?.();
    return true;
}

function removeHitTrackCards(game, track) {
    const slots = HIT_TRACK_SLOTS[track] || [];
    slots.forEach((slotId) => {
        delete game.boardCards[slotId];
    });
}

function oppositeTrack(track) {
    return track === 'top' ? 'bottom' : 'top';
}

function addSavedScoresForTrack(game, savedTrack) {
    const slots = SAVED_TRACK_SLOTS[savedTrack] || [];
    slots.forEach((slotId) => {
        const card = game.boardCards[slotId];
        if (!card || !SCORING_SLOT_TYPES.includes(card.type)) return;
        const player = SLOT_SAVE_CREDIT[slotId];
        if (player) game.savedScores[player] += 1;
    });
}

function ensureRescuedPiles(game) {
    if (!game.rescuedPiles) {
        game.rescuedPiles = { top: [], bottom: [] };
    }
}

function moveSavedTrackToRescuePile(game, savedTrack) {
    ensureRescuedPiles(game);
    const slots = SAVED_TRACK_SLOTS[savedTrack] || [];
    const pile = game.rescuedPiles[savedTrack] || [];
    slots.forEach((slotId) => {
        const card = game.boardCards[slotId];
        if (!card) return;
        const credit = SCORING_SLOT_TYPES.includes(card.type) ? SLOT_SAVE_CREDIT[slotId] : null;
        pile.push({
            slotId,
            cycle: game.cycleCount + 1,
            credit,
            card: { title: card.title, desc: card.desc, type: card.type }
        });
        delete game.boardCards[slotId];
    });
    game.rescuedPiles[savedTrack] = pile;
}

function getMatchCycles(game) {
    return game.matchCycles ?? MIN_MATCH_CYCLES;
}

function checkMatchEnd(game) {
    if (game.cycleCount < getMatchCycles(game)) return;
    game.gameOver = true;
    const s1 = game.savedScores.p1;
    const s2 = game.savedScores.p2;
    if (s1 > s2) game.winner = 'p1';
    else if (s2 > s1) game.winner = 'p2';
    else game.winner = null;
}

function buildMatchSummary(game) {
    const s1 = game.savedScores.p1;
    const s2 = game.savedScores.p2;
    let resultText;
    if (game.winner === 'p1') {
        resultText = 'Người chơi 1 (Ray trên) thắng!';
    } else if (game.winner === 'p2') {
        resultText = 'Người chơi 2 (Ray dưới) thắng!';
    } else {
        resultText = 'Hòa — không ai dẫn trước.';
    }
    return {
        cycleCount: game.cycleCount,
        scores: { p1: s1, p2: s2 },
        winner: game.winner,
        isTie: !game.winner,
        resultText,
        detail: `Sau ${game.cycleCount} lần phán quyết · Mỗi lá Vô tội/Có tội trên ray được cứu = +1 cho chủ ray`
    };
}

function startNewMatchCycle(game) {
    game.verdict = null;
    game.roundAdvanceLock = false;
    game.confirmed = { p1: false, p2: false };
    game.phaseIndex = 0;
    const phases = game.phases || PHASES;
    game.timeRemaining = phases.ROUND1.duration;
    if (game.earlyFinishTimer) {
        clearTimeout(game.earlyFinishTimer);
        game.earlyFinishTimer = null;
    }
}

function resolveVerdict(game) {
    const track = game.verdict;
    if (!track) return;

    const savedTrack = oppositeTrack(track);
    addSavedScoresForTrack(game, savedTrack);
    removeHitTrackCards(game, track);
    moveSavedTrackToRescuePile(game, savedTrack);

    game.lastVerdictTrack = track;
    game.cycleCount += 1;

    checkMatchEnd(game);

    game.boardRevision = (game.boardRevision || 0) + 1;

    if (!game.gameOver) {
        startNewMatchCycle(game);
    } else {
        game.verdict = null;
    }
}

function setVerdict(game, room, playerId, track, onAfter) {
    const p = room.players.find((pl) => pl.id === playerId);
    if (!p || p.role !== 'conductor') return { error: 'Chỉ người lái tàu mới được bẻ ghi.' };

    if (game.gameOver) return { error: 'Trận đã kết thúc.' };

    const phase = getPhase(game);
    if (phase.id !== 5) return { error: 'Chưa đến giai đoạn phán quyết.' };
    if (game.verdict) return { error: 'Đã phán quyết rồi.' };
    if (track !== 'top' && track !== 'bottom') return { error: 'Hướng bẻ ghi không hợp lệ.' };

    game.verdict = track;

    if (game.verdictResolveTimer) clearTimeout(game.verdictResolveTimer);
    game.verdictResolveTimer = setTimeout(() => {
        game.verdictResolveTimer = null;
        resolveVerdict(game);
        onAfter?.();
    }, VERDICT_RESOLVE_MS);

    return { ok: true };
}

function formatClock(seconds) {
    if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${Math.max(0, seconds)}s`;
}

function buildClockText(game) {
    if (game.gameOver) return '🏁 KẾT THÚC TRẬN';
    const phase = getPhase(game);
    if (game.verdict) return '⚡ TÀU ĐANG CHẠY...';
    if (phase.id === 5) return 'PHÁN QUYẾT — BẺ GHI';
    return formatClock(game.timeRemaining);
}

function buildStatusMessage(game) {
    const phase = getPhase(game);

    if (game.gameOver) {
        const summary = buildMatchSummary(game);
        const { scores } = summary;
        if (summary.isTie) {
            return `KẾT THÚC (${summary.cycleCount} lần PQ): Hòa ${scores.p1}–${scores.p2} — mỗi phe cứu được cùng số người (Vô tội+Có tội)!`;
        }
        const loserKey = game.winner === 'p1' ? 'p2' : 'p1';
        const winnerName = game.winner === 'p1' ? 'Người chơi 1' : 'Người chơi 2';
        const loserName = game.winner === 'p1' ? 'Người chơi 2' : 'Người chơi 1';
        return `KẾT THÚC (${summary.cycleCount} lần PQ): ${winnerName} thắng — cứu ${scores[game.winner]} người vs ${scores[loserKey]} của ${loserName}!`;
    }

    if (game.verdict === 'top') {
        return 'PHÁN QUYẾT: Tàu đâm Ray Trên — lá trên ray trên bị loại; ray dưới được cứu → chuyển sang vùng cứu!';
    }
    if (game.verdict === 'bottom') {
        return 'PHÁN QUYẾT: Tàu đâm Ray Dưới — lá trên ray dưới bị loại; ray trên được cứu → chuyển sang vùng cứu!';
    }

    const scoreLine = `Điểm cứu: P1 ${game.savedScores.p1} · P2 ${game.savedScores.p2} (Vô tội+Có tội trên ray được cứu)`;

    if (game.lastVerdictTrack && phase.id === 1 && game.cycleCount > 0) {
        const totalCycles = getMatchCycles(game);
        const need = Math.max(0, totalCycles - game.cycleCount);
        if (need > 0) {
            return `Hiệp mới ${game.cycleCount + 1} — đặt bài vào ô trống. Còn ${need} lần PQ nữa để kết thúc. ${scoreLine}`;
        }
        return `Hiệp mới — ${scoreLine}. Sau ${totalCycles} lần PQ, ai cứu được nhiều người hơn thắng.`;
    }
    if (game.roundAdvanceLock) {
        return '✓ Cả hai đã xác nhận — chuyển vòng!';
    }
    if (phase.id <= 3) {
        return `${phase.name}: đặt 1 lá "${CARD_TYPE_LABELS[phase.allowedType]}" rồi nhấn Xác nhận — cả hai xác nhận sẽ chuyển vòng ngay (tối đa ${phase.duration}s).`;
    }
    if (phase.id === 4) {
        return 'Hết lượt đặt bài! Hai phe tranh luận — Người lái tàu nghe rồi chọn ray.';
    }
    return 'Thời gian khép lại! Người lái tàu hãy bẻ ghi.';
}

function serializeBoard(game) {
    const board = {};
    Object.keys(SLOT_PLACEHOLDERS).forEach((slotId) => {
        const card = game.boardCards[slotId];
        board[slotId] = card
            ? {
                  filled: true,
                  card: { title: card.title, desc: card.desc, type: card.type }
              }
            : { filled: false, placeholder: SLOT_PLACEHOLDERS[slotId] };
    });
    return board;
}

function serializeState(game, room, viewerPlayerId) {
    ensureRescuedPiles(game);
    const viewer = room.players.find((p) => p.id === viewerPlayerId);
    const role = viewer?.role || null;
    const phase = getPhase(game);

    let hand = [];
    if (role === 'p1') hand = game.hands.p1.map((c) => ({ uid: c.uid, title: c.title, desc: c.desc, type: c.type }));
    if (role === 'p2') hand = game.hands.p2.map((c) => ({ uid: c.uid, title: c.title, desc: c.desc, type: c.type }));

    const rail = (role === 'p1' || role === 'p2') ? role : null;
    const playerConfirmed = rail ? !!(game.confirmed?.[rail]) : false;
    const playerSlot = rail ? slotIdForRail(rail, phase) : null;
    const playerHasPlaced = !!(playerSlot && game.boardCards[playerSlot]);

    return {
        roomCode: room.code,
        role,
        roleLabel: role === 'p1' ? 'Người chơi 1 (Ray trên)' : role === 'p2' ? 'Người chơi 2 (Ray dưới)' : role === 'conductor' ? 'Người lái tàu' : '',
        phaseId: phase.id,
        phaseName: game.gameOver ? 'Kết thúc trận' : phase.name,
        allowedType: phase.allowedType,
        timeRemaining: game.timeRemaining,
        clockText: buildClockText(game),
        boardRevision: game.boardRevision || 0,
        board: serializeBoard(game),
        hand,
        cardsPerType: game.cardsPerType || CARDS_PER_TYPE,
        statusMessage: buildStatusMessage(game),
        showConductorPanel:
            !game.gameOver && phase.id === 5 && role === 'conductor' && !game.verdict,
        canPlayCards:
            !game.gameOver &&
            (role === 'p1' || role === 'p2') &&
            !!phase.allowedType &&
            !game.roundAdvanceLock &&
            !game.verdict,
        activeSlotIds: getActiveSlotIds(game),
        verdict: game.verdict,
        lastVerdictTrack: game.lastVerdictTrack,
        cycleCount: game.cycleCount,
        minMatchCycles: getMatchCycles(game),
        gameOver: game.gameOver,
        winner: game.winner,
        matchSummary: game.gameOver ? buildMatchSummary(game) : null,
        handCounts: { p1: game.hands.p1.length, p2: game.hands.p2.length },
        savedScores: { ...game.savedScores },
        rescuedPiles: {
            top: (game.rescuedPiles?.top || []).map((e) => ({ ...e })),
            bottom: (game.rescuedPiles?.bottom || []).map((e) => ({ ...e }))
        },
        cardTypeLabels: CARD_TYPE_LABELS,
        playerConfirmed,
        playerHasPlaced
    };
}

function getActiveSlotIds(game) {
    const phase = getPhase(game);
    if (!phase.allowedType) return [];
    return (ROUND_SLOT_IDS[phase.id] || []).filter((id) => !game.boardCards[id]);
}

module.exports = {
    CARDS_PER_TYPE,
    MIN_MATCH_CYCLES,
    CARD_TYPE_LABELS,
    createGameForRoom,
    tick,
    playCard,
    confirmCard,
    setVerdict,
    serializeState,
    getPhase
};
