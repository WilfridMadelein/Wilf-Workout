// ============================================================
// MODULES
// ============================================================

import {
    normalizeSearchText,
    getSearchTerms,
    getProgressionName,
    getProgressionDisplay,
    isIsometricExercise,
    findTermMatches,
    findValidTermCombination,
    getMatchQuality,
    getMatchPosition,
    getSearchCriteria,
    compareSearchCriteria,
    getExerciseSearchRanking,
    compareExercisesBySearch,
    escapeHtml,
    highlightSearchMatches
} from "./exercises/exercise-search.js";

import {
    configureExerciseFilters,

    createMuscleButtons,
    updateMuscleSpecialButtons,
    createSubmuscleButtons,
    removeSubmuscleContainer,
    exerciseMatchesMuscle,

    createEquipmentButtons,
    updateEquipmentAllButton,
    setupEquipmentAllButton,
    exerciseHasRequiredEquipment,
    exerciseMatchesEquipmentFilter,

    setupTypeButtons,
    updateTypeAllButton,

    setupCategoryButtons,
    exerciseMatchesCategoryFilter,

    getProgressionOptions,
    createProgressionOptions,
    createProgressionButton,
    updateProgressionButtons,
    exerciseMatchesProgression
} from "./exercises/exercise-filters.js";

import {
    configureExerciseDisplay,
    exerciseMatchesProgressionContext,
    getProgressionNeighbor,
    exerciseMatchesPlanProgressionFilter,
    exerciseHasRequiredEquipmentForPlan,
    getPlanProgressionNeighbor,
    updateProgressionNavigation
} from "./exercises/exercise-display.js";

import {
    configurePlanRender,
    createPlanNumberInput,
    renderPlanExercises,
    openPlanExerciseInstructions
} from "./plans/plan-render.js";

import {
    configurePlanCombinations,
    getNextCombinationGroup,
    getCombinationGroups,
    normalizeCombinationNumbers,
    moveExerciseToCombination,
    moveExerciseToNewCombination,
    getAvailableCombinationGroups,
    openCombinationMenu,
    moveExerciseWithinCombination,
    moveCombination
} from "./plans/plan-combinations.js";

import {
    configurePlanManager,
    addExerciseToCurrentPlan,
    removeExerciseFromCurrentPlan,
    updatePlanExerciseProgression,
    movePlanExercise
} from "./plans/plan-manager.js";

import {
    configurePlanFilters,
    createPlanFilterRows,
    syncPlanFiltersToSearch,
    updatePlanFilterSummaries,
    exerciseMatchesPlanFilters,
    exerciseMatchesPlanEquipment,
    updatePlanProgressionFilters
} from "./plans/plan-filters.js";


// DOM
const exerciseList = document.getElementById("exercise-list");
const searchInput = document.getElementById("search-input");
const exerciseBrowser = document.getElementById("exercise-browser");
const pageExercises = document.getElementById("page-exercises");
const planExerciseBrowserContainer = document.getElementById("plan-exercise-browser-container");
const planExerciseList = document.getElementById("plan-exercise-list");

const typeFilters = document.getElementById("type-filters");
const muscleFilters = document.getElementById("muscle-filters");
const submuscleFilters = document.getElementById("submuscle-filters");
const equipmentFilters = document.getElementById("equipment-filters");
const categoryFilters = document.getElementById("category-filters");
const detailsContent = document.getElementById("details-content");

const tabExercises = document.getElementById("tab-exercises");
const tabPlans = document.getElementById("tab-plans");
const pagePlans = document.getElementById("page-plans");

const planSetsInput = document.getElementById("plan-sets");
const planRepsInput = document.getElementById("plan-reps");
const planTimeInput = document.getElementById("plan-time");
const planRestInput = document.getElementById("plan-rest");

const planTempoInputs = [
    document.getElementById("plan-tempo-1"),
    document.getElementById("plan-tempo-2"),
    document.getElementById("plan-tempo-3"),
    document.getElementById("plan-tempo-4")
];

let currentDetailExercise = null;
let currentDetailContext = "search";

