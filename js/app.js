// ============================================================
// MODULES
// ============================================================



import "./exercises/exercise-search.js";

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

// Muscles
function createMuscleButtons() {
    const allButton = document.createElement("button");

    allButton.classList.add("filter-button", "active");
    allButton.textContent = "Tous";
    allButton.dataset.muscle = "all";

    allButton.addEventListener("click", () => {
        selectedMuscleFamilies.clear();
        selectedSubmuscles.clear();

        document
            .querySelectorAll("#muscle-filters .filter-button")
            .forEach(button => button.classList.remove("active"));

        allButton.classList.add("active");
        submuscleFilters.innerHTML = "";

        displayExercises();
    });

    muscleFilters.appendChild(allButton);

    muscleFamilies.forEach(family => {
        const button = document.createElement("button");

        button.classList.add("filter-button");
        button.textContent = family;
        button.dataset.muscle = family;

        button.addEventListener("click", () => {
            if (selectedMuscleFamilies.has(family)) {
                selectedMuscleFamilies.delete(family);
                selectedSubmuscles.delete(family);
                button.classList.remove("active");
                removeSubmuscleContainer(family);
            } else {
                selectedMuscleFamilies.add(family);
                button.classList.add("active");
                createSubmuscleButtons(family);
            }

            updateMuscleSpecialButtons();
            displayExercises();
        });

        muscleFilters.appendChild(button);
    });
}

function updateMuscleSpecialButtons() {
    const allButton = muscleFilters.querySelector('[data-muscle="all"]');

    allButton.classList.toggle(
        "active",
        selectedMuscleFamilies.size === 0
    );
}

function createSubmuscleButtons(family) {
    removeSubmuscleContainer(family);

    const submuscles = new Set();

    exercises.forEach(exercise => {
        const allMuscles = [
            ...exercise.muscles_principaux,
            ...exercise.muscles_secondaires
        ];

        allMuscles.forEach(muscle => {
            if (muscle[0] === family && muscle[1] !== "") {
                submuscles.add(muscle[1]);
            }
        });
    });

    if (submuscles.size === 0) {
        return;
    }

    if (!selectedSubmuscles.has(family)) {
    selectedSubmuscles.set(
        family,
        new Set(submuscles)
    );
    }

    const container = document.createElement("div");
    container.classList.add("submuscle-container");
    container.dataset.family = family;

    const title = document.createElement("p");
    title.classList.add("submuscle-title");
    title.innerHTML = `<strong>${family}</strong>`;

    container.appendChild(title);

    submuscles.forEach(submuscle => {
        const label = document.createElement("label");
        label.classList.add("submuscle-option");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;

        checkbox.addEventListener("change", () => {
            const selected = selectedSubmuscles.get(family);

            if (checkbox.checked) {
                selected.add(submuscle);
            } else {
                selected.delete(submuscle);
            }

            displayExercises();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(submuscle));
        container.appendChild(label);
    });

    submuscleFilters.appendChild(container);
}

function removeSubmuscleContainer(family) {
    const container = submuscleFilters.querySelector(
        `[data-family="${family}"]`
    );

    if (container) {
        container.remove();
    }
}

// Équipements
function createEquipmentButtons() {
    equipmentOptions.forEach(equipment => {
        const button = document.createElement("button");

        button.classList.add("filter-button", "active");
        button.textContent = equipment;
        button.dataset.equipment = equipment;

        button.addEventListener("click", () => {
            if (selectedEquipment.has(equipment)) {
                selectedEquipment.delete(equipment);
                button.classList.remove("active");
            } else {
                selectedEquipment.add(equipment);
                button.classList.add("active");
            }

            updateEquipmentAllButton();
            displayExercises();
        });

        equipmentFilters.appendChild(button);
    });

    updateEquipmentAllButton();
}

function updateEquipmentAllButton() {
    const allButton = equipmentFilters.querySelector(
        '[data-equipment="all"]'
    );

    const noneButton = equipmentFilters.querySelector(
        '[data-equipment="none"]'
    );

    const allSelected =
        selectedEquipment.size === equipmentOptions.length;

    const noneSelected =
        selectedEquipment.size === 0;

    allButton.classList.toggle("active", allSelected);
    noneButton.classList.toggle("active", noneSelected);
}

function setupEquipmentAllButton() {
    const allButton = equipmentFilters.querySelector(
        '[data-equipment="all"]'
    );

    const noneButton = equipmentFilters.querySelector(
        '[data-equipment="none"]'
    );

    allButton.addEventListener("click", () => {
        equipmentOptions.forEach(equipment => {
            selectedEquipment.add(equipment);
        });

        equipmentFilters
            .querySelectorAll(".filter-button")
            .forEach(button => button.classList.add("active"));

        displayExercises();
    });

    noneButton.addEventListener("click", () => {
        selectedEquipment.clear();

        equipmentFilters
            .querySelectorAll(".filter-button")
            .forEach(button => button.classList.remove("active"));

        noneButton.classList.add("active");

        displayExercises();
    });
}

// Types
function setupTypeButtons() {
    const buttons = typeFilters.querySelectorAll(".filter-button");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const type = button.dataset.type;

            if (type === "all") {
                selectedTypes.clear();

                buttons.forEach(otherButton => {
                    otherButton.classList.remove("active");
                });

                button.classList.add("active");
            } else {
                if (selectedTypes.has(type)) {
                    selectedTypes.delete(type);
                    button.classList.remove("active");
                } else {
                    selectedTypes.add(type);
                    button.classList.add("active");
                }

                updateTypeAllButton();
            }

            displayExercises();
        });
    });
}

function updateTypeAllButton() {
    const allButton = typeFilters.querySelector(
        '[data-type="all"]'
    );

    allButton.classList.toggle(
        "active",
        selectedTypes.size === 0
    );
}

// Catégories
function setupCategoryButtons() {
    const buttons = categoryFilters.querySelectorAll(".filter-button");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const category = button.dataset.category;

            if (selectedCategories.has(category)) {
                selectedCategories.delete(category);
                button.classList.remove("active");
            } else {
                selectedCategories.add(category);
                button.classList.add("active");
            }

            displayExercises();
        });
    });
}

// Logique équipement
function exerciseHasRequiredEquipment(exercise) {
    return exercise.equipement.every(equipmentGroup => {
        return equipmentGroup.some(equipment => {
            if (equipment === "Aucun") {
                return true;
            }

            return selectedEquipment.has(equipment);
        });
    });
}

