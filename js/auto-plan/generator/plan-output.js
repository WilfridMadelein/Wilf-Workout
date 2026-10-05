import { getPlanExerciseDetailsLines } from "../../exercises/exercise-details.js";
import { getProgressionName } from "../../exercises/exercise-search.js";
import { normalizeSplitOrder } from "../../exercises/exercise-split.js";
import { AUTO_PLAN_BODY_PARTS } from "../auto-plan-settings.js";
import { AUTO_PLAN_PRESCRIPTION_DEFAULTS } from "./time-estimator.js";

// ============================================================
// CONVERSION DU WORKOUT AUTOMATIQUE EN PLAN WILF
// ============================================================

function getRepresentativeValue(values = [], fallback) {
    const clean = values.filter(value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))).map(Number);
    if (!clean.length) return fallback;

    const counts = new Map();
    clean.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
    const maximum = Math.max(...counts.values());
    const modes = [...counts].filter(([, count]) => count === maximum).map(([value]) => value).sort((a, b) => a - b);
    if (modes.length === 1) return modes[0];

    const sorted = [...clean].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return modes.sort((a, b) => Math.abs(a - median) - Math.abs(b - median) || a - b)[0];
}

function getGeneratedPlanDefaults(request, workout, fallbackDefaults = {}) {
    const priorities = request?.planPriorities ?? {};
    const prescriptions = (workout?.exercises ?? []).map(item => item.prescription).filter(Boolean);
    const reps = prescriptions.filter(item => item.valueUnit === "rep").map(item => item.value);
    const times = prescriptions.filter(item => item.valueUnit === "sec").map(item => item.value);
    const tempoValues = key => prescriptions.map(item => item.tempo?.[key]);

    return {
        sets: priorities.sets ?? getRepresentativeValue(prescriptions.map(item => item.sets), AUTO_PLAN_PRESCRIPTION_DEFAULTS.sets),
        reps: priorities.reps ?? getRepresentativeValue(reps, fallbackDefaults.reps ?? AUTO_PLAN_PRESCRIPTION_DEFAULTS.reps),
        time: priorities.time ?? getRepresentativeValue(times, fallbackDefaults.time ?? AUTO_PLAN_PRESCRIPTION_DEFAULTS.time),
        rest: priorities.rest ?? getRepresentativeValue(prescriptions.map(item => item.rest), AUTO_PLAN_PRESCRIPTION_DEFAULTS.rest),
        weight: priorities.weight ?? 0,
        weightUnit: ["kg", "lbs"].includes(priorities.weightUnit) ? priorities.weightUnit : ["kg", "lbs"].includes(fallbackDefaults.weightUnit) ? fallbackDefaults.weightUnit : "lbs",
        tempo: {
            first: priorities.tempo?.first ?? getRepresentativeValue(tempoValues("first"), AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.first),
            second: priorities.tempo?.second ?? getRepresentativeValue(tempoValues("second"), AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.second),
            third: priorities.tempo?.third ?? getRepresentativeValue(tempoValues("third"), AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.third),
            fourth: priorities.tempo?.fourth ?? getRepresentativeValue(tempoValues("fourth"), AUTO_PLAN_PRESCRIPTION_DEFAULTS.tempo.fourth)
        }
    };
}

function createGeneratedPlanFilterState(request, autoExcludedProgressions, defaultPlanSettings = {}) {
    return {
        search: "",
        types: new Set(request?.types ?? []),
        progressionsInclude: new Set(),
        progressionsExclude: new Set(autoExcludedProgressions),
        muscleFamilies: new Set(),
        submuscles: new Map(),
        categories: new Set(request?.categories ?? []),
        equipment: new Set(request?.equipment ?? []),
        autoExcludeProgressions: defaultPlanSettings.filters?.autoExcludeProgressions !== false
    };
}

function createGeneratedPlanExercises(workout, planDefaults, request, defaultSplitOrder) {
    const includeInstructions = request?.planPriorities?.autoAddDefaultInstructions === true;

    return (workout?.exercises ?? []).map((item, index) => {
        const exercise = item.candidate.exercise;
        const prescription = item.prescription;

        return {
            exercise,
            sets: prescription.sets,
            value: prescription.value,
            valueUnit: prescription.valueUnit,
            rest: prescription.rest,
            tempo: { ...prescription.tempo },
            weight: planDefaults.weight,
            weightUnit: planDefaults.weightUnit,
            splitOrder: normalizeSplitOrder(defaultSplitOrder),
            details: { instructions: includeInstructions ? getPlanExerciseDetailsLines(exercise).join("\n") : "" },
            combination: { group: index + 1 }
        };
    });
}

function createAutoPlanGenerationMetadata(request, workout) {
    return {
        version: 1,
        createdAt: Date.now(),
        targetDurationMinutes: request?.durationMinutes ?? null,
        estimatedDurationSeconds: workout?.estimatedDurationSeconds ?? null,
        timeFlexibility: request?.timeFlexibility === "flexible" ? "flexible" : "strict",
        goals: [...(request?.goals ?? [])],
        bodyParts: [...(request?.bodyParts ?? [])],
        muscles: Object.fromEntries(Object.entries(request?.muscles ?? {}).map(([key, values]) => [key, [...values]])),
        types: [...(request?.types ?? [])],
        exerciseCount: { min: request?.exerciseCount?.min ?? null, max: request?.exerciseCount?.max ?? null },
        supersetPreference: request?.supersetPreference ?? "indifferent"
    };
}

function buildGeneratedPlan({ request, workout, planNumber, defaultPlanSettings = {}, defaultSplitOrder = "left-right" }) {
    const defaults = getGeneratedPlanDefaults(request, workout, defaultPlanSettings);
    const autoExcludedProgressions = new Set((workout?.exercises ?? []).map(item => getProgressionName(item.candidate.exercise)).filter(Boolean));
    const filters = createGeneratedPlanFilterState(request, autoExcludedProgressions, defaultPlanSettings);
    const includeCategories = defaultPlanSettings.includeCategories === true;
    const includeEquipment = defaultPlanSettings.includeEquipment === true;

    return {
        id: crypto.randomUUID?.() ?? Date.now(),
        createdAt: Date.now(),
        name: `✦ Plan ${planNumber}`,
        defaults,
        exercises: createGeneratedPlanExercises(workout, defaults, request, defaultSplitOrder),
        notes: "",
        filters,
        filtersInitialized: true,
        categories: includeCategories ? [...(request?.categories ?? [])] : [],
        equipment: includeEquipment ? [...(request?.equipment ?? [])] : [],
        includeCategories,
        includeEquipment,
        includeNotes: request?.planPriorities?.includeNotes === true,
        autoAddDefaultInstructions: request?.planPriorities?.autoAddDefaultInstructions === true,
        autoExcludedProgressions,
        autoPlanGeneration: createAutoPlanGenerationMetadata(request, workout)
    };
}

export {
    getRepresentativeValue,
    getGeneratedPlanDefaults,
    createGeneratedPlanFilterState,
    createGeneratedPlanExercises,
    createAutoPlanGenerationMetadata,
    buildGeneratedPlan
};
