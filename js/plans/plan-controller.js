import {
    setupNumberInput,
    updateNumberInputWidth
} from "../ui/ui.js";

import {
    formatPlanDuration
} from "./plan-timing.js";

let getCurrentPlan;
let setCurrentPlan;

let newPlanButton;
let planHome;
let plansList;
let planEditor;
let currentPlanName;
let backToPlansButton;
let startPlanWorkoutButton;
let startWorkout = () => {};
let plans;
let editPlanNameButton;
let currentPlanNameInput;

let planAutoAddCategories;
let planAutoAddEquipment;
let planIncludeNotes;
let planAutoAddInstructions;

let planFiltersToggle;
let planFiltersContent;
let planSettingsToggle;
let planSettingsContent;
let planWorkoutMetadataToggle;
let planWorkoutMetadata;

let planNotesEditor;
let planNotesInput;
let planNotesCounter;

let planCategoryEditor;
let planCategorySelected;
let addPlanCategoryButton;
let planCategoryOptions;

let planEquipmentEditor;
let planEquipmentSelected;
let addPlanEquipmentButton;
let planEquipmentOptions;

let planDeleteModal;
let planDeleteMessage;
let cancelPlanDeleteButton;
let confirmPlanDeleteButton;

let getEquipmentOptions = () => [];
let getSelectedPlanCategories = () => new Set();
let getSelectedPlanEquipment = () => new Set();
let getCategoryOptions = () => [];

let pendingPlanDeletion = null;

let planSetsInput;
let planRepsInput;
let planTimeInput;
let planRestInput;
let planWeightInput;
let planWeightUnitButtons;
let planTempoInputs;

let planExerciseBrowserContainer;
let exerciseBrowser;

let loadPlanFilters = () => {};
let saveCurrentPlanFilters = () => {};

let displayExercises;
let renderPlanExercises;

let setCurrentDetailExercise;
let setCurrentDetailContext;

let syncPlanAutoExcludedProgressions = () => {};

let savePlanNow = async () => {};
let deletePlanFromStorage = async () => {};
let schedulePlanSave = () => {};
let requestPersistentStorage = async () => false;

let getDefaultPlanSettings = () => null;


export function configurePlanController(dependencies) {
    ({
        getCurrentPlan,
        setCurrentPlan,

        newPlanButton,
        plans,
        planHome,
        plansList,
        planEditor,
        currentPlanName,
        editPlanNameButton,
        currentPlanNameInput,
        backToPlansButton,
        startPlanWorkoutButton,
        startWorkout,

        planAutoAddEquipment,
        planAutoAddInstructions,
        planNotesInput,
        planNotesCounter,
        planEquipmentEditor,
        planEquipmentSelected,
        addPlanEquipmentButton,
        planEquipmentOptions,

        planDeleteModal,
        planDeleteMessage,
        cancelPlanDeleteButton,
        confirmPlanDeleteButton,

        getEquipmentOptions,
        getSelectedPlanCategories,
        getSelectedPlanEquipment,
        getCategoryOptions,

        planSetsInput,
        planRepsInput,
        planTimeInput,
        planRestInput,
        planWeightInput,
        planWeightUnitButtons,
        planTempoInputs,

        planExerciseBrowserContainer,
        exerciseBrowser,

        loadPlanFilters,
        saveCurrentPlanFilters, 
        displayExercises,
        renderPlanExercises,

        setCurrentDetailExercise,
        setCurrentDetailContext,
        syncPlanAutoExcludedProgressions,

        savePlanNow,
        deletePlanFromStorage,
        schedulePlanSave,
        requestPersistentStorage,

        getDefaultPlanSettings,
planAutoAddCategories,
planAutoAddEquipment,
planIncludeNotes,
planAutoAddInstructions,

planFiltersToggle,
planFiltersContent,
planSettingsToggle,
planSettingsContent,
planWorkoutMetadataToggle,
planWorkoutMetadata,

planNotesEditor,
planNotesInput,
planNotesCounter,

planCategoryEditor,
planCategorySelected,
addPlanCategoryButton,
planCategoryOptions,

planEquipmentEditor,        

    } = dependencies);
}