// Logique muscles
function exerciseMatchesMuscle(exercise) {
    if (selectedMuscleFamilies.size === 0) {
        return true;
    }

    const allMuscles = [
        ...exercise.muscles_principaux,
        ...exercise.muscles_secondaires
    ];

    return [...selectedMuscleFamilies].some(family => {
        const familyMuscles = allMuscles.filter(
            muscle => muscle[0] === family
        );

        if (familyMuscles.length === 0) {
            return false;
        }

        const selectedSubs = selectedSubmuscles.get(family);

        if (!selectedSubs || selectedSubs.size === 0) {
            return false;
        }

        return familyMuscles.some(muscle =>
            selectedSubs.has(muscle[1])
        );
    });
}

// Progression
function getProgressionOptions() {
    const progressions = new Set();

    exercises.forEach(exercise => {
        if (
            exercise.prog_group &&
            exercise.prog_group.trim() !== ""
        ) {
            progressions.add(exercise.prog_group);
        }
    });

    return [...progressions].sort();
}

function createProgressionOptions() {
    const includeContainer = document.getElementById(
        "progression-include-options"
    );

    const excludeContainer = document.getElementById(
        "progression-exclude-options"
    );

    includeContainer.innerHTML = "";
    excludeContainer.innerHTML = "";

    const progressions = getProgressionOptions();

    progressions.forEach(progression => {
        createProgressionButton(
            progression,
            includeContainer,
            selectedProgressionsInclude,
            selectedProgressionsExclude
        );

        createProgressionButton(
            progression,
            excludeContainer,
            selectedProgressionsExclude,
            selectedProgressionsInclude
        );
    });
}

function createProgressionButton(
    progression,
    container,
    selectedSet,
    oppositeSet
) {
    const button = document.createElement("button");

    button.classList.add("filter-button");
    button.textContent = progression;

    if (selectedSet.has(progression)) {
        button.classList.add("active");
    }

    button.addEventListener("click", () => {
        if (selectedSet.has(progression)) {
            selectedSet.delete(progression);
            button.classList.remove("active");
        } else {
            oppositeSet.delete(progression);
            selectedSet.add(progression);
            button.classList.add("active");
            updateProgressionButtons();
        }

        displayExercises();
    });

    container.appendChild(button);
}

function updateProgressionButtons() {
    document
        .querySelectorAll(
            "#progression-include-options .filter-button"
        )
        .forEach(button => {
            const progression = button.textContent;

            button.classList.toggle(
                "active",
                selectedProgressionsInclude.has(progression)
            );
        });

    document
        .querySelectorAll(
            "#progression-exclude-options .filter-button"
        )
        .forEach(button => {
            const progression = button.textContent;

            button.classList.toggle(
                "active",
                selectedProgressionsExclude.has(progression)
            );
        });
}

function exerciseMatchesProgression(exercise) {
    const progression = exercise.prog_group;

    if (
        selectedProgressionsInclude.size > 0 &&
        !selectedProgressionsInclude.has(progression)
    ) {
        return false;
    }

    if (selectedProgressionsExclude.has(progression)) {
        return false;
    }

    return true;
}

 // Recherche
function normalizeSearchText(text) {
    return String(text || "")
        .trim()
        .toLowerCase();
}

function getSearchTerms(searchText) {
    return normalizeSearchText(searchText)
        .split(/\s+/)
        .filter(Boolean);
}

function getProgressionName(exercise) {
    return String(exercise.prog_group || "").trim();
}

function isIsometricExercise(exercise) {
    const type = String(exercise.type).toLowerCase().trim();

    return (
        type === "iso" ||
        type === "isométrique" ||
        type === "isometric"
    );
}

function getProgressionDisplay(exercise) {
    const progression = getProgressionName(exercise);
    const ordre = exercise.prog_ordre;

    if (!progression) {
        return "";
    }

    if (
        ordre !== undefined &&
        ordre !== null &&
        ordre !== ""
    ) {
        return `${progression} ${ordre}`;
    }

    return progression;
}

function findTermMatches(text, term) {
    const normalizedText = normalizeSearchText(text);
    const matches = [];

    if (!normalizedText || !term) {
        return matches;
    }

    let startIndex = 0;

    while (true) {
        const index = normalizedText.indexOf(
            term,
            startIndex
        );

        if (index === -1) {
            break;
        }

        matches.push({
            start: index,
            end: index + term.length
        });

        startIndex = index + 1;
    }

    return matches;
}

function findValidTermCombination(text, searchTerms) {
    const normalizedText = normalizeSearchText(text);

    if (!normalizedText || searchTerms.length === 0) {
        return null;
    }

    const matchesByTerm = searchTerms.map(term =>
        findTermMatches(normalizedText, term)
    );

    if (matchesByTerm.some(matches => matches.length === 0)) {
        return null;
    }

    function search(
        termIndex,
        usedRanges,
        selectedMatches
    ) {
        if (termIndex === searchTerms.length) {
            return selectedMatches;
        }

        for (const match of matchesByTerm[termIndex]) {
            const overlaps = usedRanges.some(range =>
                match.start < range.end &&
                match.end > range.start
            );

            if (overlaps) {
                continue;
            }

            const result = search(
                termIndex + 1,
                [...usedRanges, match],
                [...selectedMatches, match]
            );

            if (result) {
                return result;
            }
        }

        return null;
    }

    return search(0, [], []);
}

function getMatchQuality(text, term, match) {
    const normalizedText = normalizeSearchText(text);

    const before = normalizedText[match.start - 1];
    const after = normalizedText[match.end];

    const startsWord =
        match.start === 0 ||
        /\s/.test(before);

    const endsWord =
        match.end === normalizedText.length ||
        /\s/.test(after);

    // Le mot entier correspond exactement
    if (startsWord && endsWord) {
        return 5;
    }

    // Le match commence au début d'un mot
    if (startsWord) {
        return 4;
    }

    // Le match est à l'intérieur d'un mot
    return 2;
}

function getMatchPosition(text, match) {
    const normalizedText = normalizeSearchText(text);

    if (match.start === 0) {
        return 0;
    }

    const textBeforeMatch = normalizedText.slice(
        0,
        match.start
    );

    return textBeforeMatch.split(/\s+/).length - 1;
}

