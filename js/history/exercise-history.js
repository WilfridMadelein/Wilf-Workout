import { getWorkoutExerciseSides, getWorkoutSeriesLog, getWorkoutSideLabel } from "../workout/workout-session.js";
import { convertWeight } from "../training/weight-estimation.js";

// ============================================================
// HISTORIQUE D'UN EXERCICE
// ============================================================

const EXERCISE_RECORD_ORDER = ["singleReps", "totalReps", "singleDuration", "totalDuration", "maxWeight", "singleVolume", "totalVolume"];
const EXERCISE_RECORD_LABELS = {
    singleReps: "Répétitions en une série",
    totalReps: "Répétitions totales",
    singleDuration: "Durée en une série",
    totalDuration: "Durée totale",
    maxWeight: "Poids utilisé",
    singleVolume: "Volume en une série",
    totalVolume: "Volume total"
};

function getExerciseKey(exercise) { return String(exercise?.ID ?? exercise?.nom ?? "exercise"); }

function getExerciseHistory(workoutHistory, exercise) {
    const exerciseKey = getExerciseKey(exercise);
    const records = [];
    (workoutHistory ?? []).forEach(session => {
        const entries = [];
        (session.sets ?? []).forEach(set => (set.exercises ?? []).forEach(workoutExercise => {
            if (getExerciseKey(workoutExercise.exercise) !== exerciseKey) return;
            (workoutExercise.series ?? []).forEach(series => getWorkoutExerciseSides(workoutExercise).forEach(side => {
                const log = getWorkoutSeriesLog(series, side.key);
                if (!log?.completedAt) return;
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
    const metrics = { singleReps: null, totalReps: null, singleDuration: null, totalDuration: null, maxWeight: null, singleVolume: null, totalVolume: null };
    let totalReps = 0;
    let totalDuration = 0;
    let totalVolumeKg = 0;
    let totalVolumeUnit = null;

    record.entries.forEach(entry => {
        const value = Math.max(0, Number(entry.log.value) || 0);
        const weight = Math.max(0, Number(entry.log.weight) || 0);
        const multiplier = getEntryMultiplier(entry);
        const isDuration = entry.log.valueUnit === "sec";

        if (isDuration) {
            totalDuration += value * multiplier;
            if (value > 0) metrics.singleDuration = setHighest(metrics.singleDuration, createMetric(value, "sec"));
        } else {
            totalReps += value * multiplier;
            if (value > 0) metrics.singleReps = setHighest(metrics.singleReps, createMetric(value, "rep"));
        }

        if (weight <= 0) return;
        const weightKg = convertWeight(weight, entry.log.weightUnit, "kg");
        if (weightKg === null) return;
        metrics.maxWeight = setHighest(metrics.maxWeight, { value: weight, weight, unit: entry.log.weightUnit, compareValue: weightKg });
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

function getExerciseRecords(historyRecords) {
    const records = Object.fromEntries(EXERCISE_RECORD_ORDER.map(key => [key, null]));
    historyRecords.forEach(record => {
        const metrics = getExerciseSessionMetrics(record);
        EXERCISE_RECORD_ORDER.forEach(key => {
            const metric = metrics[key];
            if (!metric || (records[key] && metric.compareValue <= records[key].compareValue)) return;
            records[key] = { ...metric, session: record.session };
        });
    });
    return records;
}

function getExerciseRecordAchievements(historyRecords, session) {
    const target = historyRecords.find(record => String(record.session.id) === String(session?.id));
    if (!target) return [];
    const targetMetrics = getExerciseSessionMetrics(target);
    const previousRecords = getExerciseRecords(historyRecords.filter(record => Number(record.session.startedAt) < Number(target.session.startedAt)));
    return EXERCISE_RECORD_ORDER.filter(key => {
        const metric = targetMetrics[key];
        return metric && (!previousRecords[key] || metric.compareValue > previousRecords[key].compareValue);
    }).map(key => ({ key, label: EXERCISE_RECORD_LABELS[key], ...targetMetrics[key], session: target.session }));
}

export { EXERCISE_RECORD_ORDER, EXERCISE_RECORD_LABELS, getExerciseKey, getExerciseHistory, getExerciseSessionMetrics, getExerciseRecords, getExerciseRecordAchievements, groupEntriesBySeries };