// État des filtres
const selectedTypes = new Set();
const selectedProgressionsInclude = new Set();
const selectedProgressionsExclude = new Set();
const selectedMuscleFamilies = new Set();
const selectedSubmuscles = new Map();
const selectedEquipment = new Set(equipmentOptions);
const selectedCategories = new Set(["cali", "gym"]);
const selectedPlanEquipment = new Set(equipmentOptions);
const selectedPlanCategories = new Set(["cali", "gym"]);

const searchPageState = {
    search: "",
    types: new Set(),
    progressionsInclude: new Set(),
    progressionsExclude: new Set(),
    muscleFamilies: new Set(),
    submuscles: new Map(),
    equipment: new Set(equipmentOptions),
    categories: new Set(["cali", "gym"])
};

const planSearchState = {
    search: "",
    types: new Set(),
    progressionsInclude: new Set(),
    progressionsExclude: new Set(),
    muscleFamilies: new Set(),
    submuscles: new Map(),
    equipment: new Set(equipmentOptions),
    categories: new Set(["cali", "gym"])
};
//------------
// search filter state management
//------------

function cloneSubmuscles(source) {
    const result = new Map();

    source.forEach((submuscles, family) => {
        result.set(family, new Set(submuscles));
    });

    return result;
}

function saveSearchState(state) {
    state.search = searchInput.value;

    state.types = new Set(selectedTypes);
    state.progressionsInclude = new Set(selectedProgressionsInclude);
    state.progressionsExclude = new Set(selectedProgressionsExclude);
    state.muscleFamilies = new Set(selectedMuscleFamilies);
    state.submuscles = cloneSubmuscles(selectedSubmuscles);
    state.equipment = new Set(selectedEquipment);
    state.categories = new Set(selectedCategories);
}

function loadSearchState(state) {
    searchInput.value = state.search;

    selectedTypes.clear();
    state.types.forEach(type => {
        selectedTypes.add(type);
    });

    selectedProgressionsInclude.clear();
    state.progressionsInclude.forEach(progression => {
        selectedProgressionsInclude.add(progression);
    });

    selectedProgressionsExclude.clear();
    state.progressionsExclude.forEach(progression => {
        selectedProgressionsExclude.add(progression);
    });

    selectedMuscleFamilies.clear();
    state.muscleFamilies.forEach(family => {
        selectedMuscleFamilies.add(family);
    });

    selectedSubmuscles.clear();
    state.submuscles.forEach((submuscles, family) => {
        selectedSubmuscles.set(
            family,
            new Set(submuscles)
        );
    });

    selectedEquipment.clear();
    state.equipment.forEach(equipment => {
        selectedEquipment.add(equipment);
    });

    selectedCategories.clear();
    state.categories.forEach(category => {
        selectedCategories.add(category);
    });

    rebuildSearchFilterInterface();
}

function rebuildSearchFilterInterface() {
    // Catégories
    document
        .querySelectorAll("#category-filters .filter-button")
        .forEach(button => {
            if (button.dataset.category) {
                button.classList.toggle(
                    "active",
                    selectedCategories.has(
                        button.dataset.category
                    )
                );
            }
        });

    // Types
    document
        .querySelectorAll("#type-filters .filter-button")
        .forEach(button => {
            const type = button.dataset.type;

            if (type === "all") {
                button.classList.toggle(
                    "active",
                    selectedTypes.size === 0
                );
            } else {
                button.classList.toggle(
                    "active",
                    selectedTypes.has(type)
                );
            }
        });

    // Équipements
    document
        .querySelectorAll("#equipment-filters .filter-button")
        .forEach(button => {
            const equipment = button.dataset.equipment;

            if (
                equipment === "all" ||
                equipment === "none"
            ) {
                return;
            }

            button.classList.toggle(
                "active",
                selectedEquipment.has(equipment)
            );
        });

    updateEquipmentAllButton();

    // Muscles
    document
        .querySelectorAll("#muscle-filters .filter-button")
        .forEach(button => {
            const family = button.dataset.muscle;

            if (family === "all") {
                button.classList.toggle(
                    "active",
                    selectedMuscleFamilies.size === 0
                );
            } else {
                button.classList.toggle(
                    "active",
                    selectedMuscleFamilies.has(family)
                );
            }
        });

    // Sous-muscles
    submuscleFilters.innerHTML = "";

    selectedMuscleFamilies.forEach(family => {
        createSubmuscleButtons(family);

        const selectedSubs =
            selectedSubmuscles.get(family);

        if (!selectedSubs) {
            return;
        }

        const container =
            submuscleFilters.querySelector(
                `[data-family="${family}"]`
            );

        if (!container) {
            return;
        }

        container
            .querySelectorAll(
                'input[type="checkbox"]'
            )
            .forEach(checkbox => {
                const label =
                    checkbox.parentElement;

                const submuscle =
                    label.textContent;

                checkbox.checked =
                    selectedSubs.has(submuscle);
            });
    });

    // Progressions
    updateProgressionButtons();

    // Bulles
    updateFilterSummaries();
}


