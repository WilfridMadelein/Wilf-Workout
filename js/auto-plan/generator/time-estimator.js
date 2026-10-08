import { isIsometricExercise } from "../../exercises/exercise-search.js";
import { getPlanExerciseDurationSeconds } from "../../plans/plan-timing.js";

// ============================================================
// AJUSTEMENT DE DURÉE ET PRESCRIPTION DU PLAN AUTOMATIQUE
// ============================================================

const AUTO_PLAN_TIME_TOLERANCE_MINUTES = { strict: 5, flexible: 10 };
const AUTO_PLAN_PRESCRIPTION_DEFAULTS = {
    sets: 2,
    reps: 8,
    time: 30,
    rest: 45,
    tempo: { first: 2, second: 0, third: 1, fourth: 0 }
};
const AUTO_PLAN_ISOMETRIC_TEMPO = { first: 1, second: 0, third: 0, fourth: 0 };
const AUTO_PLAN_TEMPO_PROFILES = [
    { tempo: { first: 2, second: 0, third: 1, fourth: 0 }, weight: 42 },
    { tempo: { first: 3, second: 0, third: 1, fourth: 0 }, weight: 17 },
    { tempo: { first: 1, second: 0, third: 1, fourth: 0 }, weight: 14 },
    { tempo: { first: 2, second: 0, third: 0, fourth: 0 }, weight: 12 },
    { tempo: { first: 2, second: 1, third: 1, fourth: 1 }, weight: 8 },
    { tempo: { first: 3, second: 1, third: 1, fourth: 0 }, weight: 4 },
    { tempo: { first: 1, second: 1, third: 1, fourth: 1 }, weight: 3 }
];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hasPriority(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function safePriority(value, fallback) {
    return hasPriority(value) ? Number(value) : fallback;
}

function weightedChoice(entries, random = Math.random) {
    const usable = entries.filter(entry => Number.isFinite(entry.weight) && entry.weight > 0);
    if (!usable.length) return entries[0]?.value ?? null;

    const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = random() * total;

    for (const entry of usable) {
        cursor -= entry.weight;
        if (cursor <= 0) return entry.value;
    }

    return usable.at(-1).value;
}

function getPerExerciseBudget(targetSeconds, exerciseCount) {
    return Math.max(30, Number(targetSeconds) / Math.max(1, Number(exerciseCount) || 1));
}

function getBudgetSetCenter(perExerciseBudget) {
    if (perExerciseBudget <= 105) return 1;
    if (perExerciseBudget <= 210) return 2;
    if (perExerciseBudget <= 360) return 3;
    if (perExerciseBudget <= 540) return 4;
    if (perExerciseBudget <= 720) return 5;
    return 6;
}

function getBudgetRestCenter(perExerciseBudget) {
    if (perExerciseBudget <= 120) return 15;
    if (perExerciseBudget <= 210) return 30;
    if (perExerciseBudget <= 360) return 45;
    if (perExerciseBudget <= 540) return 60;
    return 75;
}

function createPrescriptionProfile(selected, input, targetSeconds) {
    const priorities = input?.request?.planPriorities ?? {};
    const perExerciseBudget = getPerExerciseBudget(targetSeconds, selected?.length ?? 1);

    return {
        perExerciseBudget,
        setsWasRequested: hasPriority(priorities.sets),
        sets: hasPriority(priorities.sets) ? clamp(Number(priorities.sets), 1, 12) : getBudgetSetCenter(perExerciseBudget),
        reps: safePriority(priorities.reps, AUTO_PLAN_PRESCRIPTION_DEFAULTS.reps),
        time: safePriority(priorities.time, AUTO_PLAN_PRESCRIPTION_DEFAULTS.time),
        rest: hasPriority(priorities.rest) ? Math.max(0, Number(priorities.rest)) : getBudgetRestCenter(perExerciseBudget),
        tempo: {
            first: hasPriority(priorities.tempo?.first) ? Number(priorities.tempo.first) : null,
            second: hasPriority(priorities.tempo?.second) ? Number(priorities.tempo.second) : null,
            third: hasPriority(priorities.tempo?.third) ? Number(priorities.tempo.third) : null,
            fourth: hasPriority(priorities.tempo?.fourth) ? Number(priorities.tempo.fourth) : null
        }
    };
}

function getDistanceWeight(distance, weights = [100, 30, 7, 1.5]) {
    const index = Math.min(Math.abs(Math.round(distance)), weights.length - 1);
    return weights[index];
}

function sampleSetCount(profile, input, random) {
    const requested = input?.request?.planPriorities?.sets;
    const center = profile.sets;
    const maximum = profile.setsWasRequested ? Math.min(12, Math.max(1, center + 2)) : 6;
    const entries = [];

    for (let sets = 1; sets <= maximum; sets += 1) {
        const distance = Math.abs(sets - center);
        const weight = getDistanceWeight(distance, hasPriority(requested) ? [130, 24, 3.5, 0.5] : [100, 34, 5, 0.5]);
        entries.push({ value: sets, weight });
    }

    return weightedChoice(entries, random);
}

function sampleAround(center, offsets, min, max, random) {
    const entries = offsets.map(({ offset, weight }) => ({ value: clamp(center + offset, min, max), weight }));
    const merged = new Map();
    entries.forEach(entry => merged.set(entry.value, (merged.get(entry.value) ?? 0) + entry.weight));
    return weightedChoice([...merged].map(([value, weight]) => ({ value, weight })), random);
}

function getTempoDistance(tempo, priorities) {
    let distance = 0;
    let specified = 0;

    ["first", "second", "third", "fourth"].forEach(key => {
        if (!hasPriority(priorities?.[key])) return;
        distance += Math.abs(Number(tempo[key]) - Number(priorities[key]));
        specified += 1;
    });

    return { distance, specified };
}

function sampleTempo(input, random) {
    const priorities = input?.request?.planPriorities?.tempo ?? {};
    const entries = AUTO_PLAN_TEMPO_PROFILES.map(profile => {
        const { distance, specified } = getTempoDistance(profile.tempo, priorities);
        const preferenceMultiplier = specified ? Math.exp(-distance * 1.35) * 3 : 1;
        return { value: profile.tempo, weight: profile.weight * preferenceMultiplier };
    });
    const selected = weightedChoice(entries, random) ?? AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo;
    return { ...selected };
}

function createPreferredPrescription(candidate, input, { profile = null, random = Math.random } = {}) {
    const priorities = input?.request?.planPriorities ?? {};
    const resolvedProfile = profile ?? createPrescriptionProfile([{ candidate }], input, 30 * 60);
    const isometric = isIsometricExercise(candidate.exercise);
    const sets = sampleSetCount(resolvedProfile, input, random);
    const reps = sampleAround(resolvedProfile.reps, [
        { offset: 0, weight: 54 }, { offset: -1, weight: 15 }, { offset: 1, weight: 15 },
        { offset: -2, weight: 8 }, { offset: 2, weight: 8 }
    ], 3, Math.max(20, safePriority(priorities.reps, 20) + 2), random);
    const time = sampleAround(resolvedProfile.time, [
        { offset: 0, weight: 60 }, { offset: -5, weight: 14 }, { offset: 5, weight: 14 },
        { offset: -10, weight: 6 }, { offset: 10, weight: 6 }
    ], 10, Math.max(90, safePriority(priorities.time, 90) + 10), random);
    const rest = sampleAround(resolvedProfile.rest, [
        { offset: 0, weight: 58 }, { offset: -15, weight: 14 }, { offset: 15, weight: 14 },
        { offset: -30, weight: 7 }, { offset: 30, weight: 7 }
    ], 0, Math.max(180, safePriority(priorities.rest, 180) + 30), random);

    return {
        exercise: candidate.exercise,
        sets,
        value: isometric ? time : reps,
        valueUnit: isometric ? "sec" : "rep",
        rest,
        tempo: isometric ? { ...AUTO_PLAN_ISOMETRIC_TEMPO } : sampleTempo(input, random)
    };
}

function getPrescriptionDurationSeconds(prescription, effectiveRest = prescription.rest) {
    return getPlanExerciseDurationSeconds(prescription, effectiveRest);
}

function getWorkoutPrescriptionDurationSeconds(prescriptions = []) {
    return prescriptions.reduce((total, prescription) => total + getPrescriptionDurationSeconds(prescription), 0);
}

function getPriorityStrength(input, key) {
    const priorities = input?.request?.planPriorities ?? {};
    if (key.startsWith("tempo.")) {
        const tempoKey = key.split(".")[1];
        return hasPriority(priorities.tempo?.[tempoKey]) ? 4 : 1;
    }
    return hasPriority(priorities[key]) ? 4 : 1;
}

function getSetMaximum(profile) {
    const center = Math.max(1, Number(profile?.sets) || AUTO_PLAN_PRESCRIPTION_DEFAULTS.sets);
    if (!profile?.setsWasRequested) return 6;
    const extra = Number(profile?.perExerciseBudget) <= 210 ? 1 : 2;
    return Math.min(12, center + extra);
}

function createDurationOption(prescription, key, next, cost) {
    const copy = { ...prescription, tempo: { ...prescription.tempo } };
    if (key.startsWith("tempo.")) copy.tempo[key.split(".")[1]] = next;
    else if (key === "value") copy.value = next;
    else copy[key] = next;

    return { key, next, cost, deltaSeconds: getPrescriptionDurationSeconds(copy) - getPrescriptionDurationSeconds(prescription) };
}

function getReductionOptions(prescription, input, profile) {
    const options = [];
    const push = (key, next, cost) => {
        const option = createDurationOption(prescription, key, next, cost);
        if (option.deltaSeconds < 0) options.push(option);
    };

    if (prescription.rest > 0) push("rest", Math.max(0, prescription.rest - 15), getPriorityStrength(input, "rest") * 1.5);
    if (prescription.sets > 1) {
        const nextSets = prescription.sets - 1;
        const distance = Math.abs(nextSets - profile.sets);
        push("sets", nextSets, getPriorityStrength(input, "sets") * 3 * (1 + distance * 2));
    }
    if (prescription.valueUnit === "rep" && prescription.value > 3) push("value", prescription.value - 1, getPriorityStrength(input, "reps") * 2);
    if (prescription.valueUnit === "sec" && prescription.value > 10) push("value", Math.max(10, prescription.value - 5), getPriorityStrength(input, "time") * 2);

    if (prescription.valueUnit === "rep") {
        if (prescription.tempo.first > 1) push("tempo.first", prescription.tempo.first - 1, getPriorityStrength(input, "tempo.first") * 3);
        if (prescription.tempo.second > 0) push("tempo.second", prescription.tempo.second - 1, getPriorityStrength(input, "tempo.second") * 3);
        if (prescription.tempo.third > 0) push("tempo.third", prescription.tempo.third - 1, getPriorityStrength(input, "tempo.third") * 3);
        if (prescription.tempo.fourth > 0) push("tempo.fourth", prescription.tempo.fourth - 1, getPriorityStrength(input, "tempo.fourth") * 3);
    }

    return options;
}

function getExpansionOptions(prescription, input, profile) {
    const priorities = input?.request?.planPriorities ?? {};
    const options = [];
    const push = (key, next, cost) => {
        const option = createDurationOption(prescription, key, next, cost);
        if (option.deltaSeconds > 0) options.push(option);
    };

    if (prescription.sets < getSetMaximum(profile)) {
        const nextSets = prescription.sets + 1;
        const distance = Math.abs(nextSets - profile.sets);
        push("sets", nextSets, getPriorityStrength(input, "sets") * 3 * (1 + distance * 2));
    }

    if (prescription.valueUnit === "rep") {
        const maximumReps = hasPriority(priorities.reps) ? Math.max(20, Number(priorities.reps) + 2) : 20;
        if (prescription.value < maximumReps) push("value", prescription.value + 1, getPriorityStrength(input, "reps") * 2);
    } else {
        const maximumTime = hasPriority(priorities.time) ? Math.max(90, Number(priorities.time) + 10) : 90;
        if (prescription.value < maximumTime) push("value", prescription.value + 5, getPriorityStrength(input, "time") * 2);
    }

    const maximumRest = hasPriority(priorities.rest) ? Math.max(180, Number(priorities.rest) + 30) : 180;
    if (prescription.rest < maximumRest) push("rest", prescription.rest + 15, getPriorityStrength(input, "rest") * 1.5);

    if (prescription.valueUnit === "rep") {
        if (prescription.tempo.first < 5) push("tempo.first", prescription.tempo.first + 1, getPriorityStrength(input, "tempo.first") * 3);
        if (prescription.tempo.third < 4) push("tempo.third", prescription.tempo.third + 1, getPriorityStrength(input, "tempo.third") * 3);
        if (prescription.tempo.second < 1) push("tempo.second", 1, getPriorityStrength(input, "tempo.second") * 4);
        if (prescription.tempo.fourth < 1) push("tempo.fourth", 1, getPriorityStrength(input, "tempo.fourth") * 4);
    }

    return options;
}

function applyDurationOption(prescription, option) {
    if (option.key.startsWith("tempo.")) prescription.tempo[option.key.split(".")[1]] = option.next;
    else if (option.key === "value") prescription.value = option.next;
    else prescription[option.key] = option.next;
}

function findBestDurationMove(prescriptions, input, profile, durationSeconds, targetSeconds, maximumSeconds, random) {
    const currentDeviation = Math.abs(durationSeconds - targetSeconds);
    const reducing = durationSeconds > targetSeconds;
    let best = null;

    prescriptions.forEach((prescription, index) => {
        const options = reducing ? getReductionOptions(prescription, input, profile) : getExpansionOptions(prescription, input, profile);

        options.forEach(option => {
            const nextDuration = durationSeconds + option.deltaSeconds;
            if (nextDuration > maximumSeconds && !reducing) return;

            const nextDeviation = Math.abs(nextDuration - targetSeconds);
            const improvement = currentDeviation - nextDeviation;
            if (improvement <= 0) return;

            const score = improvement / Math.max(0.1, option.cost) * (0.94 + random() * 0.12);
            if (!best || score > best.score) best = { index, option, score, nextDuration, nextDeviation };
        });
    });

    return best;
}

function fitPrescriptionsToTarget(selected, input, targetSeconds, maximumSeconds = targetSeconds, { random = Math.random } = {}) {
    const profile = createPrescriptionProfile(selected, input, targetSeconds);
    const prescriptions = selected.map(item => createPreferredPrescription(item.candidate, input, { profile, random }));
    let durationSeconds = getWorkoutPrescriptionDurationSeconds(prescriptions);
    let safety = 0;

    const preferredDeviation = input?.request?.timeFlexibility === "flexible" ? 3 * 60 : 90;

    while (safety < 10000 && Math.abs(durationSeconds - targetSeconds) > preferredDeviation) {
        const move = findBestDurationMove(prescriptions, input, profile, durationSeconds, targetSeconds, maximumSeconds, random);
        if (!move) break;

        applyDurationOption(prescriptions[move.index], move.option);
        durationSeconds = move.nextDuration;
        safety += 1;

    }

    return {
        prescriptions,
        profile,
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
    AUTO_PLAN_ISOMETRIC_TEMPO,
    AUTO_PLAN_TEMPO_PROFILES,
    createPrescriptionProfile,
    createPreferredPrescription,
    getPrescriptionDurationSeconds,
    getWorkoutPrescriptionDurationSeconds,
    fitPrescriptionsToTarget,
    getTimePenalty,
    isWithinTimeTolerance
};
