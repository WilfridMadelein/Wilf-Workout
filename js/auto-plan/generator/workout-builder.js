import { isIsometricExercise } from "../../exercises/exercise-search.js";
import { getPlanExerciseDurationSeconds } from "../../plans/plan-timing.js";
import { BODY_PART_ORDER } from "./workout-constraint.js";
import { compareScoredCandidates } from "./exercise-scoring.js";

// ============================================================
// CONSTRUCTION DU WORKOUT
// ============================================================

const MAX_AUTO_PLAN_EXERCISES = 40;
const AUTO_PLAN_SELECTION_TEMPERATURE = 12;
const AUTO_PLAN_SELECTION_POOL_SIZE = 8;

const AUTO_PLAN_ESTIMATION_DEFAULTS = {
    sets: 3,
    reps: 8,
    time: 30,
    rest: 45,
    tempo: { first: 2, second: 0, third: 1, fourth: 0 }
};

function getSelectedBodyParts(request) {
    return [...(request?.bodyParts ?? [])].sort((first, second) => (BODY_PART_ORDER[first] ?? 99) - (BODY_PART_ORDER[second] ?? 99));
}

function getCandidateDurationSeconds(candidate, input) {
    const priorities = input?.request?.planPriorities ?? {};
    const isometric = isIsometricExercise(candidate.exercise);

    return getPlanExerciseDurationSeconds({
        exercise: candidate.exercise,
        sets: priorities.sets ?? AUTO_PLAN_ESTIMATION_DEFAULTS.sets,
        value: isometric ? priorities.time ?? AUTO_PLAN_ESTIMATION_DEFAULTS.time : priorities.reps ?? AUTO_PLAN_ESTIMATION_DEFAULTS.reps,
        valueUnit: isometric ? "sec" : "rep",
        rest: priorities.rest ?? AUTO_PLAN_ESTIMATION_DEFAULTS.rest,
        tempo: {
            first: priorities.tempo?.first ?? AUTO_PLAN_ESTIMATION_DEFAULTS.tempo.first,
            second: priorities.tempo?.second ?? AUTO_PLAN_ESTIMATION_DEFAULTS.tempo.second,
            third: priorities.tempo?.third ?? AUTO_PLAN_ESTIMATION_DEFAULTS.tempo.third,
            fourth: priorities.tempo?.fourth ?? AUTO_PLAN_ESTIMATION_DEFAULTS.tempo.fourth
        }
    });
}

function candidateKey(candidate) {
    return candidate.exerciseId ?? candidate.exerciseName;
}

function canUseCandidate(candidate, usedExercises, usedProgressions) {
    if (usedExercises.has(candidateKey(candidate))) return false;
    return !candidate.progressionId || !usedProgressions.has(candidate.progressionId);
}

function compareBodyPartCandidates(first, second, bodyPart) {
    const firstPrimary = first.primaryBodyPart === bodyPart;
    const secondPrimary = second.primaryBodyPart === bodyPart;

    if (firstPrimary !== secondPrimary) return Number(secondPrimary) - Number(firstPrimary);
    return compareScoredCandidates(first, second);
}

function getAvailableCandidates(candidates, bodyPart, usedExercises, usedProgressions) {
    return candidates
        .filter(candidate => candidate.matchingBodyParts.includes(bodyPart) && canUseCandidate(candidate, usedExercises, usedProgressions))
        .sort((first, second) => compareBodyPartCandidates(first, second, bodyPart));
}

