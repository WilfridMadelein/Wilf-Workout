// ============================================================
// CORRESPONDANCE MUSCLES WILF → MUSCLEMAPJS
// ============================================================

function normalizeMuscleName(value = "") {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
        .toLowerCase();
}

const FAMILY_MAP = {
    "pectoraux": ["chest"],
    "epaules": ["deltoids"],
    "triceps": ["triceps"],
    "biceps": ["biceps"],
    "avant-bras": ["forearm"],
    "abdominaux": ["abs"],
    "dos": ["upper-back"],
    "trapezes": ["trapezius"],
    "fessier": ["gluteal"],
    "quadriceps": ["quadriceps"],
    "ischio-jambiers": ["hamstring"],
    "mollets": ["calves"]
};

const SUBMUSCLE_MAP = {
    "abdominaux|obliques": ["obliques"],

    "dos|lombaires": ["lower-back"],
    "dos|erecteur": ["lower-back"],

    "quadriceps|hip flexors": ["hip-flexors"],
    "quadriceps|aducteur": ["adductors"]
};

// ============================================================
// CORRECTIONS MANUELLES PAR EXERCICE
// ============================================================

export const EXERCISE_MUSCLE_OVERRIDES = {
    /*
    17: {
        primary: ["biceps", "upper-back"],
        secondary: ["forearm", "lower-trapezius", "chest"]
    }
    */
};

function mapMuscles(muscles = []) {
    return [...new Set(muscles.flatMap(([family, submuscle]) => {
        const familyKey = normalizeMuscleName(family);
        const submuscleKey = normalizeMuscleName(submuscle);
        return SUBMUSCLE_MAP[`${familyKey}|${submuscleKey}`] ??
            FAMILY_MAP[familyKey] ??
            [];
    }))];
}

export function getExerciseMuscleMap(exercise) {
    const automaticPrimary = mapMuscles(exercise.muscles_principaux);
    const automaticSecondary = mapMuscles(exercise.muscles_secondaires);
    const override = EXERCISE_MUSCLE_OVERRIDES[exercise.ID];

    const primary = [...new Set(override?.primary ?? automaticPrimary)];
    const primarySet = new Set(primary);
    const secondary = [...new Set(override?.secondary ?? automaticSecondary)]
        .filter(muscle => !primarySet.has(muscle));

    return { primary, secondary };
}