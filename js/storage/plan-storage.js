import {
    getStoredPlans,
    putStoredPlan,
    deleteStoredPlan
} from "./indexed-db.js";

// ============================================================
// STOCKAGE DES PLANS
// ============================================================

const PLAN_SCHEMA_VERSION = 2.1;
const saveTimers = new Map();

// ------------------------------------------------------------
// Filtres
// ------------------------------------------------------------

function setToArray(value) {
    if (value instanceof Set) return [...value];
    return Array.isArray(value) ? [...value] : [];
}

function serializeFilterState(state = {}) {
    return {
        search: state.search ?? "",
        types: setToArray(state.types),
        progressionsInclude: setToArray(state.progressionsInclude),
        progressionsExclude: setToArray(state.progressionsExclude),
        muscleFamilies: setToArray(state.muscleFamilies),
        equipment: setToArray(state.equipment),
        categories: setToArray(state.categories),
        autoExcludeProgressions: state.autoExcludeProgressions !== false,

        submuscles: state.submuscles instanceof Map
            ? [...state.submuscles].map(([family, values]) => [
                family,
                setToArray(values)
            ])
            : []
    };
}

function deserializeFilterState(state = {}) {
    return {
        search: state.search ?? "",
        types: new Set(state.types ?? []),
        progressionsInclude: new Set(state.progressionsInclude ?? []),
        progressionsExclude: new Set(state.progressionsExclude ?? []),
        muscleFamilies: new Set(state.muscleFamilies ?? []),
        equipment: new Set(state.equipment ?? []),
        categories: new Set(state.categories ?? []),
        autoExcludeProgressions: state.autoExcludeProgressions !== false,

        submuscles: new Map(
            (state.submuscles ?? []).map(([family, values]) => [
                family,
                new Set(values ?? [])
            ])
        )
    };
}

// ------------------------------------------------------------
// Exercices du plan
// ------------------------------------------------------------

function serializePlanExercise(planExercise) {
    const exercise = planExercise.exercise ?? {};

    return {
        exerciseId: exercise.ID ?? null,
        exerciseName: exercise.nom ?? "",

        sets: planExercise.sets,
        value: planExercise.value,
        valueUnit: planExercise.valueUnit,
        rest: planExercise.rest,

        tempo: {
            first: planExercise.tempo?.first ?? 3,
            second: planExercise.tempo?.second ?? 0,
            third: planExercise.tempo?.third ?? 1,
            fourth: planExercise.tempo?.fourth ?? 0
        },

        weight: planExercise.weight ?? 0,
        weightUnit: planExercise.weightUnit ?? "lbs",

        combination: {
            group: planExercise.combination?.group ?? 1
        },

        details: {
            ...(planExercise.details ?? {})
        }
    };
}

function createUnavailableExercise(savedExercise) {
    return {
        ID: savedExercise.exerciseId,
        nom: savedExercise.exerciseName || "Exercice indisponible",
        type: "",
        catégorie: [],
        pronation: [],
        equipement: [],
        prog_group: "",
        prog_ordre: 0,
        split: "false",
        muscles_principaux: [],
        muscles_secondaires: [],
        unavailable: true
    };
}

function hydratePlanExercise(savedExercise, exercisesById, exercisesByName) {
    const exercise =
        exercisesById.get(String(savedExercise.exerciseId)) ??
        exercisesByName.get(savedExercise.exerciseName) ??
        createUnavailableExercise(savedExercise);

    return {
        exercise,

        sets: savedExercise.sets ?? 3,
        value: savedExercise.value ?? 10,
        valueUnit: savedExercise.valueUnit ?? "rep",
        rest: savedExercise.rest ?? 60,

        tempo: {
            first: savedExercise.tempo?.first ?? 3,
            second: savedExercise.tempo?.second ?? 0,
            third: savedExercise.tempo?.third ?? 1,
            fourth: savedExercise.tempo?.fourth ?? 0
        },

        weight: savedExercise.weight ?? 0,
        weightUnit: savedExercise.weightUnit ?? "lbs",

        combination: {
            group: savedExercise.combination?.group ?? 1
        },

        details: {
            ...(savedExercise.details ?? {})
        }
    };
}

// ------------------------------------------------------------
// Migration
// ------------------------------------------------------------

function migratePlanRecord(record) {
    const plan = structuredClone(record);
    let version = Number(plan.schemaVersion) || 0;

    if (version > PLAN_SCHEMA_VERSION) {
        throw new Error(
            `Plan ${plan.id} créé avec un schéma plus récent (${version}).`
        );
    }

    if (version < 1) {
        if (typeof plan.notes !== "string") plan.notes = "";
        if (!Array.isArray(plan.equipment)) plan.equipment = [];
        if (typeof plan.includeEquipment !== "boolean") plan.includeEquipment = false;
        if (!Array.isArray(plan.autoExcludedProgressions)) {
            plan.autoExcludedProgressions = [];
        }

        plan.filters ??= {};
        version = 1;
    }

    if (version < 2) {
    plan.filtersInitialized = false;
    version = 2;
    }
    if (version < 2.1) {
    plan.defaults ??= {};

    if (plan.defaults.weight == null) {
        plan.defaults.weight = 0;
    }

    if (!["kg", "lbs"].includes(plan.defaults.weightUnit)) {
        plan.defaults.weightUnit = "lbs";
    }

    version = 2.1;
}

    plan.schemaVersion = version;
    return plan;
}

