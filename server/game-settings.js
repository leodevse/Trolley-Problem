const { CARD_POOLS } = require('./cards-data');

const MAX_CARDS_PER_TYPE = Math.min(
    CARD_POOLS.innocent.length,
    CARD_POOLS.guilty.length,
    CARD_POOLS.modifier.length
);

const DEFAULT_GAME_SETTINGS = {
    roundDuration: 30,
    debateDuration: 60,
    cardsPerType: 5,
    matchCycles: 5
};

function getSettingsLimits() {
    return {
        maxCardsPerType: MAX_CARDS_PER_TYPE,
        minRoundDuration: 10,
        maxRoundDuration: 300,
        minDebateDuration: 15,
        maxDebateDuration: 600,
        minCardsPerType: 1,
        minMatchCycles: 1
    };
}

function isOdd(n) {
    return n % 2 === 1;
}

function validateGameSettings(raw) {
    const limits = getSettingsLimits();
    const errors = [];

    const roundDuration = Number(raw?.roundDuration);
    const debateDuration = Number(raw?.debateDuration);
    const cardsPerType = Number(raw?.cardsPerType);
    const matchCycles = Number(raw?.matchCycles);

    if (
        !Number.isFinite(roundDuration) ||
        roundDuration < limits.minRoundDuration ||
        roundDuration > limits.maxRoundDuration
    ) {
        errors.push(`Thời gian mỗi vòng đặt bài: ${limits.minRoundDuration}–${limits.maxRoundDuration} giây.`);
    }

    if (
        !Number.isFinite(debateDuration) ||
        debateDuration < limits.minDebateDuration ||
        debateDuration > limits.maxDebateDuration
    ) {
        errors.push(`Thời gian thảo luận: ${limits.minDebateDuration}–${limits.maxDebateDuration} giây.`);
    }

    if (
        !Number.isFinite(cardsPerType) ||
        cardsPerType < limits.minCardsPerType ||
        cardsPerType > limits.maxCardsPerType
    ) {
        errors.push(`Số lá mỗi loại: ${limits.minCardsPerType}–${limits.maxCardsPerType}.`);
    } else if (!isOdd(cardsPerType)) {
        errors.push('Số lá mỗi loại phải là số lẻ (1, 3, 5, …) để tránh hòa điểm.');
    }

    if (!Number.isFinite(matchCycles) || matchCycles < limits.minMatchCycles) {
        errors.push('Số vòng trận không hợp lệ.');
    } else if (!isOdd(matchCycles)) {
        errors.push('Số vòng trận phải là số lẻ (1, 3, 5, …) để có người thắng, không hòa.');
    } else if (Number.isFinite(cardsPerType) && isOdd(cardsPerType) && matchCycles > cardsPerType) {
        errors.push(`Số vòng trận phải ≤ số lá mỗi loại (${cardsPerType}).`);
    }

    if (errors.length) return { error: errors.join(' ') };

    return {
        settings: {
            roundDuration: Math.round(roundDuration),
            debateDuration: Math.round(debateDuration),
            cardsPerType: Math.round(cardsPerType),
            matchCycles: Math.round(matchCycles)
        }
    };
}

function normalizeGameSettings(raw) {
    const result = validateGameSettings({ ...DEFAULT_GAME_SETTINGS, ...raw });
    return result.settings || { ...DEFAULT_GAME_SETTINGS };
}

module.exports = {
    DEFAULT_GAME_SETTINGS,
    getSettingsLimits,
    validateGameSettings,
    normalizeGameSettings
};