function weightedPick(candidates, { random = Math.random, temperature = AUTO_PLAN_SELECTION_TEMPERATURE, poolSize = AUTO_PLAN_SELECTION_POOL_SIZE } = {}) {
    if (!candidates.length) return null;

    const pool = candidates.slice(0, Math.max(1, poolSize));
    const maximumScore = Math.max(...pool.map(candidate => candidate.score));
    const weights = pool.map(candidate => Math.exp((candidate.score - maximumScore) / Math.max(1, temperature)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    let cursor = random() * total;

    for (let index = 0; index < pool.length; index += 1) {
        cursor -= weights[index];
        if (cursor <= 0) return pool[index];
    }

    return pool.at(-1);
}

function getCoverage(selected, bodyPart) {
    const primary = selected.find(item => item.candidate.primaryBodyPart === bodyPart);
    if (primary) return { status: "primary", exerciseId: primary.candidate.exerciseId, exerciseName: primary.candidate.exerciseName };

    const matching = selected.find(item => item.candidate.matchingBodyParts.includes(bodyPart));
    if (matching) return { status: "matching", exerciseId: matching.candidate.exerciseId, exerciseName: matching.candidate.exerciseName };

    return { status: "missing", exerciseId: null, exerciseName: null };
}

function getTargetExerciseCount(input, candidates, bodyParts) {
    const duration = Math.max(15, Number(input?.request?.durationMinutes) || 30);
    const coveragePotential = bodyParts.filter(bodyPart => candidates.some(candidate => candidate.matchingBodyParts.includes(bodyPart))).length;

    const durationTarget = Math.min(MAX_AUTO_PLAN_EXERCISES, Math.max(1, Math.round(2 + duration / 10)));
    const reasonableMin = Math.max(1, Math.floor(duration / 8));
    const reasonableMax = Math.min(MAX_AUTO_PLAN_EXERCISES, Math.max(coveragePotential, Math.ceil(duration / 2.5)));

    const requestedMin = Number(input?.request?.exerciseCount?.min);
    const requestedMax = Number(input?.request?.exerciseCount?.max);

    let target = Math.max(durationTarget, coveragePotential);

    if (Number.isFinite(requestedMin) && requestedMin > 0) {
        target = Math.max(target, Math.min(requestedMin, reasonableMax));
    }

    if (Number.isFinite(requestedMax) && requestedMax > 0 && target > requestedMax) {
        target = Math.max(coveragePotential, reasonableMin, requestedMax);
    }

    return Math.min(reasonableMax, Math.max(coveragePotential || 1, target));
}

function addCandidate(selected, candidate, coverageBodyPart, reason, state, input, bodyParts) {
    const durationSeconds = getCandidateDurationSeconds(candidate, input);
    const compositionBodyPart = bodyParts.includes(candidate.primaryBodyPart) ? candidate.primaryBodyPart : coverageBodyPart;

    selected.push({
        candidate,
        coverageBodyPart,
        compositionBodyPart,
        selectionReason: reason,
        estimatedDurationSeconds: durationSeconds,
        sequence: selected.length
    });

    state.usedExercises.add(candidateKey(candidate));
    if (candidate.progressionId) state.usedProgressions.add(candidate.progressionId);

    state.durationSeconds += durationSeconds;
}

function selectCoverageCandidates(candidates, bodyParts, selected, state, input, options) {
    bodyParts.forEach(bodyPart => {
        const primaryCandidates = getAvailableCandidates(candidates, bodyPart, state.usedExercises, state.usedProgressions)
            .filter(candidate => candidate.primaryBodyPart === bodyPart);

        const candidate = weightedPick(primaryCandidates, options);
        if (candidate) addCandidate(selected, candidate, bodyPart, "coverage-primary", state, input, bodyParts);
    });

    bodyParts.forEach(bodyPart => {
        if (getCoverage(selected, bodyPart).status !== "missing") return;

        const matchingCandidates = getAvailableCandidates(candidates, bodyPart, state.usedExercises, state.usedProgressions);
        const candidate = weightedPick(matchingCandidates, options);

        if (candidate) addCandidate(selected, candidate, bodyPart, "coverage-matching", state, input, bodyParts);
    });
}

function fillRemainingCandidates(candidates, bodyParts, selected, state, targetCount, input, options) {
    let index = 0;
    let misses = 0;

    while (selected.length < targetCount && misses < bodyParts.length) {
        const bodyPart = bodyParts[index % bodyParts.length];
        const available = getAvailableCandidates(candidates, bodyPart, state.usedExercises, state.usedProgressions);
        const candidate = weightedPick(available, options);

        if (candidate) {
            addCandidate(selected, candidate, bodyPart, "fill", state, input, bodyParts);
            misses = 0;
        } else {
            misses += 1;
        }

        index += 1;
    }
}

function sortWorkoutExercises(selected) {
    return [...selected].sort((first, second) => {
        const orderDifference = (BODY_PART_ORDER[first.compositionBodyPart] ?? 99) - (BODY_PART_ORDER[second.compositionBodyPart] ?? 99);
        return orderDifference || first.sequence - second.sequence;
    });
}

function buildWorkoutFromScoredPool(scoredPool, input, {
    random = Math.random,
    temperature = AUTO_PLAN_SELECTION_TEMPERATURE,
    poolSize = AUTO_PLAN_SELECTION_POOL_SIZE
} = {}) {
    const candidates = scoredPool?.candidates ?? [];
    const bodyParts = getSelectedBodyParts(input?.request);
    const targetSeconds = Math.max(0, Number(input?.request?.durationMinutes) || 0) * 60;
    const targetExerciseCount = getTargetExerciseCount(input, candidates, bodyParts);

    const selected = [];
    const state = { usedExercises: new Set(), usedProgressions: new Set(), durationSeconds: 0 };
    const options = { random, temperature, poolSize };

    selectCoverageCandidates(candidates, bodyParts, selected, state, input, options);
    fillRemainingCandidates(candidates, bodyParts, selected, state, targetExerciseCount, input, options);

    const exercises = sortWorkoutExercises(selected);
    const coverage = Object.fromEntries(bodyParts.map(bodyPart => [bodyPart, getCoverage(exercises, bodyPart)]));

    return {
        exercises,
        coverage,
        targetExerciseCount,
        targetDurationSeconds: targetSeconds,
        estimatedDurationSeconds: state.durationSeconds,
        estimatedDurationMinutes: Math.round(state.durationSeconds / 60),
        unusedDurationSeconds: Math.max(0, targetSeconds - state.durationSeconds),
        overTargetSeconds: Math.max(0, state.durationSeconds - targetSeconds)
    };
}

export {
    MAX_AUTO_PLAN_EXERCISES,
    AUTO_PLAN_SELECTION_TEMPERATURE,
    AUTO_PLAN_SELECTION_POOL_SIZE,
    AUTO_PLAN_ESTIMATION_DEFAULTS,
    getSelectedBodyParts,
    getCandidateDurationSeconds,
    weightedPick,
    getCoverage,
    getTargetExerciseCount,
    buildWorkoutFromScoredPool
};