function getSearchCriteria(text, searchTerms) {
    const matches = findValidTermCombination(
        text,
        searchTerms
    );

    if (!matches) {
        return null;
    }

    let bestQuality = 0;
    let bestPosition = Infinity;

    matches.forEach((match, index) => {
        const term = searchTerms[index];

        const quality = getMatchQuality(
            text,
            term,
            match
        );

        const position = getMatchPosition(
            text,
            match
        );

        bestQuality = Math.max(
            bestQuality,
            quality
        );

        bestPosition = Math.min(
            bestPosition,
            position
        );
    });

    const allTermsExact =
        matches.length === searchTerms.length &&
        matches.every((match, index) =>
            getMatchQuality(
                text,
                searchTerms[index],
                match
            ) === 5
        );

    const allTermsAtWordStart =
        matches.every((match, index) =>
            getMatchQuality(
                text,
                searchTerms[index],
                match
            ) >= 4
        );

    return {
        matches,
        quality: bestQuality,
        position: bestPosition,
        allTermsExact,
        allTermsAtWordStart
    };
}

function compareSearchCriteria(a, b) {
    if (a.quality !== b.quality) {
        return b.quality - a.quality;
    }

    if (a.position !== b.position) {
        return a.position - b.position;
    }

    if (a.allTermsExact !== b.allTermsExact) {
        return b.allTermsExact - a.allTermsExact;
    }

    if (a.allTermsAtWordStart !== b.allTermsAtWordStart) {
        return b.allTermsAtWordStart - a.allTermsAtWordStart;
    }

    return 0;
}

function getExerciseSearchRanking(
    exercise,
    searchTerms
) {
    if (searchTerms.length === 0) {
        return {
            exerciseCriteria: null,
            progressionCriteria: null
        };
    }

    const exerciseCriteria = getSearchCriteria(
        exercise.nom,
        searchTerms
    );

    const progressionCriteria = getSearchCriteria(
        getProgressionName(exercise),
        searchTerms
    );

    if (!exerciseCriteria && !progressionCriteria) {
        return null;
    }

    return {
        exerciseCriteria,
        progressionCriteria
    };
}

