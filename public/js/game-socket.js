/**
 * Giai đoạn 3 — Client Socket.io (server quản lý state)
 */
(function initOnlineGame() {
    const session = window.GAME_SESSION;
    if (!session || session.mode !== 'online') return;

    const socket = io();
    let lastState = null;
    let lastSnapshot = null;

    const clockWidget = document.getElementById('game-clock');
    const statusWidget = document.getElementById('game-status');
    const phaseBadge = document.getElementById('phase-badge');
    const conductorPanel = document.getElementById('conductor-panel');
    const handsGrid = document.getElementById('hands-grid');

    const SLOT_IDS = [
        'slot-p1-innocent',
        'slot-p1-guilty',
        'slot-p1-modifier',
        'slot-p2-innocent',
        'slot-p2-guilty',
        'slot-p2-modifier'
    ];

    function cardHtml(card) {
        const label = CARD_TYPE_LABELS[card.type] || card.type;
        return `
            <div class="game-card card-${card.type}">
                <div class="card-title">${card.title}</div>
                <div class="card-desc">${card.desc}</div>
                <div class="card-type-badge">${label}</div>
            </div>
        `;
    }

    function slotContentKey(slotId, slotData) {
        if (slotData.filled) {
            return `${slotId}:f:${slotData.card.type}:${slotData.card.title}`;
        }
        const ph = slotData.placeholder;
        return `${slotId}:e:${ph.tag}`;
    }

    function rescuedPilesKey(piles) {
        const top = (piles?.top || []).map((e) => `${e.cycle}:${e.card.type}:${e.card.title}`).join(',');
        const bottom = (piles?.bottom || []).map((e) => `${e.cycle}:${e.card.type}:${e.card.title}`).join(',');
        return `${top}|${bottom}`;
    }

    function renderRescuedPiles(piles) {
        ['top', 'bottom'].forEach((track) => {
            const container = document.getElementById(`rescued-${track}-cards`);
            if (!container) return;
            const entries = piles?.[track] || [];
            if (entries.length === 0) {
                container.innerHTML = '<span class="rescued-empty">Chưa có lá nào được cứu</span>';
                return;
            }
            container.innerHTML = entries
                .map((entry) => {
                    const scores = entry.credit ? `+${entry.credit.toUpperCase()}` : '';
                    return `
                <div class="rescued-card card-${entry.card.type}" title="${entry.card.desc}">
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

    function renderSlot(slotId, slotData, force) {
        const el = document.getElementById(slotId);
        if (!el) return;
        const key = slotContentKey(slotId, slotData);
        if (!force && el.dataset.contentKey === key) return;
        el.dataset.contentKey = key;
        el.classList.remove('slot-saved');

        if (slotData.filled) {
            el.innerHTML = cardHtml(slotData.card);
        } else {
            const ph = slotData.placeholder;
            el.innerHTML = `<b>[${ph.tag}]</b><br>${ph.sub}<br><small>${ph.hint}</small>`;
        }
    }

    function highlightSlots(activeIds) {
        const key = activeIds.slice().sort().join(',');
        if (lastSnapshot?.activeSlotsKey === key) return;
        lastSnapshot = { ...lastSnapshot, activeSlotsKey: key };

        document.querySelectorAll('.card-slot').forEach((el) => el.classList.remove('slot-active'));
        activeIds.forEach((id) => document.getElementById(id)?.classList.add('slot-active'));
    }

    const ONLINE_TABS = [
        { key: 'all',      label: 'Tất cả' },
        { key: 'innocent', label: 'Thiên Thần' },
        { key: 'guilty',   label: 'Ác Quỷ' },
        { key: 'modifier', label: 'Bổ Sung' },
    ];
    let onlineHandTab = 'all';
    let lastAutoSwitchPhaseId = null; // track which phase triggered last auto-switch

    function renderHand(state) {
        const panelP1 = document.getElementById('panel-p1');
        const panelP2 = document.getElementById('panel-p2');
        const areaP1 = document.getElementById('p1-hand-area');
        const areaP2 = document.getElementById('p2-hand-area');

        const label = `${state.cardsPerType} Vô tội · ${state.cardsPerType} Có tội · ${state.cardsPerType} Bổ sung`;

        if (state.role === 'conductor') {
            handsGrid.style.display = 'none';
            return;
        }

        handsGrid.style.display = 'grid';
        panelP1.classList.toggle('hand-hidden', state.role !== 'p1');
        panelP2.classList.toggle('hand-hidden', state.role !== 'p2');

        const pId = state.role; // 'p1' or 'p2'
        const area = pId === 'p1' ? areaP1 : areaP2;
        const panel = pId === 'p1' ? panelP1 : panelP2;

        if (state.role === 'p1') panelP1.querySelector('h3').textContent = `Người chơi 1 — Tay bài (${label})`;
        if (state.role === 'p2') panelP2.querySelector('h3').textContent = `Người chơi 2 — Tay bài (${label})`;

        // Auto-switch tab ONLY when phase changes (not on every render)
        if (state.phaseId !== lastAutoSwitchPhaseId) {
            lastAutoSwitchPhaseId = state.phaseId;
            onlineHandTab = state.allowedType || 'all';
        }

        // Tab bar
        const tabBar = document.getElementById(`${pId}-tab-bar`);
        if (tabBar) {
            tabBar.innerHTML = ONLINE_TABS.map((t) => {
                const active = onlineHandTab === t.key ? ' active' : '';
                return `<button class="hand-tab hand-tab-${t.key}${active}"
                    onclick="(function(){window._onlineHandTab='${t.key}';window._onlineRerender&&window._onlineRerender();})()">${t.label}</button>`;
            }).join('');
        }

        renderHandCards(area, state.hand, state, onlineHandTab);

        // Confirm area
        const confirmArea = document.getElementById(`${pId}-confirm-area`);
        if (confirmArea) {
            if (state.phaseId > 3 || state.gameOver || state.roundAdvanceLock) {
                confirmArea.innerHTML = '';
            } else if (state.playerConfirmed) {
                confirmArea.innerHTML = '<div class="confirm-done">✓ Đã xác nhận</div>';
            } else if (state.playerHasPlaced) {
                confirmArea.innerHTML = '<button class="confirm-btn" id="online-confirm-btn">Xác nhận đặt bài</button>';
                document.getElementById('online-confirm-btn')?.addEventListener('click', () => {
                    socket.emit('confirm_card', { roomCode: session.room, playerId: session.playerId });
                });
            } else {
                confirmArea.innerHTML = '<div class="confirm-hint">Chọn 1 thẻ để đặt xuống</div>';
            }
        }
    }

    // Tab switching: re-render hand with new tab
    window._onlineHandTab = onlineHandTab;
    window._onlineRerender = function () {
        onlineHandTab = window._onlineHandTab;
        if (lastState) renderHand(lastState);
    };

    function handPlayKey(state) {
        return `${state.canPlayCards}:${state.allowedType || ''}`;
    }

    function handCardsKey(hand) {
        return hand.map((c) => c.uid).join(',');
    }

    function renderHandCards(container, hand, state, tabFilter) {
        const playKey = handPlayKey(state);
        const cardsKey = handCardsKey(hand);
        const tabKey  = tabFilter || 'all';
        if (
            container.dataset.cardsKey === cardsKey &&
            container.dataset.playKey  === playKey &&
            container.dataset.tabKey   === tabKey
        ) {
            return;
        }
        container.dataset.cardsKey = cardsKey;
        container.dataset.playKey  = playKey;
        container.dataset.tabKey   = tabKey;

        const existing = new Map();
        container.querySelectorAll('[data-uid]').forEach((el) => {
            existing.set(el.dataset.uid, el);
        });

        const seen = new Set();

        hand.forEach((card, index) => {
            if (tabFilter && tabFilter !== 'all' && card.type !== tabFilter) return;
            seen.add(card.uid); // only mark as seen if passes filter
            const canPlay = state.canPlayCards && card.type === state.allowedType;
            let cardDiv = existing.get(card.uid);

            if (!cardDiv) {
                cardDiv = document.createElement('div');
                cardDiv.dataset.uid = card.uid;
                cardDiv.classList.add('game-card--enter');
                cardDiv.innerHTML = `
                    <div class="card-title">${card.title}</div>
                    <div class="card-desc">${card.desc}</div>
                    <div class="card-type-badge">${state.cardTypeLabels[card.type]}</div>
                `;
            }

            cardDiv.className = `game-card card-${card.type}${canPlay ? '' : ' card-disabled'}`;
            cardDiv.onclick = canPlay
                ? () => {
                      socket.emit('play_card', {
                          roomCode: session.room,
                          playerId: session.playerId,
                          handIndex: index
                      });
                  }
                : null;

            container.appendChild(cardDiv);
        });

        existing.forEach((el, uid) => {
            if (!seen.has(uid)) el.remove();
        });
    }

    function applyVerdictAnimation(track) {
        const locomotive = document.getElementById('trolley-car');
        if (!locomotive) return;
        if (track === 'top') {
            locomotive.style.transform = 'translate(220px, -15px)';
        } else {
            locomotive.style.transform = 'translate(220px, 155px)';
        }
        conductorPanel.style.display = 'none';
        document.querySelectorAll('.btn-choice').forEach((b) => (b.disabled = true));
    }

    function boardKey(board) {
        return SLOT_IDS.map((id) => slotContentKey(id, board[id])).join('|');
    }

    function emitVerdict(track) {
        if (!session.isConductor) {
            statusWidget.textContent = '⚠️ Chỉ người lái tàu mới được bẻ ghi.';
            return;
        }
        if (!socket.connected) {
            statusWidget.textContent = '⚠️ Mất kết nối — tải lại trang.';
            return;
        }
        if (lastState?.verdict || lastState?.gameOver) return;

        applyVerdictAnimation(track);
        statusWidget.innerHTML =
            track === 'top'
                ? "<span class='status-accent'>⚖ Đang xử lý: Tàu đâm <b>Ray Trên</b>...</span>"
                : "<span class='status-accent'>⚖ Đang xử lý: Tàu đâm <b>Ray Dưới</b>...</span>";

        socket.emit('verdict', {
            roomCode: session.room,
            playerId: session.playerId,
            track
        });
    }

    function wireConductorButtons() {
        document.querySelectorAll('#conductor-panel [data-track]').forEach((btn) => {
            btn.addEventListener('click', () => emitVerdict(btn.dataset.track));
        });
    }

    function renderState(state) {
        lastState = state;

        const scores = state.savedScores || { p1: 0, p2: 0 };
        const pqLabel = state.gameOver
            ? `PQ: ${state.cycleCount}/${state.minMatchCycles}`
            : `PQ: ${state.cycleCount}/${state.minMatchCycles}+`;
        phaseBadge.textContent =
            `Giai đoạn 3 — Online | Phòng ${state.roomCode} | ${state.phaseName} | ` +
            `${pqLabel} · Điểm cứu P1:${scores.p1} P2:${scores.p2}`;
        clockWidget.textContent = state.clockText;
        statusWidget.textContent = state.statusMessage;

        if (state.phaseId === 4 || state.phaseId === 5) {
            clockWidget.classList.add('clock-urgent');
        } else {
            clockWidget.classList.remove('clock-urgent');
        }

        const nextBoardKey = `${boardKey(state.board)}|rev${state.boardRevision ?? 0}|c${state.cycleCount}|v${state.verdict || ''}`;
        const boardChanged = lastSnapshot?.boardKey !== nextBoardKey;
        const cycleChanged = lastSnapshot?.cycleCount !== state.cycleCount;
        if (boardChanged || cycleChanged) {
            SLOT_IDS.forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    delete el.dataset.contentKey;
                    el.classList.remove('slot-saved');
                }
                renderSlot(id, state.board[id], true);
            });
            lastSnapshot = { ...lastSnapshot, boardKey: nextBoardKey };
        }

        const nextRescuedKey = rescuedPilesKey(state.rescuedPiles);
        if (lastSnapshot?.rescuedKey !== nextRescuedKey) {
            renderRescuedPiles(state.rescuedPiles);
            lastSnapshot = { ...lastSnapshot, rescuedKey: nextRescuedKey };
        }

        if (state.phaseId === 1 && !state.verdict && (lastSnapshot?.phaseId !== 1 || lastSnapshot?.cycleCount !== state.cycleCount)) {
            const locomotive = document.getElementById('trolley-car');
            if (locomotive) locomotive.style.transform = '';
        }
        lastSnapshot = { ...lastSnapshot, phaseId: state.phaseId, cycleCount: state.cycleCount };

        highlightSlots(state.activeSlotIds);
        renderHand(state);

        const panelVisible = state.showConductorPanel ? 'block' : 'none';
        if (conductorPanel.style.display !== panelVisible) {
            conductorPanel.style.display = panelVisible;
        }
        document.querySelectorAll('#conductor-panel [data-track]').forEach((btn) => {
            btn.disabled = !state.showConductorPanel || !!state.verdict || state.gameOver;
        });

        if (!state.verdict) {
            lastSnapshot = { ...lastSnapshot, verdict: undefined };
        }

        if (state.verdict && lastSnapshot?.verdict !== state.verdict) {
            if (conductorPanel.style.display !== 'none') {
                applyVerdictAnimation(state.verdict);
            }
            statusWidget.innerHTML = `<span class="status-accent">⚖ ${state.statusMessage}</span>`;
            lastSnapshot = { ...lastSnapshot, verdict: state.verdict };
        }

        if (state.gameOver) {
            statusWidget.innerHTML = `<span class="status-accent">✦ ${state.statusMessage}</span>`;
            conductorPanel.style.display = 'none';
            document.querySelectorAll('.btn-choice').forEach((b) => (b.disabled = true));
            handsGrid.style.display = 'none';
            if (state.matchSummary) {
                showEndgameOverlay(state.matchSummary);
            }
        }
    }

    function applyOnlineLayout() {
        const sessionBar = document.getElementById('session-bar');
        const hint = document.getElementById('mode-hint');
        sessionBar.textContent = `Phòng ${session.room} · ${session.roleLabel}`;
        sessionBar.classList.add('session-online');

        if (session.isConductor) {
            hint.innerHTML =
                '<strong>Người lái tàu:</strong> Bẻ ghi → ray bị đâm mất bài; ray còn lại chuyển sang vùng cứu, ô bàn reset. Sau 5 lần PQ, ai cứu được nhiều người (Vô tội+Có tội) hơn thắng.';
        } else if (session.role === 'p1') {
            hint.innerHTML =
                '<strong>P1:</strong> Chỉ tay bài của bạn; đặt bài → mọi người thấy trên bàn ngay lập tức.';
        } else {
            hint.innerHTML =
                '<strong>P2:</strong> Chỉ tay bài của bạn; đặt bài → mọi người thấy trên bàn ngay lập tức.';
        }
    }

    socket.on('connect', () => {
        statusWidget.textContent = 'Đang kết nối máy chủ...';
        socket.emit('join_game', {
            roomCode: session.room,
            playerId: session.playerId
        });
    });

    socket.on('game:state', renderState);

    socket.on('game:error', ({ message }) => {
        statusWidget.textContent = `⚠️ ${message}`;
        document.querySelectorAll('#conductor-panel [data-track]').forEach((btn) => {
            btn.disabled = false;
        });
    });

    socket.on('connect_error', () => {
        statusWidget.textContent = '⚠️ Mất kết nối máy chủ. Tải lại trang hoặc kiểm tra npm start.';
    });

    window.addEventListener('DOMContentLoaded', () => {
        applyOnlineLayout();
        wireConductorButtons();
        statusWidget.textContent = 'Đang tham gia trận...';
    });
})();
