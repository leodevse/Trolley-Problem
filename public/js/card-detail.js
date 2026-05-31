/* card-detail.js — Pure UI enhancement: eye icon + detail modal
   No game logic changes. Only visual layer. */
(function () {
    'use strict';

    /* ---------- Build modal DOM (once) ---------- */
    const modal = document.createElement('div');
    modal.id = 'card-detail-modal';
    modal.setAttribute('hidden', '');
    modal.innerHTML = `
        <div class="cdm-backdrop"></div>
        <div class="cdm-panel" role="dialog" aria-modal="true" aria-labelledby="cdm-title">
            <div class="cdm-header" id="cdm-header">
                <div class="cdm-header-icon" id="cdm-header-icon"></div>
            </div>
            <div class="cdm-content">
                <h2 class="cdm-title" id="cdm-title"></h2>
                <p  class="cdm-desc"  id="cdm-desc"></p>
                <span class="cdm-badge" id="cdm-badge"></span>
            </div>
            <button class="cdm-close" id="cdm-close" aria-label="Đóng">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    /* ---------- Eye icon SVG ---------- */
    const EYE_SVG = `<svg viewBox="0 0 20 14" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 7 C4 1.5 16 1.5 19 7 C16 12.5 4 12.5 1 7Z"/>
        <circle cx="10" cy="7" r="2.8"/>
        <circle cx="10" cy="7" r="1.2" fill="currentColor" stroke="none"/>
    </svg>`;

    /* ---------- Type → header icon URL ---------- */
    const ICON_MAP = {
        'card-innocent': '/images/icon-innocent.svg',
        'card-guilty':   '/images/icon-guilty.svg',
        'card-modifier': '/images/icon-modifier.svg',
    };

    /* ---------- Close helpers ---------- */
    function closeModal() {
        modal.setAttribute('hidden', '');
        document.body.style.overflow = '';
    }

    modal.querySelector('.cdm-backdrop').addEventListener('click', closeModal);
    modal.querySelector('#cdm-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
    });

    /* ---------- Show detail ---------- */
    function showDetail(cardEl) {
        const title = cardEl.querySelector('.card-title')?.textContent?.trim() || '—';
        const desc  = cardEl.querySelector('.card-desc')?.textContent?.trim()  || '';
        const badge = cardEl.querySelector('.card-type-badge')?.textContent?.trim() || '';
        const typeClass = ['card-innocent', 'card-guilty', 'card-modifier']
            .find(c => cardEl.classList.contains(c)) || '';

        document.getElementById('cdm-title').textContent = title;
        document.getElementById('cdm-desc').textContent  = desc;
        document.getElementById('cdm-badge').textContent = badge;

        const header = document.getElementById('cdm-header');
        header.className = 'cdm-header ' + typeClass;

        const iconEl = document.getElementById('cdm-header-icon');
        const iconUrl = ICON_MAP[typeClass];
        iconEl.style.backgroundImage = iconUrl ? `url('${iconUrl}')` : 'none';

        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    }

    /* ---------- Add eye button to one card ---------- */
    function addEyeBtn(cardEl) {
        if (cardEl.querySelector('.card-eye-btn')) return; // already added

        const btn = document.createElement('button');
        btn.className = 'card-eye-btn';
        btn.type = 'button';
        btn.title = 'Xem chi tiết thẻ bài';
        btn.setAttribute('aria-label', 'Xem chi tiết thẻ bài');
        btn.innerHTML = EYE_SVG;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            showDetail(cardEl);
        });

        cardEl.appendChild(btn);
    }

    /* ---------- MutationObserver: watch for new cards ---------- */
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.classList?.contains('game-card')) addEyeBtn(node);
                node.querySelectorAll?.('.game-card').forEach(addEyeBtn);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    /* ---------- Process cards already in DOM ---------- */
    document.querySelectorAll('.game-card').forEach(addEyeBtn);
})();