export function ensurePlanDefaults(plan) {
    if (!plan.defaults) {
        plan.defaults = {};
    }

    if (plan.defaults.sets == null) {
        plan.defaults.sets = 3;
    }

    if (plan.defaults.reps == null) {
        plan.defaults.reps = 10;
    }

    if (plan.defaults.time == null) {
        plan.defaults.time = 30;
    }

    if (plan.defaults.rest == null) {
        plan.defaults.rest = 60;
    }

    if (plan.defaults.weight == null) {
        plan.defaults.weight = 0;
    }

    if (!["kg", "lbs"].includes(plan.defaults.weightUnit)) {
        plan.defaults.weightUnit = "lbs";
    }

    if (!plan.defaults.tempo) {
        plan.defaults.tempo = {};
    }

    if (
        plan.defaults.tempo.first == null ||
        plan.defaults.tempo.first === ""
    ) {
        plan.defaults.tempo.first = 3;
    }

    if (
        plan.defaults.tempo.second == null ||
        plan.defaults.tempo.second === ""
    ) {
        plan.defaults.tempo.second = 0;
    }

    if (
        plan.defaults.tempo.third == null ||
        plan.defaults.tempo.third === ""
    ) {
        plan.defaults.tempo.third = 1;
    }

    if (
        plan.defaults.tempo.fourth == null ||
        plan.defaults.tempo.fourth === ""
    ) {
        plan.defaults.tempo.fourth = 0;
    }
}

function updatePlanWeightUnitButtons(unit) {
    planWeightUnitButtons.forEach(button => {
        const active = button.dataset.weightUnit === unit;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

export function loadPlanDefaultsIntoInputs() {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) return;

    ensurePlanDefaults(currentPlan);

    planSetsInput.value = currentPlan.defaults.sets;
    planRepsInput.value = currentPlan.defaults.reps;
    planTimeInput.value = currentPlan.defaults.time;
    planRestInput.value = currentPlan.defaults.rest;
    planWeightInput.value = currentPlan.defaults.weight;

    updatePlanWeightUnitButtons(currentPlan.defaults.weightUnit);

const tempoValues = [
    currentPlan.defaults.tempo.first,
    currentPlan.defaults.tempo.second,
    currentPlan.defaults.tempo.third,
    currentPlan.defaults.tempo.fourth
];

planTempoInputs.forEach((input, index) => {
    const value = tempoValues[index];
    const usesX = index === 0 || index === 2;

    input.value =
        usesX && value === 0
            ? "X"
            : value;
});

[
    planSetsInput,
    planRepsInput,
    planTimeInput,
    planRestInput,
    planWeightInput,
    ...planTempoInputs
].forEach(input => {
    updateNumberInputWidth(
        input,
        Number(
            input.dataset.minChars
        ) || 3
    );
});

}

export function setupPlanDefaultInputs() {

    const bind = (
        input,
        options,
        save
    ) => {
        const control =
            setupNumberInput(input, {
                ...options,

                onChange: value => {
                    const plan = getCurrentPlan();

                    if (!plan) return;

                    save(plan.defaults,value);
                    schedulePlanSave(plan);
                }
            });

        input
            .closest(
                ".plan-default-number-control"
            )
            ?.querySelectorAll(
                "[data-direction]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        control.step(
                             Number(button.dataset.direction),
                                options.snapStep === true
                        );
                    }
                );
            });
    };


    bind(
        planSetsInput,
        {
            min: 1,
            max: 999,
            step: 1,
            minChars: 3
        },
        (defaults, value) =>
            defaults.sets = value
    );

    bind(
        planRepsInput,
        {
            min: 1,
            max: 999,
            step: 1,
            minChars: 3
        },
        (defaults, value) =>
            defaults.reps = value
    );

    bind(
        planTimeInput,
        {
            min: 1,
            max: 999,
            step: 15,
            minChars: 3,
            snapStep: true
        },
        (defaults, value) =>
            defaults.time = value
    );

    bind(
        planRestInput,
        {
            min: 0,
            max: 999,
            step: 15,
            minChars: 3,
            snapStep: true
        },
        (defaults, value) =>
            defaults.rest = value
    );

    bind(
    planWeightInput,
    {
        min: 0,
        max: 9999.9,
        step: 2.5,
        decimals: 1,
        minChars: 3,
        snapStep: true
    },
    (defaults, value) =>
        defaults.weight = value
    );


    const tempoKeys = [
        "first",
        "second",
        "third",
        "fourth"
    ];

    planTempoInputs.forEach(
        (input, index) => {
            bind(
                input,
                {
                    min: 0,
                    max: 999,
                    step: 1,
                    minChars: 1,
                    zeroDisplay:
                        index === 0 || index === 2
                            ? "X"
                            : null
                },

                (defaults, value) =>
                    defaults.tempo[
                        tempoKeys[index]
                    ] = value
            );
        }
    );

    const weightUnitSwitch =
    planWeightUnitButtons[0]?.closest(".plan-weight-unit-switch");

    weightUnitSwitch?.addEventListener("click", () => {
    const plan = getCurrentPlan();
    if (!plan) return;

    const unit = plan.defaults.weightUnit === "kg" ? "lbs" : "kg";

    plan.defaults.weightUnit = unit;
    updatePlanWeightUnitButtons(unit);
    schedulePlanSave(plan);
    });

}


