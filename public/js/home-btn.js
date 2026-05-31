/* home-btn.js — Floating home button with confirmation on play page */
(function () {
    'use strict';

    const isPlayPage = !!document.getElementById('game-clock');

    /* ── Build floating button ── */
    const btn = document.createElement('a');
    btn.className = 'home-fab';
    btn.href = '/';
    btn.setAttribute('aria-label', 'Về trang chủ');
    btn.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9.5L10 3l7 6.5"/>
            <path d="M5 8v8a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8"/>
        </svg>
        <span>Trang chủ</span>
    `;
    document.body.appendChild(btn);

    if (!isPlayPage) return; /* rules / other pages → navigate directly */

    /* ── Build confirmation modal ── */
    const modal = document.createElement('div');
    modal.id = 'home-confirm-modal';
    modal.setAttribute('hidden', '');
    modal.innerHTML = `
        <div class="hcm-backdrop"></div>
        <div class="hcm-panel" role="dialog" aria-modal="true">
            <div class="hcm-icon">⚖</div>
            <h2 class="hcm-title">Rời khỏi trận?</h2>
            <p class="hcm-desc">
                Trận đấu đang diễn ra sẽ <strong>không được lưu lại.</strong><br>
                Bạn chắc chắn muốn quay về trang chủ?
            </p>
            <div class="hcm-actions">
                <button class="hcm-btn hcm-cancel" id="hcm-cancel">Tiếp tục chơi</button>
                <a class="hcm-btn hcm-confirm" href="/">Rời trận</a>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    function openModal()  { modal.removeAttribute('hidden'); document.body.style.overflow = 'hidden'; }
    function closeModal() { modal.setAttribute('hidden', ''); document.body.style.overflow = ''; }

    btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
    });

    modal.querySelector('#hcm-cancel').addEventListener('click', closeModal);
    modal.querySelector('.hcm-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
    });
})();
