/** Hiển thị bảng tổng kết sau đủ 5 lần phán quyết */
function showEndgameOverlay(summary) {
    const overlay = document.getElementById('endgame-overlay');
    if (!overlay || !summary) return;

    const title = document.getElementById('endgame-title');
    const scoresEl = document.getElementById('endgame-scores');
    const resultEl = document.getElementById('endgame-result');

    const s1 = summary.scores?.p1 ?? 0;
    const s2 = summary.scores?.p2 ?? 0;
    const cycles = summary.cycleCount ?? 0;

    title.textContent = '🏁 Tổng kết trận';
    scoresEl.innerHTML = `
        <div class="endgame-score-row"><span>Người chơi 1 (Ray trên)</span><strong>${s1}</strong></div>
        <div class="endgame-score-row"><span>Người chơi 2 (Ray dưới)</span><strong>${s2}</strong></div>
        <p class="endgame-note">Điểm = tổng lá Vô tội + Có tội trên ray được cứu của mỗi phe (qua ${cycles} lần PQ). Lá Bổ sung không tính điểm.</p>
    `;

    if (summary.isTie || summary.winner === null) {
        resultEl.textContent = `Hòa ${s1}–${s2}! Không ai dẫn trước.`;
        resultEl.className = 'endgame-result endgame-tie';
    } else if (summary.winner === 'p1') {
        resultEl.textContent = `Người chơi 1 thắng (${s1} vs ${s2})!`;
        resultEl.className = 'endgame-result endgame-win-p1';
    } else {
        resultEl.textContent = `Người chơi 2 thắng (${s2} vs ${s1})!`;
        resultEl.className = 'endgame-result endgame-win-p2';
    }

    overlay.hidden = false;
}

function hideEndgameOverlay() {
    const overlay = document.getElementById('endgame-overlay');
    if (overlay) overlay.hidden = true;
}
