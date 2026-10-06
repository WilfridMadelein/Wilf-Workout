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
const TEST_LAB_STORAGE_KEY = "wilf:auto-plan-test-lab:v3";
const PLAN_SAMPLE_LIMIT = 10;
const state = {
    appSettings: null,
    workoutHistory: [],
    anomalies: [],
    planSamples: [],
    planSampleSeen: 0,
    reportText: "",
    runTimerId: null,
    selections: {
        goals: new Set(), bodyParts: new Set(), categories: new Set(), types: new Set(), equipment: new Set(),
        superset: new Set(["indifferent"]), timeFlexibility: new Set(["strict"])
    }
};

// ============================================================
// ÉTAT LOCAL DU TEST LAB
// ============================================================

function readStoredLabState() {
    try {
        return JSON.parse(localStorage.getItem(TEST_LAB_STORAGE_KEY) || "null");
    } catch {
        return null;
    }
}

function captureLabState() {
    const controls = {};
    document.querySelectorAll(".test-lab-shell input[id], .test-lab-shell select[id]").forEach(control => {
        controls[control.id] = control.type === "checkbox" ? control.checked : control.value;
    });

    return {
        controls,
        selections: Object.fromEntries(Object.entries(state.selections).map(([key, values]) => [key, [...values]])),
        theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light"
    };
}

function saveLabState() {
    try {
        localStorage.setItem(TEST_LAB_STORAGE_KEY, JSON.stringify(captureLabState()));
    } catch (error) {
        console.warn("Impossible de sauvegarder l'état du Test Lab.", error);
    }
}

function renderAllToggleGroups() {
    [
        ["test-lab-goals", "goals"],
        ["test-lab-bodyparts", "bodyParts"],
        ["test-lab-categories", "categories"],
        ["test-lab-types", "types"],
        ["test-lab-equipment", "equipment"],
        ["test-lab-superset", "superset"],
        ["test-lab-time-flexibility", "timeFlexibility"]
    ].forEach(([containerId, stateKey]) => renderToggleGroup(containerId, stateKey));
}

function applyTheme(theme, { save = false } = {}) {
    const resolved = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;

    const button = element("test-lab-theme-toggle");
    if (button) {
        button.textContent = resolved === "dark" ? "☀ Clair" : "🌙 Sombre";
        button.setAttribute("aria-pressed", String(resolved === "dark"));
    }

    if (save) saveLabState();
}

function restoreLabState() {
    const saved = readStoredLabState();
    if (!saved) {
        applyTheme("light");
        return;
    }

    Object.entries(saved.controls ?? {}).forEach(([id, value]) => {
        const control = element(id);
        if (!control) return;
        if (control.type === "checkbox") control.checked = value === true;
        else control.value = value ?? "";
    });

    Object.entries(saved.selections ?? {}).forEach(([key, values]) => {
        if (!state.selections[key] || !Array.isArray(values)) return;
        const allowed = new Set(getGroupValues(key));
        state.selections[key] = new Set(values.filter(value => allowed.has(value)));
    });

    if (!state.selections.superset.size) state.selections.superset.add("indifferent");
    if (!state.selections.timeFlexibility.size) state.selections.timeFlexibility.add("strict");

    renderAllToggleGroups();
    applyTheme(saved.theme ?? "light");
    renderAdvancedProfileEditor();
}

function startRunTimer(startedAt) {
    const timer = element("test-lab-run-timer");
    if (!timer) return;

    if (state.runTimerId) clearInterval(state.runTimerId);
    timer.hidden = false;

    const update = () => {
        timer.textContent = `Temps écoulé : ${((performance.now() - startedAt) / 1000).toFixed(1)} s`;
    };

    update();
    state.runTimerId = setInterval(update, 100);
}

function stopRunTimer(startedAt) {
    if (state.runTimerId) clearInterval(state.runTimerId);
    state.runTimerId = null;

    const timer = element("test-lab-run-timer");
    if (timer) timer.textContent = `Temps écoulé : ${((performance.now() - startedAt) / 1000).toFixed(1)} s`;
}

function yieldToBrowser() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

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
    const profiles = [[], ...categories.map(value => [value])];
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

function getCustomPriorities() {
    return {
        preset: "settings",
        sets: optionalNumber("test-lab-custom-sets"),
        reps: optionalNumber("test-lab-custom-reps"),
        time: optionalNumber("test-lab-custom-time"),
        rest: optionalNumber("test-lab-custom-rest"),
        weight: optionalNumber("test-lab-custom-weight"),
        weightUnit: element("test-lab-custom-weight-unit").value,
        tempo: {
            first: optionalNumber("test-lab-custom-tempo-1"),
            second: optionalNumber("test-lab-custom-tempo-2"),
            third: optionalNumber("test-lab-custom-tempo-3"),
            fourth: optionalNumber("test-lab-custom-tempo-4")
        },
        includeNotes: element("test-lab-custom-notes").checked,
        autoAddDefaultInstructions: element("test-lab-custom-instructions").checked
    };
}

