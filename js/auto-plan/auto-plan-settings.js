// ============================================================
// PARAMÈTRES DES PLANS AUTOMATIQUES
// ============================================================

const AUTO_PLAN_GOALS = ["strength", "hypertrophy", "endurance"];
const AUTO_PLAN_GOAL_LABELS = { strength: "Force", hypertrophy: "Masse", endurance: "Endurance" };
const AUTO_PLAN_TYPES = ["Push", "Pull", "Iso"];

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
        equipment: normalizeStringList(value.equipment)
    };
}

export {
    AUTO_PLAN_GOALS,
    AUTO_PLAN_GOAL_LABELS,
    AUTO_PLAN_TYPES,
    AUTO_PLAN_BODY_PARTS,
    normalizeAutoPlanDuration,
    normalizeAutoPlanLastRequest
};
