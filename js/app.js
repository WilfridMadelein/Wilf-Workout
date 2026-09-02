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

    selectedSubmuscles.set(family, new Set(submuscles));

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
                isPlanContext ? "plan" : "search"
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


function updateProgressionNavigation(
    currentExercise,
    context = "search"
) {
    const upButton =
        document.getElementById(
            "progression-up-button"
        );

    const downButton =
        document.getElementById(
            "progression-down-button"
        );

    if (!upButton || !downButton) {
        return;
    }

    const nextExercise =
        getProgressionNeighbor(
            currentExercise,
            1,
            context
        );

    const previousExercise =
        getProgressionNeighbor(
            currentExercise,
            -1,
            context
        );

    upButton.disabled = !nextExercise;
    downButton.disabled = !previousExercise;

    upButton.onclick = () => {

        if (!nextExercise) {
            return;
        }

        displayExerciseDetails(
            nextExercise,
            context
        );
    };

    downButton.onclick = () => {

        if (!previousExercise) {
            return;
        }

        displayExerciseDetails(
            previousExercise,
            context
        );
    };
}

// Détails

function displayExerciseDetails(
    exercise,
    context = "search"
) {
    const nameElement =
        document.getElementById(
            "details-exercise-name"
        );

    const header = document.querySelector(".exercise-detail-header");
let addButton = document.getElementById("add-exercise-to-plan-button");

if (addButton) {
    addButton.remove();
}

if (context === "plan") {
    addButton = document.createElement("button");
    addButton.id = "add-exercise-to-plan-button";
    addButton.textContent = "Ajouter";
    addButton.addEventListener("click", () => {
        addExerciseToCurrentPlan(exercise);
    });
    header.appendChild(addButton);
}

    const infoElement =
        document.getElementById(
            "details-exercise-info"
        );

    if (!nameElement || !infoElement) {
        return;
    }

    currentDetailExercise = exercise;
    currentDetailContext = context;

    nameElement.textContent = exercise.nom;

    const musclesPrincipaux =
        exercise.muscles_principaux
            .map(muscle => `
                <li>
                    ${muscle
                        .filter(part => part !== "")
                        .join(" — ")}
                </li>
            `)
            .join("");

    const musclesSecondaires =
        exercise.muscles_secondaires
            .map(muscle => `
                <li>
                    ${muscle
                        .filter(part => part !== "")
                        .join(" — ")}
                </li>
            `)
            .join("");

    const equipements =
        exercise.equipement
            .map(group => `
                <li>
                    ${group.join(" OU ")}
                </li>
            `)
            .join("");

    infoElement.innerHTML = `
        <p>
            <strong>Type :</strong>
            ${exercise.type}
        </p>

        <p>
            <strong>Cali :</strong>
            ${exercise.cali ? "Oui" : "Non"}
        </p>

        <p>
            <strong>Gym :</strong>
            ${exercise.gym ? "Oui" : "Non"}
        </p>

        <p>
            <strong>Pronation :</strong>
            ${
                Array.isArray(exercise.pronation)
                    ? exercise.pronation.join(", ")
                    : exercise.pronation || ""
            }
        </p>

        <p>
            <strong>Progression :</strong>
            ${exercise.prog_group}
            ${exercise.prog_ordre}
        </p>

        <h4>Équipement</h4>

        <ul>
            ${equipements}
        </ul>

        <h4>Muscles principaux</h4>

        <ul>
            ${musclesPrincipaux}
        </ul>

        <h4>Muscles secondaires</h4>

        <ul>
            ${musclesSecondaires}
        </ul>
    `;

    updateProgressionNavigation(
        exercise,
        "search"
    );
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
    pageExercises.style.display = "block";
    pagePlans.style.display = "none";

    tabExercises.classList.add("active");
    tabPlans.classList.remove("active");
});

tabPlans.addEventListener("click", () => {
    pageExercises.style.display = "none";
    pagePlans.style.display = "block";

    planHome.style.display = "block";
    planCreator.style.display = "none";
    planEditor.style.display = "none";

    tabExercises.classList.remove("active");
    tabPlans.classList.add("active");
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

function renderPlanExercises() {
    planExerciseList.innerHTML = "";

    if (!currentPlan || currentPlan.exercises.length === 0) {
        planExerciseList.textContent = "Aucun exercice ajouté.";
        return;
    }

    currentPlan.exercises.forEach((planExercise, index) => {
        const exerciseElement = document.createElement("div");
        exerciseElement.classList.add("plan-exercise-item");

        const navigation = document.createElement("div");
        navigation.classList.add("plan-exercise-navigation");

        const upButton = document.createElement("button");
        upButton.textContent = "▲";
        upButton.classList.add("plan-exercise-move-button");
        upButton.disabled = index === 0;

        upButton.addEventListener("click", () => {
            movePlanExercise(index, -1);
        });

        const downButton = document.createElement("button");
        downButton.textContent = "▼";
        downButton.classList.add("plan-exercise-move-button");
        downButton.disabled = index === currentPlan.exercises.length - 1;

        downButton.addEventListener("click", () => {
            movePlanExercise(index, 1);
        });

        navigation.appendChild(upButton);
        navigation.appendChild(downButton);

        const exerciseName = document.createElement("span");
        exerciseName.textContent = `${index + 1}. ${planExercise.exercise.nom}`;
        exerciseName.style.cursor = "pointer";

        exerciseName.addEventListener("click", () => {
            displayExerciseDetails(planExercise.exercise, "plan");
        });

        const removeButton = document.createElement("button");
        removeButton.classList.add("remove-plan-exercise-button");
        removeButton.textContent = "✕";
        removeButton.setAttribute("aria-label", `Supprimer ${planExercise.exercise.nom}`);

        removeButton.addEventListener("click", () => {
            removeExerciseFromCurrentPlan(index);
        });

        exerciseElement.appendChild(navigation);
        exerciseElement.appendChild(exerciseName);
        exerciseElement.appendChild(removeButton);

        planExerciseList.appendChild(exerciseElement);
    });
}

function addExerciseToCurrentPlan(exercise) {
    if (!currentPlan) {
        return;
    }

    currentPlan.exercises.push({
        exercise: exercise,
        sets: 3,
        reps: 10,
        weight: 0,
        rest: 90,
        tempo: ""
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
            button.classList.toggle(
                "active",
                selectedCategories.has(button.dataset.category)
            );
        });

    document
        .querySelectorAll("#equipment-filters .filter-button")
        .forEach(button => {
            if (
                button.dataset.equipment === "all" ||
                button.dataset.equipment === "none"
            ) {
                return;
            }

            button.classList.toggle(
                "active",
                selectedEquipment.has(button.dataset.equipment)
            );
        });

    updateEquipmentAllButton();
    updateFilterSummaries();
    displayExercises();
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
    planHome.style.display = "none";
    planEditor.style.display = "block";
    currentPlanName.textContent = plan.name;
    renderPlanExercises();
    planExerciseBrowserContainer.appendChild(exerciseBrowser);
    exerciseBrowser.style.display = "block";
});

    planCreator.style.display = "none";
    planHome.style.display = "block";
});

backToPlansButton.addEventListener("click", () => {
    planEditor.style.display = "none";
    planHome.style.display = "block";

    const exerciseBrowserContainer =
        document.getElementById("exercise-browser-container");

    exerciseBrowserContainer.appendChild(exerciseBrowser);
    exerciseBrowser.style.display = "block";

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