function formatPriorityValue(value, suffix = "") {
    return value === null || value === undefined ? "N/A" : `${value}${suffix}`;
}

function formatPriorities(priorities) {
    const tempo = priorities?.tempo ?? {};
    return [
        `${formatPriorityValue(priorities?.sets)} séries`,
        `${formatPriorityValue(priorities?.reps)} reps`,
        `${formatPriorityValue(priorities?.time, " sec")} durée`,
        `${formatPriorityValue(priorities?.rest, " sec")} repos`,
        `tempo ${[tempo.first, tempo.second, tempo.third, tempo.fourth].map(value => formatPriorityValue(value)).join("-")}`,
        `${formatPriorityValue(priorities?.weight)} ${priorities?.weightUnit ?? "lbs"}`
    ].join(" · ");
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
            saveLabState();
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
        saveLabState();
    });

    element("test-lab-equipment-all").addEventListener("click", () => {
        state.selections.equipment = new Set(getEquipmentOptions());
        renderToggleGroup("test-lab-equipment", "equipment");
        saveLabState();
    });

    element("test-lab-advanced-profile").addEventListener("change", () => {
        renderAdvancedProfileEditor();
        saveLabState();
    });
    element("test-lab-theme-toggle").addEventListener("click", () => {
        applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", { save: true });
    });
    element("test-lab-run").addEventListener("click", runTests);
    element("test-lab-copy-report").addEventListener("click", copyReportToClipboard);
    element("test-lab-results").addEventListener("click", event => {
        const anomalyButton = event.target.closest("[data-anomaly-index]");
        const sampleButton = event.target.closest("[data-sample-index]");
        let detail = null;

        if (anomalyButton) detail = state.anomalies[Number(anomalyButton.dataset.anomalyIndex)] ?? null;
        if (sampleButton) detail = state.planSamples[Number(sampleButton.dataset.sampleIndex)] ?? null;
        if (!detail) return;

        element("test-lab-detail").textContent = formatScenarioDetail(detail);
        element("test-lab-detail-block").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const shell = document.querySelector(".test-lab-shell");
    shell.addEventListener("change", saveLabState);
    shell.addEventListener("input", event => {
        if (event.target.matches("input[id], select[id]")) saveLabState();
    });

    renderAdvancedProfileEditor();
}

function renderAdvancedProfileEditor() {
    const profile = element("test-lab-advanced-profile").value;
    const panel = element("test-lab-custom-priorities");
    const summary = element("test-lab-advanced-summary");
    panel.hidden = profile !== "custom";

    if (profile === "empty") {
        summary.textContent = "Tous les paramètres du plan sont N/A.";
        return;
    }

    if (profile === "settings") {
        summary.textContent = `Paramètres Settings actuels : ${formatPriorities(createSettingsPriorities(state.appSettings ?? createDefaultAppSettings()))}.`;
        return;
    }

    if (profile === "custom") {
        summary.textContent = "Les valeurs personnalisées ci-dessous seront utilisées. Chaque case vide reste N/A.";
        return;
    }

    summary.textContent = `Varier teste Vide et Paramètres. Valeurs Settings actuelles : ${formatPriorities(createSettingsPriorities(state.appSettings ?? createDefaultAppSettings()))}.`;
}

async function copyReportToClipboard() {
    if (!state.reportText) return;

    const button = element("test-lab-copy-report");

    try {
        await navigator.clipboard.writeText(state.reportText);
    } catch {
        const textarea = document.createElement("textarea");
        textarea.value = state.reportText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
    }

    const previous = button.textContent;
    button.textContent = "Rapport copié ✓";
    setTimeout(() => { button.textContent = previous; }, 1600);
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
        customPriorities: element("test-lab-advanced-profile").value === "custom" ? getCustomPriorities() : null,
        supersetPreference: element("test-lab-fix-superset").checked ? [...state.selections.superset][0] ?? "indifferent" : null
    };
}

// ============================================================
// DOMAINES DE TEST
// ============================================================