// ------------------------------------------------------------
// Résumé d'un plan
// ------------------------------------------------------------

export function getPlanSetCount(plan) {
    return new Set(
        plan.exercises
            .map(item => item.combination?.group)
            .filter(Number.isInteger)
    ).size;
}

export function getPlanPrimaryMuscles(plan) {
    const muscles = new Set();

    plan.exercises.forEach(planExercise => {
        planExercise.exercise?.muscles_principaux
            ?.forEach(([family]) => {
                if (family) {
                    muscles.add(family);
                }
            });
    });

    return [...muscles];
}

// ------------------------------------------------------------
// Notes et équipements du plan
// ------------------------------------------------------------

function updateNotesCounter(textarea, counter) {
    const length = textarea.value.length;
    const visible = length >= 450;

    counter.textContent = `${length} / 500`;
    counter.hidden = !visible;
    textarea.classList.toggle("counter-visible", visible);
}

function resizePlanNotesTextarea(textarea) {
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const verticalExtra =
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth);

    const maxHeight = lineHeight * 4 + verticalExtra;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY =
        textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

function ensurePlanMetadata(plan) {
    if (typeof plan.notes !== "string") plan.notes = "";
    plan.notes = plan.notes.slice(0, 500);

    if (!Array.isArray(plan.categories)) plan.categories = [];
    if (!Array.isArray(plan.equipment)) plan.equipment = [];

    if (typeof plan.includeCategories !== "boolean") plan.includeCategories = false;
    if (typeof plan.includeEquipment !== "boolean") plan.includeEquipment = false;
    if (typeof plan.includeNotes !== "boolean") plan.includeNotes = plan.notes.trim().length > 0;
    if (typeof plan.autoAddDefaultInstructions !== "boolean") plan.autoAddDefaultInstructions = true;
}

export function addCategoriesToCurrentPlan(...categoryNames) {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);

    const validCategories = new Set(getCategoryOptions());
    let changed = false;

    categoryNames.forEach(category => {
        if (!validCategories.has(category) || plan.categories.includes(category)) return;
        plan.categories.push(category);
        changed = true;
    });

    if (changed) {
        schedulePlanSave(plan);
        renderPlanCategoryEditor();
    }
}

function removeCategoryFromCurrentPlan(category) {
    const plan = getCurrentPlan();
    if (!plan) return;

    plan.categories = plan.categories.filter(item => item !== category);
    schedulePlanSave(plan);
    renderPlanCategoryEditor();
}

function renderPlanCategoryEditor() {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);

    planCategoryEditor.hidden = !plan.includeCategories;
    planCategoryOptions.hidden = true;
    planCategorySelected.replaceChildren();
    planCategoryOptions.replaceChildren();

    if (!plan.includeCategories) return;

    if (!plan.categories.length) {
        const empty = document.createElement("span");
        empty.classList.add("plan-metadata-empty");
        empty.textContent = "Aucune";
        planCategorySelected.appendChild(empty);
    }

    plan.categories.forEach(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("summary-button", "plan-metadata-chip");

        const remove = document.createElement("span");
        remove.classList.add("summary-remove");
        remove.textContent = "−";

        const label = document.createElement("span");
        label.textContent = category;

        button.append(remove, label);
        button.addEventListener("click", () => removeCategoryFromCurrentPlan(category));
        planCategorySelected.appendChild(button);
    });

    getCategoryOptions().filter(category => !plan.categories.includes(category)).forEach(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("filter-button");
        button.textContent = category;
        button.addEventListener("click", () => addCategoriesToCurrentPlan(category));
        planCategoryOptions.appendChild(button);
    });

    if (!planCategoryOptions.children.length) {
        const empty = document.createElement("span");
        empty.textContent = "Toutes les catégories sont déjà ajoutées.";
        planCategoryOptions.appendChild(empty);
    }
}

