import {
    AUTO_PLAN_GOALS,
    AUTO_PLAN_GOAL_LABELS,
    AUTO_PLAN_TYPES,
    AUTO_PLAN_BODY_PARTS,
    AUTO_PLAN_SUPERSET_OPTIONS,
    AUTO_PLAN_SUPERSET_LABELS,
    AUTO_PLAN_PRIORITY_PRESETS,
    normalizeAutoPlanExerciseCount,
    normalizeAutoPlanDuration,
    normalizeAutoPlanPriorities,
    normalizeAutoPlanLastRequest
} from "./auto-plan-settings.js";

import { updateNumberInputWidth } from "../ui/ui.js";

let page;
let openButton;
let planHome;
let planEditor;
let getAppSettings = () => null;
let saveAppSettingsNow = async () => {};
let getCategoryOptions = () => [];
let getEquipmentOptions = () => [];
let getExercises = () => [];
let getDefaultPlanEquipment = () => [];
let onCreatePlan = async () => {};
let navigationButtons = [];

let draft = null;
let validationStarted = false;
let preferredEquipmentPreset = null;

// ============================================================
// CONFIGURATION
// ============================================================

function configureAutoPlanController(dependencies) {
    ({ page, openButton, planHome, planEditor, getAppSettings, saveAppSettingsNow, getCategoryOptions, getEquipmentOptions, getExercises, getDefaultPlanEquipment, onCreatePlan = async () => {}, navigationButtons = [] } = dependencies);
}

// ============================================================
// DONNÉES
// ============================================================

function uniqueValid(values, options) {
    const allowed = new Set(options);
    return [...new Set(values)].filter(value => allowed.has(value));
}

function getSubmuscleOptions(family) {
    const values = new Set();

    getExercises().forEach(exercise => {
        [...(exercise.muscles_principaux || []), ...(exercise.muscles_secondaires || [])].forEach(muscle => {
            if (muscle[0] === family && muscle[1]) values.add(muscle[1]);
        });
    });

    return [...values].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
}

function getBodyPartMuscleOptions(key) {
    const config = AUTO_PLAN_BODY_PARTS[key];
    if (!config) return [];
    return config.mode === "submuscles" ? getSubmuscleOptions(config.family) : [...config.values];
}

function createPriorityPreset(preset) {
    const defaults = getAppSettings()?.planDefaults ?? {};
    const weightUnit = ["kg", "lbs"].includes(defaults.weightUnit) ? defaults.weightUnit : "lbs";

    if (preset === "settings") {
        return normalizeAutoPlanPriorities({
            preset: "settings",
            sets: defaults.sets,
            reps: defaults.reps,
            time: defaults.time,
            rest: defaults.rest,
            weight: defaults.weight,
            weightUnit,
            tempo: { ...defaults.tempo },
            includeNotes: defaults.includeNotes,
            autoAddDefaultInstructions: defaults.autoAddDefaultInstructions
        });
    }

    return normalizeAutoPlanPriorities({
        preset: "empty",
        weightUnit,
        includeNotes: false,
        autoAddDefaultInstructions: false
    });
}

function createInitialDraft() {
    const bodyParts = Object.keys(AUTO_PLAN_BODY_PARTS);
    const muscles = {};

    bodyParts.forEach(key => { muscles[key] = getBodyPartMuscleOptions(key); });

return {
    durationMinutes: 30,
    goals: [],
    bodyParts,
    muscles,
    types: [...AUTO_PLAN_TYPES],
    categories: [],
    equipment: uniqueValid(getDefaultPlanEquipment(), getEquipmentOptions()),
    exerciseCount: { min: null, max: null },
    planPriorities: createPriorityPreset("empty"),
    supersetPreference: "indifferent"
};
}

