import { getProgressionId, getProgressionName } from "../exercises/exercise-search.js";
import { getProgressionState } from "../training/progression-state.js";
import { normalizeProgressionPreferences, normalizeProgressionPreference } from "../training/progression-preferences.js";
import { normalizeReserveToFailure } from "../training/reserve-to-failure.js";
import { normalizeWeightUnit, normalizeWeightValue } from "../training/weight-estimation.js";
import { AUTO_PLAN_BODY_PARTS, normalizeAutoPlanLastRequest } from "./auto-plan-settings.js";

// ============================================================
// DONNÉES D'ENTRÉE DU PLAN AUTOMATIQUE
// ============================================================

const AUTO_PLAN_INPUT_SCHEMA_VERSION = 1;

function getProgressionDefinitions(exercises = []) {
    const definitions = new Map();

    exercises.forEach(exercise => {
        const id = getProgressionId(exercise);
        if (!id) return;

        if (!definitions.has(id)) definitions.set(id, { id, name: getProgressionName(exercise) || id, exerciseCount: 0, minIndex: null, maxIndex: null });

        const definition = definitions.get(id);
        const index = Number(exercise?.prog_ordre);
        definition.exerciseCount += 1;

        if (Number.isFinite(index)) {
            definition.minIndex = definition.minIndex === null ? index : Math.min(definition.minIndex, index);
            definition.maxIndex = definition.maxIndex === null ? index : Math.max(definition.maxIndex, index);
        }
    });

    return [...definitions.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

function getAutoPlanMuscleTargets(request) {
    const targets = [];

    request.bodyParts.forEach(bodyPart => {
        const config = AUTO_PLAN_BODY_PARTS[bodyPart];
        if (!config) return;

        (request.muscles[bodyPart] ?? []).forEach(value => {
            targets.push(config.mode === "submuscles"
                ? { bodyPart, family: config.family, submuscle: value }
                : { bodyPart, family: value, submuscle: null });
        });
    });

    return targets;
}

function getHistoryStats(workoutHistory = []) {
    let logCount = 0;
    let reserveFeedbackCount = 0;
    let weightLogCount = 0;

    workoutHistory.forEach(session => session.sets?.forEach(set => set.exercises?.forEach(workoutExercise => {
        workoutExercise.series?.forEach(series => Object.values(series.logs ?? {}).forEach(log => {
            if (!log?.completedAt) return;

            logCount += 1;
            if (normalizeReserveToFailure(log.reserveToFailure) !== null) reserveFeedbackCount += 1;
            if (normalizeWeightValue(log.weight) > 0 && normalizeWeightUnit(log.weightUnit)) weightLogCount += 1;
        }));
    })));

    const dates = workoutHistory.map(session => Number(session.startedAt) || 0).filter(Boolean).sort((a, b) => a - b);

    return {
        workoutCount: workoutHistory.length,
        logCount,
        reserveFeedbackCount,
        weightLogCount,
        firstWorkoutAt: dates[0] ?? null,
        latestWorkoutAt: dates.at(-1) ?? null
    };
}

function getInputDiagnostics(request, muscleTargets, progressions, history, preferences, progressionIds) {
    const errors = [];
    const warnings = [];

    if (!request) errors.push("Paramètres de plan automatique absents.");

    if (request) {
        if (request.durationMinutes === null) errors.push("Temps visé invalide.");
        if (!request.bodyParts.length) errors.push("Aucune partie du corps sélectionnée.");
        if (!request.goals.length) errors.push("Aucun objectif sélectionné.");
        if (!request.types.length) errors.push("Aucun type sélectionné.");
        if (!request.categories.length) errors.push("Aucune catégorie sélectionnée.");

        request.bodyParts.forEach(bodyPart => {
            if (!(request.muscles[bodyPart] ?? []).length) warnings.push(`Aucun muscle sélectionné pour ${AUTO_PLAN_BODY_PARTS[bodyPart]?.label ?? bodyPart}.`);
        });
    }

    if (!muscleTargets.length && request?.bodyParts.length) warnings.push("Aucune cible musculaire détaillée n'est disponible.");
    if (!history.workoutCount) warnings.push("Aucun historique d'entraînement disponible.");
    if (history.workoutCount && !history.reserveFeedbackCount) warnings.push("Aucun feedback de réserve avant échec disponible.");
    if (history.workoutCount && !history.weightLogCount) warnings.push("Aucun log avec poids disponible.");

    Object.keys(preferences).forEach(id => {
        if (!progressionIds.has(id)) warnings.push(`Préférence enregistrée pour une progression inconnue : ${id}.`);
    });

    if (!progressions.length) errors.push("Aucune progression valide dans la base d'exercices.");

    return { valid: errors.length === 0, errors, warnings };
}

function buildAutoPlanInput({ request, exercises = [], workoutHistory = [], appSettings = {} } = {}) {
    const normalizedRequest = normalizeAutoPlanLastRequest(request);
    const preferences = normalizeProgressionPreferences(appSettings?.progressionPreferences);
    const definitions = getProgressionDefinitions(exercises);
    const progressionIds = new Set(definitions.map(definition => definition.id));
    const muscleTargets = normalizedRequest ? getAutoPlanMuscleTargets(normalizedRequest) : [];
    const history = getHistoryStats(workoutHistory);

    const progressions = definitions.map(definition => ({
        ...definition,
        preference: normalizeProgressionPreference(preferences[definition.id]),
        state: getProgressionState(workoutHistory, definition.id)
    }));

    const diagnostics = getInputDiagnostics(normalizedRequest, muscleTargets, progressions, history, preferences, progressionIds);

    return {
        schemaVersion: AUTO_PLAN_INPUT_SCHEMA_VERSION,
        request: normalizedRequest,
        defaults: { weightUnit: ["kg", "lbs"].includes(appSettings?.planDefaults?.weightUnit) ? appSettings.planDefaults.weightUnit : "lbs" },
        muscleTargets,
        progressionPreferences: preferences,
        progressions,
        history,
        diagnostics
    };
}

function getAutoPlanProgression(input, progressionId) {
    const id = String(progressionId || "").trim();
    return input?.progressions?.find(progression => progression.id === id) ?? null;
}

function getAutoPlanProgressionsByPreference(input, preference) {
    const normalized = normalizeProgressionPreference(preference);
    return input?.progressions?.filter(progression => progression.preference === normalized) ?? [];
}

function getAutoPlanInputSummary(input) {
    const progressions = input?.progressions ?? [];

    return {
        valid: input?.diagnostics?.valid === true,
        workouts: input?.history?.workoutCount ?? 0,
        logs: input?.history?.logCount ?? 0,
        reserveFeedbacks: input?.history?.reserveFeedbackCount ?? 0,
        weightLogs: input?.history?.weightLogCount ?? 0,
        progressions: progressions.length,
        progressionsWithHistory: progressions.filter(progression => progression.state.occurrenceCount > 0).length,
        more: progressions.filter(progression => progression.preference === "more").length,
        less: progressions.filter(progression => progression.preference === "less").length,
        never: progressions.filter(progression => progression.preference === "never").length
    };
}

export {
    AUTO_PLAN_INPUT_SCHEMA_VERSION,
    getProgressionDefinitions,
    getAutoPlanMuscleTargets,
    getHistoryStats,
    buildAutoPlanInput,
    getAutoPlanProgression,
    getAutoPlanProgressionsByPreference,
    getAutoPlanInputSummary
};