// ============================================================
// PARAMÈTRES DES PLANS AUTOMATIQUES
// ============================================================

const AUTO_PLAN_GOALS = ["strength", "hypertrophy", "endurance"];
const AUTO_PLAN_GOAL_LABELS = { strength: "Force", hypertrophy: "Masse", endurance: "Endurance" };
const AUTO_PLAN_TYPES = ["Push", "Pull", "Iso"];
const AUTO_PLAN_SUPERSET_OPTIONS = ["indifferent", "none", "sometimes", "always"];
const AUTO_PLAN_SUPERSET_LABELS = { indifferent: "Indifférent", none: "Aucun", sometimes: "Parfois", always: "Toujours" };
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
function normalizePriorityNumber(value, fallback, min, max, decimals = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;

    const factor = 10 ** decimals;
    return Math.min(max, Math.max(min, Math.round(number * factor) / factor));
}

function normalizeAutoPlanPriorities(value = {}) {
    const tempo = value?.tempo ?? {};

    return {
        sets: normalizePriorityNumber(value?.sets, 3, 1, 999),
        reps: normalizePriorityNumber(value?.reps, 10, 1, 999),
        time: normalizePriorityNumber(value?.time, 30, 1, 999),
        rest: normalizePriorityNumber(value?.rest, 60, 0, 999),
        weight: normalizePriorityNumber(value?.weight, 0, 0, 9999.9, 1),
        weightUnit: ["kg", "lbs"].includes(value?.weightUnit) ? value.weightUnit : "lbs",
        tempo: {
            first: normalizePriorityNumber(tempo.first, 3, 0, 999),
            second: normalizePriorityNumber(tempo.second, 0, 0, 999),
            third: normalizePriorityNumber(tempo.third, 1, 0, 999),
            fourth: normalizePriorityNumber(tempo.fourth, 0, 0, 999)
        },
        includeNotes: value?.includeNotes === true,
        autoAddDefaultInstructions: value?.autoAddDefaultInstructions !== false
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
    normalizeAutoPlanPriorities,
    normalizeAutoPlanDuration,
    normalizeAutoPlanLastRequest
};