// Affichage des exercices
function displayExercises() {
    const searchTerms = getSearchTerms(searchInput.value);
    const isPlanContext = planEditor.style.display === "block";

        if (!isPlanContext) {
        removeAddButton();
        currentDetailContext = "search";
    }

    updateFilterSummaries();

    if (isPlanContext) {
        updatePlanFilterSummaries();
    }

let filteredExercises = exercises.filter(exercise => {

    // Filtres de recherche
    if (!exerciseMatchesCategoryFilter(exercise)) {
            return false;
        }

        if (!exerciseMatchesEquipmentFilter(exercise)) {
            return false;
        }

        if (
            selectedTypes.size > 0 &&
            !selectedTypes.has(exercise.type)
        ) {
            return false;
        }

        if (!exerciseMatchesMuscle(exercise)) {
            return false;
        }

        if (!exerciseMatchesProgression(exercise)) {
            return false;
        }

        // Recherche textuelle
        if (
            searchTerms.length > 0 &&
            !findValidTermCombination(
                exercise.nom,
                searchTerms
            ) &&
            !findValidTermCombination(
                getProgressionName(exercise),
                searchTerms
            )
        ) {
            return false;
        }

        return true;
    });

    const rankedExercises = filteredExercises.map(exercise => ({
        exercise: exercise,
        searchRanking: getExerciseSearchRanking(
            exercise,
            searchTerms
        )
    }));

    rankedExercises.sort(compareExercisesBySearch);

    // Compteur
    const exerciseCount = document.getElementById("exercise-count");

    if (exerciseCount) {
        exerciseCount.textContent =
            `${rankedExercises.length} exercice` +
            (rankedExercises.length !== 1 ? "s" : "");
    }

    exerciseList.innerHTML = "";

    rankedExercises.forEach(item => {
        const exercise = item.exercise;

        const element = document.createElement("div");
        element.classList.add("exercise-item");

        const nameElement = document.createElement("span");
        nameElement.classList.add("exercise-name");
        nameElement.innerHTML = highlightSearchMatches(
            exercise.nom,
            searchTerms
        );

        const progressionElement = document.createElement("span");
        progressionElement.classList.add("exercise-progression");
        progressionElement.textContent =
            getProgressionDisplay(exercise);

        element.appendChild(nameElement);

        if (getProgressionDisplay(exercise) !== "") {
            element.appendChild(progressionElement);
        }

element.addEventListener("click", () => {
    displayExerciseDetails(
        exercise,
        pagePlans.style.display === "block" && planEditor.style.display === "block"
            ? "plan"
            : "search"
    );
});

        exerciseList.appendChild(element);
    });

    if (rankedExercises.length === 0) {
        exerciseList.textContent = "Aucun exercice trouvé.";
    }
}


// Détails

function removeAddButton() {
    const addButton = document.getElementById("add-exercise-to-plan-button");

    if (addButton) {
        addButton.remove();
    }
}

