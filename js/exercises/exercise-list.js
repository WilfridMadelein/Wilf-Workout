import { getSuggestedWeightEquipment } from "../equipment/weight-equipment.js";

import {
    createProgressionPreferenceSelect
} from "../training/progression-preferences.js";

// ------------------------------------------------------------
// DÉPENDANCES
// ------------------------------------------------------------

let getExercises = () => [];

let getSearchInput = () => "";
let getExerciseList = () => null;
let getExerciseCount = () => null;

let getIsPlanContext = () => false;

let getSelectedTypes = () => new Set();
let getSelectedEquipment = () => new Set();
let getEquipmentOptions = () => [];
let getAppSettings = () => ({});
let scheduleAppSettingsSave = () => {};

let getCurrentDetailContext = () => "search";
let setCurrentDetailContext = () => {};

let getSearchTerms = () => [];
let getProgressionId = () => "";
let getProgressionName = () => "";
let getProgressionDisplay = () => "";

let findValidTermCombination = () => false;
let getExerciseSearchRanking = () => ({});
let compareExercisesBySearch = () => 0;
let highlightSearchMatches = () => "";

let exerciseMatchesCategoryFilter = () => false;
let exerciseMatchesEquipmentFilter = () => false;
let exerciseMatchesMuscle = () => true;
let shouldGroupExercisesByMuscle = () => false;
let updateMuscleRoleFilter = () => {};
let exerciseMatchesProgression = () => true;

let removeAddButton = () => {};
let updateFilterSummaries = () => {};
let updatePlanFilterSummaries = () => {};
let displayExerciseDetails = () => {};

let addExerciseToCurrentPlan = () => {};
let saveCurrentPlanFilters = () => {};

function configureExerciseList(dependencies) {
    shouldGroupExercisesByMuscle = dependencies.shouldGroupExercisesByMuscle;
    updateMuscleRoleFilter = dependencies.updateMuscleRoleFilter;
    getExercises = dependencies.getExercises;

    getSearchInput = dependencies.getSearchInput;
    getExerciseList = dependencies.getExerciseList;
    getExerciseCount = dependencies.getExerciseCount;

    getIsPlanContext = dependencies.getIsPlanContext;
    getSelectedEquipment = dependencies.getSelectedEquipment;
    getEquipmentOptions = dependencies.getEquipmentOptions;
    getAppSettings = dependencies.getAppSettings;
    scheduleAppSettingsSave = dependencies.scheduleAppSettingsSave;
    const toggle = document.getElementById("exercise-weight-separation");
    if (toggle) {
        toggle.checked = getAppSettings().equipmentWeightSeparation === true;
        toggle.addEventListener("change", () => { const settings = getAppSettings(); settings.equipmentWeightSeparation = toggle.checked; scheduleAppSettingsSave(settings); displayExercises(); });
    }

    getSelectedTypes = dependencies.getSelectedTypes;

    getCurrentDetailContext = dependencies.getCurrentDetailContext;

    setCurrentDetailContext = dependencies.setCurrentDetailContext;

    getSearchTerms = dependencies.getSearchTerms;
    getProgressionId = dependencies.getProgressionId;
    getProgressionName = dependencies.getProgressionName;
    getProgressionDisplay = dependencies.getProgressionDisplay;

    findValidTermCombination = dependencies.findValidTermCombination;

    getExerciseSearchRanking = dependencies.getExerciseSearchRanking;

    compareExercisesBySearch = dependencies.compareExercisesBySearch;

    highlightSearchMatches = dependencies.highlightSearchMatches;

    exerciseMatchesCategoryFilter = dependencies.exerciseMatchesCategoryFilter;

    exerciseMatchesEquipmentFilter = dependencies.exerciseMatchesEquipmentFilter;

    exerciseMatchesMuscle = dependencies.exerciseMatchesMuscle;

    exerciseMatchesProgression = dependencies.exerciseMatchesProgression;

    removeAddButton = dependencies.removeAddButton;

    updateFilterSummaries = dependencies.updateFilterSummaries;

    updatePlanFilterSummaries = dependencies.updatePlanFilterSummaries;

    displayExerciseDetails = dependencies.displayExerciseDetails;

    addExerciseToCurrentPlan = dependencies.addExerciseToCurrentPlan;

    saveCurrentPlanFilters = dependencies.saveCurrentPlanFilters;
}

// ------------------------------------------------------------
// Affichage des exercices
// ------------------------------------------------------------

