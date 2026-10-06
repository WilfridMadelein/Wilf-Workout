import { AUTO_PLAN_BODY_PARTS } from "../auto-plan-settings.js";

// ============================================================
// CONTRAINTES DU PLAN AUTOMATIQUE
// ============================================================

const BODY_PART_ORDER = { legs: 0, chest: 1, back: 1, arms: 2, core: 3 };
const REJECTION_REASONS = ["category", "equipment", "type", "muscle", "never"];
const RECENT_HISTORY_DAYS = 28;

function getExerciseProgressionId(exercise) {
    return String(exercise?.prog_group || "").trim();
}

function getExerciseProgressionFamily(exercise) {
    return String(exercise?.prog_family || "").trim();
}

function getExerciseProgressionIndex(exercise) {
    const index = Number(exercise?.prog_ordre);
    return Number.isFinite(index) ? index : null;
}

function getExerciseMainMuscles(exercise) {
    return Array.isArray(exercise?.muscles_principaux)
        ? exercise.muscles_principaux.filter(muscle => Array.isArray(muscle) && muscle[0])
        : [];
}

function getExerciseSecondaryMuscles(exercise) {
    return Array.isArray(exercise?.muscles_secondaires)
        ? exercise.muscles_secondaires.filter(muscle => Array.isArray(muscle) && muscle[0])
        : [];
}

function getBodyPartForMuscleFamily(family) {
    const name = String(family || "").trim();
    if (!name) return null;

    for (const [bodyPart, config] of Object.entries(AUTO_PLAN_BODY_PARTS)) {
        if (config.mode === "submuscles" && config.family === name) return bodyPart;
        if (config.mode !== "submuscles" && config.values?.includes(name)) return bodyPart;
    }

    return null;
}

function getExercisePrimaryBodyPart(exercise) {
    return getBodyPartForMuscleFamily(getExerciseMainMuscles(exercise)[0]?.[0]);
}

function exerciseMatchesCategories(exercise, request) {
    const selected = new Set(request?.categories ?? []);
    if (!selected.size) return true;
    return (exercise?.catégorie ?? []).some(category => selected.has(category));
}

function exerciseMatchesEquipment(exercise, request) {
    const selected = new Set(request?.equipment ?? []);
    const groups = Array.isArray(exercise?.equipement) ? exercise.equipement : [];
    if (!groups.length) return true;

    return groups.every(group => Array.isArray(group) && group.some(equipment => equipment === "Aucun" || selected.has(equipment)));
}

function exerciseMatchesType(exercise, request) {
    return (request?.types ?? []).includes(exercise?.type);
}

function muscleMatchesTarget(muscle, target) {
    if (!Array.isArray(muscle) || !target || muscle[0] !== target.family) return false;
    return target.submuscle ? muscle[1] === target.submuscle : true;
}

function getExerciseMuscleMatches(exercise, input) {
    const mainMuscles = getExerciseMainMuscles(exercise);
    return (input?.muscleTargets ?? []).filter(target => mainMuscles.some(muscle => muscleMatchesTarget(muscle, target)));
}

function getExerciseSecondaryMuscleMatches(exercise, input) {
    const secondaryMuscles = getExerciseSecondaryMuscles(exercise);
    const matches = [];

    (input?.muscleTargets ?? []).forEach(target => {
        const secondaryIndex = secondaryMuscles.findIndex(muscle => muscleMatchesTarget(muscle, target));
        if (secondaryIndex >= 0) matches.push({ ...target, secondaryIndex });
    });

    return matches;
}

function getRecentProgressionWorkoutCount(progression, referenceAt = Date.now(), days = RECENT_HISTORY_DAYS) {
    const cutoff = referenceAt - days * 24 * 60 * 60 * 1000;
    const sessionIds = new Set();

    progression?.state?.occurrences?.forEach(occurrence => {
        const startedAt = Number(occurrence?.startedAt) || 0;
        if (startedAt >= cutoff && startedAt <= referenceAt && occurrence?.sessionId != null) sessionIds.add(occurrence.sessionId);
    });

    return sessionIds.size;
}

function getProgressionContext(exercise, input) {
    const progressionId = getExerciseProgressionId(exercise);
    const progression = input?.progressions?.find(item => item.id === progressionId) ?? null;
const progressionIndex = getExerciseProgressionIndex(exercise);
const latestProgressionIndex = progression?.state?.latestProgressionIndex ?? null;
const progressionOffset = progressionIndex !== null && latestProgressionIndex !== null ? progressionIndex - latestProgressionIndex : null;
const progressionDistance = progressionOffset === null ? null : Math.abs(progressionOffset);
const referenceAt = Number(input?.referenceAt) || Date.now();

return {
    progressionId,
    progressionFamily: getExerciseProgressionFamily(exercise),
    progressionIndex,
    progressionPreference: progression?.preference ?? "neutral",
    latestProgressionIndex,
    progressionOffset,
    progressionDistance,
    progressionKnown: latestProgressionIndex !== null,
    progressionOccurrenceCount: progression?.state?.occurrenceCount ?? 0,
    recentProgressionWorkoutCount: getRecentProgressionWorkoutCount(progression, referenceAt)
};
}