function createDraftFromStored(value) {
    const stored = normalizeAutoPlanLastRequest(value);
    if (!stored) return createInitialDraft();

    const bodyPartKeys = Object.keys(AUTO_PLAN_BODY_PARTS);
    const bodyParts = uniqueValid(stored.bodyParts, bodyPartKeys);
    const muscles = {};

    bodyPartKeys.forEach(key => {
        const options = getBodyPartMuscleOptions(key);
        muscles[key] = uniqueValid(stored.muscles[key] ?? options, options);
    });

    return {
        durationMinutes: stored.durationMinutes,
        goals: uniqueValid(stored.goals, AUTO_PLAN_GOALS),
        bodyParts,
        muscles,
        types: uniqueValid(stored.types, AUTO_PLAN_TYPES),
        categories: uniqueValid(stored.categories, getCategoryOptions()),
        equipment: uniqueValid(stored.equipment, getEquipmentOptions()),
        exerciseCount: normalizeAutoPlanExerciseCount(stored.exerciseCount),
        planPriorities: stored.planPriorities ? normalizeAutoPlanPriorities(stored.planPriorities) : createPriorityPreset("empty"),
        supersetPreference: stored.supersetPreference
    };
}

function cloneDraft() {
    return {
        ...draft,
        goals: [...draft.goals],
        bodyParts: [...draft.bodyParts],
        muscles: Object.fromEntries(Object.entries(draft.muscles).map(([key, values]) => [key, [...values]])),
        types: [...draft.types],
        categories: [...draft.categories],
        equipment: [...draft.equipment],
        exerciseCount: { ...draft.exerciseCount },
        planPriorities: { ...draft.planPriorities, tempo: { ...draft.planPriorities.tempo } }
    };
}

async function saveAutoPlanDraft() {
    if (!draft) return;

    const settings = getAppSettings();
    if (!settings) return;

    settings.autoPlanLastRequest = cloneDraft();
    await saveAppSettingsNow(settings);
}

// ============================================================
// INTERFACE
// ============================================================

function getElement(id) {
    return page.querySelector(`#${id}`);
}

function createChoiceButton(container, value, label, selected, onToggle) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = label;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => onToggle(value));
    container.appendChild(button);
}

function toggleListValue(key, value) {
    const values = new Set(draft[key]);

    if (values.has(value)) values.delete(value);
    else values.add(value);

    draft[key] = [...values];

    if (validationStarted) renderValidation();
}

function toggleBodyPart(key) {
    const selected = new Set(draft.bodyParts);

    if (selected.has(key)) {
        selected.delete(key);
    } else {
        selected.add(key);
        draft.muscles[key] = getBodyPartMuscleOptions(key);
    }

    draft.bodyParts = [...selected];
    renderBodyParts();

    if (validationStarted) renderValidation();
}

function toggleBodyMuscle(key, value) {
    const selected = new Set(draft.muscles[key] ?? []);

    if (selected.has(value)) selected.delete(value);
    else selected.add(value);

    draft.muscles[key] = [...selected];
    renderBodyMuscles();

    if (validationStarted) renderValidation();
}

function renderChoiceGroup(id, values, selectedValues, labels, onToggle) {
    const container = getElement(id);
    container.replaceChildren();

    values.forEach(value => {
        createChoiceButton(container, value, labels?.[value] ?? value, selectedValues.includes(value), onToggle);
    });
}

function renderBodyParts() {
    const container = getElement("auto-plan-body-parts");
    container.replaceChildren();

    Object.entries(AUTO_PLAN_BODY_PARTS).forEach(([key, config]) => {
        createChoiceButton(container, key, config.label, draft.bodyParts.includes(key), toggleBodyPart);
    });

    renderBodyMuscles();
}

function renderBodyMuscles() {
    const container = getElement("auto-plan-body-muscles");
    container.replaceChildren();

    draft.bodyParts.forEach(key => {
        const config = AUTO_PLAN_BODY_PARTS[key];
        const options = getBodyPartMuscleOptions(key);
        if (!options.length) return;

        const group = document.createElement("div");
        group.className = "submuscle-container auto-plan-muscle-group";

        const title = document.createElement("p");
        title.className = "submuscle-title";

        const strong = document.createElement("strong");
        strong.textContent = config.label;

        title.appendChild(strong);
        group.appendChild(title);

        options.forEach(value => {
            const label = document.createElement("label");
            label.className = "submuscle-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = draft.muscles[key]?.includes(value) === true;
            checkbox.addEventListener("change", () => toggleBodyMuscle(key, value));

            const text = document.createElement("span");
            text.textContent = value;

            label.append(checkbox, text);
            group.appendChild(label);
        });

        container.appendChild(group);
    });
}

