// ============================================================
// FILTRES DU PLAN
// ============================================================

let getCurrentPlan = () => null;
let getCurrentDetailExercise = () => null;
let getCurrentDetailContext = () => "search";

let getSelectedPlanCategories = () => new Set();
let getSelectedPlanEquipment = () => new Set();

let getSelectedCategories = () => new Set();
let getSelectedEquipment = () => new Set();

let getEquipmentOptions = () => [];
let getPlanSearchState = () => ({});

let saveSearchState = () => {};
let displayExercises = () => {};
let renderPlanExercises = () => {};

let updateEquipmentAllButton = () => {};
let updateFilterSummaries = () => {};
let updateProgressionNavigation = () => {};

function configurePlanFilters(dependencies) {
    getCurrentPlan =
        dependencies.getCurrentPlan;

    getCurrentDetailExercise =
        dependencies.getCurrentDetailExercise;

    getCurrentDetailContext =
        dependencies.getCurrentDetailContext;

    getSelectedPlanCategories =
        dependencies.getSelectedPlanCategories;

    getSelectedPlanEquipment =
        dependencies.getSelectedPlanEquipment;

    getSelectedCategories =
        dependencies.getSelectedCategories;

    getSelectedEquipment =
        dependencies.getSelectedEquipment;

    getEquipmentOptions =
        dependencies.getEquipmentOptions;

    getPlanSearchState =
        dependencies.getPlanSearchState;

    saveSearchState =
        dependencies.saveSearchState;

    displayExercises =
        dependencies.displayExercises;

    renderPlanExercises =
        dependencies.renderPlanExercises;

    updateEquipmentAllButton =
        dependencies.updateEquipmentAllButton;

    updateFilterSummaries =
        dependencies.updateFilterSummaries;

    updateProgressionNavigation =
        dependencies.updateProgressionNavigation;
}

// ------------------------------------------------------------
// Création des filtres
// ------------------------------------------------------------

