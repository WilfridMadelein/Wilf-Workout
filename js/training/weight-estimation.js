// ============================================================
// ESTIMATION DU POIDS
// ============================================================

const KG_PER_LB = 0.45359237;

function normalizeWeightUnit(unit) {
    const value = String(unit ?? "").trim().toLowerCase();

    if (["kg", "kgs", "kilogram", "kilograms"].includes(value)) return "kg";
    if (["lb", "lbs", "pound", "pounds"].includes(value)) return "lbs";

    return null;
}

function normalizeWeightValue(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function convertWeight(value, fromUnit, toUnit) {
    const weight = normalizeWeightValue(value);
    const from = normalizeWeightUnit(fromUnit);
    const to = normalizeWeightUnit(toUnit);

    if (weight === null || !from || !to) return null;
    if (from === to) return weight;

    return from === "lbs"
        ? weight * KG_PER_LB
        : weight / KG_PER_LB;
}

function getMedian(values = []) {
    const sorted = values
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    if (!sorted.length) return null;

    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function getLastWeightUnit(logs = [], fallbackUnit = null) {
    const fallback = normalizeWeightUnit(fallbackUnit);

    const sorted = logs
        .filter(log => log?.completedAt && normalizeWeightUnit(log.weightUnit))
        .sort((a, b) => (Number(b.completedAt) || 0) - (Number(a.completedAt) || 0));

    return normalizeWeightUnit(sorted[0]?.weightUnit) ?? fallback;
}

function getRepresentativeWeight(logs = [], { unit = null } = {}) {
    const weightedLogs = logs.filter(log =>
        log?.completedAt &&
        normalizeWeightValue(log.weight) > 0 &&
        normalizeWeightUnit(log.weightUnit)
    );

    if (!weightedLogs.length) return null;

    const displayUnit =
        normalizeWeightUnit(unit) ??
        getLastWeightUnit(weightedLogs) ??
        "kg";

    const weightsKg = weightedLogs
        .map(log => convertWeight(log.weight, log.weightUnit, "kg"))
        .filter(value => value !== null);

    const valueKg = getMedian(weightsKg);
    if (valueKg === null) return null;

    return {
        value: convertWeight(valueKg, "kg", displayUnit),
        unit: displayUnit,
        valueKg,
        sampleCount: weightsKg.length
    };
}

function roundSuggestedWeight(value) {
    const weight = normalizeWeightValue(value);
    if (weight === null) return null;

    const step = weight < 20 ? 2.5 : 5;
    return Math.round(weight / step) * step;
}

export {
    KG_PER_LB,
    normalizeWeightUnit,
    normalizeWeightValue,
    convertWeight,
    getMedian,
    getLastWeightUnit,
    getRepresentativeWeight,
    roundSuggestedWeight
};