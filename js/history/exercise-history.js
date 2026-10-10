import { getWeightVariantKey } from "../equipment/weight-equipment.js";
import { getWorkoutExerciseSides, getWorkoutSeriesLog, getWorkoutSideLabel } from "../workout/workout-session.js";
import { convertWeight } from "../training/weight-estimation.js";

// ============================================================
// HISTORIQUE D'UN EXERCICE
// ============================================================

const EXERCISE_RECORD_ORDER = ["singleReps", "totalReps", "singleDuration", "totalDuration", "maxWeight", "singleVolume", "totalVolume", "estimatedReps", "estimated1RM", "estimatedFiveSeconds"];
const EXERCISE_RECORD_LABELS = {
    singleReps: "Répétitions en une série",
    totalReps: "Répétitions totales",
    singleDuration: "Durée en une série",
    totalDuration: "Durée totale",
    maxWeight: "Poids utilisé",
    singleVolume: "Volume en une série",
    totalVolume: "Volume total",
    estimatedReps: "Répétitions maximales estimées (RIR)",
    estimated1RM: "1RM estimé (Epley + RIR)",
    estimatedFiveSeconds: "Charge théorique sur 5 s (expérimental)"
};

function getExerciseKey(exercise) { return getWeightVariantKey(exercise, exercise?.variantEquipment); }

function getExerciseHistory(workoutHistory, exercise) {
    const exerciseKey = getExerciseKey(exercise);
    const records = [];
    (workoutHistory ?? []).forEach(session => {
        const entries = [];
        (session.sets ?? []).forEach(set => (set.exercises ?? []).forEach(workoutExercise => {
            if (String(workoutExercise.exercise?.baseExerciseId ?? workoutExercise.exercise?.ID) !== String(exercise.baseExerciseId ?? exercise.ID)) return;
            (workoutExercise.series ?? []).forEach(series => getWorkoutExerciseSides(workoutExercise).forEach(side => {
                const log = getWorkoutSeriesLog(series, side.key);
                if (!log?.completedAt) return;
                if (getWeightVariantKey(workoutExercise.exercise, Object.hasOwn(log, "weightEquipment") ? log.weightEquipment : workoutExercise.weightEquipment) !== exerciseKey) return;
                entries.push({ series, setNumber: set.group, seriesNumber: series.number, sideKey: side.key, sideLabel: getWorkoutSideLabel(side.key), splitType: workoutExercise.splitType, log });
            }));
        }));
        if (entries.length) records.push({ session, entries });
    });
    return records.sort((a, b) => Number(b.session.startedAt) - Number(a.session.startedAt));
}

function groupEntriesBySeries(entries) {
    const groups = new Map();
    entries.forEach(entry => {
        if (!groups.has(entry.series)) groups.set(entry.series, []);
        groups.get(entry.series).push(entry);
    });
    const sideOrder = { left: 0, right: 1, main: 2 };
    return [...groups.values()].map(group => group.sort((a, b) => sideOrder[a.sideKey] - sideOrder[b.sideKey]));
}

function getEntryMultiplier(entry) { return entry.splitType === "alternate" ? 2 : 1; }
function createMetric(value, unit, compareValue = value) { return { value, unit, compareValue }; }
function setHighest(current, candidate) { return !candidate ? current : !current || candidate.compareValue > current.compareValue ? candidate : current; }

function getExerciseSessionMetrics(record) {
    const metrics = { singleReps: null, totalReps: null, singleDuration: null, totalDuration: null, maxWeight: null, singleVolume: null, totalVolume: null, estimatedReps: null, estimated1RM: null, estimatedFiveSeconds: null };
    let totalReps = 0;
    let totalDuration = 0;
    let totalVolumeKg = 0;
    let totalVolumeUnit = null;

    record.entries.forEach(entry => {
        const value = Math.max(0, Number(entry.log.value) || 0);
        const weight = entry.log.weightUnit === "Res" || !entry.log.weightEquipment && entry.log.weightUnit === "Res" ? 0 : Math.max(0, Number(entry.log.weight) || 0);
        const multiplier = getEntryMultiplier(entry);
        const isDuration = entry.log.valueUnit === "sec";

        if (isDuration) {
            totalDuration += value * multiplier;
            if (value > 0) metrics.singleDuration = setHighest(metrics.singleDuration, createMetric(value, "sec"));
        } else {
            totalReps += value * multiplier;
            if (value > 0) metrics.singleReps = setHighest(metrics.singleReps, createMetric(value, "rep"));
        }

        const reserve = entry.log.reserveToFailure === null || entry.log.reserveToFailure === undefined || entry.log.reserveToFailure === "" ? null : Number(entry.log.reserveToFailure);
        if (!isDuration && value > 0 && reserve !== null && Number.isFinite(reserve) && reserve >= 0 && reserve <= 30 && weight === 0) metrics.estimatedReps = setHighest(metrics.estimatedReps, { ...createMetric(value + reserve, "rep"), estimated: true });
        if (weight <= 0) return;
        const weightKg = convertWeight(weight, entry.log.weightUnit, "kg");
        if (weightKg === null) return;
        metrics.maxWeight = setHighest(metrics.maxWeight, { value: weight, weight, unit: entry.log.weightUnit, compareValue: weightKg });
        if (!isDuration && value > 0 && reserve !== null && Number.isFinite(reserve) && reserve >= 0 && value + reserve <= 12) {
            const estimateKg = weightKg * (1 + (value + reserve) / 30);
            metrics.estimated1RM = setHighest(metrics.estimated1RM, { value: convertWeight(estimateKg, "kg", entry.log.weightUnit), unit: entry.log.weightUnit, compareValue: estimateKg, estimated: true });
        }
        if (isDuration || value <= 0) return;

        const volumeKg = weightKg * value * multiplier;
        metrics.singleVolume = setHighest(metrics.singleVolume, { value: weight * value * multiplier, unit: entry.log.weightUnit, compareValue: volumeKg });
        totalVolumeKg += volumeKg;
        totalVolumeUnit ??= entry.log.weightUnit;
    });

    if (totalReps > 0) metrics.totalReps = createMetric(totalReps, "rep");
    if (totalDuration > 0) metrics.totalDuration = createMetric(totalDuration, "sec");
    if (totalVolumeKg > 0) {
        const displayValue = convertWeight(totalVolumeKg, "kg", totalVolumeUnit) ?? totalVolumeKg;
        metrics.totalVolume = { value: displayValue, unit: totalVolumeUnit, compareValue: totalVolumeKg };
    }
    return metrics;
}

