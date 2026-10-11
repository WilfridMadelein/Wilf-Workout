import { normalizeSupersetRest } from "../plans/plan-rest.js";
import {
    getStoredPlans,
    putStoredPlan,
    deleteStoredPlan
} from "./storage-provider.js";

import {
    recordDeletion
} from "./sync-metadata.js";

import {
    normalizeSplitOrder
} from "../exercises/exercise-split.js";

// ============================================================
// STOCKAGE DES PLANS
// ============================================================

const PLAN_SCHEMA_VERSION = 4;
const saveTimers = new Map();
let activePlanSaves = 0;

function normalizeAutoPlanGeneration(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const muscles = {};
    if (value.muscles && typeof value.muscles === "object" && !Array.isArray(value.muscles)) {
        Object.entries(value.muscles).forEach(([key, items]) => {
            if (["__proto__", "prototype", "constructor"].includes(key)) return;
            muscles[key] = Array.isArray(items) ? items.filter(item => typeof item === "string") : [];
        });
    }

    const optionalNumber = number => Number.isFinite(Number(number)) ? Number(number) : null;
    return {
        version: 1,
        createdAt: optionalNumber(value.createdAt) ?? Date.now(),
        targetDurationMinutes: optionalNumber(value.targetDurationMinutes),
        estimatedDurationSeconds: optionalNumber(value.estimatedDurationSeconds),
        timeFlexibility: value.timeFlexibility === "flexible" ? "flexible" : "strict",
        goals: Array.isArray(value.goals) ? value.goals.filter(item => typeof item === "string") : [],
        bodyParts: Array.isArray(value.bodyParts) ? value.bodyParts.filter(item => typeof item === "string") : [],
        muscles,
        types: Array.isArray(value.types) ? value.types.filter(item => typeof item === "string") : [],
        exerciseCount: { min: optionalNumber(value.exerciseCount?.min), max: optionalNumber(value.exerciseCount?.max) },
        supersetPreference: typeof value.supersetPreference === "string" ? value.supersetPreference : "indifferent"
    };
}

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
        weightEquipment: planExercise.weightEquipment ?? (Number(planExercise.weight) > 0 ? "Non précisé" : null),
        weightEquipmentExplicitlyRemoved: planExercise.weightEquipmentExplicitlyRemoved === true,
        bandResistance: planExercise.bandResistance ?? null,
        weightUnit: planExercise.weightUnit ?? "lbs",
        
        splitOrder: normalizeSplitOrder(planExercise.splitOrder),

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
        weightEquipment: typeof savedExercise.weightEquipment === "string" ? savedExercise.weightEquipment : Number(savedExercise.weight) > 0 ? "Non précisé" : null,
        weightEquipmentExplicitlyRemoved: savedExercise.weightEquipmentExplicitlyRemoved === true,
        bandResistance: typeof savedExercise.bandResistance === "string" ? savedExercise.bandResistance : null,
        weightUnit: savedExercise.weightUnit ?? "lbs",

        splitOrder: normalizeSplitOrder(savedExercise.splitOrder),

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
    const version = Number(plan.schemaVersion) || 0;

    if (version > PLAN_SCHEMA_VERSION) {
        throw new Error(
            `Plan ${plan.id} créé avec un schéma plus récent (${version}).`
        );
    }

    plan.notes = typeof plan.notes === "string" ? plan.notes : "";
    plan.categories = Array.isArray(plan.categories) ? plan.categories : [];
    plan.equipment = Array.isArray(plan.equipment) ? plan.equipment : [];
    plan.includeCategories = plan.includeCategories === true;
    plan.includeEquipment = plan.includeEquipment === true;
    plan.includeNotes = typeof plan.includeNotes === "boolean" ? plan.includeNotes : plan.notes.trim().length > 0;
    plan.autoAddDefaultInstructions = plan.autoAddDefaultInstructions !== false;
    plan.autoPlanGeneration = normalizeAutoPlanGeneration(plan.autoPlanGeneration);

    plan.defaults ??= {};
    plan.defaults.weight ??= 0;

    if (!["kg", "lbs"].includes(plan.defaults.weightUnit)) {
        plan.defaults.weightUnit = "lbs";
    }

    plan.filters ??= {};
    plan.filtersInitialized = plan.filtersInitialized === true;

    if (!Array.isArray(plan.autoExcludedProgressions)) {
        plan.autoExcludedProgressions = [];
    }

    plan.schemaVersion = PLAN_SCHEMA_VERSION;
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
        categories: [...(plan.categories ?? [])],
        equipment: [...(plan.equipment ?? [])],
        includeCategories: plan.includeCategories === true,
        includeEquipment: plan.includeEquipment === true,
        includeNotes: plan.includeNotes === true,
        autoAddDefaultInstructions: plan.autoAddDefaultInstructions !== false,
        autoPlanGeneration: normalizeAutoPlanGeneration(plan.autoPlanGeneration),

        defaults: {
            sets: plan.defaults?.sets ?? 3,
            reps: plan.defaults?.reps ?? 10,
            time: plan.defaults?.time ?? 30,
            rest: plan.defaults?.rest ?? 60,
            supersetRest: normalizeSupersetRest(plan.defaults?.supersetRest),

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
        categories: [...(savedPlan.categories ?? [])],
        equipment: [...(savedPlan.equipment ?? [])],
        includeCategories: savedPlan.includeCategories === true,
        includeEquipment: savedPlan.includeEquipment === true,
        includeNotes: savedPlan.includeNotes === true,
        autoAddDefaultInstructions: savedPlan.autoAddDefaultInstructions !== false,
        autoPlanGeneration: normalizeAutoPlanGeneration(savedPlan.autoPlanGeneration),
        
        defaults: {
            sets: savedPlan.defaults?.sets ?? 3,
            reps: savedPlan.defaults?.reps ?? 10,
            time: savedPlan.defaults?.time ?? 30,
            rest: savedPlan.defaults?.rest ?? 60,
            supersetRest: normalizeSupersetRest(savedPlan.defaults?.supersetRest),

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

    activePlanSaves += 1;
    try { await putStoredPlan(serializePlan(plan)); }
    finally { activePlanSaves -= 1; }
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

    await recordDeletion("plans", id);

    try {
        await deleteStoredPlan(id);
    } catch (error) {
        console.error(
            `Impossible de supprimer le plan ${id}.`,
            error
        );

        throw error;
    }
}

function hasPendingPlanSaves() { return saveTimers.size > 0 || activePlanSaves > 0; }

export {
    hasPendingPlanSaves,
    PLAN_SCHEMA_VERSION,
    migratePlanRecord,
    serializePlan,
    hydratePlan,
    loadPlans,
    savePlanNow,
    schedulePlanSave,
    deletePlanFromStorage
};