export function addEquipmentToCurrentPlan(...equipmentNames) {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);

    const validEquipment = new Set(getEquipmentOptions());
    let changed = false;

    equipmentNames.forEach(equipment => {
        if (!validEquipment.has(equipment) || plan.equipment.includes(equipment)) return;
        plan.equipment.push(equipment);
        changed = true;
    });

    if (changed) {
        schedulePlanSave(plan);
        renderPlanEquipmentEditor();
    }

}

function removeEquipmentFromCurrentPlan(equipment) {
    const plan = getCurrentPlan();
    if (!plan) return;

    plan.equipment = plan.equipment.filter(item => item !== equipment);
    schedulePlanSave(plan);
    renderPlanEquipmentEditor();
}

function renderPlanEquipmentEditor() {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);

    planEquipmentEditor.hidden = !plan.includeEquipment;
    planEquipmentOptions.hidden = true;
    planEquipmentSelected.replaceChildren();
    planEquipmentOptions.replaceChildren();

    if (!plan.includeEquipment) return;

    if (!plan.equipment.length) {
        const empty = document.createElement("span");
        empty.classList.add("plan-equipment-empty");
        empty.textContent = "Aucun";
        planEquipmentSelected.appendChild(empty);
    }

    plan.equipment.forEach(equipment => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("summary-button", "plan-equipment-chip");

        const remove = document.createElement("span");
        remove.classList.add("summary-remove");
        remove.textContent = "−";

        const label = document.createElement("span");
        label.textContent = equipment;

        button.append(remove, label);
        button.addEventListener("click", () => removeEquipmentFromCurrentPlan(equipment));
        planEquipmentSelected.appendChild(button);
    });

    getEquipmentOptions()
        .filter(equipment => !plan.equipment.includes(equipment))
        .forEach(equipment => {
            const button = document.createElement("button");
            button.type = "button";
            button.classList.add("filter-button");
            button.textContent = equipment;
            button.addEventListener("click", () => addEquipmentToCurrentPlan(equipment));
            planEquipmentOptions.appendChild(button);
        });

    if (!planEquipmentOptions.children.length) {
        const empty = document.createElement("span");
        empty.textContent = "Tous les équipements sont déjà ajoutés.";
        planEquipmentOptions.appendChild(empty);
    }
}

function renderPlanMetadataEditor() {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);

planAutoAddCategories.checked = plan.includeCategories;
planAutoAddEquipment.checked = plan.includeEquipment;
planIncludeNotes.checked = plan.includeNotes;
planAutoAddInstructions.checked = plan.autoAddDefaultInstructions;

planNotesEditor.hidden = !plan.includeNotes;
planNotesInput.value = plan.notes.slice(0, 500);
resizePlanNotesTextarea(planNotesInput);
updateNotesCounter(planNotesInput, planNotesCounter);

renderPlanCategoryEditor();
renderPlanEquipmentEditor();
}

// ------------------------------------------------------------
// Ouvrir un plan
// ------------------------------------------------------------

function openPlan(plan) {
    const previousPlan = getCurrentPlan();

    if (previousPlan && previousPlan !== plan) {
        saveCurrentPlanFilters();
    }

    syncPlanAutoExcludedProgressions(plan);
    setCurrentPlan(plan);

    ensurePlanDefaults(plan);
    ensurePlanMetadata(plan);

    planHome.style.display = "none";
    planEditor.style.display = "block";

    currentPlanName.textContent = plan.name;
    currentPlanName.hidden = false;

    currentPlanNameInput.value = plan.name;
    currentPlanNameInput.hidden = true;

    loadPlanDefaultsIntoInputs();
    renderPlanMetadataEditor();
    renderPlanExercises();

    planExerciseBrowserContainer.appendChild(
        exerciseBrowser
    );

    exerciseBrowser.style.display = "block";

    loadPlanFilters(plan);
    displayExercises();
}


// ------------------------------------------------------------
// Liste des plans
// ------------------------------------------------------------