// Estimation descriptive individuelle : charge = a + b × ln(durée).
// N'utilise que les durées corrigées par la réserve déclarée et plusieurs charges;
// ceci n'est PAS une équation physiologique validée.
function estimateFiveSecondLoad(samples) {
    const valid = samples.filter(item => item.duration >= 5 && item.duration <= 60 && item.weightKg > 0);
    if (valid.length < 3 || new Set(valid.map(item => Math.round(item.weightKg * 100))).size < 2 || new Set(valid.map(item => Math.round(item.duration))).size < 2) return null;
    const near = valid.some(item => item.duration <= 12);
    if (!near) return null; // Refuse les extrapolations lointaines.
    const xs = valid.map(item => Math.log(item.duration)), ys = valid.map(item => item.weightKg);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length, meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const variance = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
    if (variance < 0.01) return null;
    const slope = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / variance;
    if (slope >= 0) return null;
    const estimateKg = meanY + slope * (Math.log(5) - meanX), observedMax = Math.max(...ys);
    if (!Number.isFinite(estimateKg) || estimateKg < observedMax * 0.8 || estimateKg > observedMax * 1.35) return null;
    return estimateKg;
}
function getExerciseMetricTimeline(historyRecords) {
    const samples = [];
    return [...historyRecords].reverse().map(record => {
        const metrics = getExerciseSessionMetrics(record);
        record.entries.forEach(entry => {
            const log = entry.log, weightKg = convertWeight(log.weight, log.weightUnit, "kg");
            const reserve = log.reserveToFailure === null || log.reserveToFailure === undefined || log.reserveToFailure === "" ? null : Number(log.reserveToFailure);
            if (log.valueUnit === "sec" && weightKg > 0 && Number(log.value) > 0 && reserve !== null && Number.isFinite(reserve) && reserve >= 0) samples.push({ duration: Number(log.value) + reserve, weightKg });
        });
        const estimateKg = estimateFiveSecondLoad(samples);
        if (estimateKg !== null) {
            const lastUnit = [...record.entries].reverse().find(entry => Number(entry.log.weight) > 0)?.log.weightUnit ?? "kg";
            metrics.estimatedFiveSeconds = { value: convertWeight(estimateKg, "kg", lastUnit), unit: lastUnit, compareValue: estimateKg, estimated: true };
        }
        return { record, metrics };
    });
}
function getExerciseRecords(historyRecords) {
    const records = Object.fromEntries(EXERCISE_RECORD_ORDER.map(key => [key, null]));
    getExerciseMetricTimeline(historyRecords).forEach(({ record, metrics }) => EXERCISE_RECORD_ORDER.forEach(key => {
        const metric = metrics[key];
        if (metric && (!records[key] || metric.compareValue > records[key].compareValue)) records[key] = { ...metric, session: record.session };
    }));
    return records;
}
function getExerciseRecordAchievements(historyRecords, session) {
    const timeline = getExerciseMetricTimeline(historyRecords);
    const targetIndex = timeline.findIndex(item => String(item.record.session.id) === String(session?.id));
    if (targetIndex < 0) return [];
    const { record, metrics } = timeline[targetIndex];
    const previousRecords = Object.fromEntries(EXERCISE_RECORD_ORDER.map(key => [key, null]));
    timeline.slice(0, targetIndex).forEach(item => EXERCISE_RECORD_ORDER.forEach(key => {
        const metric = item.metrics[key];
        if (metric && (!previousRecords[key] || metric.compareValue > previousRecords[key].compareValue)) previousRecords[key] = metric;
    }));
    return EXERCISE_RECORD_ORDER.filter(key => !key.startsWith("estimated") && metrics[key] && (!previousRecords[key] || metrics[key].compareValue > previousRecords[key].compareValue))
        .map(key => ({ key, label: EXERCISE_RECORD_LABELS[key], ...metrics[key], session: record.session }));
}

export { EXERCISE_RECORD_ORDER, EXERCISE_RECORD_LABELS, getExerciseKey, getExerciseHistory, getExerciseSessionMetrics, getExerciseMetricTimeline, getExerciseRecords, getExerciseRecordAchievements, groupEntriesBySeries };