// ------------------------------------------------------------
// Sérialisation du plan
// ------------------------------------------------------------

function serializePlan(plan) {
    const createdAt =
        plan.createdAt ??
        (typeof plan.id === "number" ? plan.id : Date.now());

    return {
        schemaVersion: PLAN_SCHEMA_VERSION,

        id: plan.id,
        name: plan.name ?? "Plan",
        createdAt,
        updatedAt: plan.updatedAt ?? Date.now(),

        notes: String(plan.notes ?? "").slice(0, 500),
        equipment: [...(plan.equipment ?? [])],
        includeEquipment: plan.includeEquipment === true,

        defaults: {
            sets: plan.defaults?.sets ?? 3,
            reps: plan.defaults?.reps ?? 10,
            time: plan.defaults?.time ?? 30,
            rest: plan.defaults?.rest ?? 60,

            weight: plan.defaults?.weight ?? 0,
            weightUnit: ["kg", "lbs"].includes(plan.defaults?.weightUnit)
                ? plan.defaults.weightUnit
                : "lbs",

            tempo: {
                first: plan.defaults?.tempo?.first ?? 3,
                second: plan.defaults?.tempo?.second ?? 0,
                third: plan.defaults?.tempo?.third ?? 1,
                fourth: plan.defaults?.tempo?.fourth ?? 0
            }
        },

        filtersInitialized: plan.filtersInitialized === true,
        filters: serializeFilterState(plan.filters),

        autoExcludedProgressions: setToArray(
            plan.autoExcludedProgressions
        ),

        exercises: (plan.exercises ?? []).map(serializePlanExercise)
    };
}

// ------------------------------------------------------------
// Reconstruction du plan
// ------------------------------------------------------------

function hydratePlan(record, exercises) {
    const savedPlan = migratePlanRecord(record);

    const exercisesById = new Map(
        exercises.map(exercise => [String(exercise.ID), exercise])
    );

    const exercisesByName = new Map(
        exercises.map(exercise => [exercise.nom, exercise])
    );

    return {
        id: savedPlan.id,
        name: savedPlan.name ?? "Plan",

        createdAt:
            savedPlan.createdAt ??
            (typeof savedPlan.id === "number"
                ? savedPlan.id
                : Date.now()),

        updatedAt:
            savedPlan.updatedAt ??
            savedPlan.createdAt ??
            Date.now(),

        notes: String(savedPlan.notes ?? "").slice(0, 500),
        equipment: [...(savedPlan.equipment ?? [])],
        includeEquipment: savedPlan.includeEquipment === true,

        defaults: {
            sets: savedPlan.defaults?.sets ?? 3,
            reps: savedPlan.defaults?.reps ?? 10,
            time: savedPlan.defaults?.time ?? 30,
            rest: savedPlan.defaults?.rest ?? 60,

            weight: savedPlan.defaults?.weight ?? 0,
            weightUnit: ["kg", "lbs"].includes(savedPlan.defaults?.weightUnit)
                ? savedPlan.defaults.weightUnit
                : "lbs",

            tempo: {
                first: savedPlan.defaults?.tempo?.first ?? 3,
                second: savedPlan.defaults?.tempo?.second ?? 0,
                third: savedPlan.defaults?.tempo?.third ?? 1,
                fourth: savedPlan.defaults?.tempo?.fourth ?? 0
            }
        },

        filtersInitialized: savedPlan.filtersInitialized === true,
        filters: deserializeFilterState(savedPlan.filters),

        autoExcludedProgressions: new Set(
            savedPlan.autoExcludedProgressions ?? []
        ),

        exercises: (savedPlan.exercises ?? []).map(
            exercise =>
                hydratePlanExercise(
                    exercise,
                    exercisesById,
                    exercisesByName
                )
        )
    };
}

// ------------------------------------------------------------
// Lecture / écriture
// ------------------------------------------------------------

async function loadPlans(exercises) {
    const records = await getStoredPlans();
    const loadedPlans = [];

    records.forEach(record => {
        try {
            loadedPlans.push(hydratePlan(record, exercises));
        } catch (error) {
            console.error(
                `Impossible de charger le plan ${record.id}. Les données ont été conservées.`,
                error
            );
        }
    });

    return loadedPlans.sort(
        (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)
    );
}

async function savePlanNow(plan, { touch = true } = {}) {
    if (!plan?.id) return;

    if (touch || !plan.updatedAt) plan.updatedAt = Date.now();

    await putStoredPlan(serializePlan(plan));
}

function schedulePlanSave(plan, delay = 250) {
    if (!plan?.id) return;

    plan.updatedAt = Date.now();

    clearTimeout(saveTimers.get(plan.id));

    const timer = setTimeout(async () => {
        saveTimers.delete(plan.id);

        try {
            await savePlanNow(plan, { touch: false });
        } catch (error) {
            console.error(`Impossible de sauvegarder le plan ${plan.id}.`, error);
        }
    }, delay);

    saveTimers.set(plan.id, timer);
}

async function deletePlanFromStorage(id) {
    clearTimeout(saveTimers.get(id));
    saveTimers.delete(id);
    await deleteStoredPlan(id);
}

export {
    PLAN_SCHEMA_VERSION,
    serializePlan,
    hydratePlan,
    loadPlans,
    savePlanNow,
    schedulePlanSave,
    deletePlanFromStorage
};