export function renderPlansList() {
    plansList.replaceChildren();

    plans.forEach(plan => {
        ensurePlanMetadata(plan);

        const card = document.createElement("div");
        card.classList.add("plan-card");
        card.tabIndex = 0;
        card.setAttribute("role", "button");

        const exerciseCount = plan.exercises.length;
        const setCount = getPlanSetCount(plan);
        const muscles = getPlanPrimaryMuscles(plan);

        const title = document.createElement("span");
        title.classList.add("plan-card-title");
        title.textContent = plan.name;

        const summary = document.createElement("span");
        summary.classList.add("plan-card-info");

        const duration = document.createElement("strong");
        duration.textContent = formatPlanDuration(plan);

        const counts = document.createElement("span");
        counts.textContent = ` (${exerciseCount} exercice${exerciseCount !== 1 ? "s" : ""} | ${setCount} set${setCount !== 1 ? "s" : ""})`;

        summary.append(duration, counts);

        const muscleList = document.createElement("span");
        muscleList.classList.add("plan-card-muscles");
        muscleList.textContent = muscles.length ? muscles.join(", ") : "Aucun muscle principal";

        card.append(title, summary, muscleList);

        const appendMetadataLine = (className, label, values, emptyText) => {
            const line = document.createElement("div");
            line.classList.add(className);

            const strong = document.createElement("strong");
            strong.textContent = `${label} : `;

            const text = document.createElement("span");
            text.textContent = values.length ? values.join(", ") : emptyText;

            line.append(strong, text);
            card.appendChild(line);
        };

        if (plan.includeCategories) appendMetadataLine("plan-card-categories", "Catégories", plan.categories, "Aucune");
        if (plan.includeEquipment) appendMetadataLine("plan-card-equipment", "Équipements", plan.equipment, "Aucun");

        const footer = document.createElement("div");
        footer.classList.add("plan-card-footer");

        let notes = null;
        let notesCounter = null;

        if (plan.includeNotes) {
            const notesBox = document.createElement("div");
            notesBox.classList.add("plan-card-notes");

            const notesLabel = document.createElement("strong");
            notesLabel.textContent = "Notes :";

            notes = document.createElement("textarea");
            notes.classList.add("plan-card-notes-input");
            notes.rows = 1;
            notes.maxLength = 500;
            notes.placeholder = "Ajouter des notes...";
            notes.value = plan.notes.slice(0, 500);

            const notesWrap = document.createElement("div");
            notesWrap.classList.add("plan-notes-input-wrap");

            notesCounter = document.createElement("span");
            notesCounter.classList.add("plan-notes-counter");
            notesCounter.hidden = true;
            notesCounter.textContent = "0 / 500";

            notes.addEventListener("input", () => {
                if (notes.value.length > 500) notes.value = notes.value.slice(0, 500);
                plan.notes = notes.value;
                resizePlanNotesTextarea(notes);
                updateNotesCounter(notes, notesCounter);
                schedulePlanSave(plan);
            });

            ["click", "mousedown", "keydown"].forEach(type => notes.addEventListener(type, event => event.stopPropagation()));

            notesWrap.append(notes, notesCounter);
            notesBox.append(notesLabel, notesWrap);
            footer.appendChild(notesBox);
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.classList.add("plan-delete-button");
        deleteButton.textContent = "🗑";
        deleteButton.title = "Supprimer le plan";
        deleteButton.setAttribute("aria-label", `Supprimer ${plan.name}`);

        deleteButton.addEventListener("click", event => {
            event.stopPropagation();
            openPlanDeleteModal(plan);
        });

        footer.appendChild(deleteButton);

        const startWorkoutButton = document.createElement("button");
        startWorkoutButton.type = "button";
        startWorkoutButton.classList.add("plan-start-workout-button");
        startWorkoutButton.textContent = "Commencer l'entraînement";

        startWorkoutButton.addEventListener("click", event => {
            event.stopPropagation();
            startWorkout(plan);
        });

        card.append(footer, startWorkoutButton);
        card.addEventListener("click", () => openPlan(plan));

        card.addEventListener("keydown", event => {
            if (event.target !== card || !["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            openPlan(plan);
        });

        plansList.appendChild(card);

        if (notes && notesCounter) requestAnimationFrame(() => {
            resizePlanNotesTextarea(notes);
            updateNotesCounter(notes, notesCounter);
        });
    });
}

// ------------------------------------------------------------
// Supprimer un plan
// ------------------------------------------------------------

function openPlanDeleteModal(plan) {
    pendingPlanDeletion = plan;
    planDeleteMessage.textContent =
        `Vous êtes sur le point de supprimer de manière permanente votre plan "${plan.name}". Souhaitez-vous continuer ?`;

    planDeleteModal.hidden = false;
}

function closePlanDeleteModal() {
    pendingPlanDeletion = null;
    planDeleteModal.hidden = true;
}

async function deletePendingPlan() {
    if (!pendingPlanDeletion) return;

    const plan = pendingPlanDeletion;

    try {
        await deletePlanFromStorage(plan.id);
    } catch (error) {
        console.error("Impossible de supprimer le plan du stockage :", error);
        return;
    }

    const index = plans.indexOf(plan);
    if (index !== -1) plans.splice(index, 1);

    if (getCurrentPlan() === plan) {
        syncPlanAutoExcludedProgressions(null);
        setCurrentPlan(null);
    }

    closePlanDeleteModal();
    renderPlansList();
}

// ------------------------------------------------------------
// Modifier le nom
// ------------------------------------------------------------

function startPlanNameEditing() {
    const plan = getCurrentPlan();

    if (!plan) return;

    currentPlanNameInput.value =
        plan.name;

    currentPlanName.hidden = true;
    currentPlanNameInput.hidden = false;

    currentPlanNameInput.focus();
    currentPlanNameInput.select();
}

function finishPlanNameEditing() {
    const plan = getCurrentPlan();

    if (
        !plan ||
        currentPlanNameInput.hidden
    ) {
        return;
    }

    const name =
        currentPlanNameInput.value.trim();

    if (name) {
        plan.name = name;
    }

    currentPlanName.textContent =
        plan.name;

    currentPlanNameInput.hidden = true;
    currentPlanName.hidden = false;

    renderPlansList();

    savePlanNow(plan).catch(error => {
    console.error("Impossible de sauvegarder le nom du plan :", error);
    });
}

function createNewPlanFilterState(defaults = {}) {
    const categoryOptions = getCategoryOptions();
    const equipmentOptions = getEquipmentOptions();

    const categories = Array.isArray(defaults.filters?.categories)
        ? defaults.filters.categories.filter(category => categoryOptions.includes(category))
        : categoryOptions;

    const equipment = Array.isArray(defaults.filters?.equipment)
        ? defaults.filters.equipment.filter(item => equipmentOptions.includes(item))
        : equipmentOptions;

    return {
        search: "",
        types: new Set(),
        progressionsInclude: new Set(),
        progressionsExclude: new Set(),
        muscleFamilies: new Set(),
        submuscles: new Map(),
        categories: new Set(categories),
        equipment: new Set(equipment),
        autoExcludeProgressions: defaults.filters?.autoExcludeProgressions !== false
    };
}

function createNewPlanDefaults(defaults = {}) {
    return {
        sets: defaults.sets ?? 3,
        reps: defaults.reps ?? 10,
        time: defaults.time ?? 30,
        rest: defaults.rest ?? 60,
        weight: defaults.weight ?? 0,
        weightUnit: defaults.weightUnit ?? "lbs",

        tempo: {
            first: defaults.tempo?.first ?? 3,
            second: defaults.tempo?.second ?? 0,
            third: defaults.tempo?.third ?? 1,
            fourth: defaults.tempo?.fourth ?? 0
        }
    };
}

function setupPlanSectionToggle(button, content, labels) {
    if (!button || !content) return;

    const setCollapsed = collapsed => {
        content.hidden = collapsed;
        button.setAttribute("aria-expanded", String(!collapsed));
        button.setAttribute("aria-label", collapsed ? labels.show : labels.hide);
    };

    button.addEventListener("click", () => setCollapsed(!content.hidden));
    setCollapsed(false);
}

export function setupPlanController() {

setupPlanSectionToggle(planFiltersToggle, planFiltersContent, {
    show: "Afficher le filtre du plan",
    hide: "Masquer le filtre du plan"
});

setupPlanSectionToggle(planSettingsToggle, planSettingsContent, {
    show: "Afficher les paramètres du plan",
    hide: "Masquer les paramètres du plan"
});

setupPlanSectionToggle(planWorkoutMetadataToggle, planWorkoutMetadata, {
    show: "Afficher les informations du plan",
    hide: "Masquer les informations du plan"
});    

planNotesInput.addEventListener("input", () => {
    const plan = getCurrentPlan();

    if (planNotesInput.value.length > 500) {
        planNotesInput.value = planNotesInput.value.slice(0, 500);
    }

    if (plan) {
        plan.notes = planNotesInput.value;
        schedulePlanSave(plan);
    }

    resizePlanNotesTextarea(planNotesInput);
    updateNotesCounter(planNotesInput, planNotesCounter);
});

planAutoAddCategories.addEventListener("change", () => {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);
    plan.includeCategories = planAutoAddCategories.checked;
    schedulePlanSave(plan);

    if (plan.includeCategories) addCategoriesToCurrentPlan(...getSelectedPlanCategories());
    renderPlanMetadataEditor();
});

planAutoAddEquipment.addEventListener("change", () => {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);
    plan.includeEquipment = planAutoAddEquipment.checked;
    schedulePlanSave(plan);

    if (plan.includeEquipment) addEquipmentToCurrentPlan(...getSelectedPlanEquipment());
    renderPlanMetadataEditor();
});

planIncludeNotes.addEventListener("change", () => {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);
    plan.includeNotes = planIncludeNotes.checked;
    schedulePlanSave(plan);
    renderPlanMetadataEditor();
});

planAutoAddInstructions.addEventListener(
    "change",
    () => {
        const plan = getCurrentPlan();
        if (!plan) return;

        ensurePlanMetadata(plan);

        plan.autoAddDefaultInstructions =
            planAutoAddInstructions.checked;

        schedulePlanSave(plan);
    }
);

addPlanCategoryButton.addEventListener("click", () => {
    planCategoryOptions.hidden = !planCategoryOptions.hidden;
});

addPlanEquipmentButton.addEventListener("click", () => {
    planEquipmentOptions.hidden = !planEquipmentOptions.hidden;
});

cancelPlanDeleteButton.addEventListener("click", closePlanDeleteModal);
confirmPlanDeleteButton.addEventListener("click", deletePendingPlan);

planDeleteModal.addEventListener("click", event => {
    if (event.target === planDeleteModal) closePlanDeleteModal();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !planDeleteModal.hidden) closePlanDeleteModal();
});

    newPlanButton.addEventListener(
        "click",
        async () => {
const defaults = getDefaultPlanSettings() ?? {};
const filters = createNewPlanFilterState(defaults);

const plan = {
    id: crypto.randomUUID?.() ?? Date.now(),
    createdAt: Date.now(),

    name: `Plan ${plans.length + 1}`,
    defaults: createNewPlanDefaults(defaults),

    exercises: [],
    notes: "",

    filters,
    filtersInitialized: true,

categories: defaults.includeCategories === true ? [...filters.categories] : [],
equipment: defaults.includeEquipment === true ? [...filters.equipment] : [],

includeCategories: defaults.includeCategories === true,
includeEquipment: defaults.includeEquipment === true,
includeNotes: defaults.includeNotes === true,
autoAddDefaultInstructions: defaults.autoAddDefaultInstructions !== false,
    };
            ensurePlanDefaults(plan);

            plans.push(plan);

            try {
                await savePlanNow(plan);
            } catch (error) {
                console.error("Impossible de sauvegarder le nouveau plan :", error);
            }

            requestPersistentStorage().catch(error => {
                console.warn("Impossible de demander le stockage persistant :", error);
            });

            renderPlansList();
            openPlan(plan);
        }
    );


    editPlanNameButton.addEventListener(
        "click",
        startPlanNameEditing
    );

    currentPlanName.addEventListener(
        "click",
        startPlanNameEditing
    );


    currentPlanNameInput.addEventListener(
        "blur",
        finishPlanNameEditing
    );

    currentPlanNameInput.addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                event.preventDefault();
                currentPlanNameInput.blur();
            }

            if (event.key === "Escape") {
                event.preventDefault();

                currentPlanNameInput.value =
                    getCurrentPlan()?.name ?? "";

                currentPlanNameInput.blur();
            }
        }
    );

startPlanWorkoutButton.addEventListener(
    "click",
    () => {
        const plan = getCurrentPlan();
        if (!plan) return;

        finishPlanNameEditing();
        saveCurrentPlanFilters();

        startWorkout(plan);
    }
);

    backToPlansButton.addEventListener(
        "click",
        () => {
            finishPlanNameEditing();
            saveCurrentPlanFilters();

            planEditor.style.display = "none";
            planHome.style.display = "block";

            renderPlansList();

            setCurrentDetailExercise(null);
            setCurrentDetailContext("search");
        }
    );
}
