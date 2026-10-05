import { isIsometricExercise } from "../../exercises/exercise-search.js";
import { getPlanExerciseDurationSeconds } from "../../plans/plan-timing.js";

// ============================================================
// AJUSTEMENT DE DURÉE DU PLAN AUTOMATIQUE
// ============================================================

const AUTO_PLAN_TIME_TOLERANCE_MINUTES = { strict: 5, flexible: 10 };
const AUTO_PLAN_PRESCRIPTION_DEFAULTS = {
    sets: 3,
    reps: 8,
    time: 30,
    rest: 45,
    tempo: { first: 2, second: 0, third: 1, fourth: 0 }
};

function safePriority(value, fallback) {
    const number = Number(value);
    return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : fallback;
}

function createPreferredPrescription(candidate, input) {
    const priorities = input?.request?.planPriorities ?? {};
    const isometric = isIsometricExercise(candidate.exercise);

    return {
        exercise: candidate.exercise,
        sets: safePriority(priorities.sets, AUTO_PLAN_PRESCRIPTION_DEFAULTS.sets),
        value: isometric
            ? safePriority(priorities.time, AUTO_PLAN_PRESCRIPTION_DEFAULTS.time)
            : safePriority(priorities.reps, AUTO_PLAN_PRESCRIPTION_DEFAULTS.reps),
        valueUnit: isometric ? "sec" : "rep",
        rest: safePriority(priorities.rest, AUTO_PLAN_PRESCRIPTION_DEFAULTS.rest),
        tempo: {
            first: safePriority(priorities.tempo?.first, AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.first),
            second: safePriority(priorities.tempo?.second, AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.second),
            third: safePriority(priorities.tempo?.third, AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.third),
            fourth: safePriority(priorities.tempo?.fourth, AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.fourth)
        }
    };
}

function getPrescriptionDurationSeconds(prescription) {
    return getPlanExerciseDurationSeconds(prescription);
}

function getWorkoutPrescriptionDurationSeconds(prescriptions = []) {
    return prescriptions.reduce((total, prescription) => total + getPrescriptionDurationSeconds(prescription), 0);
}

function getPriorityStrength(input, key) {
    const priorities = input?.request?.planPriorities ?? {};
    if (key.startsWith("tempo.")) {
        const tempoKey = key.split(".")[1];
        return priorities.tempo?.[tempoKey] === null || priorities.tempo?.[tempoKey] === undefined ? 1 : 3;
    }
    return priorities[key] === null || priorities[key] === undefined ? 1 : 3;
}

function getReductionOptions(prescription, input) {
    const options = [];
    const currentSeconds = getPrescriptionDurationSeconds(prescription);
    const push = (key, next, cost) => {
        const copy = { ...prescription, tempo: { ...prescription.tempo }, [key]: next };
        if (key.startsWith("tempo.")) copy.tempo[key.split(".")[1]] = next;
        const savedSeconds = currentSeconds - getPrescriptionDurationSeconds(copy);
        if (savedSeconds > 0) options.push({ key, next, cost, savedSeconds, efficiency: savedSeconds / cost });
    };

    if (prescription.rest > 0) push("rest", Math.max(0, prescription.rest - 15), getPriorityStrength(input, "rest"));
    if (prescription.sets > 1) push("sets", prescription.sets - 1, getPriorityStrength(input, "sets") * 5);

    if (prescription.valueUnit === "rep" && prescription.value > 3) {
        push("value", prescription.value - 1, getPriorityStrength(input, "reps") * 2);
    }

    if (prescription.valueUnit === "sec" && prescription.value > 10) {
        push("value", Math.max(10, prescription.value - 5), getPriorityStrength(input, "time") * 2);
    }

    if (prescription.tempo.first > 1) push("tempo.first", prescription.tempo.first - 1, getPriorityStrength(input, "tempo.first") * 3);
    if (prescription.tempo.third > 1) push("tempo.third", prescription.tempo.third - 1, getPriorityStrength(input, "tempo.third") * 3);

    return options.sort((first, second) => second.efficiency - first.efficiency);
}

function applyReduction(prescription, reduction) {
    if (reduction.key.startsWith("tempo.")) prescription.tempo[reduction.key.split(".")[1]] = reduction.next;
    else if (reduction.key === "value") prescription.value = reduction.next;
    else prescription[reduction.key] = reduction.next;
}

function fitPrescriptionsToTarget(selected, input, targetSeconds, maximumSeconds = targetSeconds) {
    const prescriptions = selected.map(item => createPreferredPrescription(item.candidate, input));
    let durationSeconds = getWorkoutPrescriptionDurationSeconds(prescriptions);
    let safety = 0;

    while (durationSeconds > maximumSeconds && safety < 10000) {
        let best = null;

        prescriptions.forEach((prescription, index) => {
            const option = getReductionOptions(prescription, input)[0];
            if (!option) return;
            if (!best || option.efficiency > best.option.efficiency) best = { index, option };
        });

        if (!best) break;
        applyReduction(prescriptions[best.index], best.option);
        durationSeconds = getWorkoutPrescriptionDurationSeconds(prescriptions);
        safety += 1;
    }

    return {
        prescriptions,
        durationSeconds,
        durationMinutes: Math.round(durationSeconds / 60),
        targetSeconds,
        deviationSeconds: durationSeconds - targetSeconds,
        deviationMinutes: Math.abs(durationSeconds - targetSeconds) / 60
    };
}

function getTimePenalty(durationSeconds, targetSeconds, mode = "strict") {
    const deviationMinutes = Math.abs(durationSeconds - targetSeconds) / 60;
    if (mode === "strict") {
        const base = deviationMinutes * deviationMinutes * 5;
        return -(base + (deviationMinutes > 5 ? 5000 + (deviationMinutes - 5) * 1000 : 0));
    }

    return -(Math.pow(deviationMinutes, 1.6) * 6);
}

function isWithinTimeTolerance(durationSeconds, targetSeconds, mode = "strict") {
    const tolerance = AUTO_PLAN_TIME_TOLERANCE_MINUTES[mode] ?? AUTO_PLAN_TIME_TOLERANCE_MINUTES.strict;
    return Math.abs(durationSeconds - targetSeconds) <= tolerance * 60;
}

export {
    AUTO_PLAN_TIME_TOLERANCE_MINUTES,
    AUTO_PLAN_PRESCRIPTION_DEFAULTS,
    createPreferredPrescription,
    getPrescriptionDurationSeconds,
    getWorkoutPrescriptionDurationSeconds,
    fitPrescriptionsToTarget,
    getTimePenalty,
    isWithinTimeTolerance
};