function displayExerciseDetails(exercise, context = "search") {
    const nameElement = document.getElementById("details-exercise-name");
    const infoElement = document.getElementById("details-exercise-info");
    const header = document.querySelector(".exercise-detail-header");

    if (!nameElement || !infoElement || !header) return;

    const isReallyInPlan =
        pagePlans.style.display === "block" &&
        planEditor.style.display === "block";

    if (!isReallyInPlan) {
        context = "search";
    }

    currentDetailExercise = exercise;
    currentDetailContext = context;

    removeAddButton();

    if (context === "plan") {
        const addButton = document.createElement("button");

        addButton.id = "add-exercise-to-plan-button";
        addButton.textContent = "Ajouter";

        addButton.addEventListener("click", () => {
            if (
                currentDetailContext !== "plan" ||
                pagePlans.style.display !== "block" ||
                planEditor.style.display !== "block"
            ) {
                return;
            }

            addExerciseToCurrentPlan(exercise);
        });

        header.appendChild(addButton);
    }

    nameElement.textContent = exercise.nom;

infoElement.innerHTML = `
    
    <p>
        <strong>Progression :</strong>
        ${getProgressionDisplay(exercise) || "—"}
    </p>

        <p>
        <strong>Muscles principaux :</strong><br>
        ${exercise.muscles_principaux
            .map(muscle => `${muscle[0]} — ${muscle[1]}`)
            .join("<br>")}
    </p>

    <p>
        <strong>Muscles secondaires :</strong><br>
        ${exercise.muscles_secondaires
            .map(muscle => `${muscle[0]} — ${muscle[1]}`)
            .join("<br>")}
    </p>

<p><strong>Type :</strong> ${exercise.type}</p>

    <p><strong>Catégorie :</strong> ${
        exercise.cali && exercise.gym
            ? "Calisthénique, Gym"
            : exercise.cali
                ? "Calisthénique"
                : "Gym"
    }</p>

    ${getExerciseDetailsLines(exercise)
        .map(line => `<p>${line}</p>`)
        .join("")}

`;

    updateProgressionNavigation(exercise, context);
}


function getExerciseDetailsLines(exercise) {
    const lines = [];

    const gripValues = ["Neutre", "Pronation", "Supination"];
    const footPositionValues = ["Intérieur", "Avant", "Extérieur"];

    if (exercise.pronation) {
        const values = Array.isArray(exercise.pronation)
            ? exercise.pronation
            : [exercise.pronation];

        const grips = values.filter(value =>
            gripValues.includes(value)
        );

        const footPositions = values.filter(value =>
            footPositionValues.includes(value)
        );

        if (grips.length > 0) {
            lines.push(`Grip : ${grips.join(" / ")}`);
        }

        if (footPositions.length > 0) {
            lines.push(
                `Position des pieds : ${footPositions.join(" / ")}`
            );
        }
    }

    if (exercise.equipement && exercise.equipement.length > 0) {
        const equipmentGroups = exercise.equipement
            .map(group => group.join(" ou "))
            .join(" + ");

        lines.push(`Équipement : ${equipmentGroups}`);
    }

    return lines;
}

function getPlanExerciseDetailsLines(exercise) {
    const lines = [];

    const gripValues = ["Neutre", "Pronation", "Supination"];
    const footPositionValues = ["Intérieur", "Avant", "Extérieur"];

    if (exercise.pronation) {
        const values = Array.isArray(exercise.pronation)
            ? exercise.pronation
            : [exercise.pronation];

        const grips = values.filter(value =>
            gripValues.includes(value)
        );

        const footPositions = values.filter(value =>
            footPositionValues.includes(value)
        );

        if (grips.length > 0) {
            lines.push(`Grip : ${grips.join(" / ")}`);
        }

        if (footPositions.length > 0) {
            lines.push(
                `Position des pieds : ${footPositions.join(" / ")}`
            );
        }
    }

    if (exercise.equipement && exercise.equipement.length > 0) {
        const equipmentGroups = exercise.equipement
            .map(group => {
                const availableEquipment = group.filter(equipment => {
                    if (equipment === "Aucun") {
                        return true;
                    }

                    return selectedPlanEquipment.has(equipment);
                });

                return availableEquipment;
            })
            .filter(group => group.length > 0);

        if (equipmentGroups.length > 0) {
            const equipmentText = equipmentGroups
                .map(group => group.join(" OU "))
                .join(" ET ");

            lines.push(`Équipement : ${equipmentText}`);
        }
    }

    return lines;
}

function closePlanInstructionsPopup(save = true) {
    const popup = document.querySelector(".plan-instructions-popup");

    if (!popup) {
        return;
    }

    if (save && popup._saveInstructions) {
        popup._saveInstructions();
    }

    popup.remove();

    if (popup._closeHandler) {
        document.removeEventListener(
            "click",
            popup._closeHandler
        );
    }
}