function displayExercises() {
    const searchInput = getSearchInput();
    const exerciseList = getExerciseList();
    const exerciseCount = getExerciseCount();

    const searchTerms =
        getSearchTerms(searchInput.value);

    const isPlanContext =
        getIsPlanContext();

    if (!isPlanContext) {
        removeAddButton();
        setCurrentDetailContext("search");
    }

    updateFilterSummaries();
    updateMuscleRoleFilter();
    const selectedEquipment = getSelectedEquipment();
    const equipmentFilterActive = selectedEquipment.size > 0 && selectedEquipment.size < getEquipmentOptions().length;
    const separateWeight = equipmentFilterActive && getAppSettings()?.equipmentWeightSeparation === true;
    const weightToggle = document.getElementById("exercise-weight-separation-row");
    if (weightToggle) weightToggle.hidden = !equipmentFilterActive;

    if (isPlanContext) {
        updatePlanFilterSummaries();
        saveCurrentPlanFilters();
    }

    const selectedTypes =
        getSelectedTypes();

    const filteredExercises =
        getExercises().filter(exercise => {

            // Filtres de recherche
            if (
                !exerciseMatchesCategoryFilter(
                    exercise
                )
            ) {
                return false;
            }

            if (
                !exerciseMatchesEquipmentFilter(
                    exercise
                )
            ) {
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

    const rankedExercises =
        filteredExercises.map(exercise => ({
            exercise: exercise,
            searchRanking:
                getExerciseSearchRanking(
                    exercise,
                    searchTerms
                )
        }));

    rankedExercises.sort(
        compareExercisesBySearch
    );
    const groupByMuscle = shouldGroupExercisesByMuscle();
    if (groupByMuscle) {
        rankedExercises.forEach(item => { item.primaryMuscleMatch = exerciseMatchesMuscle(item.exercise, true); });
        rankedExercises.sort((first, second) => Number(second.primaryMuscleMatch) - Number(first.primaryMuscleMatch));
    }

    if (separateWeight) rankedExercises.sort((a, b) => (groupByMuscle ? Number(b.primaryMuscleMatch) - Number(a.primaryMuscleMatch) : 0) || Number(!!b.exercise.variantEquipment) - Number(!!a.exercise.variantEquipment));
    // Compteur
    if (exerciseCount) {
        exerciseCount.textContent =
            `${rankedExercises.length} exercice` +
            (
                rankedExercises.length !== 1
                    ? "s"
                    : ""
            );
    }

    exerciseList.innerHTML = "";
    let resultContainer = exerciseList;
    let currentMuscleRole = null, currentWeightRole = null, roleContainer = exerciseList;

    rankedExercises.forEach(item => {
        if (groupByMuscle && currentMuscleRole !== item.primaryMuscleMatch) {
            currentMuscleRole = item.primaryMuscleMatch;
            resultContainer = document.createElement("section");
            resultContainer.classList.add("exercise-muscle-section");
            const heading = document.createElement("h3");
            heading.classList.add("exercise-muscle-section-title");
            heading.textContent = currentMuscleRole ? "Primaire" : "Secondaire";
            resultContainer.appendChild(heading);
            exerciseList.appendChild(resultContainer);
            roleContainer = resultContainer; currentWeightRole = null;
        }
        const exercise = item.exercise;
        if (separateWeight) {
            const role = exercise.variantEquipment ? "utilisé" : "suggéré";
            if (role !== currentWeightRole) {
                currentWeightRole = role;
                resultContainer = document.createElement("section"); resultContainer.className = "exercise-weight-section";
                const heading = document.createElement("h4"); heading.className = "exercise-weight-section-title"; heading.textContent = role === "utilisé" ? "Poids utilisé" : "Poids suggéré";
                resultContainer.appendChild(heading); roleContainer.appendChild(resultContainer);
            }
        } else if (!groupByMuscle) resultContainer = exerciseList;

        const element =
            document.createElement("div");

        element.classList.add("exercise-item");

        const nameElement =
            document.createElement("span");

        nameElement.classList.add(
            "exercise-name"
        );

        nameElement.innerHTML =
            highlightSearchMatches(
                exercise.nom,
                searchTerms
            );

        const progressionElement =
            document.createElement("span");

        progressionElement.classList.add(
            "exercise-progression"
        );

        progressionElement.textContent =
            getProgressionDisplay(exercise);

element.appendChild(nameElement);

if (getProgressionDisplay(exercise) !== "") {
    const progressionWrap = document.createElement("span");
    progressionWrap.classList.add("exercise-progression-wrap");

    const preference = createProgressionPreferenceSelect(
        getProgressionId(exercise),
        getProgressionName(exercise)
    );

    progressionWrap.appendChild(progressionElement);
    if (preference) progressionWrap.appendChild(preference);
    element.appendChild(progressionWrap);
}

        if (isPlanContext) {
    const addButton =
        document.createElement("button");

    addButton.type = "button";
    addButton.textContent = "+";

    addButton.classList.add(
        "add-filter-button",
        "exercise-quick-add"
    );

    addButton.title =
        "Ajouter au plan";

    addButton.addEventListener(
    "click",
    event => {
        event.stopPropagation();

        if (!getIsPlanContext()) {
            return;
        }

        addExerciseToCurrentPlan(
            exercise
        );
    }
    );

    element.appendChild(addButton);
}

        element.addEventListener(
            "click",
            () => {
                displayExerciseDetails(
                    exercise,
                    getIsPlanContext()
                        ? "plan"
                        : "search"
                );
            }
        );

        resultContainer.appendChild(element);
    });

    if (rankedExercises.length === 0) {
        exerciseList.textContent =
            "Aucun exercice trouvé.";
    }
}

// ============================================================
// EXPORTS
// ============================================================

export {
    configureExerciseList,
    displayExercises
};
