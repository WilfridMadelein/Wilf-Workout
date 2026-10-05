import { loadWorkoutHistory } from "../../js/storage/workout-history-storage.js";
import { createDefaultAppSettings, loadAppSettings } from "../../js/storage/settings-storage.js";
import {
    AUTO_PLAN_GOALS,
    AUTO_PLAN_GOAL_LABELS,
    AUTO_PLAN_TYPES,
    AUTO_PLAN_BODY_PARTS,
    AUTO_PLAN_SUPERSET_OPTIONS,
    AUTO_PLAN_SUPERSET_LABELS,
    AUTO_PLAN_TIME_FLEXIBILITY_OPTIONS,
    AUTO_PLAN_TIME_FLEXIBILITY_LABELS
} from "../../js/auto-plan/auto-plan-settings.js";
import { buildAutoPlanInput } from "../../js/auto-plan/auto-plan-input.js";
import { buildExerciseCandidatePool, BODY_PART_ORDER } from "../../js/auto-plan/generator/workout-constraint.js";
import { scoreCandidatePool } from "../../js/auto-plan/generator/exercise-scoring.js";
import { buildWorkoutFromScoredPool } from "../../js/auto-plan/generator/workout-builder.js";
import { createSeededRandom, buildTWayCases, buildRepeatCase, buildBoundaryCases } from "./auto-plan-test-engine.js";

const exercises = Array.isArray(window.__WILF_TEST_EXERCISES__) ? window.__WILF_TEST_EXERCISES__ : [];
const state = {
    appSettings: null,
    workoutHistory: [],
    anomalies: [],
    selections: {
        goals: new Set(), bodyParts: new Set(), categories: new Set(), types: new Set(), equipment: new Set(),
        superset: new Set(["indifferent"]), timeFlexibility: new Set(["strict"])
    }
};

// ============================================================
// DONNÉES
// ============================================================

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function getCategoryOptions() {
    return unique(exercises.flatMap(exercise => exercise.catégorie ?? [])).sort((a, b) => a.localeCompare(b, "fr"));
}

function getEquipmentOptions() {
    return unique(exercises.flatMap(exercise => (exercise.equipement ?? []).flat()).filter(value => value !== "Aucun"))
        .sort((a, b) => a.localeCompare(b, "fr"));
}

function getSubmuscles(family) {
    return unique(exercises
        .flatMap(exercise => [...(exercise.muscles_principaux ?? []), ...(exercise.muscles_secondaires ?? [])])
        .filter(muscle => muscle?.[0] === family && muscle?.[1])
        .map(muscle => muscle[1]))
        .sort((a, b) => a.localeCompare(b, "fr"));
}

function getAllMusclesForBodyPart(bodyPart) {
    const config = AUTO_PLAN_BODY_PARTS[bodyPart];
    if (!config) return [];
    return config.mode === "submuscles" ? getSubmuscles(config.family) : [...config.values];
}

function getBodyPartProfiles() {
    const all = Object.keys(AUTO_PLAN_BODY_PARTS);
    return [
        ...all.map(value => [value]),
        ["legs", "chest"], ["legs", "back"], ["chest", "back"], ["chest", "arms"], ["back", "arms"],
        ["legs", "chest", "arms"], ["legs", "back", "arms"], ["chest", "back", "arms"], all
    ];
}

function getCategoryProfiles(categories) {
    const profiles = categories.map(value => [value]);
    const cali = categories.filter(value => value.startsWith("Cali"));
    const gym = categories.filter(value => value.startsWith("Gym"));
    if (cali.length) profiles.push(cali);
    if (gym.length) profiles.push(gym);
    profiles.push([...categories]);
    return profiles;
}

function getTypeProfiles() {
    return [["Push"], ["Pull"], ["Iso"], ["Push", "Pull"], ["Push", "Iso"], ["Pull", "Iso"], [...AUTO_PLAN_TYPES]];
}

function getEquipmentProfiles(equipment) {
    const frequencies = new Map();
    exercises.forEach(exercise => (exercise.equipement ?? []).flat().forEach(value => {
        if (!value || value === "Aucun") return;
        frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
    }));

    const common = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value]) => value);
    const profiles = [[], [...equipment], ...common.map(value => [value])];
    for (let index = 0; index < Math.min(4, common.length - 1); index += 1) profiles.push([common[index], common[index + 1]]);
    return profiles;
}

