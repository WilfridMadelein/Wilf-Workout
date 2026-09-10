// ============================================================
// FILTRES DES EXERCICES
// ============================================================

// ------------------------------------------------------------
// DÉPENDANCES
// ------------------------------------------------------------

let getSelectedCategories = () => new Set();
let getSelectedEquipment = () => new Set();
let getSelectedTypes = () => new Set();
let getSelectedProgressionsInclude = () => new Set();
let getSelectedProgressionsExclude = () => new Set();
let getSelectedMuscleFamilies = () => new Set();
let getSelectedSubmuscles = () => new Map();

let getEquipmentOptions = () => [];
let getMuscleFamilies = () => [];
let getExercises = () => [];

let getMuscleFilters = () => null;
let getSubmuscleFilters = () => null;
let getEquipmentFilters = () => null;
let getTypeFilters = () => null;

let getSearchTerms = () => [];
let findValidTermCombination = () => null;
let getSearchCriteria = () => null;
let compareSearchCriteria = () => 0;

let displayExercises = () => {};
let updateFilterSummaries = () => {};

function configureExerciseFilters(dependencies) {
    getSelectedCategories = dependencies.getSelectedCategories;
    getSelectedEquipment = dependencies.getSelectedEquipment;
    getSelectedTypes = dependencies.getSelectedTypes;
    getSelectedProgressionsInclude =
        dependencies.getSelectedProgressionsInclude;
    getSelectedProgressionsExclude =
        dependencies.getSelectedProgressionsExclude;
    getSelectedMuscleFamilies =
        dependencies.getSelectedMuscleFamilies;
    getSelectedSubmuscles =
        dependencies.getSelectedSubmuscles;

    getEquipmentOptions = dependencies.getEquipmentOptions;
    getMuscleFamilies = dependencies.getMuscleFamilies;
    getExercises = dependencies.getExercises;

    getMuscleFilters = dependencies.getMuscleFilters;
    getSubmuscleFilters = dependencies.getSubmuscleFilters;
    getEquipmentFilters = dependencies.getEquipmentFilters;
    getTypeFilters = dependencies.getTypeFilters;

    getSearchTerms =
    dependencies.getSearchTerms;

    findValidTermCombination =
        dependencies.findValidTermCombination;

    getSearchCriteria =
        dependencies.getSearchCriteria;

    compareSearchCriteria =
        dependencies.compareSearchCriteria;

    displayExercises = dependencies.displayExercises;
    updateFilterSummaries =
        dependencies.updateFilterSummaries;
}

// ------------------------------------------------------------
// Muscles
// ------------------------------------------------------------

