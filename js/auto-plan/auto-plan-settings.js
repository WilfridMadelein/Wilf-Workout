// ============================================================
// PARAMÈTRES DES PLANS AUTOMATIQUES
// ============================================================

const AUTO_PLAN_GOALS = ["strength", "hypertrophy", "endurance"];
const AUTO_PLAN_GOAL_LABELS = { strength: "Force", hypertrophy: "Masse", endurance: "Endurance" };
const AUTO_PLAN_TYPES = ["Push", "Pull", "Iso"];
const AUTO_PLAN_SUPERSET_OPTIONS = ["indifferent", "none", "sometimes", "always"];
const AUTO_PLAN_SUPERSET_LABELS = { indifferent: "Indifférent", none: "Aucun", sometimes: "Parfois", always: "Toujours" };
const AUTO_PLAN_PRIORITY_PRESETS = ["empty", "settings"];
const AUTO_PLAN_PRIORITY_PRESET_LABELS = { empty: "Vide", settings: "Paramètres" };
const AUTO_PLAN_TIME_FLEXIBILITY_OPTIONS = ["strict", "flexible"];
const AUTO_PLAN_TIME_FLEXIBILITY_LABELS = { strict: "Sévère", flexible: "Flexible" };
const AUTO_PLAN_BODY_PARTS = {
    legs: { label: "Jambes", mode: "families", values: ["Quadriceps", "Ischio-jambiers", "Fessier", "Mollets"] },
    arms: { label: "Bras", mode: "families", values: ["Biceps", "Triceps", "Avant-bras"] },
    chest: { label: "Torse", mode: "families", values: ["Pectoraux", "Épaules"] },
    back: { label: "Dos", mode: "families", values: ["Trapèzes", "Dos"] },
    core: { label: "Abdos", mode: "submuscles", family: "Abdominaux" }
};

function normalizeStringList(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean))];
}

function normalizeAutoPlanDuration(value) {
    if (value === null || value === undefined || value === "") return null;
    const minutes = Math.round(Number(value));
    return Number.isFinite(minutes) ? Math.min(120, Math.max(15, minutes)) : null;
}

function normalizeOptionalPriorityNumber(value, min, max, decimals = 0) {
    if (value === null || value === undefined || String(value).trim() === "") return null;

    const number = Number(value);
    if (!Number.isFinite(number)) return null;

    const factor = 10 ** decimals;
    return Math.min(max, Math.max(min, Math.round(number * factor) / factor));
}

function normalizeAutoPlanPriorities(value = {}) {
    const tempo = value?.tempo ?? {};
    const hasStoredValues = [value?.sets, value?.reps, value?.time, value?.rest, value?.supersetRest, value?.weight, tempo.first, tempo.second, tempo.third, tempo.fourth].some(item => item !== null && item !== undefined && item !== "");

    return {
        preset: AUTO_PLAN_PRIORITY_PRESETS.includes(value?.preset) ? value.preset : hasStoredValues ? "settings" : "empty",
        sets: normalizeOptionalPriorityNumber(value?.sets, 1, 999),
        reps: normalizeOptionalPriorityNumber(value?.reps, 1, 999),
        time: normalizeOptionalPriorityNumber(value?.time, 1, 999),
        rest: normalizeOptionalPriorityNumber(value?.rest, 0, 999),
        supersetRest: normalizeOptionalPriorityNumber(value?.supersetRest, 0, 999),
        weight: normalizeOptionalPriorityNumber(value?.weight, 0, 9999.9, 1),
        weightUnit: ["kg", "lbs"].includes(value?.weightUnit) ? value.weightUnit : "lbs",
        tempo: {
            first: normalizeOptionalPriorityNumber(tempo.first, 0, 999),
            second: normalizeOptionalPriorityNumber(tempo.second, 0, 999),
            third: normalizeOptionalPriorityNumber(tempo.third, 0, 999),
            fourth: normalizeOptionalPriorityNumber(tempo.fourth, 0, 999)
        },
        includeNotes: value?.includeNotes === true,
        autoAddDefaultInstructions: value?.autoAddDefaultInstructions === true
    };
}

function normalizeAutoPlanExerciseCount(value = {}) {
    return {
        min: normalizeOptionalPriorityNumber(value?.min, 1, 25),
        max: normalizeOptionalPriorityNumber(value?.max, 1, 40)
    };
}

function normalizeAutoPlanLastRequest(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const muscles = {};
    if (value.muscles && typeof value.muscles === "object" && !Array.isArray(value.muscles)) {
        Object.entries(value.muscles).forEach(([key, items]) => {
            if (!["__proto__", "prototype", "constructor"].includes(key)) muscles[key] = normalizeStringList(items);
        });
    }

return {
    durationMinutes: normalizeAutoPlanDuration(value.durationMinutes),
    goals: normalizeStringList(value.goals),
    bodyParts: normalizeStringList(value.bodyParts),
    muscles,
    types: normalizeStringList(value.types),
    categories: normalizeStringList(value.categories),
    equipment: normalizeStringList(value.equipment),
    exerciseCount: normalizeAutoPlanExerciseCount(value.exerciseCount),
    timeFlexibility: AUTO_PLAN_TIME_FLEXIBILITY_OPTIONS.includes(value.timeFlexibility) ? value.timeFlexibility : "strict",
    planPriorities: value.planPriorities && typeof value.planPriorities === "object" && !Array.isArray(value.planPriorities)
        ? normalizeAutoPlanPriorities(value.planPriorities)
        : null,
    supersetPreference: AUTO_PLAN_SUPERSET_OPTIONS.includes(value.supersetPreference) ? value.supersetPreference : "indifferent"
};
}

export {
    AUTO_PLAN_GOALS,
    AUTO_PLAN_GOAL_LABELS,
    AUTO_PLAN_TYPES,
    AUTO_PLAN_BODY_PARTS,
    AUTO_PLAN_SUPERSET_OPTIONS,
    AUTO_PLAN_SUPERSET_LABELS,
    AUTO_PLAN_PRIORITY_PRESETS,
    AUTO_PLAN_PRIORITY_PRESET_LABELS,
    AUTO_PLAN_TIME_FLEXIBILITY_OPTIONS,
    AUTO_PLAN_TIME_FLEXIBILITY_LABELS,
    normalizeOptionalPriorityNumber,
    normalizeAutoPlanExerciseCount,
    normalizeAutoPlanPriorities,
    normalizeAutoPlanDuration,
    normalizeAutoPlanLastRequest
};