function createPlanFilterRows() {
    const selectedPlanCategories =
        getSelectedPlanCategories();

    const selectedPlanEquipment =
        getSelectedPlanEquipment();

    const equipmentOptions =
        getEquipmentOptions();

    const categoryContainer =
        document.getElementById(
            "plan-category-filters"
        );

    const equipmentContainer =
        document.getElementById(
            "plan-equipment-filters"
        );

    categoryContainer.innerHTML = "";
    equipmentContainer.innerHTML = "";

    function createFilterRow(
        container,
        filterName,
        titleText,
        optionsContainerId,
        summaryId
    ) {
        const row =
            document.createElement("div");

        row.classList.add(
            "plan-filter-row"
        );

        const title =
            document.createElement("div");

        title.classList.add(
            "plan-filter-title"
        );

        title.dataset.filter =
            filterName;

        const titleTextElement =
            document.createElement("strong");

        titleTextElement.textContent =
            titleText;

        const arrow =
            document.createElement("span");

        arrow.classList.add(
            "plan-filter-arrow"
        );

        arrow.textContent = "▼";

        title.appendChild(
            titleTextElement
        );

        title.appendChild(arrow);

        const summary =
            document.createElement("div");

        summary.id = summaryId;

        summary.classList.add(
            "plan-filter-summary"
        );

        const options =
            document.createElement("div");

        options.id =
            optionsContainerId;

        options.classList.add(
            "plan-filter-options"
        );

        row.appendChild(title);
        row.appendChild(summary);
        row.appendChild(options);

        container.appendChild(row);

        title.addEventListener(
            "click",
            () => {
                const isOpen =
                    options.classList.contains(
                        "open"
                    );

                const planFiltersBox =
                    document.querySelector(
                        ".plan-filters-box"
                    );

                planFiltersBox
                    .querySelectorAll(
                        ".plan-filter-options.open"
                    )
                    .forEach(
                        otherOptions =>
                            otherOptions.classList.remove(
                                "open"
                            )
                    );

                planFiltersBox
                    .querySelectorAll(
                        ".plan-filter-arrow"
                    )
                    .forEach(
                        otherArrow =>
                            otherArrow.textContent =
                                "▼"
                    );

                if (!isOpen) {
                    options.classList.add(
                        "open"
                    );

                    arrow.textContent =
                        "▲";
                }
            }
        );

        return options;
    }

    const categoryOptions =
        createFilterRow(
            categoryContainer,
            "plan-category",
            "Catégorie",
            "plan-category-filter-options",
            "plan-category-summary"
        );

    const equipmentOptionsContainer =
        createFilterRow(
            equipmentContainer,
            "plan-equipment",
            "Équipements",
            "plan-equipment-filter-options",
            "plan-equipment-summary"
        );

    [
        {
            value: "cali",
            label: "Cali"
        },
        {
            value: "gym",
            label: "Gym"
        }
    ].forEach(category => {
        const button =
            document.createElement("button");

        button.classList.add(
            "filter-button"
        );

        button.textContent =
            category.label;

        button.dataset.category =
            category.value;

        if (
            selectedPlanCategories.has(
                category.value
            )
        ) {
            button.classList.add(
                "active"
            );
        }

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                if (
                    selectedPlanCategories.has(
                        category.value
                    )
                ) {
                    selectedPlanCategories.delete(
                        category.value
                    );

                    button.classList.remove(
                        "active"
                    );
                } else {
                    selectedPlanCategories.add(
                        category.value
                    );

                    button.classList.add(
                        "active"
                    );
                }

                syncPlanFiltersToSearch();
                updatePlanFilterSummaries();
                updatePlanProgressionFilters();
            }
        );

        categoryOptions.appendChild(
            button
        );
    });

    equipmentOptions.forEach(
        equipment => {
            const button =
                document.createElement(
                    "button"
                );

            button.classList.add(
                "filter-button"
            );

            button.textContent =
                equipment;

            button.dataset.equipment =
                equipment;

            if (
                selectedPlanEquipment.has(
                    equipment
                )
            ) {
                button.classList.add(
                    "active"
                );
            }

            button.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    if (
                        selectedPlanEquipment.has(
                            equipment
                        )
                    ) {
                        selectedPlanEquipment.delete(
                            equipment
                        );

                        button.classList.remove(
                            "active"
                        );
                    } else {
                        selectedPlanEquipment.add(
                            equipment
                        );

                        button.classList.add(
                            "active"
                        );
                    }

                    syncPlanFiltersToSearch();
                    updatePlanFilterSummaries();
                    updatePlanProgressionFilters();
                }
            );

            equipmentOptionsContainer.appendChild(
                button
            );
        }
    );

    updatePlanFilterSummaries();
}

// ------------------------------------------------------------
// Synchroniser avec les filtres de recherche
// ------------------------------------------------------------

function syncPlanFiltersToSearch() {
    const selectedPlanCategories =
        getSelectedPlanCategories();

    const selectedPlanEquipment =
        getSelectedPlanEquipment();

    const selectedCategories =
        getSelectedCategories();

    const selectedEquipment =
        getSelectedEquipment();

    selectedCategories.clear();

    selectedPlanCategories.forEach(
        category =>
            selectedCategories.add(
                category
            )
    );

    selectedEquipment.clear();

    selectedPlanEquipment.forEach(
        equipment =>
            selectedEquipment.add(
                equipment
            )
    );

    document
        .querySelectorAll(
            "#category-filters .filter-button"
        )
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
        .querySelectorAll(
            "#equipment-filters .filter-button"
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
                "active",
                selectedEquipment.has(
                    equipment
                )
            );
        });

    updateEquipmentAllButton();
    updateFilterSummaries();

    saveSearchState(
        getPlanSearchState()
    );

    displayExercises();

    if (getCurrentPlan()) {
        renderPlanExercises();
    }
}

