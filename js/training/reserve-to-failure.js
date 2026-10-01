// ============================================================
// RÉSERVE AVANT ÉCHEC
// ============================================================

function normalizeWorkoutValue(value) {
    return Math.max(0, Math.round(Number(value) || 0));
}

function normalizeReserveToFailure(value) {
    if (value === null || value === undefined || value === "") return null;

    const reserve = Number(value);
    return Number.isFinite(reserve) && reserve >= 0 ? reserve : null;
}

function getReserveToFailureMaximum(logValue, valueUnit) {
    const value = normalizeWorkoutValue(logValue);
    const duration = valueUnit === "sec";

    return Math.min(
        getReserveToFailureStep(logValue, valueUnit) * 12,
        Math.max(duration ? 20 : 8, value)
    );
}

function getReserveToFailureStep(logValue, valueUnit) {
    const value = normalizeWorkoutValue(logValue);

    if (valueUnit === "sec") {
        if (value <= 20) return 2;
        if (value <= 44) return 3;
        return 5;
    }

    if (value <= 9) return 1;
    if (value <= 19) return 2;
    return 3;
}

function getReserveToFailureOptions(logValue, valueUnit) {
    const maximum = getReserveToFailureMaximum(logValue, valueUnit);
    const step = getReserveToFailureStep(logValue, valueUnit);
    const values = [];

    for (let value = 0; value <= maximum; value += step) values.push(value);
    if (values.at(-1) !== maximum) values.push(maximum);

    return values;
}

function getFailureCapacity(log) {
    const reserve = normalizeReserveToFailure(log?.reserveToFailure);
    if (reserve === null) return null;

    return normalizeWorkoutValue(log?.value) + reserve;
}

function formatReserveToFailure(value, valueUnit) {
    const reserve = normalizeReserveToFailure(value);

    if (reserve === null) return "Non renseigné";
    if (reserve === 0) return "0 — échec atteint";

    return `${reserve} ${valueUnit === "sec" ? "sec" : `rep${reserve !== 1 ? "s" : ""}`}`;
}

export {
    normalizeReserveToFailure,
    getReserveToFailureMaximum,
    getReserveToFailureStep,
    getReserveToFailureOptions,
    getFailureCapacity,
    formatReserveToFailure
};