function createDimensions(constraints) {
    const categories = getCategoryOptions();
    const equipment = getEquipmentOptions();
    const advancedValues = constraints.advancedProfile === "vary"
        ? [{ type: "empty" }, { type: "settings" }]
        : constraints.advancedProfile === "custom"
            ? [{ type: "custom", priorities: constraints.customPriorities }]
            : [{ type: constraints.advancedProfile }];

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
    const profile = scenario.advancedProfile ?? { type: "empty" };

    let planPriorities = createEmptyPriorities(weightUnit);
    if (profile.type === "settings") planPriorities = createSettingsPriorities(settings);
    if (profile.type === "custom") planPriorities = structuredClone(profile.priorities ?? createEmptyPriorities(weightUnit));

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
        planPriorities,
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

const ANOMALY_PRIORITY = {
    "never-selected": 1000,
    "non-candidate-selected": 950,
    "candidates-but-empty": 900,
    "duplicate-exercise": 850,
    "duplicate-progression": 800,
    "bodypart-order": 750,
    "no-candidates": 650,
    "strict-time-outside-5": 600,
    "missing-coverage-with-candidate": 500
};

function getAnomalySeverity(anomaly) {
    return (ANOMALY_PRIORITY[anomaly.type] ?? 100) + (Number(anomaly.severityScore) || 0);
}

function keepWorstAnomalies() {
    const errors = state.anomalies.filter(item => item.level === "error").sort((a, b) => getAnomalySeverity(b) - getAnomalySeverity(a)).slice(0, 10);
    const warnings = state.anomalies.filter(item => item.level === "warning").sort((a, b) => getAnomalySeverity(b) - getAnomalySeverity(a)).slice(0, 10);
    state.anomalies = [...errors, ...warnings];
}

function addAnomaly(stats, anomaly) {
    stats.anomalyCounts[anomaly.type] = (stats.anomalyCounts[anomaly.type] ?? 0) + 1;
    state.anomalies.push(anomaly);
    keepWorstAnomalies();
}

function planSignature(workout) {
    return (workout.exercises ?? []).map(item => {
        const prescription = item.prescription ?? {};
        const tempo = prescription.tempo ? Object.values(prescription.tempo).join("-") : "";
        return [
            item.candidate.exerciseId ?? item.candidate.exerciseName,
            item.combinationGroup ?? "",
            prescription.sets ?? "",
            prescription.value ?? "",
            prescription.valueUnit ?? "",
            prescription.rest ?? "",
            tempo
        ].join(":");
    }).join("|");
}

function registerSelectedExercise(stats, name) {
    stats.selectedExercises.set(name, (stats.selectedExercises.get(name) ?? 0) + 1);
}

function createPlanSample({ scenarioIndex, generationIndex, request, pool, workout }) {
    return {
        kind: "sample",
        scenarioIndex,
        generationIndex,
        request,
        candidateCount: pool.candidates.length,
        secondaryFallbackCount: pool.summary?.secondaryFallbackEligible ?? 0,
        targetDurationMinutes: Math.round((workout.targetDurationSeconds ?? 0) / 60 * 10) / 10,
        estimatedDurationMinutes: Math.round((workout.estimatedDurationSeconds ?? 0) / 60 * 10) / 10,
        coverage: workout.coverage ?? {},
        supersetComposition: workout.supersetComposition ?? null,
        workout: (workout.exercises ?? []).map(item => ({
            name: item.candidate.exerciseName,
            bodyPart: item.compositionBodyPart,
            score: item.candidate.score,
            reason: item.selectionReason,
            prescription: item.prescription
        }))
    };
}

function registerPlanSample(sample, random) {
    state.planSampleSeen += 1;

    if (state.planSamples.length < PLAN_SAMPLE_LIMIT) {
        state.planSamples.push(sample);
        return;
    }

    const index = Math.floor(random() * state.planSampleSeen);
    if (index < PLAN_SAMPLE_LIMIT) state.planSamples[index] = sample;
}

function validateWorkout({ scenarioIndex, generationIndex, request, pool, workout, stats }) {
    const selected = workout.exercises ?? [];
    const exerciseKeys = selected.map(item => item.candidate.exerciseId ?? item.candidate.exerciseName);
    const progressionIds = selected.map(item => item.candidate.progressionId).filter(Boolean);
    const candidateKeys = new Set(pool.candidates.map(candidate => candidate.exerciseId ?? candidate.exerciseName));
    const base = {
        scenarioIndex,
        generationIndex,
        request,
        candidateCount: pool.candidates.length,
        targetDurationMinutes: Math.round((workout.targetDurationSeconds ?? 0) / 60 * 10) / 10,
        estimatedDurationMinutes: Math.round((workout.estimatedDurationSeconds ?? 0) / 60 * 10) / 10,
        coverage: workout.coverage ?? {},
        workout: selected.map(item => ({
            name: item.candidate.exerciseName,
            bodyPart: item.compositionBodyPart,
            score: item.candidate.score,
            reason: item.selectionReason,
            prescription: item.prescription
        }))
    };

    if (new Set(exerciseKeys).size !== exerciseKeys.length) addAnomaly(stats, { ...base, level: "error", type: "duplicate-exercise", detail: "Le workout contient deux fois le même exercice." });
    if (new Set(progressionIds).size !== progressionIds.length) addAnomaly(stats, { ...base, level: "error", type: "duplicate-progression", detail: "Le workout contient deux exercices de la même progression." });
    if (selected.some(item => item.candidate.progressionPreference === "never")) addAnomaly(stats, { ...base, level: "error", type: "never-selected", detail: "Une progression Never a été sélectionnée." });
    if (selected.some(item => {
        const key = item.candidate.exerciseId ?? item.candidate.exerciseName;
        return !candidateKeys.has(key) && item.candidate.secondaryFallbackEligible !== true;
    })) addAnomaly(stats, { ...base, level: "error", type: "non-candidate-selected", detail: "Un exercice sélectionné ne faisait pas partie des candidats admissibles ni des recours valides par muscle secondaire." });

    const orders = selected.map(item => BODY_PART_ORDER[item.compositionBodyPart] ?? 99);
    if (orders.some((order, index) => index > 0 && order < orders[index - 1])) addAnomaly(stats, { ...base, level: "error", type: "bodypart-order", detail: "L'ordre Jambes → Torse/Dos → Bras → Abdos n'est pas respecté." });

    Object.entries(workout.coverage ?? {}).forEach(([bodyPart, coverage]) => {
        if (coverage.status !== "missing") return;
        const bodyPartSummary = pool.summary?.bodyParts?.[bodyPart] ?? {};
        const available = (bodyPartSummary.matching ?? 0) + (bodyPartSummary.secondary ?? 0);
        if (available > 0) addAnomaly(stats, { ...base, level: "warning", type: "missing-coverage-with-candidate", severityScore: available, detail: `${bodyPart} n'est pas couvert malgré ${available} candidat(s) principal(aux) ou secondaire(s) compatible(s).` });
    });

    const requestedMin = Number(request.exerciseCount?.min);
    const requestedMax = Number(request.exerciseCount?.max);
    if (Number.isFinite(requestedMin) && requestedMin > 0 && selected.length < requestedMin) stats.softMinimumMisses += 1;
    if (Number.isFinite(requestedMax) && requestedMax > 0 && selected.length > requestedMax) stats.softMaximumMisses += 1;
    if ((workout.overTargetSeconds ?? 0) > 0) stats.overTargetEstimates += 1;

    if (request.timeFlexibility === "strict") {
        stats.strictWorkouts += 1;
        if (Math.abs(workout.estimatedDurationSeconds - workout.targetDurationSeconds) > 5 * 60) {
            const deviationMinutes = Math.round(Math.abs(workout.estimatedDurationSeconds - workout.targetDurationSeconds) / 60 * 10) / 10;
            stats.strictOutsideFiveMinutes += 1;
            addAnomaly(stats, { ...base, level: "warning", type: "strict-time-outside-5", severityScore: deviationMinutes, detail: `Mode Sévère : écart de ${deviationMinutes} min.` });
        }
    } else stats.flexibleWorkouts += 1;
}

// ============================================================
// EXÉCUTION
// ============================================================

async function runTests() {
    const runButton = element("test-lab-run");
    const copyButton = element("test-lab-copy-report");
    const status = element("test-lab-run-status");
    const startedAt = performance.now();

    runButton.disabled = true;
    copyButton.disabled = true;
    state.reportText = "";
    state.anomalies = [];
    state.planSamples = [];
    state.planSampleSeen = 0;
    status.textContent = "Tests en cours…";
    saveLabState();
    startRunTimer(startedAt);

    try {
        const mode = element("test-lab-mode").value;
        const runs = Math.min(10000, Math.max(1, Number(element("test-lab-runs").value) || 1));
        const seed = Number(element("test-lab-seed").value) || 12345;
        const constraints = getFixedConstraints();
        const dimensions = createDimensions(constraints);
        const generated = getScenarios(mode, dimensions, runs, seed);
        const useUserData = element("test-lab-use-user-data").checked;
        const settings = useUserData ? state.appSettings : createDefaultAppSettings();
        const workoutHistory = useUserData ? state.workoutHistory : [];
        const referenceAt = Date.now();
        const stats = createStats();
        const sampleRandom = createSeededRandom((seed ^ 0x9E3779B9) >>> 0);
        let executionIndex = 0;

        for (let scenarioIndex = 0; scenarioIndex < generated.scenarios.length; scenarioIndex += 1) {
            const request = createScenarioRequest(generated.scenarios[scenarioIndex], settings);

            for (let repetition = 0; repetition < generated.repetitions; repetition += 1) {
                stats.executions += 1;
                if (stats.executions % 10 === 0) await yieldToBrowser();

                const input = buildAutoPlanInput({ request, exercises, workoutHistory, appSettings: settings, referenceAt });
                if (!input.diagnostics?.valid) { stats.invalidRequests += 1; executionIndex += 1; continue; }

                const pool = buildExerciseCandidatePool(exercises, input);
                const secondaryFallbackCount = pool.summary?.secondaryFallbackEligible ?? 0;
                const usableCandidateCount = pool.candidates.length + secondaryFallbackCount;
                stats.totalCandidates += usableCandidateCount;

                if (!usableCandidateCount) {
                    stats.noCandidates += 1;
                    addAnomaly(stats, {
                        scenarioIndex,
                        generationIndex: repetition,
                        request,
                        candidateCount: 0,
                        secondaryFallbackCount: 0,
                        rejectionSummary: pool.summary?.rejectedByReason ?? {},
                        level: "warning",
                        type: "no-candidates",
                        detail: "Aucun candidat principal ni recours valide par muscle secondaire ne correspond aux contraintes."
                    });
                    executionIndex += 1;
                    continue;
                }

                const scored = scoreCandidatePool(pool);
                const random = createSeededRandom((seed + executionIndex * 2654435761) >>> 0);
                const workout = buildWorkoutFromScoredPool(scored, input, { random });

                if (!workout.exercises?.length) {
                    stats.candidatesButEmpty += 1;
                    addAnomaly(stats, {
                        scenarioIndex,
                        generationIndex: repetition,
                        request,
                        candidateCount: pool.candidates.length,
                        targetDurationMinutes: request.durationMinutes,
                        estimatedDurationMinutes: 0,
                        coverage: workout.coverage ?? {},
                        workout: [],
                        level: "error",
                        type: "candidates-but-empty",
                        detail: `${pool.candidates.length} candidat(s) existaient mais aucun exercice n'a été sélectionné.`
                    });
                    executionIndex += 1;
                    continue;
                }

                stats.successfulWorkouts += 1;
                stats.totalExercises += workout.exercises.length;
                stats.planSignatures.add(planSignature(workout));
                workout.exercises.forEach(item => registerSelectedExercise(stats, item.candidate.exerciseName));
                registerPlanSample(createPlanSample({ scenarioIndex, generationIndex: repetition, request, pool, workout }), sampleRandom);
                validateWorkout({ scenarioIndex, generationIndex: repetition, request, pool, workout, stats });
                executionIndex += 1;
            }
        }

        const generationSeconds = Math.round((performance.now() - startedAt) / 10) / 100;
        const meta = { mode, requestedRuns: runs, seed, useUserData, constraints, referenceAt, generationSeconds };

        renderReport(stats, generated, meta);
        state.reportText = buildClipboardReport(stats, generated, meta);
        copyButton.disabled = false;
        status.textContent = `${stats.executions} test(s) terminés en ${generationSeconds} s.`;
    } catch (error) {
        console.error(error);
        status.textContent = `Erreur : ${error.message}`;
    } finally {
        stopRunTimer(startedAt);
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

function getStrictWithinRate(stats) {
    if (!stats.strictWorkouts) return null;
    return Math.round((stats.strictWorkouts - stats.strictOutsideFiveMinutes) / stats.strictWorkouts * 1000) / 10;
}

function getTopExercises(stats) {
    const denominator = Math.max(1, stats.successfulWorkouts);

    return [...stats.selectedExercises.entries()]
        .sort((first, second) => second[1] - first[1])
        .slice(0, 10)
        .map(([name, count]) => ({
            name,
            count,
            percent: Math.round(count / denominator * 1000) / 10
        }));
}

function getWorstAnomalies(level) {
    return state.anomalies
        .filter(item => item.level === level)
        .sort((first, second) => getAnomalySeverity(second) - getAnomalySeverity(first))
        .slice(0, 10);
}

function formatList(values, labels = null, empty = "Aucun") {
    if (!Array.isArray(values) || !values.length) return empty;
    return values.map(value => labels?.[value] ?? value).join(", ");
}

function formatRequestSummary(request) {
    const bodyPartLabels = Object.fromEntries(Object.entries(AUTO_PLAN_BODY_PARTS).map(([key, value]) => [key, value.label]));
    const timeLabel = AUTO_PLAN_TIME_FLEXIBILITY_LABELS[request?.timeFlexibility] ?? request?.timeFlexibility ?? "N/A";
    const min = request?.exerciseCount?.min ?? "N/A";
    const max = request?.exerciseCount?.max ?? "N/A";

    return [
        `${request?.durationMinutes ?? "N/A"} min (${timeLabel})`,
        `Bodyparts: ${formatList(request?.bodyParts, bodyPartLabels)}`,
        `Objectifs: ${formatList(request?.goals, AUTO_PLAN_GOAL_LABELS)}`,
        `Catégories: ${formatList(request?.categories)}`,
        `Types: ${formatList(request?.types)}`,
        `Équipement: ${formatList(request?.equipment)}`,
        `Exercices min/max: ${min}/${max}`,
        `Super-set: ${AUTO_PLAN_SUPERSET_LABELS[request?.supersetPreference] ?? request?.supersetPreference ?? "N/A"}`
    ].join(" | ");
}

function formatPrescription(prescription) {
    if (!prescription) return "prescription non disponible";

    const value = prescription.valueUnit === "sec"
        ? `${prescription.value} sec`
        : `${prescription.value} reps`;

    const tempo = prescription.tempo
        ? Object.values(prescription.tempo).join("-")
        : "N/A";

    return `${prescription.sets} série(s) × ${value} · repos ${prescription.rest} sec · tempo ${tempo}`;
}

function formatScenarioDetail(item) {
    const bodyPartLabels = Object.fromEntries(Object.entries(AUTO_PLAN_BODY_PARTS).map(([key, value]) => [key, value.label]));
    const request = item.request ?? {};
    const priorities = request.planPriorities ?? {};
    const isSample = item.kind === "sample";
    const coverageLines = Object.entries(item.coverage ?? {}).map(([bodyPart, coverage]) =>
        `- ${bodyPartLabels[bodyPart] ?? bodyPart}: ${coverage.status}${coverage.exerciseName ? ` — ${coverage.exerciseName}` : ""}`
    );

    const workoutLines = (item.workout ?? []).map((exercise, index) => {
        const bodyPart = bodyPartLabels[exercise.bodyPart] ?? exercise.bodyPart ?? "N/A";
        return `${index + 1}. ${exercise.name}
   Zone: ${bodyPart} · score ${exercise.score ?? "N/A"} · sélection: ${exercise.reason ?? "N/A"}
   ${formatPrescription(exercise.prescription)}`;
    });

    const supersetLines = (item.supersetComposition?.groups ?? []).map(group =>
        `- Set ${group.group}: ${group.exerciseNames.join(" + ")}${group.isSuperset ? " (super-set)" : ""}`
    );

    const rejectionLines = Object.entries(item.rejectionSummary ?? {})
        .filter(([, count]) => count > 0)
        .map(([reason, count]) => `- ${reason}: ${count}`);

    const header = isSample
        ? [`PLAN ÉCHANTILLON — scénario #${(item.scenarioIndex ?? 0) + 1}`]
        : [
            `SCÉNARIO #${(item.scenarioIndex ?? 0) + 1}`,
            `${item.level === "error" ? "ANOMALIE" : "AVERTISSEMENT"} : ${item.type}`,
            "",
            `Problème : ${item.detail}`
        ];

    return [
        ...header,
        "",
        "PARAMÈTRES",
        `- Temps : ${request.durationMinutes ?? "N/A"} min — ${AUTO_PLAN_TIME_FLEXIBILITY_LABELS[request.timeFlexibility] ?? request.timeFlexibility ?? "N/A"}`,
        `- Objectifs : ${formatList(request.goals, AUTO_PLAN_GOAL_LABELS)}`,
        `- Parties du corps : ${formatList(request.bodyParts, bodyPartLabels)}`,
        `- Catégories : ${formatList(request.categories)}`,
        `- Types : ${formatList(request.types)}`,
        `- Équipement : ${formatList(request.equipment)}`,
        `- Nombre d'exercices souhaité : min ${request.exerciseCount?.min ?? "N/A"} / max ${request.exerciseCount?.max ?? "N/A"}`,
        `- Super-sets : ${AUTO_PLAN_SUPERSET_LABELS[request.supersetPreference] ?? request.supersetPreference ?? "N/A"}`,
        `- Paramètres du plan : ${formatPriorities(priorities)}`,
        "",
        "RÉSULTAT",
        `- Candidats principaux : ${item.candidateCount ?? "N/A"}`,
        `- Recours muscles secondaires disponibles : ${item.secondaryFallbackCount ?? 0}`,
        `- Durée cible : ${item.targetDurationMinutes ?? request.durationMinutes ?? "N/A"} min`,
        `- Durée estimée : ${item.estimatedDurationMinutes ?? "N/A"} min`,
        ...(rejectionLines.length ? ["", "REJETS PAR RAISON", ...rejectionLines] : []),
        "",
        "COUVERTURE",
        ...(coverageLines.length ? coverageLines : ["- Non disponible"]),
        ...(supersetLines.length ? ["", "SETS / SUPER-SETS", ...supersetLines] : []),
        "",
        "WORKOUT",
        ...(workoutLines.length ? workoutLines : ["Aucun exercice sélectionné."])
    ].join("
");
}

function formatConstraintsForReport(constraints) {
    const parts = [];

    if (constraints.duration !== null) parts.push(`temps=${constraints.duration}`);
    if (constraints.timeFlexibility !== null) parts.push(`tolérance=${constraints.timeFlexibility}`);
    if (constraints.goals !== null) parts.push(`objectifs=${formatList(constraints.goals, AUTO_PLAN_GOAL_LABELS)}`);
    if (constraints.bodyParts !== null) parts.push(`bodyparts=${formatList(constraints.bodyParts)}`);
    if (constraints.categories !== null) parts.push(`catégories=${formatList(constraints.categories)}`);
    if (constraints.types !== null) parts.push(`types=${formatList(constraints.types)}`);
    if (constraints.equipment !== null) parts.push(`équipement=${formatList(constraints.equipment)}`);
    if (constraints.exerciseCount !== null) parts.push(`exercices=${constraints.exerciseCount.min ?? "N/A"}/${constraints.exerciseCount.max ?? "N/A"}`);

    parts.push(`paramètres=${constraints.advancedProfile}`);

    if (constraints.advancedProfile === "custom") {
        parts.push(`personnalisé=[${formatPriorities(constraints.customPriorities)}]`);
    }

    if (constraints.supersetPreference !== null) parts.push(`superset=${constraints.supersetPreference}`);
    return parts.length ? parts.join(" | ") : "Aucune contrainte fixe";
}

function buildClipboardReport(stats, generated, meta) {
    const strictWithinRate = getStrictWithinRate(stats);
    const averageCandidates = stats.executions ? Math.round(stats.totalCandidates / stats.executions * 10) / 10 : 0;
    const averageExercises = stats.successfulWorkouts ? Math.round(stats.totalExercises / stats.successfulWorkouts * 10) / 10 : 0;
    const errors = getWorstAnomalies("error");
    const warnings = getWorstAnomalies("warning");
    const topExercises = getTopExercises(stats);

    const lines = [
        "WILF AUTO-PLAN — RAPPORT TEST LAB",
        `Mode: ${meta.mode} | demandés: ${meta.requestedRuns} | exécutés: ${stats.executions} | seed: ${meta.seed}`,
        `Rapport généré en: ${meta.generationSeconds} s | données utilisateur: ${meta.useUserData ? "oui" : "non"}`,
        `Contraintes fixes: ${formatConstraintsForReport(meta.constraints)}`,
        generated.coverage
            ? `Couverture ${generated.coverage.strength}-way: ${generated.coverage.percent}% (${generated.coverage.covered}/${generated.coverage.total}; ${generated.coverage.uncovered ?? 0} non couvertes)`
            : "Couverture combinatoire: N/A",
        "",
        "RÉSULTATS",
        `Workouts produits: ${stats.successfulWorkouts}/${stats.executions}`,
        `Sans candidat: ${stats.noCandidates}`,
        `Candidats mais workout vide: ${stats.candidatesButEmpty}`,
        `Plans uniques: ${stats.planSignatures.size}`,
        `Candidats moyens: ${averageCandidates}`,
        `Exercices moyens: ${averageExercises}`,
        `Mode sévère dans ±5 min: ${strictWithinRate === null ? "N/A" : `${strictWithinRate}%`} (${stats.strictOutsideFiveMinutes} hors tolérance)`,
        `Minimum souple non atteint: ${stats.softMinimumMisses}`,
        `Maximum souple dépassé: ${stats.softMaximumMisses}`,
        ""
    ];

    lines.push("TOP 10 ANOMALIES");
    if (!errors.length) lines.push("Aucune.");
    errors.forEach((item, index) => lines.push(`${index + 1}. ${item.type} — scénario #${item.scenarioIndex + 1} — ${item.detail} — ${formatRequestSummary(item.request)}`));

    lines.push("", "TOP 10 AVERTISSEMENTS");
    if (!warnings.length) lines.push("Aucun.");
    warnings.forEach((item, index) => lines.push(`${index + 1}. ${item.type} — scénario #${item.scenarioIndex + 1} — ${item.detail} — ${formatRequestSummary(item.request)}`));

    lines.push("", "TOP 10 EXERCICES");
    if (!topExercises.length) lines.push("Aucun.");
    topExercises.forEach((item, index) => lines.push(`${index + 1}. ${item.name} — ${item.count} sélection(s) — ${item.percent}% des workouts`));

    lines.push("", "ÉCHANTILLON DE PLANS");
    if (!state.planSamples.length) lines.push("Aucun plan généré.");
    state.planSamples.forEach((sample, index) => {
        const names = sample.workout.map(item => item.name).join(" + ");
        const sets = sample.workout.map(item => item.prescription?.sets ?? "?").join("/");
        lines.push(`${index + 1}. scénario #${sample.scenarioIndex + 1} — ${sample.targetDurationMinutes}→${sample.estimatedDurationMinutes} min — ${sample.workout.length} ex — séries ${sets} — ${names}`);
    });

    return lines.join("\n");
}

function renderReport(stats, generated, meta) {
    element("test-lab-results").hidden = false;

    const summary = element("test-lab-summary");
    summary.replaceChildren();

    const strictWithinRate = getStrictWithinRate(stats);
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
        summaryCard("Maximum souple dépassé", stats.softMaximumMisses),
        summaryCard("Rapport généré en", `${meta.generationSeconds} s`)
    );

    const coverage = element("test-lab-coverage");
    coverage.innerHTML = generated.coverage
        ? `<h3>Couverture combinatoire</h3><p>${generated.coverage.strength}-way : <strong>${generated.coverage.percent}%</strong> (${generated.coverage.covered}/${generated.coverage.total}). ${generated.coverage.uncovered ? `${generated.coverage.uncovered} interaction(s) non couvertes.` : ""}</p>`
        : `<h3>Mode</h3><p><strong>${meta.mode}</strong> — référence historique figée au ${new Date(meta.referenceAt).toLocaleString("fr-CA")}.</p>`;

    renderAnomalyTable("test-lab-errors", "error");
    renderAnomalyTable("test-lab-warnings", "warning");
    renderTopExercises(stats);
    renderPlanSamples();

    element("test-lab-detail").textContent = "Clique « Voir » sur une anomalie, un avertissement ou un plan échantillon.";
    element("test-lab-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderEmptyTable(body, columns, text) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.textContent = text;
    row.appendChild(cell);
    body.appendChild(row);
}

function renderAnomalyTable(id, level) {
    const body = element(id);
    body.replaceChildren();

    const anomalies = getWorstAnomalies(level);

    if (!anomalies.length) {
        renderEmptyTable(body, 5, level === "error" ? "Aucune anomalie." : "Aucun avertissement.");
        return;
    }

    anomalies.forEach((anomaly, index) => {
        const stateIndex = state.anomalies.indexOf(anomaly);
        const row = document.createElement("tr");

        [index + 1, anomaly.type, String(anomaly.scenarioIndex + 1), anomaly.detail].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const action = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Voir";
        button.dataset.anomalyIndex = stateIndex;

        action.appendChild(button);
        row.appendChild(action);
        body.appendChild(row);
    });
}

function renderTopExercises(stats) {
    const body = element("test-lab-top-exercises");
    body.replaceChildren();

    const topExercises = getTopExercises(stats);

    if (!topExercises.length) {
        renderEmptyTable(body, 4, "Aucun exercice sélectionné.");
        return;
    }

    topExercises.forEach((item, index) => {
        const row = document.createElement("tr");

        [index + 1, item.name, item.count, `${item.percent}%`].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        body.appendChild(row);
    });
}

function renderPlanSamples() {
    const body = element("test-lab-plan-samples");
    body.replaceChildren();

    if (!state.planSamples.length) {
        renderEmptyTable(body, 7, "Aucun plan généré.");
        return;
    }

    state.planSamples.forEach((sample, index) => {
        const row = document.createElement("tr");
        const supersetCount = sample.supersetComposition?.supersetGroupCount ?? 0;
        const preview = sample.workout.slice(0, 4).map(item => item.name).join(" · ") + (sample.workout.length > 4 ? "…" : "");
        const values = [
            index + 1,
            String(sample.scenarioIndex + 1),
            `${sample.targetDurationMinutes} → ${sample.estimatedDurationMinutes} min`,
            sample.workout.length,
            supersetCount,
            preview
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const action = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Voir";
        button.dataset.sampleIndex = index;
        action.appendChild(button);
        row.appendChild(action);
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
        restoreLabState();
        renderAdvancedProfileEditor();
        status.textContent = `${exercises.length} exercices · ${history.length} workout(s) historiques`;
        status.classList.add("ok");
    } catch (error) {
        console.error(error);
        state.appSettings = createDefaultAppSettings();
        state.workoutHistory = [];
        restoreLabState();
        renderAdvancedProfileEditor();
        status.textContent = "Données utilisateur indisponibles — mode vierge";
        status.classList.add("error");
    }
}

initialize();
