// ============================================================
// LISTE DES EXERCICES
// ============================================================

// ------------------------------------------------------------
// DÉPENDANCES
// ------------------------------------------------------------

let getExercises = () => [];

let getSearchInput = () => "";
let getExerciseList = () => null;
let getExerciseCount = () => null;

let getIsPlanContext = () => false;

let getSelectedTypes = () => new Set();

let getCurrentDetailContext = () => "search";
let setCurrentDetailContext = () => {};

let getSearchTerms = () => [];
let getProgressionName = () => "";
let getProgressionDisplay = () => "";

let findValidTermCombination = () => false;
let getExerciseSearchRanking = () => ({});
let compareExercisesBySearch = () => 0;
let highlightSearchMatches = () => "";

let exerciseMatchesCategoryFilter = () => false;
let exerciseMatchesEquipmentFilter = () => false;
let exerciseMatchesMuscle = () => true;
let exerciseMatchesProgression = () => true;

let removeAddButton = () => {};
let updateFilterSummaries = () => {};
let updatePlanFilterSummaries = () => {};
let displayExerciseDetails = () => {};

function configureExerciseList(dependencies) {
    getExercises = dependencies.getExercises;

    getSearchInput = dependencies.getSearchInput;
    getExerciseList = dependencies.getExerciseList;
    getExerciseCount = dependencies.getExerciseCount;

    getIsPlanContext = dependencies.getIsPlanContext;

    getSelectedTypes = dependencies.getSelectedTypes;

    getCurrentDetailContext =
        dependencies.getCurrentDetailContext;

    setCurrentDetailContext =
        dependencies.setCurrentDetailContext;

    getSearchTerms = dependencies.getSearchTerms;
    getProgressionName =
        dependencies.getProgressionName;
    getProgressionDisplay =
        dependencies.getProgressionDisplay;

    findValidTermCombination =
        dependencies.findValidTermCombination;

    getExerciseSearchRanking =
        dependencies.getExerciseSearchRanking;

    compareExercisesBySearch =
        dependencies.compareExercisesBySearch;

    highlightSearchMatches =
        dependencies.highlightSearchMatches;

    exerciseMatchesCategoryFilter =
        dependencies.exerciseMatchesCategoryFilter;

    exerciseMatchesEquipmentFilter =
        dependencies.exerciseMatchesEquipmentFilter;

    exerciseMatchesMuscle =
        dependencies.exerciseMatchesMuscle;

    exerciseMatchesProgression =
        dependencies.exerciseMatchesProgression;

    removeAddButton =
        dependencies.removeAddButton;

    updateFilterSummaries =
        dependencies.updateFilterSummaries;

    updatePlanFilterSummaries =
        dependencies.updatePlanFilterSummaries;

    displayExerciseDetails =
        dependencies.displayExerciseDetails;
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

    if (isPlanContext) {
        updatePlanFilterSummaries();
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

    rankedExercises.forEach(item => {
        const exercise = item.exercise;

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

        if (
            getProgressionDisplay(exercise) !== ""
        ) {
            element.appendChild(
                progressionElement
            );
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

        exerciseList.appendChild(element);
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