import {
    getExerciseSplitType
} from "../exercises/exercise-split.js";

// ============================================================
// TEMPS APPROXIMATIF D'UN PLAN
// ============================================================

function getSafeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function getTempoSeconds(tempo = {}) {
    const values = [
        tempo.first,
        tempo.second,
        tempo.third,
        tempo.fourth
    ];

    return values.reduce((total, value, index) => {
        if (String(value).trim().toUpperCase() === "X") return total + 1;

        const seconds = getSafeNumber(value);

        if ((index === 0 || index === 2) && seconds === 0) {
            return total + 1;
        }

        return total + seconds;
    }, 0);
}

function getPlanExerciseDurationSeconds(planExercise) {
    const splitType = getExerciseSplitType(planExercise?.exercise);
    const sets = getSafeNumber(planExercise?.sets);
    const value = getSafeNumber(planExercise?.value);
    const rest = getSafeNumber(planExercise?.rest);

    let workSeconds;

    if (planExercise?.valueUnit === "sec") {
        workSeconds = value;
    } else {
        const repetitions =
            value * (splitType === "alternate" ? 2 : 1);

        workSeconds =
            repetitions *
            getTempoSeconds(planExercise?.tempo);
    }

    const splitMultiplier =
        splitType === "split" ? 2 : 1;

    return (workSeconds + rest) * sets * splitMultiplier;
}

function getPlanDurationSeconds(plan) {
    return (plan?.exercises ?? []).reduce(
        (total, exercise) =>
            total + getPlanExerciseDurationSeconds(exercise),
        0
    );
}

function getPlanDurationMinutes(plan) {
    const seconds = getPlanDurationSeconds(plan);
    if (seconds <= 0) return 0;

    return Math.max(1, Math.round(seconds / 60));
}

function formatPlanDuration(plan) {
    const minutes = getPlanDurationMinutes(plan);

    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

export {
    getTempoSeconds,
    getPlanExerciseDurationSeconds,
    getPlanDurationSeconds,
    getPlanDurationMinutes,
    formatPlanDuration
};