// Filtres ouverts
function setupFilterRows() {
    const filterTitles = document.querySelectorAll(".filter-title");

    filterTitles.forEach(title => {
        title.addEventListener("click", () => {
            const filterName = title.dataset.filter;
            const options = document.getElementById(
                `${filterName}-filter-options`
            );

            const arrow = title.querySelector(".filter-arrow");

            if (!options) {
                return;
            }

            const isOpen = options.classList.contains("open");

            document
                .querySelectorAll(".filter-options.open")
                .forEach(otherOptions => {
                    otherOptions.classList.remove("open");
                });

            document
                .querySelectorAll(".filter-arrow")
                .forEach(otherArrow => {
                    otherArrow.textContent = "▼";
                });

            if (!isOpen) {
                options.classList.add("open");
                arrow.textContent = "▲";
            }
        });
    });
}

// Résumés des filtres
function updateFilterSummaries() {
    function createSummaryButton(text, removeFunction = null) {
        const button = document.createElement("span");
        button.classList.add("summary-button");

        const label = document.createElement("span");
        label.textContent = text;
        button.appendChild(label);

        if (removeFunction) {
            const remove = document.createElement("button");

            remove.classList.add("summary-remove");
            remove.textContent = "−";

            remove.addEventListener("click", event => {
                event.stopPropagation();
                removeFunction();
            });

            button.appendChild(remove);
        }

        return button;
    }

    // Catégorie
    const categorySummary = document.getElementById(
        "category-summary"
    );

    categorySummary.innerHTML = "";

    if (selectedCategories.has("cali")) {
        categorySummary.appendChild(
            createSummaryButton("Cali")
        );
    }

    if (selectedCategories.has("gym")) {
        categorySummary.appendChild(
            createSummaryButton("Gym")
        );
    }

    // Type
    const typeSummary = document.getElementById("type-summary");

    typeSummary.innerHTML = "";

    const allTypes = [
        "Push",
        "Pull",
        "Isométrique"
    ];

    if (selectedTypes.size === 0) {
        typeSummary.appendChild(
            createSummaryButton("Tous")
        );
    } else {
        allTypes.forEach(type => {
            if (selectedTypes.has(type)) {
                typeSummary.appendChild(
                    createSummaryButton(type)
                );
            }
        });
    }

    // Muscles
    const muscleSummary = document.getElementById(
        "muscle-summary"
    );

    muscleSummary.innerHTML = "";

    if (selectedMuscleFamilies.size === 0) {
        muscleSummary.appendChild(
            createSummaryButton("Tous")
        );
    } else {
        [...selectedMuscleFamilies].forEach(family => {
            muscleSummary.appendChild(
                createSummaryButton(family)
            );
        });
    }

    // Équipements
    const equipmentSummary = document.getElementById(
        "equipment-summary"
    );

    equipmentSummary.innerHTML = "";

    if (
        selectedEquipment.size ===
        equipmentOptions.length
    ) {
        equipmentSummary.appendChild(
            createSummaryButton("Tous")
        );
    } else if (selectedEquipment.size === 0) {
        equipmentSummary.appendChild(
            createSummaryButton("Aucun")
        );
    } else {
        [...selectedEquipment].forEach(equipment => {
            equipmentSummary.appendChild(
                createSummaryButton(equipment)
            );
        });
    }

    // Progression
    const progressionIncludeSummary = document.getElementById(
        "progression-include-summary"
    );

    const progressionExcludeSummary = document.getElementById(
        "progression-exclude-summary"
    );

    progressionIncludeSummary.innerHTML = "";
    progressionExcludeSummary.innerHTML = "";

    selectedProgressionsInclude.forEach(progression => {
        progressionIncludeSummary.appendChild(
            createSummaryButton(progression, () => {
                selectedProgressionsInclude.delete(progression);
                updateProgressionButtons();
                displayExercises();
            })
        );
    });

    selectedProgressionsExclude.forEach(progression => {
        progressionExcludeSummary.appendChild(
            createSummaryButton(progression, () => {
                selectedProgressionsExclude.delete(progression);
                updateProgressionButtons();
                displayExercises();
            })
        );
    });
}

// Recherche
searchInput.addEventListener("input", displayExercises);

// Onglets principaux
tabExercises.addEventListener("click", () => {
    saveSearchState(planSearchState);

    pageExercises.style.display = "block";
    pagePlans.style.display = "none";

    pageExercises
        .querySelector("#exercise-browser-container")
        .appendChild(exerciseBrowser);

    exerciseBrowser.style.display = "block";

    loadSearchState(searchPageState);

    tabExercises.classList.add("active");
    tabPlans.classList.remove("active");

    currentDetailContext = "search";

    removeAddButton();

    displayExercises();
});