// ------------------------------------------------------------
// Résumés
// ------------------------------------------------------------

function updatePlanFilterSummaries() {
    const selectedPlanCategories =
        getSelectedPlanCategories();

    const selectedPlanEquipment =
        getSelectedPlanEquipment();

    const equipmentOptions =
        getEquipmentOptions();

    function createSummaryButton(text) {
        const button =
            document.createElement("span");

        button.classList.add(
            "summary-button"
        );

        const label =
            document.createElement("span");

        label.textContent = text;

        button.appendChild(label);

        return button;
    }

    const categorySummary =
        document.getElementById(
            "plan-category-summary"
        );

    categorySummary.innerHTML = "";

    if (
        selectedPlanCategories.size === 0
    ) {
        categorySummary.appendChild(
            createSummaryButton(
                "Aucun"
            )
        );
    } else {
        if (
            selectedPlanCategories.has(
                "cali"
            )
        ) {
            categorySummary.appendChild(
                createSummaryButton(
                    "Cali"
                )
            );
        }

        if (
            selectedPlanCategories.has(
                "gym"
            )
        ) {
            categorySummary.appendChild(
                createSummaryButton(
                    "Gym"
                )
            );
        }
    }

    const equipmentSummary =
        document.getElementById(
            "plan-equipment-summary"
        );

    equipmentSummary.innerHTML = "";

    if (
        selectedPlanEquipment.size ===
        equipmentOptions.length
    ) {
        equipmentSummary.appendChild(
            createSummaryButton(
                "Tous"
            )
        );
    } else if (
        selectedPlanEquipment.size === 0
    ) {
        equipmentSummary.appendChild(
            createSummaryButton(
                "Aucun"
            )
        );
    } else {
        [
            ...selectedPlanEquipment
        ].forEach(equipment => {
            equipmentSummary.appendChild(
                createSummaryButton(
                    equipment
                )
            );
        });
    }
}

// ------------------------------------------------------------
// Correspondance des filtres
// ------------------------------------------------------------

function exerciseMatchesPlanFilters(
    exercise
) {
    const selectedPlanCategories =
        getSelectedPlanCategories();

    if (
        selectedPlanCategories.size === 0
    ) {
        return false;
    }

    const matchesCategory =
        (
            selectedPlanCategories.has(
                "cali"
            ) &&
            exercise.cali
        ) ||
        (
            selectedPlanCategories.has(
                "gym"
            ) &&
            exercise.gym
        );

    if (!matchesCategory) {
        return false;
    }

    return exerciseMatchesPlanEquipment(
        exercise
    );
}

function exerciseMatchesPlanEquipment(
    exercise
) {
    const selectedPlanEquipment =
        getSelectedPlanEquipment();

    if (
        selectedPlanEquipment.size === 0
    ) {
        return false;
    }

    if (
        !exercise.equipement ||
        exercise.equipement.length === 0
    ) {
        return true;
    }

    return exercise.equipement.every(
        group =>
            group.some(
                equipment =>
                    equipment === "Aucun" ||
                    selectedPlanEquipment.has(
                        equipment
                    )
            )
    );
}

// ------------------------------------------------------------
// Filtres de progression
// ------------------------------------------------------------

function updatePlanProgressionFilters() {
    const currentDetailExercise =
        getCurrentDetailExercise();

    if (
        currentDetailExercise &&
        getCurrentDetailContext() ===
            "plan"
    ) {
        updateProgressionNavigation(
            currentDetailExercise,
            "plan"
        );
    }
}

// ============================================================
// EXPORTS
// ============================================================

export {
    configurePlanFilters,
    createPlanFilterRows,
    syncPlanFiltersToSearch,
    updatePlanFilterSummaries,
    exerciseMatchesPlanFilters,
    exerciseMatchesPlanEquipment,
    updatePlanProgressionFilters
};