function getGoalProfiles() {
    return [["strength"], ["hypertrophy"], ["endurance"], ["strength", "hypertrophy"], ["hypertrophy", "endurance"], [...AUTO_PLAN_GOALS]];
}

function getExerciseCountProfiles() {
    return [
        { min: null, max: null }, { min: 3, max: null }, { min: null, max: 6 },
        { min: 4, max: 8 }, { min: 6, max: null }, { min: 8, max: 12 }
    ];
}

function createEmptyPriorities(weightUnit = "lbs") {
    return {
        preset: "empty", sets: null, reps: null, time: null, rest: null, weight: null, weightUnit,
        tempo: { first: null, second: null, third: null, fourth: null },
        includeNotes: false, autoAddDefaultInstructions: false
    };
}

function createSettingsPriorities(settings) {
    const defaults = settings?.planDefaults ?? {};
    return {
        preset: "settings",
        sets: defaults.sets ?? null,
        reps: defaults.reps ?? null,
        time: defaults.time ?? null,
        rest: defaults.rest ?? null,
        weight: defaults.weight ?? null,
        weightUnit: ["kg", "lbs"].includes(defaults.weightUnit) ? defaults.weightUnit : "lbs",
        tempo: {
            first: defaults.tempo?.first ?? null,
            second: defaults.tempo?.second ?? null,
            third: defaults.tempo?.third ?? null,
            fourth: defaults.tempo?.fourth ?? null
        },
        includeNotes: defaults.includeNotes === true,
        autoAddDefaultInstructions: defaults.autoAddDefaultInstructions === true
    };
}

// ============================================================
// INTERFACE
// ============================================================

function element(id) {
    return document.getElementById(id);
}

function getGroupValues(stateKey) {
    if (stateKey === "goals") return AUTO_PLAN_GOALS;
    if (stateKey === "bodyParts") return Object.keys(AUTO_PLAN_BODY_PARTS);
    if (stateKey === "types") return AUTO_PLAN_TYPES;
    if (stateKey === "superset") return AUTO_PLAN_SUPERSET_OPTIONS;
    if (stateKey === "timeFlexibility") return AUTO_PLAN_TIME_FLEXIBILITY_OPTIONS;
    if (stateKey === "categories") return getCategoryOptions();
    return getEquipmentOptions();
}

function createToggleButtons(containerId, values, labels, stateKey, { single = false } = {}) {
    const container = element(containerId);
    container.replaceChildren();

    values.forEach(value => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-button";
        button.textContent = labels?.[value] ?? value;
        button.addEventListener("click", () => {
            const selection = state.selections[stateKey];
            if (single) {
                selection.clear();
                selection.add(value);
            } else if (selection.has(value)) selection.delete(value);
            else selection.add(value);
            renderToggleGroup(containerId, stateKey);
        });
        container.appendChild(button);
    });

    renderToggleGroup(containerId, stateKey);
}

