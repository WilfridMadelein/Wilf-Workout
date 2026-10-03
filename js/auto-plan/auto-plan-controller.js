import {
    AUTO_PLAN_GOALS,
    AUTO_PLAN_GOAL_LABELS,
    AUTO_PLAN_TYPES,
    AUTO_PLAN_BODY_PARTS,
    normalizeAutoPlanDuration,
    normalizeAutoPlanLastRequest
} from "./auto-plan-settings.js";

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
        equipment: uniqueValid(getDefaultPlanEquipment(), getEquipmentOptions())
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
        equipment: uniqueValid(stored.equipment, getEquipmentOptions())
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
        equipment: [...draft.equipment]
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

    getElement("auto-plan-equipment-presets").querySelectorAll("[data-equipment-preset]").forEach(button => {
        button.classList.toggle("active", button.dataset.equipmentPreset === preset);
    });

    renderChoiceGroup("auto-plan-equipment", options, draft.equipment, null, value => {
        preferredEquipmentPreset = null;
        toggleListValue("equipment", value);
        renderEquipment();
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

function renderForm() {
    getElement("auto-plan-duration").value = draft.durationMinutes ?? "";
    renderGoals();
    renderBodyParts();
    renderTypes();
    renderCategories();
    renderEquipment();

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

function setupAutoPlanController() {
    openButton.addEventListener("click", openAutoPlanPage);
    getElement("back-to-plan-home-button").addEventListener("click", closeAutoPlanPage);
    getElement("auto-plan-create-button").addEventListener("click", createPlanFromDraft);

    getElement("auto-plan-duration").addEventListener("change", event => {
        draft.durationMinutes = normalizeAutoPlanDuration(event.target.value);
        event.target.value = draft.durationMinutes ?? "";

        if (validationStarted) renderValidation();
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
}

export {
    configureAutoPlanController,
    setupAutoPlanController,
    saveAutoPlanDraft
};
