// ============================================================
// SCORING DES EXERCICES CANDIDATS
// ============================================================

const EXERCISE_SCORE_WEIGHTS = {
    preference: { more: 20, neutral: 0, less: -20, never: -1000 },
    primaryTarget: 12,
    recentFrequency: { perWorkout: 2, maximum: 8 },
    progressionDistance: { exact: 24, one: 16, two: 8, three: 0, extraStep: -8, minimum: -24 }
};

function getPreferenceScore(candidate) {
    return EXERCISE_SCORE_WEIGHTS.preference[candidate?.progressionPreference] ?? 0;
}

function getProgressionDistanceScore(candidate) {
    const distance = candidate?.progressionDistance;
    if (distance === null || distance === undefined) return 0;
    if (distance === 0) return EXERCISE_SCORE_WEIGHTS.progressionDistance.exact;
    if (distance === 1) return EXERCISE_SCORE_WEIGHTS.progressionDistance.one;
    if (distance === 2) return EXERCISE_SCORE_WEIGHTS.progressionDistance.two;
    if (distance === 3) return EXERCISE_SCORE_WEIGHTS.progressionDistance.three;

    return Math.max(
        EXERCISE_SCORE_WEIGHTS.progressionDistance.minimum,
        (distance - 3) * EXERCISE_SCORE_WEIGHTS.progressionDistance.extraStep
    );
}

function getPrimaryTargetScore(candidate) {
    return candidate?.primaryTargeted ? EXERCISE_SCORE_WEIGHTS.primaryTarget : 0;
}

function getRecentFrequencyScore(candidate) {
    const count = Math.max(0, Number(candidate?.recentProgressionWorkoutCount) || 0);
    return Math.min(EXERCISE_SCORE_WEIGHTS.recentFrequency.maximum, count * EXERCISE_SCORE_WEIGHTS.recentFrequency.perWorkout);
}

function scoreExerciseCandidate(candidate) {
    const scoreBreakdown = {
        preference: getPreferenceScore(candidate),
        progressionDistance: getProgressionDistanceScore(candidate),
        recentFrequency: getRecentFrequencyScore(candidate),
        primaryTarget: getPrimaryTargetScore(candidate)
    };

    const score = Object.values(scoreBreakdown).reduce((total, value) => total + value, 0);
    return { ...candidate, score, scoreBreakdown };
}

function compareScoredCandidates(first, second) {
    if (second.score !== first.score) return second.score - first.score;

    const firstDistance = first.progressionDistance ?? Infinity;
    const secondDistance = second.progressionDistance ?? Infinity;

    if (firstDistance !== secondDistance) return firstDistance - secondDistance;
    if (first.primaryTargeted !== second.primaryTargeted) return Number(second.primaryTargeted) - Number(first.primaryTargeted);

    return first.exerciseName.localeCompare(second.exerciseName, "fr", { sensitivity: "base" });
}

function getScoreStats(candidates = []) {
    if (!candidates.length) return { minimum: null, maximum: null, average: null };

    const scores = candidates.map(candidate => candidate.score);
    const total = scores.reduce((sum, score) => sum + score, 0);

    return {
        minimum: Math.min(...scores),
        maximum: Math.max(...scores),
        average: Math.round((total / scores.length) * 100) / 100
    };
}

function getBodyPartScoreStats(candidates = []) {
    const groups = {};

    candidates.forEach(candidate => {
        const key = candidate.primaryBodyPart ?? "other";
        groups[key] ??= [];
        groups[key].push(candidate);
    });

    return Object.fromEntries(Object.entries(groups).map(([bodyPart, values]) => [
        bodyPart,
        { count: values.length, ...getScoreStats(values) }
    ]));
}

function scoreCandidatePool(pool) {
    const candidates = (pool?.candidates ?? []).map(scoreExerciseCandidate).sort(compareScoredCandidates);

    return {
        ...pool,
        candidates,
        scoring: {
            weights: EXERCISE_SCORE_WEIGHTS,
            overall: getScoreStats(candidates),
            bodyParts: getBodyPartScoreStats(candidates)
        }
    };
}

export {
    EXERCISE_SCORE_WEIGHTS,
    getPreferenceScore,
    getProgressionDistanceScore,
    getPrimaryTargetScore,
    getRecentFrequencyScore,
    scoreExerciseCandidate,
    compareScoredCandidates,
    getScoreStats,
    getBodyPartScoreStats,
    scoreCandidatePool
};