tabPlans.addEventListener("click", () => {
    saveSearchState(searchPageState);

    pageExercises.style.display = "none";
    pagePlans.style.display = "block";

    planHome.style.display = "block";
    planCreator.style.display = "none";
    planEditor.style.display = "none";

    planExerciseBrowserContainer.appendChild(exerciseBrowser);
    exerciseBrowser.style.display = "block";

    loadSearchState(planSearchState);

    tabExercises.classList.remove("active");
    tabPlans.classList.add("active");

    displayExercises();
});

// Plans
const newPlanButton = document.getElementById("new-plan-button");
const createPlanButton = document.getElementById("create-plan-button");
const cancelPlanButton = document.getElementById("cancel-plan-button");
const planHome = document.getElementById("plan-home");
const planCreator = document.getElementById("plan-creator");
const planNameInput = document.getElementById("plan-name");
const plansList = document.getElementById("plans-list");
const planEditor = document.getElementById("plan-editor");
const currentPlanName = document.getElementById("current-plan-name");
const backToPlansButton = document.getElementById("back-to-plans-button");

let currentPlan = null;

function ensurePlanDefaults(plan) {
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
        plan.defaults.rest = 90;
    }

    if (!plan.defaults.tempo) {
        plan.defaults.tempo = {};
    }

    if (plan.defaults.tempo.first == null || plan.defaults.tempo.first === "") {
        plan.defaults.tempo.first = 3;
    }

    if (plan.defaults.tempo.second == null || plan.defaults.tempo.second === "") {
        plan.defaults.tempo.second = 1;
    }

    if (plan.defaults.tempo.third == null || plan.defaults.tempo.third === "") {
        plan.defaults.tempo.third = 1;
    }

    if (plan.defaults.tempo.fourth == null || plan.defaults.tempo.fourth === "") {
        plan.defaults.tempo.fourth = 0;
    }
}

function loadPlanDefaultsIntoInputs() {
    if (!currentPlan) return;

    ensurePlanDefaults(currentPlan);

    planSetsInput.value = currentPlan.defaults.sets;
    planRepsInput.value = currentPlan.defaults.reps;
    planTimeInput.value = currentPlan.defaults.time;
    planRestInput.value = currentPlan.defaults.rest;

    planTempoInputs[0].value = currentPlan.defaults.tempo.first;
    planTempoInputs[1].value = currentPlan.defaults.tempo.second;
    planTempoInputs[2].value = currentPlan.defaults.tempo.third;
    planTempoInputs[3].value = currentPlan.defaults.tempo.fourth;
}

function setupPlanDefaultInputs() {
    planSetsInput.addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.sets =
            Number(planSetsInput.value);
    });

    planRepsInput.addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.reps =
            Number(planRepsInput.value);
    });

    planTimeInput.addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.time =
            Number(planTimeInput.value);
    });

    planRestInput.addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.rest =
            Number(planRestInput.value);
    });

    planTempoInputs[0].addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.tempo.first =
            Number(planTempoInputs[0].value);
    });

    planTempoInputs[1].addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.tempo.second =
            Number(planTempoInputs[1].value);
    });

    planTempoInputs[2].addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.tempo.third =
            Number(planTempoInputs[2].value);
    });

    planTempoInputs[3].addEventListener("change", () => {
        if (!currentPlan) return;

        currentPlan.defaults.tempo.fourth =
            Number(planTempoInputs[3].value);
    });
}


// new plan

newPlanButton.addEventListener("click", () => {
    planHome.style.display = "none";
    planCreator.style.display = "block";

    planNameInput.value = "";
    planNameInput.focus();
});

cancelPlanButton.addEventListener("click", () => {
    planCreator.style.display = "none";
    planHome.style.display = "block";
});