function sameSelection(first, second) {
    if (first.length !== second.length) return false;

    const values = new Set(first);
    return second.every(value => values.has(value));
}

function getMatchingEquipmentPreset() {
    const options = getEquipmentOptions();
    const settingsEquipment = uniqueValid(getDefaultPlanEquipment(), options);

    if (preferredEquipmentPreset) return preferredEquipmentPreset;
    if (sameSelection(draft.equipment, settingsEquipment)) return "settings";
    if (!draft.equipment.length) return "none";
    if (sameSelection(draft.equipment, options)) return "all";

    return null;
}

function renderEquipment() {
    const options = getEquipmentOptions();
    const preset = getMatchingEquipmentPreset();
    const summary = getElement("auto-plan-equipment-summary");
    summary.textContent = preset ? { none: "Aucun", all: "Tous", settings: "Paramètres" }[preset] : draft.equipment.join(", ");
    summary.title = summary.textContent;

    getElement("auto-plan-equipment-presets").querySelectorAll("[data-equipment-preset]").forEach(button => {
        button.classList.toggle("active", button.dataset.equipmentPreset === preset);
    });

    const container = getElement("auto-plan-equipment");
    if (!container.childElementCount) {
        renderChoiceGroup("auto-plan-equipment", options, draft.equipment, null, value => {
            preferredEquipmentPreset = null;
            toggleListValue("equipment", value);
            renderEquipment();
        });
    }
    container.querySelectorAll("button").forEach((button, index) => {
        const selected = draft.equipment.includes(options[index]);
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

function applyEquipmentPreset(preset) {
    const options = getEquipmentOptions();
    preferredEquipmentPreset = preset;

    if (preset === "none") draft.equipment = [];
    if (preset === "all") draft.equipment = [...options];
    if (preset === "settings") draft.equipment = uniqueValid(getDefaultPlanEquipment(), options);

    renderEquipment();
}

function renderGoals() {
    renderChoiceGroup("auto-plan-goals", AUTO_PLAN_GOALS, draft.goals, AUTO_PLAN_GOAL_LABELS, value => {
        toggleListValue("goals", value);
        renderGoals();
    });
}

function renderTypes() {
    renderChoiceGroup("auto-plan-types", AUTO_PLAN_TYPES, draft.types, null, value => {
        toggleListValue("types", value);
        renderTypes();
    });
}

function renderCategories() {
    const categories = getCategoryOptions();

    renderChoiceGroup("auto-plan-categories", categories, draft.categories, null, value => {
        toggleListValue("categories", value);
        renderCategories();
    });
}

function setPriorityInputValue(id, value, { zeroDisplay = null, minChars = 3 } = {}) {
    const input = getElement(id);
    input.value = value === 0 && zeroDisplay ? zeroDisplay : value;
    updateNumberInputWidth(input, minChars);
}

function renderSupersetPreference() {
    renderChoiceGroup("auto-plan-supersets", AUTO_PLAN_SUPERSET_OPTIONS, [draft.supersetPreference], AUTO_PLAN_SUPERSET_LABELS, value => {
        draft.supersetPreference = value;
        renderSupersetPreference();
    });
}

function renderPriorityPreset() {
    page.querySelectorAll("[data-auto-priority-preset]").forEach(button => {
        const active = button.dataset.autoPriorityPreset === draft.planPriorities.preset;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function applyPriorityPreset(preset) {
    if (!AUTO_PLAN_PRIORITY_PRESETS.includes(preset)) return;

    draft.planPriorities = createPriorityPreset(preset);
    renderPlanPriorities();
}

function resetPriorityField(field) {
    const source = createPriorityPreset(draft.planPriorities.preset);

    if (field === "tempo") draft.planPriorities.tempo = { ...source.tempo };
    else {
        draft.planPriorities[field] = source[field];
        if (field === "weight") draft.planPriorities.weightUnit = source.weightUnit;
    }

    renderPlanPriorities();
}

function renderPlanPriorities() {
    renderPriorityPreset();
    const priorities = draft.planPriorities;

    setOptionalInputValue(getElement("auto-plan-priority-sets"), priorities.sets);
    setOptionalInputValue(getElement("auto-plan-priority-reps"), priorities.reps);
    setOptionalInputValue(getElement("auto-plan-priority-time"), priorities.time);
    setOptionalInputValue(getElement("auto-plan-priority-rest"), priorities.rest);
    setOptionalInputValue(getElement("auto-plan-priority-weight"), priorities.weight);

    setOptionalInputValue(getElement("auto-plan-priority-tempo-1"), priorities.tempo.first, { zeroDisplay: "X", minChars: 1 });
    setOptionalInputValue(getElement("auto-plan-priority-tempo-2"), priorities.tempo.second, { minChars: 1 });
    setOptionalInputValue(getElement("auto-plan-priority-tempo-3"), priorities.tempo.third, { zeroDisplay: "X", minChars: 1 });
    setOptionalInputValue(getElement("auto-plan-priority-tempo-4"), priorities.tempo.fourth, { minChars: 1 });

    getElement("auto-plan-priority-include-notes").checked = priorities.includeNotes;
    getElement("auto-plan-priority-instructions").checked = priorities.autoAddDefaultInstructions;

    page.querySelectorAll("[data-auto-plan-weight-unit]").forEach(button => {
        const active = button.dataset.autoPlanWeightUnit === priorities.weightUnit;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    renderSupersetPreference();
}

function renderExerciseCount() {
    setOptionalInputValue(getElement("auto-plan-exercise-min"), draft.exerciseCount.min);
    setOptionalInputValue(getElement("auto-plan-exercise-max"), draft.exerciseCount.max);
}

function setAutoPlanAdvancedOpen(open) {
    const toggle = getElement("auto-plan-advanced-toggle");
    const content = getElement("auto-plan-advanced-content");

    content.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Masquer les paramètres avancés" : "Afficher les paramètres avancés");
}

function setAutoPlanSectionOpen(section, open) {
    const body = section === "body";
    const content = getElement(body ? "auto-plan-body-muscles" : "auto-plan-equipment-content");
    const toggle = getElement(`auto-plan-${section}-toggle`);
    content.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", `${open ? "Masquer" : "Afficher"} les ${body ? "muscles" : "équipements"}`);
    if (!body) getElement("auto-plan-equipment-summary").hidden = open;
}

function renderForm() {
    renderExerciseCount();
    getElement("auto-plan-duration").value = draft.durationMinutes ?? "";
    renderGoals();
    renderBodyParts();
    renderTypes();
    renderCategories();
    renderEquipment();
    renderPlanPriorities();

    if (validationStarted) renderValidation();
}

// ============================================================
// VALIDATION
// ============================================================

const VALIDATION_FIELDS = [
    ["duration", "Entrez un temps entre 15 et 120 minutes"],
    ["bodyParts", "Sélectionnez au moins une partie du corps"],
    ["goals", "Sélectionnez au moins un objectif"],
    ["types", "Sélectionnez au moins un type"],
    ["categories", "Sélectionnez au moins une catégorie"]
];

function validateDraft() {
    return {
        duration: draft.durationMinutes === null,
        bodyParts: draft.bodyParts.length === 0,
        goals: draft.goals.length === 0,
        types: draft.types.length === 0,
        categories: draft.categories.length === 0
    };
}

function renderValidation() {
    const errors = validateDraft();
    const summary = getElement("auto-plan-errors");
    summary.replaceChildren();

    VALIDATION_FIELDS.forEach(([key, message]) => {
        const field = page.querySelector(`[data-auto-plan-field="${key}"]`);
        const error = field?.querySelector(".auto-plan-field-error");

        field?.classList.toggle("has-error", errors[key]);

        if (error) {
            error.textContent = message;
            error.hidden = !errors[key];
        }

        if (!errors[key]) return;

        const line = document.createElement("div");
        line.textContent = message;
        summary.appendChild(line);
    });

    summary.hidden = !Object.values(errors).some(Boolean);

    return !Object.values(errors).some(Boolean);
}

// ============================================================
// NAVIGATION
// ============================================================

function openAutoPlanPage() {
    const settings = getAppSettings();
    const stored = settings?.autoPlanLastRequest ?? null;

    draft = createDraftFromStored(stored);
    validationStarted = false;
    preferredEquipmentPreset = stored ? null : "settings";

    planHome.style.display = "none";
    planEditor.style.display = "none";
    page.hidden = false;

    getElement("auto-plan-errors").hidden = true;
    setAutoPlanAdvancedOpen(false);
    setAutoPlanSectionOpen("body", false);
    setAutoPlanSectionOpen("equipment", false);
    getElement("auto-plan-equipment").replaceChildren();
    renderForm();
    window.scrollTo({ top: 0, behavior: "auto" });
}

async function closeAutoPlanPage() {
    if (page.hidden) return;

    try {
        await saveAutoPlanDraft();
    } catch (error) {
        console.error("Impossible de sauvegarder les paramètres du plan automatique :", error);
    }

    page.hidden = true;
    planHome.style.display = "block";
}

async function createPlanFromDraft() {
    validationStarted = true;

    if (!renderValidation()) return;

    try {
        await saveAutoPlanDraft();
        await onCreatePlan(cloneDraft());
    } catch (error) {
        console.error("Impossible de préparer le plan automatique :", error);
        alert("Impossible d'enregistrer les paramètres du plan automatique.");
    }
}

// ============================================================
// INITIALISATION
// ============================================================

function normalizeOptionalInput(value, { min = 0, max = 999, decimals = 0, zeroDisplay = null } = {}) {
    const text = String(value ?? "").trim();

    if (!text) return null;
    if (zeroDisplay && text.toUpperCase() === String(zeroDisplay).toUpperCase()) return 0;

    const number = Number(text.replace(",", "."));
    if (!Number.isFinite(number)) return null;

    const factor = 10 ** decimals;
    return Math.min(max, Math.max(min, Math.round(number * factor) / factor));
}

function setOptionalInputValue(input, value, { zeroDisplay = null, minChars = 3 } = {}) {
    input.value = value === null || value === undefined ? "" : value === 0 && zeroDisplay ? zeroDisplay : value;
    updateNumberInputWidth(input, minChars);
}

function bindOptionalNumber(id, options, save, arrowSelector) {
    const input = getElement(id);
    const { min = 0, max = 999, step = 1, decimals = 0, minChars = 3, zeroDisplay = null, snap = false } = options;

    if (zeroDisplay) {
        input.type = "text";
        input.inputMode = "numeric";
    }

    const commit = value => {
        const normalized = normalizeOptionalInput(value, { min, max, decimals, zeroDisplay });
        setOptionalInputValue(input, normalized, { zeroDisplay, minChars });
        save(normalized);
    };

    input.addEventListener("input", () => updateNumberInputWidth(input, minChars));
    input.addEventListener("change", () => commit(input.value));

    input.closest(".plan-default-number-control")?.querySelectorAll(arrowSelector).forEach(button => {
        button.addEventListener("click", () => {
            const direction = Number(button.dataset.autoPriorityDirection ?? button.dataset.autoCountDirection);
            const current = normalizeOptionalInput(input.value, { min, max, decimals, zeroDisplay });
            const stepValue = Number(step);
            let next = current === null ? direction > 0 ? Math.max(min, stepValue) : min : current + direction * stepValue;

            if (snap && current !== null && stepValue > 1) {
                const ratio = current / stepValue;
                next = direction > 0 ? (Math.floor(ratio) + 1) * stepValue : (Math.ceil(ratio) - 1) * stepValue;
            }

            commit(next);
        });
    });

    return {
        render: value => setOptionalInputValue(input, value, { zeroDisplay, minChars })
    };
}

function setupAutoPlanController() {
    ["body", "equipment"].forEach(section => {
        const toggle = getElement(`auto-plan-${section}-toggle`);
        toggle.addEventListener("click", () => setAutoPlanSectionOpen(section, toggle.getAttribute("aria-expanded") !== "true"));
    });
    openButton.addEventListener("click", openAutoPlanPage);
    getElement("back-to-plan-home-button").addEventListener("click", closeAutoPlanPage);
    getElement("auto-plan-create-button").addEventListener("click", createPlanFromDraft);

    getElement("auto-plan-duration").addEventListener("change", event => {
        draft.durationMinutes = normalizeAutoPlanDuration(event.target.value);
        event.target.value = draft.durationMinutes ?? "";

        if (validationStarted) renderValidation();
    });
    getElement("auto-plan-advanced-toggle").addEventListener("click", () => {
    setAutoPlanAdvancedOpen(getElement("auto-plan-advanced-content").hidden);
    });

    page.querySelectorAll("[data-duration-direction]").forEach(button => {
        button.addEventListener("click", () => {
            const input = getElement("auto-plan-duration");
            const base = normalizeAutoPlanDuration(input.value) ?? 30;

            draft.durationMinutes = Math.min(120, Math.max(15, base + Number(button.dataset.durationDirection) * 5));
            input.value = draft.durationMinutes;

            if (validationStarted) renderValidation();
        });
    });

    getElement("auto-plan-equipment-presets").querySelectorAll("[data-equipment-preset]").forEach(button => {
        button.addEventListener("click", () => applyEquipmentPreset(button.dataset.equipmentPreset));
    });

    navigationButtons.filter(Boolean).forEach(button => {
        button.addEventListener("click", () => {
            if (page.hidden) return;

            void saveAutoPlanDraft().catch(error => {
                console.error("Impossible de sauvegarder les paramètres du plan automatique :", error);
            });

            page.hidden = true;
        });
    });
bindOptionalNumber("auto-plan-priority-sets", { min: 1, max: 999, step: 1 }, value => draft.planPriorities.sets = value, "[data-auto-priority-direction]");
bindOptionalNumber("auto-plan-priority-reps", { min: 1, max: 999, step: 1 }, value => draft.planPriorities.reps = value, "[data-auto-priority-direction]");
bindOptionalNumber("auto-plan-priority-time", { min: 1, max: 999, step: 15, snap: true }, value => draft.planPriorities.time = value, "[data-auto-priority-direction]");
bindOptionalNumber("auto-plan-priority-rest", { min: 0, max: 999, step: 15, snap: true }, value => draft.planPriorities.rest = value, "[data-auto-priority-direction]");
bindOptionalNumber("auto-plan-priority-weight", { min: 0, max: 9999.9, step: 2.5, decimals: 1, snap: true }, value => draft.planPriorities.weight = value, "[data-auto-priority-direction]");

[
    ["auto-plan-priority-tempo-1", "first", "X"],
    ["auto-plan-priority-tempo-2", "second", null],
    ["auto-plan-priority-tempo-3", "third", "X"],
    ["auto-plan-priority-tempo-4", "fourth", null]
].forEach(([id, key, zeroDisplay]) => {
    bindOptionalNumber(id, { min: 0, max: 999, step: 1, minChars: 1, zeroDisplay }, value => draft.planPriorities.tempo[key] = value, "[data-auto-priority-direction]");
});

bindOptionalNumber("auto-plan-exercise-min", { min: 1, max: 25, step: 1 }, value => draft.exerciseCount.min = value, "[data-auto-count-direction]");
bindOptionalNumber("auto-plan-exercise-max", { min: 1, max: 40, step: 1 }, value => draft.exerciseCount.max = value, "[data-auto-count-direction]");

page.querySelectorAll("[data-auto-priority-preset]").forEach(button => {
    button.addEventListener("click", () => applyPriorityPreset(button.dataset.autoPriorityPreset));
});

page.querySelectorAll("[data-auto-priority-reset]").forEach(button => {
    button.addEventListener("click", () => resetPriorityField(button.dataset.autoPriorityReset));
});

page.querySelectorAll("[data-auto-plan-weight-unit]").forEach(button => {
    button.addEventListener("click", () => {
        if (!draft) return;
        draft.planPriorities.weightUnit = button.dataset.autoPlanWeightUnit;
        renderPlanPriorities();
    });
});

getElement("auto-plan-priority-include-notes").addEventListener("change", event => {
    if (draft) draft.planPriorities.includeNotes = event.target.checked;
});

getElement("auto-plan-priority-instructions").addEventListener("change", event => {
    if (draft) draft.planPriorities.autoAddDefaultInstructions = event.target.checked;
});

setAutoPlanAdvancedOpen(false);

}


export {
    configureAutoPlanController,
    setupAutoPlanController,
    saveAutoPlanDraft
};