function renderToggleGroup(containerId, stateKey) {
    const selected = state.selections[stateKey];
    const values = getGroupValues(stateKey);
    element(containerId).querySelectorAll(".filter-button").forEach((button, index) => {
        const active = selected.has(values[index]);
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function setupInterface() {
    createToggleButtons("test-lab-goals", AUTO_PLAN_GOALS, AUTO_PLAN_GOAL_LABELS, "goals");
    createToggleButtons("test-lab-bodyparts", Object.keys(AUTO_PLAN_BODY_PARTS), Object.fromEntries(Object.entries(AUTO_PLAN_BODY_PARTS).map(([key, value]) => [key, value.label])), "bodyParts");
    createToggleButtons("test-lab-categories", getCategoryOptions(), null, "categories");
    createToggleButtons("test-lab-types", AUTO_PLAN_TYPES, null, "types");
    createToggleButtons("test-lab-equipment", getEquipmentOptions(), null, "equipment");
    createToggleButtons("test-lab-superset", AUTO_PLAN_SUPERSET_OPTIONS, AUTO_PLAN_SUPERSET_LABELS, "superset", { single: true });
    createToggleButtons("test-lab-time-flexibility", AUTO_PLAN_TIME_FLEXIBILITY_OPTIONS, AUTO_PLAN_TIME_FLEXIBILITY_LABELS, "timeFlexibility", { single: true });

    element("test-lab-equipment-none").addEventListener("click", () => {
        state.selections.equipment.clear();
        renderToggleGroup("test-lab-equipment", "equipment");
    });

    element("test-lab-equipment-all").addEventListener("click", () => {
        state.selections.equipment = new Set(getEquipmentOptions());
        renderToggleGroup("test-lab-equipment", "equipment");
    });

    element("test-lab-run").addEventListener("click", runTests);
    element("test-lab-anomalies").addEventListener("click", event => {
        const button = event.target.closest("[data-anomaly-index]");
        if (!button) return;
        element("test-lab-detail").textContent = JSON.stringify(state.anomalies[Number(button.dataset.anomalyIndex)], null, 2);
    });
}

function optionalNumber(id) {
    const value = String(element(id).value ?? "").trim();
    if (!value) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function getFixedConstraints() {
    return {
        duration: element("test-lab-fix-duration").checked ? optionalNumber("test-lab-duration") : null,
        timeFlexibility: element("test-lab-fix-time-flexibility").checked ? [...state.selections.timeFlexibility][0] ?? "strict" : null,
        goals: element("test-lab-fix-goals").checked ? [...state.selections.goals] : null,
        bodyParts: element("test-lab-fix-bodyparts").checked ? [...state.selections.bodyParts] : null,
        categories: element("test-lab-fix-categories").checked ? [...state.selections.categories] : null,
        types: element("test-lab-fix-types").checked ? [...state.selections.types] : null,
        equipment: element("test-lab-fix-equipment").checked ? [...state.selections.equipment] : null,
        exerciseCount: element("test-lab-fix-count").checked ? { min: optionalNumber("test-lab-count-min"), max: optionalNumber("test-lab-count-max") } : null,
        advancedProfile: element("test-lab-advanced-profile").value,
        supersetPreference: element("test-lab-fix-superset").checked ? [...state.selections.superset][0] ?? "indifferent" : null
    };
}

// ============================================================
// DOMAINES DE TEST
// ============================================================

function createDimensions(constraints) {
    const categories = getCategoryOptions();
    const equipment = getEquipmentOptions();
    const advancedValues = constraints.advancedProfile === "vary" ? ["empty", "settings"] : [constraints.advancedProfile];

    return [
        { name: "durationMinutes", values: constraints.duration !== null ? [constraints.duration] : [15, 20, 30, 45, 60, 90, 120] },
        { name: "timeFlexibility", values: constraints.timeFlexibility !== null ? [constraints.timeFlexibility] : [...AUTO_PLAN_TIME_FLEXIBILITY_OPTIONS] },
        { name: "goals", values: constraints.goals !== null ? [constraints.goals] : getGoalProfiles() },
        { name: "bodyParts", values: constraints.bodyParts !== null ? [constraints.bodyParts] : getBodyPartProfiles() },
        { name: "categories", values: constraints.categories !== null ? [constraints.categories] : getCategoryProfiles(categories) },
        { name: "types", values: constraints.types !== null ? [constraints.types] : getTypeProfiles() },
        { name: "equipment", values: constraints.equipment !== null ? [constraints.equipment] : getEquipmentProfiles(equipment) },
        { name: "exerciseCount", values: constraints.exerciseCount !== null ? [constraints.exerciseCount] : getExerciseCountProfiles() },
        { name: "advancedProfile", values: advancedValues },
        { name: "supersetPreference", values: constraints.supersetPreference !== null ? [constraints.supersetPreference] : [...AUTO_PLAN_SUPERSET_OPTIONS] }
    ];
}

function createBoundaryDimensions(dimensions) {
    return dimensions.map(dimension => {
        if (dimension.name === "durationMinutes" && dimension.values.length > 1) return { ...dimension, values: [15, 16, 30, 119, 120] };
        if (dimension.name === "exerciseCount" && dimension.values.length > 1) {
            return { ...dimension, values: [
                { min: null, max: null }, { min: 1, max: null }, { min: 25, max: null },
                { min: null, max: 1 }, { min: null, max: 40 }, { min: 25, max: 5 }
            ] };
        }
        return dimension;
    });
}

function createScenarioRequest(scenario, settings) {
    const muscles = {};
    scenario.bodyParts.forEach(bodyPart => { muscles[bodyPart] = getAllMusclesForBodyPart(bodyPart); });
    const weightUnit = ["kg", "lbs"].includes(settings?.planDefaults?.weightUnit) ? settings.planDefaults.weightUnit : "lbs";

    return {
        durationMinutes: scenario.durationMinutes,
        timeFlexibility: scenario.timeFlexibility,
        goals: [...scenario.goals],
        bodyParts: [...scenario.bodyParts],
        muscles,
        types: [...scenario.types],
        categories: [...scenario.categories],
        equipment: [...scenario.equipment],
        exerciseCount: { ...scenario.exerciseCount },
        planPriorities: scenario.advancedProfile === "settings" ? createSettingsPriorities(settings) : createEmptyPriorities(weightUnit),
        supersetPreference: scenario.supersetPreference
    };
}

function getScenarios(mode, dimensions, runs, seed) {
    if (mode === "repeat") return { scenarios: [buildRepeatCase(dimensions, { seed })], repetitions: runs, coverage: null };
    if (mode === "pairwise") {
        const result = buildTWayCases(dimensions, 2, { seed, maxCases: runs });
        return { scenarios: result.cases, repetitions: 1, coverage: result.coverage };
    }
    if (mode === "threeway") {
        const result = buildTWayCases(dimensions, 3, { seed, maxCases: runs });
        return { scenarios: result.cases, repetitions: 1, coverage: result.coverage };
    }
    return { scenarios: buildBoundaryCases(createBoundaryDimensions(dimensions), { maxCases: runs }), repetitions: 1, coverage: null };
}

// ============================================================
// VALIDATION
// ============================================================

function createStats() {
    return {
        executions: 0, invalidRequests: 0, noCandidates: 0, candidatesButEmpty: 0, successfulWorkouts: 0,
        strictWorkouts: 0, strictOutsideFiveMinutes: 0, flexibleWorkouts: 0,
        overTargetEstimates: 0, softMinimumMisses: 0, softMaximumMisses: 0,
        totalCandidates: 0, totalExercises: 0, anomalyCounts: {}, planSignatures: new Set(), selectedExercises: new Map()
    };
}

function addAnomaly(stats, anomaly) {
    stats.anomalyCounts[anomaly.type] = (stats.anomalyCounts[anomaly.type] ?? 0) + 1;
    if (state.anomalies.length < 250) state.anomalies.push(anomaly);
}

function planSignature(workout) {
    return (workout.exercises ?? []).map(item => item.candidate.exerciseId ?? item.candidate.exerciseName).join("|");
}

function registerSelectedExercise(stats, name) {
    stats.selectedExercises.set(name, (stats.selectedExercises.get(name) ?? 0) + 1);
}

function validateWorkout({ scenarioIndex, generationIndex, request, pool, workout, stats }) {
    const selected = workout.exercises ?? [];
    const exerciseKeys = selected.map(item => item.candidate.exerciseId ?? item.candidate.exerciseName);
    const progressionIds = selected.map(item => item.candidate.progressionId).filter(Boolean);
    const candidateKeys = new Set(pool.candidates.map(candidate => candidate.exerciseId ?? candidate.exerciseName));
    const base = {
        scenarioIndex, generationIndex, request, candidateCount: pool.candidates.length,
        workout: selected.map(item => ({ name: item.candidate.exerciseName, bodyPart: item.compositionBodyPart, score: item.candidate.score, reason: item.selectionReason, prescription: item.prescription }))
    };

    if (new Set(exerciseKeys).size !== exerciseKeys.length) addAnomaly(stats, { ...base, level: "error", type: "duplicate-exercise", detail: "Le workout contient deux fois le même exercice." });
    if (new Set(progressionIds).size !== progressionIds.length) addAnomaly(stats, { ...base, level: "error", type: "duplicate-progression", detail: "Le workout contient deux exercices de la même progression." });
    if (selected.some(item => item.candidate.progressionPreference === "never")) addAnomaly(stats, { ...base, level: "error", type: "never-selected", detail: "Une progression Never a été sélectionnée." });
    if (selected.some(item => !candidateKeys.has(item.candidate.exerciseId ?? item.candidate.exerciseName))) addAnomaly(stats, { ...base, level: "error", type: "non-candidate-selected", detail: "Un exercice sélectionné ne faisait pas partie des candidats admissibles." });

    const orders = selected.map(item => BODY_PART_ORDER[item.compositionBodyPart] ?? 99);
    if (orders.some((order, index) => index > 0 && order < orders[index - 1])) addAnomaly(stats, { ...base, level: "error", type: "bodypart-order", detail: "L'ordre Jambes → Torse/Dos → Bras → Abdos n'est pas respecté." });

    Object.entries(workout.coverage ?? {}).forEach(([bodyPart, coverage]) => {
        if (coverage.status !== "missing") return;
        const available = pool.summary?.bodyParts?.[bodyPart]?.matching ?? 0;
        if (available > 0) addAnomaly(stats, { ...base, level: "warning", type: "missing-coverage-with-candidate", detail: `${bodyPart} n'est pas couvert malgré ${available} candidat(s) compatible(s).` });
    });

    const requestedMin = Number(request.exerciseCount?.min);
    const requestedMax = Number(request.exerciseCount?.max);
    if (Number.isFinite(requestedMin) && requestedMin > 0 && selected.length < requestedMin) stats.softMinimumMisses += 1;
    if (Number.isFinite(requestedMax) && requestedMax > 0 && selected.length > requestedMax) stats.softMaximumMisses += 1;
    if ((workout.overTargetSeconds ?? 0) > 0) stats.overTargetEstimates += 1;

    if (request.timeFlexibility === "strict") {
        stats.strictWorkouts += 1;
        if (Math.abs(workout.estimatedDurationSeconds - workout.targetDurationSeconds) > 5 * 60) {
            stats.strictOutsideFiveMinutes += 1;
            addAnomaly(stats, { ...base, level: "warning", type: "strict-time-outside-5", detail: `Mode Sévère : écart de ${Math.round(Math.abs(workout.estimatedDurationSeconds - workout.targetDurationSeconds) / 60 * 10) / 10} min.` });
        }
    } else stats.flexibleWorkouts += 1;
}

// ============================================================
// EXÉCUTION
// ============================================================

async function runTests() {
    const runButton = element("test-lab-run");
    const status = element("test-lab-run-status");
    runButton.disabled = true;
    status.textContent = "Tests en cours…";
    state.anomalies = [];

    try {
        const mode = element("test-lab-mode").value;
        const runs = Math.min(5000, Math.max(1, Number(element("test-lab-runs").value) || 1));
        const seed = Number(element("test-lab-seed").value) || 12345;
        const dimensions = createDimensions(getFixedConstraints());
        const generated = getScenarios(mode, dimensions, runs, seed);
        const useUserData = element("test-lab-use-user-data").checked;
        const settings = useUserData ? state.appSettings : createDefaultAppSettings();
        const workoutHistory = useUserData ? state.workoutHistory : [];
        const referenceAt = Date.now();
        const stats = createStats();
        let executionIndex = 0;

        for (let scenarioIndex = 0; scenarioIndex < generated.scenarios.length; scenarioIndex += 1) {
            const request = createScenarioRequest(generated.scenarios[scenarioIndex], settings);

            for (let repetition = 0; repetition < generated.repetitions; repetition += 1) {
                stats.executions += 1;
                const input = buildAutoPlanInput({ request, exercises, workoutHistory, appSettings: settings, referenceAt });
                if (!input.diagnostics?.valid) { stats.invalidRequests += 1; executionIndex += 1; continue; }

                const pool = buildExerciseCandidatePool(exercises, input);
                stats.totalCandidates += pool.candidates.length;
                if (!pool.candidates.length) { stats.noCandidates += 1; executionIndex += 1; continue; }

                const scored = scoreCandidatePool(pool);
                const random = createSeededRandom((seed + executionIndex * 2654435761) >>> 0);
                const workout = buildWorkoutFromScoredPool(scored, input, { random });

                if (!workout.exercises?.length) {
                    stats.candidatesButEmpty += 1;
                    addAnomaly(stats, { scenarioIndex, generationIndex: repetition, request, level: "error", type: "candidates-but-empty", detail: `${pool.candidates.length} candidat(s) existaient mais aucun exercice n'a été sélectionné.` });
                    executionIndex += 1;
                    continue;
                }

                stats.successfulWorkouts += 1;
                stats.totalExercises += workout.exercises.length;
                stats.planSignatures.add(planSignature(workout));
                workout.exercises.forEach(item => registerSelectedExercise(stats, item.candidate.exerciseName));
                validateWorkout({ scenarioIndex, generationIndex: repetition, request, pool, workout, stats });
                executionIndex += 1;
            }
        }

        renderReport(stats, generated, mode, referenceAt);
        status.textContent = `${stats.executions} test(s) terminés.`;
    } catch (error) {
        console.error(error);
        status.textContent = `Erreur : ${error.message}`;
    } finally {
        runButton.disabled = false;
    }
}

// ============================================================
// RAPPORT
// ============================================================

function summaryCard(label, value, className = "") {
    const card = document.createElement("div");
    card.className = `test-lab-summary-card ${className}`.trim();
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    card.append(span, strong);
    return card;
}

function renderReport(stats, generated, mode, referenceAt) {
    element("test-lab-results").hidden = false;
    const summary = element("test-lab-summary");
    summary.replaceChildren();
    const strictWithinRate = stats.strictWorkouts
        ? Math.round((stats.strictWorkouts - stats.strictOutsideFiveMinutes) / stats.strictWorkouts * 1000) / 10
        : null;
    const averageCandidates = stats.executions ? Math.round(stats.totalCandidates / stats.executions * 10) / 10 : 0;
    const averageExercises = stats.successfulWorkouts ? Math.round(stats.totalExercises / stats.successfulWorkouts * 10) / 10 : 0;

    summary.append(
        summaryCard("Tests exécutés", stats.executions),
        summaryCard("Workouts produits", stats.successfulWorkouts, "ok"),
        summaryCard("Sans candidat", stats.noCandidates, stats.noCandidates ? "warning" : "ok"),
        summaryCard("Candidats mais workout vide", stats.candidatesButEmpty, stats.candidatesButEmpty ? "error" : "ok"),
        summaryCard("Plans uniques", stats.planSignatures.size),
        summaryCard("Candidats moyens", averageCandidates),
        summaryCard("Exercices moyens", averageExercises),
        summaryCard("Sévère dans ±5 min", strictWithinRate === null ? "N/A" : `${strictWithinRate}%`, strictWithinRate !== null && strictWithinRate < 97 ? "warning" : "ok"),
        summaryCard("Sévère hors ±5 min", stats.strictOutsideFiveMinutes, stats.strictOutsideFiveMinutes ? "warning" : "ok"),
        summaryCard("Minimum souple non atteint", stats.softMinimumMisses),
        summaryCard("Maximum souple dépassé", stats.softMaximumMisses)
    );

    const coverage = element("test-lab-coverage");
    coverage.innerHTML = generated.coverage
        ? `<h3>Couverture combinatoire</h3><p>${generated.coverage.strength}-way : <strong>${generated.coverage.percent}%</strong> (${generated.coverage.covered}/${generated.coverage.total}). ${generated.coverage.uncovered ? `${generated.coverage.uncovered} interaction(s) non couvertes.` : ""}</p>`
        : `<h3>Mode</h3><p><strong>${mode}</strong> — référence historique figée au ${new Date(referenceAt).toLocaleString("fr-CA")}.</p>`;

    renderAnomalies();
    renderTopExercises(stats);
    element("test-lab-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAnomalies() {
    const body = element("test-lab-anomalies");
    body.replaceChildren();

    if (!state.anomalies.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = "Aucune anomalie enregistrée.";
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    state.anomalies.forEach((anomaly, index) => {
        const row = document.createElement("tr");
        [anomaly.type, anomaly.level, String(anomaly.scenarioIndex + 1), anomaly.detail].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        const action = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Voir";
        button.dataset.anomalyIndex = index;
        action.appendChild(button);
        row.appendChild(action);
        body.appendChild(row);
    });
}

function renderTopExercises(stats) {
    const body = element("test-lab-top-exercises");
    body.replaceChildren();
    const denominator = Math.max(1, stats.successfulWorkouts);

    [...stats.selectedExercises.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([name, count]) => {
            const row = document.createElement("tr");
            [name, count, `${Math.round(count / denominator * 1000) / 10}%`].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
            body.appendChild(row);
        });
}

// ============================================================
// INITIALISATION
// ============================================================

async function initialize() {
    setupInterface();
    const status = element("test-lab-data-status");

    try {
        const [settings, history] = await Promise.all([loadAppSettings(), loadWorkoutHistory()]);
        state.appSettings = settings;
        state.workoutHistory = history;
        status.textContent = `${exercises.length} exercices · ${history.length} workout(s) historiques`;
        status.classList.add("ok");
    } catch (error) {
        console.error(error);
        state.appSettings = createDefaultAppSettings();
        state.workoutHistory = [];
        status.textContent = "Données utilisateur indisponibles — mode vierge";
        status.classList.add("error");
    }
}

initialize();
