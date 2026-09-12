import {
    setupNumberInput,
    updateNumberInputWidth
} from "../ui/ui.js";

let getCurrentPlan;
let setCurrentPlan;

let newPlanButton;
let planHome;
let plansList;
let planEditor;
let currentPlanName;
let backToPlansButton;
let plans;
let editPlanNameButton;
let currentPlanNameInput;

let planAutoAddEquipment;
let planNotesInput;
let planNotesCounter;
let planEquipmentEditor;
let planEquipmentSelected;
let addPlanEquipmentButton;
let planEquipmentOptions;

let planDeleteModal;
let planDeleteMessage;
let cancelPlanDeleteButton;
let confirmPlanDeleteButton;

let getEquipmentOptions = () => [];
let getSelectedPlanEquipment = () => new Set();

let pendingPlanDeletion = null;

let planSetsInput;
let planRepsInput;
let planTimeInput;
let planRestInput;
let planTempoInputs;

let planExerciseBrowserContainer;
let exerciseBrowser;

let getPlanSearchState;
let loadSearchState;
let displayExercises;
let renderPlanExercises;

let setCurrentDetailExercise;
let setCurrentDetailContext;

let syncPlanAutoExcludedProgressions = () => {};

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

        planAutoAddEquipment,
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
        getSelectedPlanEquipment,

        planSetsInput,
        planRepsInput,
        planTimeInput,
        planRestInput,
        planTempoInputs,

        planExerciseBrowserContainer,
        exerciseBrowser,

        getPlanSearchState,
        loadSearchState,
        displayExercises,
        renderPlanExercises,

        setCurrentDetailExercise,
        setCurrentDetailContext,
        syncPlanAutoExcludedProgressions

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

export function loadPlanDefaultsIntoInputs() {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) return;

    ensurePlanDefaults(currentPlan);

    planSetsInput.value = currentPlan.defaults.sets;
    planRepsInput.value = currentPlan.defaults.reps;
    planTimeInput.value = currentPlan.defaults.time;
    planRestInput.value = currentPlan.defaults.rest;

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
                    const plan =
                        getCurrentPlan();

                    if (!plan) return;

                    save(
                        plan.defaults,
                        value
                    );
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

function updatePlanNotesCounter() {
    const length = planNotesInput.value.length;
    const visible = length >= 450;

    planNotesCounter.textContent = `${length} / 500`;
    planNotesCounter.hidden = !visible;
    planNotesInput.classList.toggle("counter-visible", visible);
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

    if (!Array.isArray(plan.equipment)) plan.equipment = [];
    if (typeof plan.includeEquipment !== "boolean") plan.includeEquipment = false;
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

    if (changed) renderPlanEquipmentEditor();
}

function removeEquipmentFromCurrentPlan(equipment) {
    const plan = getCurrentPlan();
    if (!plan) return;

    plan.equipment = plan.equipment.filter(item => item !== equipment);
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

    planAutoAddEquipment.checked = plan.includeEquipment;
    planNotesInput.value = plan.notes.slice(0, 500);
    resizePlanNotesTextarea(planNotesInput);
    updatePlanNotesCounter();
    renderPlanEquipmentEditor();
}

// ------------------------------------------------------------
// Ouvrir un plan
// ------------------------------------------------------------

function openPlan(plan) {
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

    loadSearchState(
        getPlanSearchState()
    );

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

        const exercises = document.createElement("span");
        exercises.classList.add("plan-card-info");
        exercises.textContent = `${exerciseCount} exercice${exerciseCount !== 1 ? "s" : ""}`;

        const sets = document.createElement("span");
        sets.classList.add("plan-card-info");
        sets.textContent = `${setCount} set${setCount !== 1 ? "s" : ""}`;

        const muscleList = document.createElement("span");
        muscleList.classList.add("plan-card-muscles");
        muscleList.textContent = muscles.length ? muscles.join(", ") : "Aucun muscle principal";

        card.append(title, exercises, sets, muscleList);

        if (plan.includeEquipment) {
            const equipment = document.createElement("span");
            equipment.classList.add("plan-card-equipment");
            equipment.textContent = `Équipements : ${plan.equipment.length ? plan.equipment.join(", ") : "Aucun"}`;
            card.appendChild(equipment);
        }

        const footer = document.createElement("div");
        footer.classList.add("plan-card-footer");

        const notesBox = document.createElement("div");
        notesBox.classList.add("plan-card-notes");

        const notesLabel = document.createElement("strong");
        notesLabel.textContent = "Notes :";

        const notes = document.createElement("textarea");
        notes.classList.add("plan-card-notes-input");
        notes.rows = 1;
        notes.maxLength = 500;
        notes.placeholder = "Ajouter des notes...";
        notes.value = plan.notes.slice(0, 500);

        notes.addEventListener("input", () => {
            plan.notes = notes.value.slice(0, 500);
            resizePlanNotesTextarea(notes);
        });

        ["click", "mousedown", "keydown"].forEach(type => {
            notes.addEventListener(type, event => event.stopPropagation());
        });

        notesBox.append(notesLabel, notes);

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

        footer.append(notesBox, deleteButton);
        card.appendChild(footer);

        card.addEventListener("click", () => openPlan(plan));

        card.addEventListener("keydown", event => {
            if (event.target !== card || !["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            openPlan(plan);
        });

        plansList.appendChild(card);

        requestAnimationFrame(() => resizePlanNotesTextarea(notes));
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

function deletePendingPlan() {
    if (!pendingPlanDeletion) return;

    const plan = pendingPlanDeletion;
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
}

export function setupPlanController() {

planNotesInput.addEventListener("input", () => {
    const plan = getCurrentPlan();

    if (planNotesInput.value.length > 500) {
        planNotesInput.value = planNotesInput.value.slice(0, 500);
    }

    if (plan) plan.notes = planNotesInput.value;

    resizePlanNotesTextarea(planNotesInput);
    updatePlanNotesCounter();
});

planAutoAddEquipment.addEventListener("change", () => {
    const plan = getCurrentPlan();
    if (!plan) return;

    ensurePlanMetadata(plan);
    plan.includeEquipment = planAutoAddEquipment.checked;

    if (plan.includeEquipment) {
        addEquipmentToCurrentPlan(...getSelectedPlanEquipment());
    }

    renderPlanMetadataEditor();
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
        () => {
            const plan = {
                id: Date.now(),
                name: `Plan ${plans.length + 1}`,
                defaults: {},
                exercises: [],
                notes: "",
                equipment: [],
                includeEquipment: false
            };

            ensurePlanDefaults(plan);

            plans.push(plan);

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


    backToPlansButton.addEventListener(
        "click",
        () => {
            finishPlanNameEditing();

            planEditor.style.display = "none";
            planHome.style.display = "block";

            renderPlansList();

            setCurrentDetailExercise(null);
            setCurrentDetailContext("search");
        }
    );
}