function evaluateExerciseConstraints(exercise, input) {
    const progression = getProgressionContext(exercise, input);
    const mainMuscles = getExerciseMainMuscles(exercise);
    const primaryMuscle = mainMuscles[0] ?? null;
    const muscleMatches = getExerciseMuscleMatches(exercise, input);
    const secondaryMuscleMatches = getExerciseSecondaryMuscleMatches(exercise, input);
    const primaryBodyPart = getExercisePrimaryBodyPart(exercise);
    const reasons = [];

    if (!exerciseMatchesCategories(exercise, input?.request)) reasons.push("category");
    if (!exerciseMatchesEquipment(exercise, input?.request)) reasons.push("equipment");
    if (!exerciseMatchesType(exercise, input?.request)) reasons.push("type");
    if (!muscleMatches.length) reasons.push("muscle");
    if (progression.progressionPreference === "never") reasons.push("never");

    const secondaryMatchRanks = {};
    secondaryMuscleMatches.forEach(match => {
        const current = secondaryMatchRanks[match.bodyPart];
        if (current === undefined || match.secondaryIndex < current) secondaryMatchRanks[match.bodyPart] = match.secondaryIndex;
    });

    const secondaryFallbackEligible = reasons.length === 1 && reasons[0] === "muscle" && secondaryMuscleMatches.length > 0;

    return {
        eligible: reasons.length === 0,
        secondaryFallbackEligible,
        reasons,
        exercise,
        exerciseId: exercise?.ID ?? null,
        exerciseName: String(exercise?.nom ?? ""),
        primaryBodyPart,
        bodyPartOrder: BODY_PART_ORDER[primaryBodyPart] ?? null,
        matchingBodyParts: [...new Set(muscleMatches.map(match => match.bodyPart))],
        matchingMuscleTargets: muscleMatches,
        secondaryMatchingBodyParts: [...new Set(secondaryMuscleMatches.map(match => match.bodyPart))],
        secondaryMatchingMuscleTargets: secondaryMuscleMatches,
        secondaryMatchRanks,
        primaryTargeted: muscleMatches.some(target => target.bodyPart === primaryBodyPart && muscleMatchesTarget(primaryMuscle, target)),
        ...progression
    };
}

function getCandidatePoolSummary(candidates, rejected, request) {
    const rejectedByReason = Object.fromEntries(REJECTION_REASONS.map(reason => [reason, 0]));
    rejected.forEach(item => item.reasons.forEach(reason => { rejectedByReason[reason] = (rejectedByReason[reason] ?? 0) + 1; }));

    const bodyParts = Object.fromEntries((request?.bodyParts ?? []).map(bodyPart => [bodyPart, { matching: 0, primary: 0, secondary: 0 }]));

    candidates.forEach(candidate => {
        candidate.matchingBodyParts.forEach(bodyPart => {
            if (bodyParts[bodyPart]) bodyParts[bodyPart].matching += 1;
        });

        if (bodyParts[candidate.primaryBodyPart]) bodyParts[candidate.primaryBodyPart].primary += 1;
    });

    [...candidates, ...rejected].forEach(candidate => {
        const hardRejected = candidate.reasons.some(reason => reason !== "muscle");
        if (hardRejected) return;

        candidate.secondaryMatchingBodyParts.forEach(bodyPart => {
            if (bodyParts[bodyPart]) bodyParts[bodyPart].secondary += 1;
        });
    });

    return {
        total: candidates.length + rejected.length,
        eligible: candidates.length,
        secondaryFallbackEligible: rejected.filter(item => item.secondaryFallbackEligible).length,
        rejected: rejected.length,
        rejectedByReason,
        bodyParts
    };
}

function buildExerciseCandidatePool(exercises = [], input = {}) {
    const candidates = [];
    const rejected = [];

    exercises.forEach(exercise => {
        const result = evaluateExerciseConstraints(exercise, input);
        if (result.eligible) candidates.push(result);
        else rejected.push(result);
    });

    return { candidates, rejected, summary: getCandidatePoolSummary(candidates, rejected, input?.request) };
}

function getCandidatesForBodyPart(pool, bodyPart, { primaryOnly = false } = {}) {
    const candidates = pool?.candidates ?? [];
    return candidates.filter(candidate => primaryOnly ? candidate.primaryBodyPart === bodyPart : candidate.matchingBodyParts.includes(bodyPart));
}

export {
    BODY_PART_ORDER,
    REJECTION_REASONS,
    RECENT_HISTORY_DAYS,
    getBodyPartForMuscleFamily,
    getExerciseProgressionFamily,
    getExercisePrimaryBodyPart,
    exerciseMatchesCategories,
    exerciseMatchesEquipment,
    exerciseMatchesType,
    getExerciseMuscleMatches,
    getExerciseSecondaryMuscleMatches,
    getProgressionContext,
    evaluateExerciseConstraints,
    buildExerciseCandidatePool,
    getCandidatesForBodyPart,
    getRecentProgressionWorkoutCount,
};