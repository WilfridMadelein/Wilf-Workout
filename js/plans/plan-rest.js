// null conserve les repos individuels des anciens plans.
function normalizeSupersetRest(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(999, Math.max(0, Math.round(number))) : fallback;
}

function usesSupersetRest(plan, planExercise) {
    const group = planExercise.combination?.group;
    if (!Number.isInteger(group) || normalizeSupersetRest(plan.defaults?.supersetRest) === null) return false;
    const members = plan.exercises.filter(item => item.combination?.group === group);
    return members.length > 1 && members[members.length - 1] !== planExercise;
}

function getPlanExerciseRest(plan, planExercise) {
    return usesSupersetRest(plan, planExercise) ? normalizeSupersetRest(plan.defaults.supersetRest) : planExercise.rest;
}

export { normalizeSupersetRest, usesSupersetRest, getPlanExerciseRest };
