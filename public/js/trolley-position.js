/* trolley-position.js — Dynamically correct trolley Y offset.
   The game JS uses hardcoded translate(220px, 155px) for the bottom track.
   This file watches for that transform and recalculates the correct Y
   based on actual DOM positions, so it works regardless of CSS layout. */
(function () {
    'use strict';

    let correcting = false;

    function correctY() {
        const trolley = document.getElementById('trolley-car');
        if (!trolley || correcting) return;

        const transform = trolley.style.transform;
        if (!transform) return;

        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (!match) return;

        const xVal = match[1];                // keep original X
        const yVal = parseFloat(match[2]);

        // Only intercept large positive Y (= bottom track movement)
        if (yVal <= 50) return;

        // Find the two .track-area divs: [0]=top, [1]=bottom
        const trackAreas = document.querySelectorAll('.track-area');
        if (trackAreas.length < 2) return;

        const topArea = trackAreas[0];
        const botArea = trackAreas[1];

        // Current bounding rect of the trolley (before correction)
        const trolleyRect = trolley.getBoundingClientRect();
        const botRect     = botArea.getBoundingClientRect();

        // We want the trolley's vertical center to land on the bottom track's center
        const trolleyH   = trolleyRect.height || trolley.offsetHeight;
        const targetDeltaY = Math.round(
            (botRect.top + botRect.height / 2) -
            (trolleyRect.top + trolleyH / 2)
        );

        if (Math.abs(targetDeltaY - yVal) < 5) return; // close enough, skip

        correcting = true;
        trolley.style.transform = `translate(${xVal}, ${targetDeltaY}px)`;
        correcting = false;
    }

    // Watch style attribute of #trolley-car for transform changes
    function attachObserver() {
        const trolley = document.getElementById('trolley-car');
        if (!trolley) return;

        const obs = new MutationObserver(() => correctY());
        obs.observe(trolley, { attributes: true, attributeFilter: ['style'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachObserver);
    } else {
        attachObserver();
    }
})();