function createMuscleButtons() {
    const muscleFilters = getMuscleFilters();
    const submuscleFilters = getSubmuscleFilters();
    const selectedMuscleFamilies =
        getSelectedMuscleFamilies();
    const selectedSubmuscles =
        getSelectedSubmuscles();
    const muscleFamilies = getMuscleFamilies();

    const allButton = document.createElement("button");

    allButton.classList.add("filter-button", "active");
    allButton.textContent = "Tous";
    allButton.dataset.muscle = "all";

    allButton.addEventListener("click", () => {
        selectedMuscleFamilies.clear();
        selectedSubmuscles.clear();

        document
            .querySelectorAll(
                "#muscle-filters .filter-button"
            )
            .forEach(button =>
                button.classList.remove("active")
            );

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
    const muscleFilters = getMuscleFilters();
    const selectedMuscleFamilies =
        getSelectedMuscleFamilies();

    const allButton =
        muscleFilters.querySelector(
            '[data-muscle="all"]'
        );

    if (!allButton) {
        return;
    }

    allButton.classList.toggle(
        "active",
        selectedMuscleFamilies.size === 0
    );
}

function createSubmuscleButtons(family) {
    const submuscleFilters = getSubmuscleFilters();
    const selectedSubmuscles =
        getSelectedSubmuscles();
    const exercises = getExercises();

    removeSubmuscleContainer(family);

    const submuscles = new Set();

    exercises.forEach(exercise => {
        const allMuscles = [
            ...(exercise.muscles_principaux || []),
            ...(exercise.muscles_secondaires || [])
        ];

        allMuscles.forEach(muscle => {
            if (
                muscle[0] === family &&
                muscle[1] !== ""
            ) {
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

    const container =
        document.createElement("div");

    container.classList.add(
        "submuscle-container"
    );

    container.dataset.family = family;

    const title =
        document.createElement("p");

    title.classList.add(
        "submuscle-title"
    );

    title.innerHTML =
        `<strong>${family}</strong>`;

    container.appendChild(title);

    submuscles.forEach(submuscle => {
        const label =
            document.createElement("label");

        label.classList.add(
            "submuscle-option"
        );

        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = true;

        checkbox.addEventListener(
            "change",
            () => {
                const selected =
                    selectedSubmuscles.get(
                        family
                    );

                if (checkbox.checked) {
                    selected.add(submuscle);
                } else {
                    selected.delete(submuscle);
                }

                updateFilterSummaries();
                displayExercises();
            }
        );

        const text =
            document.createElement("span");

        text.textContent = submuscle;

        label.appendChild(checkbox);
        label.appendChild(text);
        container.appendChild(label);
    });

    submuscleFilters.appendChild(container);
}

function removeSubmuscleContainer(family) {
    const submuscleFilters =
        getSubmuscleFilters();

    const container =
        submuscleFilters.querySelector(
            `[data-family="${CSS.escape(family)}"]`
        );

    if (container) {
        container.remove();
    }
}

function exerciseMatchesMuscle(exercise) {
    const selectedMuscleFamilies =
        getSelectedMuscleFamilies();

    const selectedSubmuscles =
        getSelectedSubmuscles();

    if (selectedMuscleFamilies.size === 0) {
        return true;
    }

    const allMuscles = [
        ...(exercise.muscles_principaux || []),
        ...(exercise.muscles_secondaires || [])
    ];

    return [...selectedMuscleFamilies].some(
        family => {
            const familyMuscles =
                allMuscles.filter(
                    muscle =>
                        muscle[0] === family
                );

            if (familyMuscles.length === 0) {
                return false;
            }

            const selectedSubs =
                selectedSubmuscles.get(
                    family
                );

            if (
                !selectedSubs ||
                selectedSubs.size === 0
            ) {
                return false;
            }

            return familyMuscles.some(
                muscle =>
                    selectedSubs.has(
                        muscle[1]
                    )
            );
        }
    );
}

// ------------------------------------------------------------
// Équipements
// ------------------------------------------------------------

function createEquipmentButtons() {
    const equipmentFilters =
        getEquipmentFilters();

    const equipmentOptions =
        getEquipmentOptions();

    const selectedEquipment =
        getSelectedEquipment();

    equipmentOptions.forEach(equipment => {
        const button =
            document.createElement("button");

        button.classList.add(
            "filter-button",
            "active"
        );

        button.textContent = equipment;
        button.dataset.equipment = equipment;

        button.addEventListener("click", () => {
            if (
                selectedEquipment.has(
                    equipment
                )
            ) {
                selectedEquipment.delete(
                    equipment
                );

                button.classList.remove(
                    "active"
                );
            } else {
                selectedEquipment.add(
                    equipment
                );

                button.classList.add(
                    "active"
                );
            }

            updateEquipmentAllButton();
            updateEquipmentRelevance();
            displayExercises();
        });

        equipmentFilters.appendChild(
            button
        );
    });

    updateEquipmentAllButton();
}

function updateEquipmentAllButton() {
    const equipmentFilters =
        getEquipmentFilters();

    const equipmentOptions =
        getEquipmentOptions();

    const selectedEquipment =
        getSelectedEquipment();

    const allButton =
        equipmentFilters.querySelector(
            '[data-equipment="all"]'
        );

    const noneButton =
        equipmentFilters.querySelector(
            '[data-equipment="none"]'
        );

    if (!allButton || !noneButton) {
        return;
    }

    const allSelected =
        selectedEquipment.size ===
        equipmentOptions.length;

    const noneSelected =
        selectedEquipment.size === 0;

    allButton.classList.toggle(
        "active",
        allSelected
    );

    noneButton.classList.toggle(
        "active",
        noneSelected
    );
}

function setupEquipmentAllButton() {
    const equipmentFilters =
        getEquipmentFilters();

    const equipmentOptions =
        getEquipmentOptions();

    const selectedEquipment =
        getSelectedEquipment();

    const allButton =
        equipmentFilters.querySelector(
            '[data-equipment="all"]'
        );

    const noneButton =
        equipmentFilters.querySelector(
            '[data-equipment="none"]'
        );

    allButton.addEventListener("click", () => {
        equipmentOptions.forEach(equipment => {
            selectedEquipment.add(
                equipment
            );
        });

        equipmentFilters
            .querySelectorAll(
                ".filter-button"
            )
            .forEach(button =>
                button.classList.add(
                    "active"
                )
            );

        displayExercises();
    });

    noneButton.addEventListener("click", () => {
        selectedEquipment.clear();

        equipmentFilters
            .querySelectorAll(
                ".filter-button"
            )
            .forEach(button =>
                button.classList.remove(
                    "active"
                )
            );

        noneButton.classList.add("active");

        displayExercises();
    });
}

function exerciseHasRequiredEquipment(
    exercise
) {
    const selectedEquipment =
        getSelectedEquipment();

    return exercise.equipement.every(
        equipmentGroup => {
            return equipmentGroup.some(
                equipment => {
                    if (
                        equipment ===
                        "Aucun"
                    ) {
                        return true;
                    }

                    return selectedEquipment.has(
                        equipment
                    );
                }
            );
        }
    );
}

function exerciseMatchesEquipmentFilter(
    exercise
) {
    return exerciseHasRequiredEquipment(
        exercise
    );
}

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

function setupTypeButtons() {
    const typeFilters =
        getTypeFilters();

    const selectedTypes =
        getSelectedTypes();

    const buttons =
        typeFilters.querySelectorAll(
            ".filter-button"
        );

    buttons.forEach(button => {
        button.addEventListener(
            "click",
            () => {
                const type =
                    button.dataset.type;

                if (type === "all") {
                    selectedTypes.clear();

                    buttons.forEach(
                        otherButton => {
                            otherButton.classList.remove(
                                "active"
                            );
                        }
                    );

                    button.classList.add(
                        "active"
                    );
                } else {
                    if (
                        selectedTypes.has(
                            type
                        )
                    ) {
                        selectedTypes.delete(
                            type
                        );

                        button.classList.remove(
                            "active"
                        );
                    } else {
                        selectedTypes.add(
                            type
                        );

                        button.classList.add(
                            "active"
                        );
                    }

                    updateTypeAllButton();
                }

                displayExercises();
            }
        );
    });
}

function updateTypeAllButton() {
    const typeFilters =
        getTypeFilters();

    const selectedTypes =
        getSelectedTypes();

    const allButton =
        typeFilters.querySelector(
            '[data-type="all"]'
        );

    if (!allButton) {
        return;
    }

    allButton.classList.toggle(
        "active",
        selectedTypes.size === 0
    );
}

// ------------------------------------------------------------
// Catégories
// ------------------------------------------------------------

function getCategoryOptions() {
    const categories = new Set();

    getExercises().forEach(exercise => {
        exercise.catégorie?.forEach(category =>
            categories.add(category)
        );
    });

    return [...categories].sort((a, b) =>
        a.localeCompare(b, "fr", {
            sensitivity: "base"
        })
    );
}

function exerciseMatchesCategories(
    exercise,
    selectedCategories
) {
    if (selectedCategories.size === 0) {
        return false;
    }

    return exercise.catégorie?.some(category =>
        selectedCategories.has(category)
    ) ?? false;
}

function getRelevantEquipment(
    selectedCategories
) {
    const relevantEquipment =
        new Set();

    getExercises()
        .filter(exercise =>
            exerciseMatchesCategories(
                exercise,
                selectedCategories
            )
        )
        .forEach(exercise => {
            exercise.equipement?.forEach(
                group => {
                    group.forEach(equipment => {
                        if (
                            equipment !== "Aucun"
                        ) {
                            relevantEquipment.add(
                                equipment
                            );
                        }
                    });
                }
            );
        });

    return relevantEquipment;
}


function updateEquipmentRelevance() {
    const relevantEquipment =
        getRelevantEquipment(
            getSelectedCategories()
        );

    getEquipmentFilters()
        .querySelectorAll(
            "[data-equipment]"
        )
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
                "equipment-irrelevant",
                !relevantEquipment.has(
                    equipment
                )
            );
        });
}


function updateCategoryAllButton() {
    const allButton =
        document.querySelector(
            '#category-filters [data-category="all"]'
        );

    if (!allButton) return;

    allButton.classList.toggle(
        "active",
        getSelectedCategories().size ===
            getCategoryOptions().length
    );
}

function setupCategoryButtons() {
    const container =
        document.getElementById(
            "category-filters"
        );

    const selectedCategories =
        getSelectedCategories();

    const categories =
        getCategoryOptions();

    container.replaceChildren();


    const allButton =
        document.createElement("button");

    allButton.classList.add(
        "filter-button"
    );

    allButton.dataset.category = "all";
    allButton.textContent = "Tous";

    allButton.addEventListener(
        "click",
        () => {
            selectedCategories.clear();

            categories.forEach(category =>
                selectedCategories.add(
                    category
                )
            );

            setupCategoryButtons();
            updateEquipmentRelevance();
            displayExercises();
        }
    );

    container.appendChild(allButton);


    categories.forEach(category => {
        const button =
            document.createElement("button");

        button.classList.add(
            "filter-button"
        );

        button.dataset.category =
            category;

        button.textContent =
            category;

        button.classList.toggle(
            "active",
            selectedCategories.has(
                category
            )
        );

        button.addEventListener(
            "click",
            () => {
                if (
                    selectedCategories.has(
                        category
                    )
                ) {
                    selectedCategories.delete(
                        category
                    );
                } else {
                    selectedCategories.add(
                        category
                    );
                }

                button.classList.toggle(
                    "active",
                    selectedCategories.has(
                        category
                    )
                );

                updateCategoryAllButton();
                updateEquipmentRelevance();
                displayExercises();
            }
        );

        container.appendChild(button);
    });

    updateCategoryAllButton();
    updateEquipmentRelevance();
}

function exerciseMatchesCategoryFilter(
    exercise
) {
    return exerciseMatchesCategories(
        exercise,
        getSelectedCategories()
    );
}

// ------------------------------------------------------------
// Progressions
// ------------------------------------------------------------

function getProgressionOptions() {
    const exercises =
        getExercises();

    const progressions = new Set();

    exercises.forEach(exercise => {
        if (
            exercise.prog_group &&
            exercise.prog_group.trim() !== ""
        ) {
            progressions.add(
                exercise.prog_group
            );
        }
    });

    return [...progressions].sort();
}

let activeProgressionMode = "include";


function setProgressionMode(mode) {
    activeProgressionMode = mode;

    updateProgressionButtons();
}


function openProgressionFilter(mode) {
    setProgressionMode(mode);

    const options =
        document.getElementById(
            "progression-filter-options"
        );

    const title =
        document.querySelector(
            '.filter-title[data-filter="progression"]'
        );

    if (
        options &&
        title &&
        !options.classList.contains("open")
    ) {
        title.click();
    }
}


function getVisibleProgressionOptions() {
    const selectedProgressionsInclude =
        getSelectedProgressionsInclude();

    const selectedProgressionsExclude =
        getSelectedProgressionsExclude();

    const searchInput =
        document.getElementById(
            "progression-search-input"
        );

    const searchTerms =
        getSearchTerms(
            searchInput?.value || ""
        );

    /*
     * Une progression déjà sélectionnée
     * ne doit plus apparaître dans les options.
     */
    const availableProgressions =
        getProgressionOptions().filter(
            progression =>
                !selectedProgressionsInclude.has(
                    progression
                ) &&
                !selectedProgressionsExclude.has(
                    progression
                )
        );

    /*
     * Sans recherche :
     * ordre alphabétique normal.
     */
    if (searchTerms.length === 0) {
        return availableProgressions.sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "fr",
                    {
                        sensitivity: "base"
                    }
                )
        );
    }

    /*
     * Avec recherche :
     *
     * même logique que la recherche
     * des exercices, mais uniquement
     * sur le nom de la progression.
     */
    return availableProgressions
        .filter(progression =>
            findValidTermCombination(
                progression,
                searchTerms
            )
        )
        .map(progression => ({
            progression,

            searchCriteria:
                getSearchCriteria(
                    progression,
                    searchTerms
                )
        }))
        .sort((a, b) => {
            if (
                a.searchCriteria &&
                !b.searchCriteria
            ) {
                return -1;
            }

            if (
                !a.searchCriteria &&
                b.searchCriteria
            ) {
                return 1;
            }

            if (
                a.searchCriteria &&
                b.searchCriteria
            ) {
                const comparison =
                    compareSearchCriteria(
                        a.searchCriteria,
                        b.searchCriteria
                    );

                if (comparison !== 0) {
                    return comparison;
                }
            }

            return a.progression.localeCompare(
                b.progression,
                "fr",
                {
                    sensitivity: "base"
                }
            );
        })
        .map(item => item.progression);
}


function renderProgressionOptions() {
    const progressionContainer =
        document.getElementById(
            "progression-options"
        );

    if (!progressionContainer) {
        return;
    }

    progressionContainer.innerHTML = "";

    const progressions =
        getVisibleProgressionOptions();

    progressions.forEach(
        progression => {
            createProgressionButton(
                progression,
                progressionContainer
            );
        }
    );
}


function createProgressionOptions() {
    const progressionContainer =
        document.getElementById(
            "progression-options"
        );

    const includeModeButton =
        document.getElementById(
            "progression-include-mode"
        );

    const excludeModeButton =
        document.getElementById(
            "progression-exclude-mode"
        );

    const includeAddButton =
        document.getElementById(
            "progression-include-add"
        );

    const excludeAddButton =
        document.getElementById(
            "progression-exclude-add"
        );

    const searchInput =
        document.getElementById(
            "progression-search-input"
        );

    if (
        !progressionContainer ||
        !includeModeButton ||
        !excludeModeButton ||
        !includeAddButton ||
        !excludeAddButton ||
        !searchInput
    ) {
        return;
    }


    includeModeButton.onclick = () => {
        setProgressionMode(
            "include"
        );
    };


    excludeModeButton.onclick = () => {
        setProgressionMode(
            "exclude"
        );
    };


    includeAddButton.onclick = event => {
        event.stopPropagation();

        openProgressionFilter(
            "include"
        );
    };


    excludeAddButton.onclick = event => {
        event.stopPropagation();

        openProgressionFilter(
            "exclude"
        );
    };


    searchInput.oninput = () => {
        renderProgressionOptions();
    };


    updateProgressionButtons();
}


function createProgressionButton(progression, container) {
    const button = document.createElement("button");

    button.classList.add("filter-button");
    button.textContent = progression;
    button.dataset.progression = progression;

    button.addEventListener("click", () => {
        const include = getSelectedProgressionsInclude();
        const exclude = getSelectedProgressionsExclude();

        const selectedSet =
            activeProgressionMode === "include"
                ? include
                : exclude;

        const oppositeSet =
            activeProgressionMode === "include"
                ? exclude
                : include;

        oppositeSet.delete(progression);
        selectedSet.add(progression);

        renderProgressionOptions();
        displayExercises();
    });

    container.appendChild(button);
}


function updateProgressionButtons() {
    const includeModeButton =
        document.getElementById(
            "progression-include-mode"
        );

    const excludeModeButton =
        document.getElementById(
            "progression-exclude-mode"
        );


    includeModeButton?.classList.toggle(
        "active",
        activeProgressionMode === "include"
    );


    excludeModeButton?.classList.toggle(
        "active",
        activeProgressionMode === "exclude"
    );


    renderProgressionOptions();
}

function exerciseMatchesProgression(
    exercise
) {
    const selectedProgressionsInclude =
        getSelectedProgressionsInclude();

    const selectedProgressionsExclude =
        getSelectedProgressionsExclude();

    const progression =
        exercise.prog_group;

    if (
        selectedProgressionsInclude.size > 0 &&
        !selectedProgressionsInclude.has(
            progression
        )
    ) {
        return false;
    }

    if (
        selectedProgressionsExclude.has(
            progression
        )
    ) {
        return false;
    }

    return true;
}

// ============================================================
// EXPORTS
// ============================================================

export {
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
    getCategoryOptions,
    exerciseMatchesCategories,

    getRelevantEquipment,
    updateEquipmentRelevance,
    updateCategoryAllButton,

    getProgressionOptions,
    createProgressionOptions,
    createProgressionButton,
    updateProgressionButtons,
    exerciseMatchesProgression
};