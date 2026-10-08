import { normalizeSupersetRest } from "../../plans/plan-rest.js";
import { BODY_PART_ORDER } from "./workout-constraint.js";
import { compareScoredCandidates, scoreExerciseCandidate } from "./exercise-scoring.js";
import { composeWorkoutSupersets } from "./superset-builder.js";
import {
    fitPrescriptionsToTarget,
    getPrescriptionDurationSeconds,
    getTimePenalty,
    isWithinTimeTolerance
} from "./time-estimator.js";

// ============================================================
// CONSTRUCTION DU WORKOUT
// ============================================================

const MAX_AUTO_PLAN_EXERCISES = 40;
const AUTO_PLAN_SELECTION_TEMPERATURE = 12;
const AUTO_PLAN_SELECTION_POOL_SIZE = 8;
const AUTO_PLAN_BUILD_ATTEMPTS = 24;

function getSelectedBodyParts(request) {
    return [...(request?.bodyParts ?? [])].sort((first, second) => (BODY_PART_ORDER[first] ?? 99) - (BODY_PART_ORDER[second] ?? 99));
}

function candidateKey(candidate) {
    return candidate.exerciseId ?? candidate.exerciseName;
}

function getCandidateProgressionFamily(candidate) {
    return String(candidate?.progressionFamily || candidate?.exercise?.prog_family || "").trim();
}

