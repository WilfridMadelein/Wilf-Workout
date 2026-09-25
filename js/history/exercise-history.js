import { getWorkoutExerciseSides, getWorkoutSeriesLog, getWorkoutSideLabel } from "../workout/workout-session.js";

// ============================================================
// HISTORIQUE D'UN EXERCICE
// ============================================================

function getExerciseKey(exercise) {
    return String(exercise?.ID ?? exercise?.nom ?? "exercise");
}

function getExerciseHistory(workoutHistory, exercise) {
    const exerciseKey = getExerciseKey(exercise);
    const records = [];

    workoutHistory.forEach(session => {
        const entries = [];

        session.sets.forEach(set => {
            set.exercises.forEach(workoutExercise => {
                if (getExerciseKey(workoutExercise.exercise) !== exerciseKey) return;

                workoutExercise.series.forEach(series => {
                    getWorkoutExerciseSides(workoutExercise).forEach(side => {
                        const log = getWorkoutSeriesLog(series, side.key);
                        if (!log?.completedAt) return;

                        entries.push({
                            setNumber: set.group,
                            seriesNumber: series.number,
                            sideKey: side.key,
                            sideLabel: getWorkoutSideLabel(side.key),
                            splitType: workoutExercise.splitType,
                            log
                        });
                    });
                });
            });
        });

        if (entries.length) records.push({ session, entries });
    });

    return records.sort((a, b) => b.session.startedAt - a.session.startedAt);
}

function weightToKg(weight, unit) {
    const value = Math.max(0, Number(weight) || 0);
    return String(unit).toLowerCase().startsWith("lb") ? value * 0.45359237 : value;
}

function getEntryMultiplier(entry) {
    return entry.splitType === "alternate" ? 2 : 1;
}

function getExerciseRecords(historyRecords) {
    let totalValue = null;
    let singleValue = null;
    let singleVolume = null;
    let totalVolume = null;
    let maxWeight = null;

    historyRecords.forEach(record => {
        let sessionReps = 0;
        let sessionSeconds = 0;
        let sessionVolumeKg = 0;
        let sessionVolumeDisplayUnit = null;

        record.entries.forEach(entry => {
            const value = Math.max(0, Number(entry.log.value) || 0);
            const weight = Math.max(0, Number(entry.log.weight) || 0);
            const multiplier = getEntryMultiplier(entry);
            const isDuration = entry.log.valueUnit === "sec";

            if (isDuration) sessionSeconds += value * multiplier;
            else sessionReps += value * multiplier;

            if (!singleValue || value > singleValue.value) singleValue = { value, unit: entry.log.valueUnit };

            if (weight <= 0) return;

            const weightKg = weightToKg(weight, entry.log.weightUnit);
            if (!maxWeight || weightKg > maxWeight.compareValue) maxWeight = { compareValue: weightKg, weight, unit: entry.log.weightUnit };

            if (isDuration || value <= 0) return;

            const volumeKg = weightKg * value * multiplier;
            if (!singleVolume || volumeKg > singleVolume.compareValue) {
                singleVolume = { compareValue: volumeKg, value: weight * value * multiplier, unit: entry.log.weightUnit };
            }

            sessionVolumeKg += volumeKg;
            sessionVolumeDisplayUnit ??= entry.log.weightUnit;
        });

        const sessionValue = sessionSeconds > 0
            ? { value: sessionSeconds, unit: "sec" }
            : { value: sessionReps, unit: "rep" };

        if (sessionValue.value > 0 && (!totalValue || sessionValue.value > totalValue.value)) totalValue = sessionValue;

        if (sessionVolumeKg > 0 && (!totalVolume || sessionVolumeKg > totalVolume.compareValue)) {
            const factor = String(sessionVolumeDisplayUnit).toLowerCase().startsWith("lb") ? 2.2046226218 : 1;
            totalVolume = { compareValue: sessionVolumeKg, value: sessionVolumeKg * factor, unit: sessionVolumeDisplayUnit };
        }
    });

    return { totalValue, singleValue, singleVolume, totalVolume, maxWeight };
}

export { getExerciseHistory, getExerciseRecords };