createPlanButton.addEventListener("click", () => {
    const planName = planNameInput.value.trim();

    if (planName === "") {
        alert("Veuillez entrer un nom de plan.");
        return;
    }

const plan = {
    id: Date.now(),
    name: planName,

    defaults: {
        sets: 3,
        reps: 10,
        time: 30,
        rest: 90,

        tempo: {
            first: 3,
            second: 1,
            third: 1,
            fourth: 0
        }
    },

    exercises: []
};

    plansList.innerHTML = `
        <div class="plan-card">
            <h3>${plan.name}</h3>
            <p>0 exercice</p>
            <button class="open-plan-button">
                Ouvrir le plan
            </button>
        </div>
    `;

    const openPlanButton = plansList.querySelector(
        ".open-plan-button"
    );

openPlanButton.addEventListener("click", () => {
    currentPlan = plan;
    ensurePlanDefaults(currentPlan);

    planHome.style.display = "none";
    planEditor.style.display = "block";

    currentPlanName.textContent = plan.name;

    loadPlanDefaultsIntoInputs();

    renderPlanExercises();

    planExerciseBrowserContainer.appendChild(exerciseBrowser);
    exerciseBrowser.style.display = "block";

    loadSearchState(planSearchState);

    displayExercises();
});

    planCreator.style.display = "none";
    planHome.style.display = "block";
});

backToPlansButton.addEventListener("click", () => {
    planEditor.style.display = "none";
    planHome.style.display = "block";

    currentDetailExercise = null;
    currentDetailContext = "search";
});

// ============================================================
// CONFIGURATION DES MODULES
// ============================================================

configurePlanCombinations({
    getCurrentPlan: () => currentPlan,
    renderPlanExercises
});

configurePlanManager({
    getCurrentPlan: () => currentPlan,
    renderPlanExercises,
    closePlanInstructionsPopup
});

configurePlanRender({
    getCurrentPlan: () => currentPlan,
    getPlanExerciseList: () => planExerciseList,

    normalizeCombinationNumbers,
    displayExerciseDetails,
    getProgressionName,
    getPlanProgressionNeighbor,
    updatePlanExerciseProgression,
    closePlanInstructionsPopup,
    getPlanExerciseDetailsLines,

    openCombinationMenu,
    moveExerciseWithinCombination,
    moveCombination
});

configurePlanFilters({
    getCurrentPlan: () => currentPlan,
    getCurrentDetailExercise: () => currentDetailExercise,
    getCurrentDetailContext: () => currentDetailContext,

    getSelectedPlanCategories: () => selectedPlanCategories,
    getSelectedPlanEquipment: () => selectedPlanEquipment,

    getSelectedCategories: () => selectedCategories,
    getSelectedEquipment: () => selectedEquipment,

    getEquipmentOptions: () => equipmentOptions,
    getPlanSearchState: () => planSearchState,

    saveSearchState,
    displayExercises,
    renderPlanExercises,

    updateEquipmentAllButton,
    updateFilterSummaries,
    updateProgressionNavigation
});

createPlanFilterRows();

configureExerciseFilters({
    getSelectedCategories: () => selectedCategories,
    getSelectedEquipment: () => selectedEquipment,
    getSelectedTypes: () => selectedTypes,
    getSelectedProgressionsInclude:
        () => selectedProgressionsInclude,
    getSelectedProgressionsExclude:
        () => selectedProgressionsExclude,
    getSelectedMuscleFamilies:
        () => selectedMuscleFamilies,
    getSelectedSubmuscles:
        () => selectedSubmuscles,

    getEquipmentOptions: () => equipmentOptions,
    getMuscleFamilies: () => muscleFamilies,
    getExercises: () => exercises,

    getMuscleFilters: () => muscleFilters,
    getSubmuscleFilters: () => submuscleFilters,
    getEquipmentFilters: () => equipmentFilters,
    getTypeFilters: () => typeFilters,

    displayExercises,
    updateFilterSummaries
});

configureExerciseDisplay({
    getExercises: () => exercises,

    getSelectedPlanCategories:
        () => selectedPlanCategories,

    getSelectedPlanEquipment:
        () => selectedPlanEquipment,

    getProgressionName,

    exerciseMatchesCategoryFilter,
    exerciseMatchesEquipmentFilter,

    displayExerciseDetails
});

// Initialisation
createMuscleButtons();
createEquipmentButtons();
setupEquipmentAllButton();
setupTypeButtons();
setupCategoryButtons();
createProgressionOptions();
setupFilterRows();
displayExercises();
setupPlanDefaultInputs();