function preferUnusedProgressionFamilies(candidates, usedFamilies) {
    if (!candidates.length || !usedFamilies?.size) return candidates;

    const unused = candidates.filter(candidate => {
        const family = getCandidateProgressionFamily(candidate);
        return !family || !usedFamilies.has(family);
    });

    return unused.length ? unused : candidates;
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

function getAvailableCandidates(candidates, bodyPart, usedExercises, usedProgressions, usedFamilies, { preferFamilies = true } = {}) {
    const available = candidates
        .filter(candidate => candidate.matchingBodyParts.includes(bodyPart) && canUseCandidate(candidate, usedExercises, usedProgressions))
        .sort((first, second) => compareBodyPartCandidates(first, second, bodyPart));

    return preferFamilies ? preferUnusedProgressionFamilies(available, usedFamilies) : available;
}

function getSecondaryFallbackRank(candidate, bodyPart) {
    const rank = candidate?.secondaryMatchRanks?.[bodyPart];
    return Number.isInteger(rank) ? rank : Infinity;
}

function isSecondaryFallbackUsable(candidate) {
    if (candidate?.eligible) return true;
    return candidate?.secondaryFallbackEligible === true;
}

function getSecondaryFallbackCandidates(scoredPool, bodyPart, usedExercises, usedProgressions, usedFamilies) {
    const sources = [...(scoredPool?.candidates ?? []), ...(scoredPool?.rejected ?? [])];
    const candidates = sources
        .filter(candidate => isSecondaryFallbackUsable(candidate))
        .filter(candidate => candidate?.secondaryMatchingBodyParts?.includes(bodyPart))
        .filter(candidate => canUseCandidate(candidate, usedExercises, usedProgressions))
        .map(candidate => Number.isFinite(candidate.score) ? candidate : scoreExerciseCandidate(candidate));

    if (!candidates.length) return [];

    const bestRank = Math.min(...candidates.map(candidate => getSecondaryFallbackRank(candidate, bodyPart)));
    const ranked = candidates
        .filter(candidate => getSecondaryFallbackRank(candidate, bodyPart) === bestRank)
        .sort(compareScoredCandidates);

    return preferUnusedProgressionFamilies(ranked, usedFamilies);
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

    const secondary = selected.find(item =>
        item.coverageBodyPart === bodyPart
        && ["coverage-secondary", "fill-secondary"].includes(item.selectionReason)
        && item.candidate.secondaryMatchingBodyParts?.includes(bodyPart)
    );
    if (secondary) return { status: "secondary", exerciseId: secondary.candidate.exerciseId, exerciseName: secondary.candidate.exerciseName };

    return { status: "missing", exerciseId: null, exerciseName: null };
}

function getExerciseCountBounds(input, candidates, bodyParts) {
    const duration = Math.max(15, Number(input?.request?.durationMinutes) || 30);
    const coveragePotential = bodyParts.filter(bodyPart => candidates.some(candidate => candidate.matchingBodyParts.includes(bodyPart))).length;
    const reasonableMin = Math.max(1, Math.floor(duration / 8));
    const reasonableMax = Math.min(MAX_AUTO_PLAN_EXERCISES, Math.max(coveragePotential, Math.ceil(duration / 2.5)));
    return { coveragePotential, reasonableMin, reasonableMax };
}

function getTargetExerciseCount(input, candidates, bodyParts) {
    const duration = Math.max(15, Number(input?.request?.durationMinutes) || 30);
    const { coveragePotential, reasonableMin, reasonableMax } = getExerciseCountBounds(input, candidates, bodyParts);
    const durationTarget = Math.min(MAX_AUTO_PLAN_EXERCISES, Math.max(1, Math.round(2 + duration / 10)));
    const requestedMin = Number(input?.request?.exerciseCount?.min);
    const requestedMax = Number(input?.request?.exerciseCount?.max);
    let target = Math.max(durationTarget, coveragePotential);

    if (Number.isFinite(requestedMin) && requestedMin > 0) target = Math.max(target, Math.min(requestedMin, reasonableMax));
    if (Number.isFinite(requestedMax) && requestedMax > 0 && target > requestedMax) target = Math.max(coveragePotential, reasonableMin, requestedMax);

    return Math.min(reasonableMax, Math.max(coveragePotential || 1, target));
}

function getTargetCountOptions(input, candidates, bodyParts) {
    const target = getTargetExerciseCount(input, candidates, bodyParts);
    const { reasonableMax } = getExerciseCountBounds(input, candidates, bodyParts);
    const options = Array.from({ length: reasonableMax }, (_, index) => index + 1);
    return options.sort((first, second) => Math.abs(first - target) - Math.abs(second - target) || first - second);
}

function addCandidate(selected, candidate, coverageBodyPart, reason, state, bodyParts) {
    const compositionBodyPart = bodyParts.includes(candidate.primaryBodyPart) ? candidate.primaryBodyPart : coverageBodyPart;

    selected.push({
        candidate,
        coverageBodyPart,
        compositionBodyPart,
        selectionReason: reason,
        sequence: selected.length
    });

    state.usedExercises.add(candidateKey(candidate));
    if (candidate.progressionId) state.usedProgressions.add(candidate.progressionId);

    const progressionFamily = getCandidateProgressionFamily(candidate);
    if (progressionFamily) state.usedFamilies.add(progressionFamily);
}

function selectCoverageCandidates(scoredPool, bodyParts, selected, state, options) {
    const candidates = scoredPool?.candidates ?? [];

    bodyParts.forEach(bodyPart => {
        const primaryCandidates = getAvailableCandidates(
            candidates, bodyPart, state.usedExercises, state.usedProgressions, state.usedFamilies, { preferFamilies: false }
        ).filter(candidate => candidate.primaryBodyPart === bodyPart);
        const candidate = weightedPick(preferUnusedProgressionFamilies(primaryCandidates, state.usedFamilies), options);
        if (candidate) addCandidate(selected, candidate, bodyPart, "coverage-primary", state, bodyParts);
    });

    bodyParts.forEach(bodyPart => {
        if (getCoverage(selected, bodyPart).status !== "missing") return;
        const candidate = weightedPick(getAvailableCandidates(candidates, bodyPart, state.usedExercises, state.usedProgressions, state.usedFamilies), options);
        if (candidate) addCandidate(selected, candidate, bodyPart, "coverage-matching", state, bodyParts);
    });

    bodyParts.forEach(bodyPart => {
        if (getCoverage(selected, bodyPart).status !== "missing") return;
        const fallback = getSecondaryFallbackCandidates(scoredPool, bodyPart, state.usedExercises, state.usedProgressions, state.usedFamilies);
        const candidate = weightedPick(fallback, options);
        if (candidate) addCandidate(selected, candidate, bodyPart, "coverage-secondary", state, bodyParts);
    });
}

function fillRemainingCandidates(scoredPool, bodyParts, selected, state, targetCount, options) {
    if (!bodyParts.length) return;
    const candidates = scoredPool?.candidates ?? [];
    let index = 0;
    let misses = 0;

    while (selected.length < targetCount && misses < bodyParts.length) {
        const bodyPart = bodyParts[index % bodyParts.length];
        let candidate = weightedPick(getAvailableCandidates(candidates, bodyPart, state.usedExercises, state.usedProgressions, state.usedFamilies), options);
        let reason = "fill";

        if (!candidate) {
            candidate = weightedPick(getSecondaryFallbackCandidates(scoredPool, bodyPart, state.usedExercises, state.usedProgressions, state.usedFamilies), options);
            reason = "fill-secondary";
        }

        if (candidate) {
            addCandidate(selected, candidate, bodyPart, reason, state, bodyParts);
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

function getFlexibleFitLimit(targetSeconds) {
    return targetSeconds + Math.max(5 * 60, Math.min(10 * 60, targetSeconds * 0.2));
}

function getRepeatedProgressionFamilyCount(exercises) {
    const counts = new Map();

    exercises.forEach(item => {
        const family = getCandidateProgressionFamily(item.candidate);
        if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
    });

    return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
}

function finalizeAttempt(selected, bodyParts, input, targetSeconds, random) {
    const mode = input?.request?.timeFlexibility === "flexible" ? "flexible" : "strict";
    const fitLimit = mode === "strict" ? targetSeconds + 5 * 60 : getFlexibleFitLimit(targetSeconds);
    const fit = fitPrescriptionsToTarget(selected, input, targetSeconds, fitLimit, { random });
    const orderedExercises = sortWorkoutExercises(selected).map(item => {
        const sourceIndex = selected.indexOf(item);
        const prescription = fit.prescriptions[sourceIndex];
        return { ...item, prescription, estimatedDurationSeconds: getPrescriptionDurationSeconds(prescription) };
    });
    const supersetComposition = composeWorkoutSupersets(orderedExercises, input?.request?.supersetPreference, { random });
    const exercises = supersetComposition.exercises;
    const supersetRest = normalizeSupersetRest(input?.request?.planPriorities?.supersetRest, 15);
    exercises.forEach((item, index) => {
        const isIntermediate = item.isSuperset && exercises[index + 1]?.combinationGroup === item.combinationGroup;
        item.estimatedDurationSeconds = getPrescriptionDurationSeconds(item.prescription, isIntermediate ? supersetRest : item.prescription.rest);
    });
    const durationSeconds = exercises.reduce((total, item) => total + item.estimatedDurationSeconds, 0);
    const coverage = Object.fromEntries(bodyParts.map(bodyPart => [bodyPart, getCoverage(exercises, bodyPart)]));
    const coveredBodyParts = Object.values(coverage).filter(item => item.status !== "missing").length;
    const exerciseScore = exercises.reduce((total, item) => total + item.candidate.score, 0);
    const requestedMin = Number(input?.request?.exerciseCount?.min);
    const requestedMax = Number(input?.request?.exerciseCount?.max);
    const minMiss = Number.isFinite(requestedMin) && requestedMin > exercises.length ? requestedMin - exercises.length : 0;
    const maxMiss = Number.isFinite(requestedMax) && requestedMax > 0 && exercises.length > requestedMax ? exercises.length - requestedMax : 0;
    const repeatedProgressionFamilies = getRepeatedProgressionFamilyCount(exercises);
    const score = coveredBodyParts * 500
        + exerciseScore
        + getTimePenalty(durationSeconds, targetSeconds, mode)
        - minMiss * 220
        - maxMiss * 100
        - repeatedProgressionFamilies * 160;

    return {
        exercises,
        coverage,
        coveredBodyParts,
        repeatedProgressionFamilies,
        score,
        timeMode: mode,
        supersetComposition,
        timeFit: {
            ...fit,
            durationSeconds,
            durationMinutes: Math.round(durationSeconds / 60),
            deviationSeconds: durationSeconds - targetSeconds,
            deviationMinutes: Math.abs(durationSeconds - targetSeconds) / 60
        },
        withinTimeTolerance: isWithinTimeTolerance(durationSeconds, targetSeconds, mode)
    };
}

function compareAttempts(first, second) {
    if (first.coveredBodyParts !== second.coveredBodyParts) return second.coveredBodyParts - first.coveredBodyParts;
    if (first.score !== second.score) return second.score - first.score;
    return first.timeFit.deviationMinutes - second.timeFit.deviationMinutes;
}

function pickAttempt(attempts, random, mode) {
    if (!attempts.length) return null;
    let pool = attempts;

    if (mode === "strict") {
        const withinTolerance = attempts.filter(attempt => attempt.withinTimeTolerance);
        if (withinTolerance.length) pool = withinTolerance;
    }

    pool = [...pool].sort(compareAttempts);
    const bestCoverage = pool[0].coveredBodyParts;
    const bestDeviation = pool[0].timeFit.deviationMinutes;
    const finalists = pool.filter(attempt =>
        attempt.coveredBodyParts === bestCoverage
        && attempt.timeFit.deviationMinutes <= bestDeviation + 1.5
    ).slice(0, 8);

    const maximumScore = Math.max(...finalists.map(attempt => attempt.score));
    const weights = finalists.map(attempt => Math.exp((attempt.score - maximumScore) / 20));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = random() * total;

    for (let index = 0; index < finalists.length; index += 1) {
        cursor -= weights[index];
        if (cursor <= 0) return finalists[index];
    }

    return finalists[0];
}

function buildWorkoutFromScoredPool(scoredPool, input, {
    random = Math.random,
    temperature = AUTO_PLAN_SELECTION_TEMPERATURE,
    poolSize = AUTO_PLAN_SELECTION_POOL_SIZE,
    attempts = AUTO_PLAN_BUILD_ATTEMPTS
} = {}) {
    const candidates = scoredPool?.candidates ?? [];
    const bodyParts = getSelectedBodyParts(input?.request);
    const targetSeconds = Math.max(0, Number(input?.request?.durationMinutes) || 0) * 60;
    const targetExerciseCount = getTargetExerciseCount(input, candidates, bodyParts);
    const countOptions = getTargetCountOptions(input, candidates, bodyParts);
    const options = { random, temperature, poolSize };
    const results = [];

    for (let attemptIndex = 0; attemptIndex < Math.max(1, attempts); attemptIndex += 1) {
        const targetCount = countOptions[attemptIndex % countOptions.length] ?? targetExerciseCount;
        const selected = [];
        const state = { usedExercises: new Set(), usedProgressions: new Set(), usedFamilies: new Set() };
        selectCoverageCandidates(scoredPool, bodyParts, selected, state, options);
        fillRemainingCandidates(scoredPool, bodyParts, selected, state, targetCount, options);
        if (selected.length) results.push(finalizeAttempt(selected, bodyParts, input, targetSeconds, random));
    }

    const mode = input?.request?.timeFlexibility === "flexible" ? "flexible" : "strict";
    const best = pickAttempt(results, random, mode);

    if (!best) {
        return {
            exercises: [],
            coverage: Object.fromEntries(bodyParts.map(bodyPart => [bodyPart, { status: "missing", exerciseId: null, exerciseName: null }])),
            targetExerciseCount,
            targetDurationSeconds: targetSeconds,
            estimatedDurationSeconds: 0,
            estimatedDurationMinutes: 0,
            unusedDurationSeconds: targetSeconds,
            overTargetSeconds: 0,
            timeMode: mode,
            withinTimeTolerance: false,
            attemptedPlans: results.length
        };
    }

    return {
        exercises: best.exercises,
        coverage: best.coverage,
        targetExerciseCount,
        targetDurationSeconds: targetSeconds,
        estimatedDurationSeconds: best.timeFit.durationSeconds,
        estimatedDurationMinutes: best.timeFit.durationMinutes,
        unusedDurationSeconds: Math.max(0, targetSeconds - best.timeFit.durationSeconds),
        overTargetSeconds: Math.max(0, best.timeFit.durationSeconds - targetSeconds),
        deviationMinutes: best.timeFit.deviationMinutes,
        timeMode: mode,
        withinTimeTolerance: best.withinTimeTolerance,
        attemptedPlans: results.length,
        planScore: best.score,
        repeatedProgressionFamilies: best.repeatedProgressionFamilies,
        supersetComposition: best.supersetComposition
    };
}

export {
    MAX_AUTO_PLAN_EXERCISES,
    AUTO_PLAN_SELECTION_TEMPERATURE,
    AUTO_PLAN_SELECTION_POOL_SIZE,
    AUTO_PLAN_BUILD_ATTEMPTS,
    getSelectedBodyParts,
    getCandidateProgressionFamily,
    preferUnusedProgressionFamilies,
    weightedPick,
    getCoverage,
    getExerciseCountBounds,
    getTargetExerciseCount,
    getTargetCountOptions,
    buildWorkoutFromScoredPool
};