function compareExercisesBySearch(a, b) {
    const aRanking = a.searchRanking;
    const bRanking = b.searchRanking;

    /*
     * Sans recherche :
     * progression alphabétique,
     * puis ordre de progression,
     * puis nom.
     */
    if (
        !aRanking.exerciseCriteria &&
        !aRanking.progressionCriteria &&
        !bRanking.exerciseCriteria &&
        !bRanking.progressionCriteria
    ) {
        const progressionComparison =
            getProgressionName(a.exercise).localeCompare(
                getProgressionName(b.exercise),
                "fr",
                { sensitivity: "base" }
            );

        if (progressionComparison !== 0) {
            return progressionComparison;
        }

        const orderA = Number(a.exercise.prog_ordre);
        const orderB = Number(b.exercise.prog_ordre);

        if (!Number.isNaN(orderA) && !Number.isNaN(orderB)) {
            if (orderA !== orderB) {
                return orderA - orderB;
            }
        }

        return a.exercise.nom.localeCompare(
            b.exercise.nom,
            "fr",
            { sensitivity: "base" }
        );
    }

    /*
     * Le nom de l'exercice est toujours prioritaire.
     */
    if (
        aRanking.exerciseCriteria &&
        !bRanking.exerciseCriteria
    ) {
        return -1;
    }

    if (
        !aRanking.exerciseCriteria &&
        bRanking.exerciseCriteria
    ) {
        return 1;
    }

    if (
        aRanking.exerciseCriteria &&
        bRanking.exerciseCriteria
    ) {
        const exerciseComparison =
            compareSearchCriteria(
                aRanking.exerciseCriteria,
                bRanking.exerciseCriteria
            );

        if (exerciseComparison !== 0) {
            return exerciseComparison;
        }
    }

    /*
     * Si le nom donne une qualité similaire,
     * la progression départage les résultats.
     */
    if (
        aRanking.progressionCriteria &&
        !bRanking.progressionCriteria
    ) {
        return -1;
    }

    if (
        !aRanking.progressionCriteria &&
        bRanking.progressionCriteria
    ) {
        return 1;
    }

    if (
        aRanking.progressionCriteria &&
        bRanking.progressionCriteria
    ) {
        const progressionComparison =
            compareSearchCriteria(
                aRanking.progressionCriteria,
                bRanking.progressionCriteria
            );

        if (progressionComparison !== 0) {
            return progressionComparison;
        }
    }

    return a.exercise.nom.localeCompare(
        b.exercise.nom,
        "fr",
        { sensitivity: "base" }
    );
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function highlightSearchMatches(text, searchTerms) {
    const safeText = escapeHtml(text);

    if (searchTerms.length === 0) {
        return safeText;
    }

    const escapedTerms = searchTerms
        .map(term =>
            term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        )
        .sort((a, b) => b.length - a.length);

    if (escapedTerms.length === 0) {
        return safeText;
    }

    const regex = new RegExp(
        `(${escapedTerms.join("|")})`,
        "gi"
    );

    return safeText.replace(
        regex,
        "<mark>$1</mark>"
    );
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

// Navigation dans la progression

function exerciseMatchesProgressionContext(exercise) {
    return (
        exerciseMatchesCategoryFilter(exercise) &&
        exerciseMatchesEquipmentFilter(exercise)
    );
}


function getProgressionNeighbor(
    currentExercise,
    direction,
    context = "search"
) {
    const progression =
        getProgressionName(currentExercise);

    const currentOrder =
        Number(currentExercise.prog_ordre);

    if (
        !progression ||
        Number.isNaN(currentOrder)
    ) {
        return null;
    }
   
    const compatibleExercises = exercises
        .filter(exercise =>
            getProgressionName(exercise) === progression
        )
        .filter(exercise =>
            exerciseMatchesProgressionContext(exercise)
        )
        .filter(exercise => {
            const order =
                Number(exercise.prog_ordre);

            return !Number.isNaN(order);
        });

    if (direction === 1) {

        const nextExercises =
            compatibleExercises
                .filter(exercise =>
                    Number(exercise.prog_ordre) >
                    currentOrder
                )
                .sort((a, b) =>
                    Number(a.prog_ordre) -
                    Number(b.prog_ordre)
                );

        return nextExercises[0] || null;
    }

    if (direction === -1) {

        const previousExercises =
            compatibleExercises
                .filter(exercise =>
                    Number(exercise.prog_ordre) <
                    currentOrder
                )
                .sort((a, b) =>
                    Number(b.prog_ordre) -
                    Number(a.prog_ordre)
                );

        return previousExercises[0] || null;
    }

    return null;
}

function exerciseMatchesPlanProgressionFilter(exercise) {
    const matchesCali =
        selectedPlanCategories.has("cali") &&
        exercise.cali;

    const matchesGym =
        selectedPlanCategories.has("gym") &&
        exercise.gym;

    if (!matchesCali && !matchesGym) {
        return false;
    }

    return exerciseHasRequiredEquipmentForPlan(exercise);
}

function exerciseHasRequiredEquipmentForPlan(exercise) {
    return exercise.equipement.every(equipmentGroup => {
        return equipmentGroup.some(equipment => {
            if (equipment === "Aucun") return true;

            return selectedPlanEquipment.has(equipment);
        });
    });
}

function getPlanProgressionNeighbor(exercise, direction) {
    const progression = getProgressionName(exercise);
    const currentOrder = Number(exercise.prog_ordre);

    if (!progression || Number.isNaN(currentOrder)) {
        return null;
    }

    const progressionExercises = exercises
        .filter(item => getProgressionName(item) === progression)
        .filter(item => exerciseMatchesPlanProgressionFilter(item))
        .filter(item => !Number.isNaN(Number(item.prog_ordre)))
        .sort((a, b) =>
            Number(a.prog_ordre) - Number(b.prog_ordre)
        );

    if (direction === 1) {
        return progressionExercises.find(
            item => Number(item.prog_ordre) > currentOrder
        ) || null;
    }

    if (direction === -1) {
        const previousExercises = progressionExercises
            .filter(item =>
                Number(item.prog_ordre) < currentOrder
            );

        return previousExercises[previousExercises.length - 1] || null;
    }

    return null;
}

function updateProgressionNavigation(currentExercise, context = "search") {
    const upButton = document.getElementById("progression-up-button");
    const downButton = document.getElementById("progression-down-button");

    if (!upButton || !downButton) return;

    const nextExercise = getProgressionNeighbor(
        currentExercise,
        1,
        "search"
    );

    const previousExercise = getProgressionNeighbor(
        currentExercise,
        -1,
        "search"
    );

    upButton.disabled = !nextExercise;
    downButton.disabled = !previousExercise;

    upButton.onclick = () => {
        if (!nextExercise) return;

        displayExerciseDetails(
            nextExercise,
            context
        );
    };

    downButton.onclick = () => {
        if (!previousExercise) return;

        displayExerciseDetails(
            previousExercise,
            context
        );
    };
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

function exerciseMatchesCategoryFilter(exercise) {
    const matchesCali =
        selectedCategories.has("cali") &&
        exercise.cali;

    const matchesGym =
        selectedCategories.has("gym") &&
        exercise.gym;

    return matchesCali || matchesGym;
}

function exerciseMatchesEquipmentFilter(exercise) {
    return exerciseHasRequiredEquipment(exercise);
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

function createPlanNumberInput(value, onChange, options = {}) {
    const container = document.createElement("div");
    container.classList.add("plan-number-control");

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.textContent = "▲";
    upButton.classList.add("plan-number-arrow");

    const input = document.createElement("input");
    input.type = "number";
    input.value = value ?? "";
    input.classList.add("plan-number-input");

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.textContent = "▼";
    downButton.classList.add("plan-number-arrow");

    if (options.min !== undefined) {
        input.min = options.min;
    }

    if (options.step !== undefined) {
        input.step = options.step;
    }

    function updateWidth() {
        const length = String(input.value || "0").length;
        input.style.width = `${Math.max(2, length + 1)}ch`;
    }

    function changeValue(amount) {
        const currentValue = Number(input.value) || 0;
        const step = Number(input.step) || 1;

        let newValue = currentValue + amount * step;

        if (input.min !== "") {
            newValue = Math.max(
                Number(input.min),
                newValue
            );
        }

        input.value = newValue;

        updateWidth();
        onChange(newValue);
    }

    upButton.addEventListener("click", () => {
        changeValue(1);
    });

    downButton.addEventListener("click", () => {
        changeValue(-1);
    });

    input.addEventListener("input", () => {
        updateWidth();
    });

    input.addEventListener("change", () => {
        const newValue = input.value === ""
            ? null
            : Number(input.value);

        updateWidth();
        onChange(newValue);
    });

    container.appendChild(upButton);
    container.appendChild(input);
    container.appendChild(downButton);

    updateWidth();

    return container;
}

function renderPlanExercises() {
    planExerciseList.innerHTML = "";

    if (!currentPlan || currentPlan.exercises.length === 0) {
        planExerciseList.textContent = "Aucun exercice ajouté.";
        return;
    }

    normalizeCombinationNumbers();

    const table = document.createElement("table");
    table.classList.add("plan-exercise-table");

    const headers = [
        "Exercices",
        "Progression",
        "Muscles",
        "Poids",
        "Séries",
        "Volume",
        "Tempo",
        "Pause",
        "Instructions",
        "Set",
    ];

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    headers.forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Regroupe les exercices par combinaison.
    const groups = [];

    currentPlan.exercises.forEach(planExercise => {
        const group = planExercise.combination.group;

        let groupData = groups.find(item => item.group === group);

        if (!groupData) {
            groupData = {
                group,
                exercises: []
            };

            groups.push(groupData);
        }

        groupData.exercises.push(planExercise);
    });

    const tbody = document.createElement("tbody");

    groups.forEach((groupData, groupIndex) => {
        const { group, exercises: groupExercises } = groupData;

        groupExercises.forEach((planExercise, exerciseIndex) => {
            const exercise = planExercise.exercise;
            const row = document.createElement("tr");

const colorPosition = (group - 1) % 6;

if (colorPosition === 0) {
    row.classList.add("plan-set-colored-1");
}

if (colorPosition === 2) {
    row.classList.add("plan-set-colored-2");
}

if (colorPosition === 4) {
    row.classList.add("plan-set-colored-3");
}

            row.classList.add(`plan-set-${group}`);

            // Exercice
            const exerciseCell = document.createElement("td");

            const exerciseName = document.createElement("button");
            exerciseName.classList.add("plan-exercise-name");
            exerciseName.textContent = exercise.nom;

            exerciseName.addEventListener("click", () => {
                displayExerciseDetails(exercise, "plan");
            });

            exerciseCell.appendChild(exerciseName);
            row.appendChild(exerciseCell);

// Progression
const progressionCell = document.createElement("td");

const progressionContainer = document.createElement("div");
progressionContainer.classList.add("plan-progression-cell");

const progressionName = document.createElement("span");
progressionName.textContent =
    getProgressionName(exercise) || "—";

const progressionButtons = document.createElement("div");
progressionButtons.classList.add("plan-progression-buttons");

const progressionUp = document.createElement("button");
progressionUp.textContent = "▲";
progressionUp.classList.add("plan-progression-button");

const progressionDown = document.createElement("button");
progressionDown.textContent = "▼";
progressionDown.classList.add("plan-progression-button");

progressionButtons.appendChild(progressionUp);
progressionButtons.appendChild(progressionDown);

progressionContainer.appendChild(progressionName);
progressionContainer.appendChild(progressionButtons);

progressionCell.appendChild(progressionContainer);
row.appendChild(progressionCell);

const nextProgression =
    getPlanProgressionNeighbor(exercise, 1);

const previousProgression =
    getPlanProgressionNeighbor(exercise, -1);

progressionUp.disabled = !nextProgression;
progressionDown.disabled = !previousProgression;

progressionUp.addEventListener("click", () => {
    if (!nextProgression) return;

    updatePlanExerciseProgression(
        planExercise,
        nextProgression
    );

    displayExerciseDetails(nextProgression, "plan");
});

progressionDown.addEventListener("click", () => {
    if (!previousProgression) return;

    updatePlanExerciseProgression(
        planExercise,
        previousProgression
    );

    displayExerciseDetails(previousProgression, "plan");
});

            // Muscles
            const musclesCell = document.createElement("td");

            const muscleFamilies = [
                ...new Set(
                    exercise.muscles_principaux.map(
                        muscle => muscle[0]
                    )
                )
            ];

            musclesCell.textContent =
                muscleFamilies.length
                    ? muscleFamilies.join(" / ")
                    : "—";

            row.appendChild(musclesCell);

            // Poids
const weightCell = document.createElement("td");

const weightContainer = document.createElement("div");
weightContainer.classList.add("plan-value-container");

weightContainer.appendChild(
    createPlanNumberInput(
        planExercise.weight,
        value => {
            planExercise.weight = value ?? 0;
        },
        {
            min: 0,
            step: 0.5
        }
    )
);

const weightUnitSelect = document.createElement("select");

["lbs", "kg"].forEach(unit => {
    const option = document.createElement("option");

    option.value = unit;
    option.textContent = unit;
    option.selected = planExercise.weightUnit === unit;

    weightUnitSelect.appendChild(option);
});

weightUnitSelect.addEventListener("change", () => {
    planExercise.weightUnit = weightUnitSelect.value;
});

weightUnitSelect.classList.add("plan-weight-unit");

weightContainer.appendChild(weightUnitSelect);

weightCell.appendChild(weightContainer);
row.appendChild(weightCell);

            // Séries
            const setsCell = document.createElement("td");

            setsCell.appendChild(
                createPlanNumberInput(
                    planExercise.sets,
                    value => {
                        planExercise.sets = value ?? 0;
                    },
                    {
                        min: 1,
                        step: 1
                    }
                )
            );

            row.appendChild(setsCell);

// Volume (répétitions ou temps)
const repsTimeCell = document.createElement("td");

const repsTimeContainer = document.createElement("div");
repsTimeContainer.classList.add("plan-value-container");

repsTimeContainer.appendChild(
    createPlanNumberInput(
        planExercise.value,
        value => {
            planExercise.value = value ?? 0;
        },
        {
            min: 1,
            step: 1
        }
    )
);

const valueUnitSelect = document.createElement("select");

[
    ["rep", "rep"],
    ["sec", "sec"]
].forEach(([value, text]) => {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = text;

    valueUnitSelect.appendChild(option);
});

valueUnitSelect.value = planExercise.valueUnit;

valueUnitSelect.addEventListener("change", () => {
    planExercise.valueUnit = valueUnitSelect.value;
});

valueUnitSelect.classList.add("plan-value-unit");

repsTimeContainer.appendChild(valueUnitSelect);

repsTimeCell.appendChild(repsTimeContainer);
row.appendChild(repsTimeCell);

// Tempo
const tempoCell = document.createElement("td");

const tempoContainer = document.createElement("div");
tempoContainer.classList.add("plan-tempo-container");

["first", "second", "third", "fourth"].forEach((key, index) => {
    const tempoControl = createPlanNumberInput(
        planExercise.tempo[key],
        value => {
            planExercise.tempo[key] = value ?? 0;
        },
        {
            min: 0,
            step: 1
        }
    );

    tempoContainer.appendChild(tempoControl);

    if (index < 3) {
        const separator = document.createElement("span");
        separator.textContent = "·";
        separator.classList.add("plan-tempo-separator");

        tempoContainer.appendChild(separator);
    }
});

tempoCell.appendChild(tempoContainer);
row.appendChild(tempoCell);

// Pause
const restCell = document.createElement("td");

const restContainer = document.createElement("div");
restContainer.classList.add("plan-value-container");

restContainer.appendChild(
    createPlanNumberInput(
        planExercise.rest,
        value => {
            planExercise.rest = value ?? 0;
        },
        {
            min: 0,
            step: 1
        }
    )
);

const restUnit = document.createElement("span");
restUnit.textContent = "sec";
restUnit.classList.add("plan-static-unit");

restContainer.appendChild(restUnit);

restCell.appendChild(restContainer);
row.appendChild(restCell);

// Instructions
const instructionsCell = document.createElement("td");

const instructionsButton = document.createElement("button");
instructionsButton.textContent = "Instructions";
instructionsButton.classList.add("plan-instructions-button");

instructionsButton.dataset.planExerciseIndex =
    currentPlan.exercises.indexOf(planExercise);

instructionsButton.addEventListener("click", () => {
    openPlanExerciseInstructions(
        planExercise,
        currentPlan.exercises.indexOf(planExercise)
    );
});

instructionsCell.appendChild(instructionsButton);
row.appendChild(instructionsCell);

            // Combinaison
            const combinationCell = document.createElement("td");

            const combinationButton = document.createElement("button");

            combinationButton.textContent = `S${group}`;
            combinationButton.classList.add("plan-combination-button");

            combinationButton.addEventListener("click", () => {
                openCombinationMenu(
                    planExercise,
                    combinationButton
                );
            });

            combinationCell.appendChild(combinationButton);
            row.appendChild(combinationCell);

            // Ordre dans la combinaison
            const combinationOrderCell = document.createElement("td");

            if (groupExercises.length > 1) {
                const buttons = document.createElement("div");
                buttons.classList.add(
                    "plan-combination-exercise-buttons"
                );

                const upButton = document.createElement("button");
                upButton.textContent = "▲";
                upButton.classList.add("plan-order-button");
                upButton.disabled = exerciseIndex === 0;

                upButton.addEventListener("click", () => {
                    moveExerciseWithinCombination(
                        planExercise,
                        -1
                    );
                });

                const downButton = document.createElement("button");
                downButton.textContent = "▼";
                downButton.classList.add("plan-order-button");
                downButton.disabled =
                    exerciseIndex === groupExercises.length - 1;

                downButton.addEventListener("click", () => {
                    moveExerciseWithinCombination(
                        planExercise,
                        1
                    );
                });

                buttons.appendChild(upButton);
                buttons.appendChild(downButton);

                combinationOrderCell.appendChild(buttons);
            }

            row.appendChild(combinationOrderCell);

            // Ordre des combinaisons
            if (exerciseIndex === 0) {
                const groupOrderCell = document.createElement("td");

                groupOrderCell.rowSpan = groupExercises.length;
                groupOrderCell.classList.add(
                    "plan-combination-group-order"
                );

                const buttons = document.createElement("div");
                buttons.classList.add(
                    "plan-combination-group-order-container"
                );

                const upButton = document.createElement("button");
                upButton.textContent = "▲";
                upButton.classList.add("plan-order-button");
                upButton.disabled = groupIndex === 0;

                upButton.addEventListener("click", () => {
                    moveCombination(group, -1);
                });

                const downButton = document.createElement("button");
                downButton.textContent = "▼";
                downButton.classList.add("plan-order-button");
                downButton.disabled =
                    groupIndex === groups.length - 1;

                downButton.addEventListener("click", () => {
                    moveCombination(group, 1);
                });

                buttons.appendChild(upButton);
                buttons.appendChild(downButton);

                groupOrderCell.appendChild(buttons);
                row.appendChild(groupOrderCell);
            }

            tbody.appendChild(row);
        });
    });

    table.appendChild(tbody);
    planExerciseList.appendChild(table);
}

function openPlanExerciseInstructions(planExercise, index) {
    if (!currentPlan) {
        return;
    }

    closePlanInstructionsPopup();

    if (!planExercise.details) {
        planExercise.details = {};
    }

    const exercise = planExercise.exercise;

    if (planExercise.details.instructions == null) {
        const parts = getPlanExerciseDetailsLines(exercise);

        planExercise.details.instructions = parts.join("\n");
    }

    const popup = document.createElement("div");
    popup.classList.add("plan-instructions-popup");

    const textarea = document.createElement("textarea");
    textarea.classList.add("plan-instructions-textarea");

    textarea.maxLength = 200;
    textarea.value = planExercise.details.instructions;

    popup.appendChild(textarea);

    popup.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.body.appendChild(popup);

    const button = document.querySelector(
        `.plan-instructions-button[data-plan-exercise-index="${index}"]`
    );

    if (button) {
        const rect = button.getBoundingClientRect();

        popup.style.left =
            `${rect.left + window.scrollX}px`;

        popup.style.top =
            `${rect.bottom + window.scrollY + 5}px`;
    }

    textarea.focus();

    function saveInstructions() {
        planExercise.details.instructions =
            textarea.value.slice(0, 200);
    }

    popup._saveInstructions = saveInstructions;

    textarea.addEventListener("input", saveInstructions);

    function closeOnOutsideClick(event) {
        if (popup.contains(event.target)) {
            return;
        }

        saveInstructions();
        popup.remove();

        document.removeEventListener(
            "click",
            closeOnOutsideClick
        );

        popup._closeHandler = null;
    }

    popup._closeHandler = closeOnOutsideClick;

    setTimeout(() => {
        document.addEventListener(
            "click",
            closeOnOutsideClick
        );
    }, 0);
}

// Combinaisons

function getNextCombinationGroup() {
    if (!currentPlan || currentPlan.exercises.length === 0) {
        return 1;
    }

    const groups = currentPlan.exercises
        .map(planExercise => planExercise.combination?.group)
        .filter(group => Number.isInteger(group));

    if (groups.length === 0) {
        return 1;
    }

    return Math.max(...groups) + 1;
}

function getCombinationGroups() {
    if (!currentPlan) {
        return [];
    }

    const groups = [];

    currentPlan.exercises.forEach(planExercise => {
        const group = planExercise.combination?.group;

        if (!Number.isInteger(group)) {
            return;
        }

        if (!groups.includes(group)) {
            groups.push(group);
        }
    });

    return groups;
}

function normalizeCombinationNumbers() {
    if (!currentPlan) {
        return;
    }

    const groups = getCombinationGroups();

    const groupMapping = new Map();

    groups.forEach((group, index) => {
        groupMapping.set(group, index + 1);
    });

    currentPlan.exercises.forEach(planExercise => {
        const oldGroup = planExercise.combination?.group;

        if (!groupMapping.has(oldGroup)) {
            return;
        }

        planExercise.combination.group =
            groupMapping.get(oldGroup);
    });
}

function moveExerciseToCombination(planExercise, targetGroup) {
    if (!currentPlan) {
        return;
    }

    const exercises = currentPlan.exercises;

    const currentIndex = exercises.indexOf(planExercise);

    if (currentIndex === -1) {
        return;
    }

    const currentGroup =
        planExercise.combination?.group;

    if (currentGroup === targetGroup) {
        return;
    }

    // Retirer l'exercice de sa position actuelle
    exercises.splice(currentIndex, 1);

    // Changer sa combinaison
    planExercise.combination.group = targetGroup;

    // Trouver le dernier exercice de la combinaison cible
    let insertIndex = -1;

    for (let i = 0; i < exercises.length; i++) {
        if (
            exercises[i].combination?.group === targetGroup
        ) {
            insertIndex = i;
        }
    }

    if (insertIndex === -1) {
        // La combinaison n'existe plus
        exercises.push(planExercise);
    } else {
        // Ajouter à la fin de la combinaison
        exercises.splice(
            insertIndex + 1,
            0,
            planExercise
        );
    }

    normalizeCombinationNumbers();

    renderPlanExercises();
}

function moveExerciseToNewCombination(planExercise) {
    if (!currentPlan) {
        return;
    }

    const exercises = currentPlan.exercises;
    const currentIndex = exercises.indexOf(planExercise);

    if (currentIndex === -1) {
        return;
    }

    // Retirer l'exercice de sa combinaison actuelle
    exercises.splice(currentIndex, 1);

    // L'exercice devient temporairement son propre groupe
    const newGroup = getNextCombinationGroup();

    planExercise.combination.group = newGroup;

    // On le remet à la même position générale
    exercises.splice(currentIndex, 0, planExercise);

    normalizeCombinationNumbers();

    renderPlanExercises();
}

function getAvailableCombinationGroups() {
    if (!currentPlan) {
        return [];
    }

    return getCombinationGroups().sort((a, b) => a - b);
}

function openCombinationMenu(planExercise, button) {
    if (!currentPlan) {
        return;
    }

    // Fermer les anciens menus
    document
        .querySelectorAll(".combination-menu")
        .forEach(menu => menu.remove());

    const menu = document.createElement("div");
    menu.classList.add("combination-menu");

    const label = document.createElement("div");
    label.textContent = "Ajouter à :";
    label.classList.add("combination-menu-label");

    menu.appendChild(label);

    const select = document.createElement("select");

    select.classList.add("combination-select");

    // Option nouvelle combinaison
    const newOption = document.createElement("option");
    newOption.value = "new";
    newOption.textContent = "Nouveau Set";

    select.appendChild(newOption);

    // Combinaisons existantes
    getAvailableCombinationGroups().forEach(group => {
        if (group === planExercise.combination.group) {
            return;
        }

        const option = document.createElement("option");

        option.value = group;
        option.textContent = `Set ${group}`;

        select.appendChild(option);
    });

    menu.appendChild(select);

    button.parentElement.appendChild(menu);

    select.addEventListener("change", () => {
        if (select.value === "new") {
            moveExerciseToNewCombination(planExercise);
        } else {
            moveExerciseToCombination(
                planExercise,
                Number(select.value)
            );
        }

        menu.remove();
    });
}

function moveExerciseWithinCombination(planExercise, direction) {
    if (!currentPlan) {
        return;
    }

    const exercises = currentPlan.exercises;

    const index = exercises.indexOf(planExercise);

    if (index === -1) {
        return;
    }

    const group = planExercise.combination?.group;

    if (!Number.isInteger(group)) {
        return;
    }

    const sameGroupIndexes = [];

    exercises.forEach((item, i) => {
        if (item.combination?.group === group) {
            sameGroupIndexes.push(i);
        }
    });

    const position = sameGroupIndexes.indexOf(index);

    if (position === -1) {
        return;
    }

    const targetPosition = position + direction;

    if (
        targetPosition < 0 ||
        targetPosition >= sameGroupIndexes.length
    ) {
        return;
    }

    const targetIndex = sameGroupIndexes[targetPosition];

    // Échanger les deux exercices
    [
        exercises[index],
        exercises[targetIndex]
    ] = [
        exercises[targetIndex],
        exercises[index]
    ];

    renderPlanExercises();
}

function moveCombination(group, direction) {
    if (!currentPlan) {
        return;
    }

    const exercises = currentPlan.exercises;

    const groupIndexes = [];

    exercises.forEach((planExercise, index) => {
        if (planExercise.combination?.group === group) {
            groupIndexes.push(index);
        }
    });

    if (groupIndexes.length === 0) {
        return;
    }

    const firstIndex = groupIndexes[0];
    const lastIndex = groupIndexes[groupIndexes.length - 1];

    // Combinaison précédente
    const groups = getCombinationGroups();

    const groupPosition = groups.indexOf(group);

    const targetGroupPosition = groupPosition + direction;

    if (
        targetGroupPosition < 0 ||
        targetGroupPosition >= groups.length
    ) {
        return;
    }

    const targetGroup = groups[targetGroupPosition];

    const targetIndexes = [];

    exercises.forEach((planExercise, index) => {
        if (planExercise.combination?.group === targetGroup) {
            targetIndexes.push(index);
        }
    });

    if (targetIndexes.length === 0) {
        return;
    }

    const targetFirstIndex = targetIndexes[0];
    const targetLastIndex = targetIndexes[targetIndexes.length - 1];

    const combinationExercises = exercises.splice(
        firstIndex,
        groupIndexes.length
    );

    let insertIndex;

    if (direction === -1) {
        insertIndex = targetFirstIndex;
    } else {
        insertIndex =
            targetLastIndex -
            (firstIndex < targetFirstIndex
                ? groupIndexes.length
                : 0) +
            1;
    }

    exercises.splice(
        insertIndex,
        0,
        ...combinationExercises
    );

    normalizeCombinationNumbers();

    renderPlanExercises();
}

// Ajouter un exercice au plan actuel

function addExerciseToCurrentPlan(exercise) {
    if (!currentPlan) return;

    const isIso = isIsometricExercise(exercise);

    currentPlan.exercises.push({
        exercise: exercise,

        sets: currentPlan.defaults.sets,

        value: isIso
            ? currentPlan.defaults.time
            : currentPlan.defaults.reps,

        valueUnit: isIso ? "sec" : "rep",

        rest: currentPlan.defaults.rest,

        tempo: {
            first: currentPlan.defaults.tempo.first,
            second: currentPlan.defaults.tempo.second,
            third: currentPlan.defaults.tempo.third,
            fourth: currentPlan.defaults.tempo.fourth
        },

        weight: 0,
        weightUnit: "lbs",

        instructions: {},

        combination: {
            type: null,
            group: getNextCombinationGroup()
        }
    });

    renderPlanExercises();
}

function removeExerciseFromCurrentPlan(index) {
    if (!currentPlan) {
        return;
    }

    currentPlan.exercises.splice(index, 1);
    renderPlanExercises();
}

function updatePlanExerciseProgression(planExercise, newExercise) {
    const oldExercise = planExercise.exercise;

    const oldIsIso = isIsometricExercise(oldExercise);
    const newIsIso = isIsometricExercise(newExercise);

    closePlanInstructionsPopup();

    planExercise.exercise = newExercise;

    if (!planExercise.details) {
        planExercise.details = {};
    }

    planExercise.details.instructions = null;

    if (!oldIsIso && newIsIso) {
        planExercise.value = currentPlan.defaults.time;
        planExercise.valueUnit = "sec";
    }

    if (oldIsIso && !newIsIso) {
        planExercise.value = currentPlan.defaults.reps;
        planExercise.valueUnit = "rep";
    }

    renderPlanExercises();
}

function movePlanExercise(index, direction) {
    if (!currentPlan) {
        return;
    }

    const newIndex = index + direction;

    if (
        newIndex < 0 ||
        newIndex >= currentPlan.exercises.length
    ) {
        return;
    }

    const exercises = currentPlan.exercises;

    [exercises[index], exercises[newIndex]] =
        [exercises[newIndex], exercises[index]];

    renderPlanExercises();
}

function createPlanFilterRows() {
    const categoryContainer = document.getElementById("plan-category-filters");
    const equipmentContainer = document.getElementById("plan-equipment-filters");

    categoryContainer.innerHTML = "";
    equipmentContainer.innerHTML = "";

    function createFilterRow(container, filterName, titleText, optionsContainerId, summaryId) {
        const row = document.createElement("div");
        row.classList.add("plan-filter-row");

        const title = document.createElement("div");
        title.classList.add("plan-filter-title");
        title.dataset.filter = filterName;

        const titleTextElement = document.createElement("strong");
        titleTextElement.textContent = titleText;

        const arrow = document.createElement("span");
        arrow.classList.add("plan-filter-arrow");
        arrow.textContent = "▼";

        title.appendChild(titleTextElement);
        title.appendChild(arrow);

        const summary = document.createElement("div");
        summary.id = summaryId;
        summary.classList.add("plan-filter-summary");

        const options = document.createElement("div");
        options.id = optionsContainerId;
        options.classList.add("plan-filter-options");

        row.appendChild(title);
        row.appendChild(summary);
        row.appendChild(options);

        container.appendChild(row);

title.addEventListener("click", () => {
    const isOpen = options.classList.contains("open");
    const planFiltersBox = document.querySelector(".plan-filters-box");

    planFiltersBox
        .querySelectorAll(".plan-filter-options.open")
        .forEach(otherOptions => {
            otherOptions.classList.remove("open");
        });

    planFiltersBox
        .querySelectorAll(".plan-filter-arrow")
        .forEach(otherArrow => {
            otherArrow.textContent = "▼";
        });

    if (!isOpen) {
        options.classList.add("open");
        arrow.textContent = "▲";
    }
});

        return options;
    }

    const categoryOptions = createFilterRow(
        categoryContainer,
        "plan-category",
        "Catégorie",
        "plan-category-filter-options",
        "plan-category-summary"
    );

    const equipmentOptionsContainer = createFilterRow(
        equipmentContainer,
        "plan-equipment",
        "Équipements",
        "plan-equipment-filter-options",
        "plan-equipment-summary"
    );

    [
        { value: "cali", label: "Cali" },
        { value: "gym", label: "Gym" }
    ].forEach(category => {
        const button = document.createElement("button");
        button.classList.add("filter-button");
        button.textContent = category.label;
        button.dataset.category = category.value;

        if (selectedPlanCategories.has(category.value)) {
            button.classList.add("active");
        }

        button.addEventListener("click", event => {
            event.stopPropagation();

            if (selectedPlanCategories.has(category.value)) {
                selectedPlanCategories.delete(category.value);
                button.classList.remove("active");
            } else {
                selectedPlanCategories.add(category.value);
                button.classList.add("active");
            }

            syncPlanFiltersToSearch();
            updatePlanFilterSummaries();
            updatePlanProgressionFilters();
        });

        categoryOptions.appendChild(button);
    });

    equipmentOptions.forEach(equipment => {
        const button = document.createElement("button");
        button.classList.add("filter-button");
        button.textContent = equipment;
        button.dataset.equipment = equipment;

        if (selectedPlanEquipment.has(equipment)) {
            button.classList.add("active");
        }

        button.addEventListener("click", event => {
            event.stopPropagation();

            if (selectedPlanEquipment.has(equipment)) {
                selectedPlanEquipment.delete(equipment);
                button.classList.remove("active");
            } else {
                selectedPlanEquipment.add(equipment);
                button.classList.add("active");
            }

            syncPlanFiltersToSearch();
            updatePlanFilterSummaries();
            updatePlanProgressionFilters();
        });

        equipmentOptionsContainer.appendChild(button);
    });

    updatePlanFilterSummaries();
}

function syncPlanFiltersToSearch() {
    selectedCategories.clear();

    selectedPlanCategories.forEach(category => {
        selectedCategories.add(category);
    });

    selectedEquipment.clear();

    selectedPlanEquipment.forEach(equipment => {
        selectedEquipment.add(equipment);
    });

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

    document
        .querySelectorAll("#equipment-filters .filter-button")
        .forEach(button => {
            const equipment =
                button.dataset.equipment;

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
    updateFilterSummaries();

    // Le nouvel état de recherche du plan est sauvegardé
    // avec les filtres du plan comme point de départ.
    saveSearchState(planSearchState);

    displayExercises();

    if (currentPlan) {
    renderPlanExercises();
}
}

function updatePlanFilterSummaries() {
    function createSummaryButton(text) {
        const button = document.createElement("span");
        button.classList.add("summary-button");

        const label = document.createElement("span");
        label.textContent = text;

        button.appendChild(label);

        return button;
    }

    // Catégorie
    const categorySummary = document.getElementById(
        "plan-category-summary"
    );

    categorySummary.innerHTML = "";

    if (selectedPlanCategories.size === 0) {
        categorySummary.appendChild(
            createSummaryButton("Aucun")
        );
    } else {
        if (selectedPlanCategories.has("cali")) {
            categorySummary.appendChild(
                createSummaryButton("Cali")
            );
        }

        if (selectedPlanCategories.has("gym")) {
            categorySummary.appendChild(
                createSummaryButton("Gym")
            );
        }
    }

    // Équipements
    const equipmentSummary = document.getElementById(
        "plan-equipment-summary"
    );

    equipmentSummary.innerHTML = "";

    if (
        selectedPlanEquipment.size ===
        equipmentOptions.length
    ) {
        equipmentSummary.appendChild(
            createSummaryButton("Tous")
        );
    } else if (selectedPlanEquipment.size === 0) {
        equipmentSummary.appendChild(
            createSummaryButton("Aucun")
        );
    } else {
        [...selectedPlanEquipment].forEach(equipment => {
            equipmentSummary.appendChild(
                createSummaryButton(equipment)
            );
        });
    }
}

createPlanFilterRows();

function exerciseMatchesPlanFilters(exercise) {
    if (selectedPlanCategories.size === 0) {
        return false;
    }

    const matchesCategory =
        (selectedPlanCategories.has("cali") && exercise.cali) ||
        (selectedPlanCategories.has("gym") && exercise.gym);

    if (!matchesCategory) {
        return false;
    }

    return exerciseMatchesPlanEquipment(exercise);
}

function exerciseMatchesPlanEquipment(exercise) {
    if (selectedPlanEquipment.size === 0) {
        return false;
    }

    if (!exercise.equipement || exercise.equipement.length === 0) {
        return true;
    }

    return exercise.equipement.every(group =>
        group.some(equipment => {
            if (equipment === "Aucun") {
                return true;
            }

            return selectedPlanEquipment.has(equipment);
        })
    );
}

function updatePlanProgressionFilters() {
    if (
        currentDetailExercise &&
        currentDetailContext === "plan"
    ) {
        updateProgressionNavigation(
            currentDetailExercise,
            "plan"
        );
    }
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