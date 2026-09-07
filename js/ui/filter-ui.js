let getSelectedCategories;
let getSelectedTypes;
let getSelectedEquipment;
let getSelectedMuscleFamilies;
let getSelectedSubmuscles;
let getSelectedProgressionsInclude;
let getSelectedProgressionsExclude;
let getSubmuscleFilters;

let createSubmuscleButtons;
let updateEquipmentAllButton;
let updateProgressionButtons;
let displayExercises;

export function configureFilterUI(dependencies) {
    ({
        getSelectedCategories,
        getSelectedTypes,
        getSelectedEquipment,
        getSelectedMuscleFamilies,
        getSelectedSubmuscles,
        getSelectedProgressionsInclude,
        getSelectedProgressionsExclude,
        getSubmuscleFilters,
        createSubmuscleButtons,
        updateEquipmentAllButton,
        updateProgressionButtons,
        displayExercises
    } = dependencies);
}

export function rebuildSearchFilterInterface() {
    const selectedCategories = getSelectedCategories();
    const selectedTypes = getSelectedTypes();
    const selectedEquipment = getSelectedEquipment();
    const selectedMuscleFamilies = getSelectedMuscleFamilies();
    const selectedSubmuscles = getSelectedSubmuscles();
    const submuscleFilters = getSubmuscleFilters();

    // Catégories
    document
        .querySelectorAll("#category-filters .filter-button")
        .forEach(button => {
            if (button.dataset.category) {
                button.classList.toggle(
                    "active",
                    selectedCategories.has(button.dataset.category)
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

export function setupFilterRows() {
    const filterTitles =
        document.querySelectorAll(".filter-title");

    filterTitles.forEach(title => {
        title.addEventListener("click", () => {
            const filterName = title.dataset.filter;

            const options = document.getElementById(
                `${filterName}-filter-options`
            );

            const arrow =
                title.querySelector(".filter-arrow");

            if (!options) {
                return;
            }

            const isOpen =
                options.classList.contains("open");

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

export function updateFilterSummaries() {
    const selectedCategories = getSelectedCategories();
    const selectedTypes = getSelectedTypes();
    const selectedEquipment = getSelectedEquipment();
    const selectedMuscleFamilies =
        getSelectedMuscleFamilies();
    const selectedProgressionsInclude =
        getSelectedProgressionsInclude();
    const selectedProgressionsExclude =
        getSelectedProgressionsExclude();

    function createSummaryButton(
        text,
        removeFunction = null
    ) {
        const button = document.createElement("span");
        button.classList.add("summary-button");

        const label = document.createElement("span");
        label.textContent = text;
        button.appendChild(label);

        if (removeFunction) {
            const remove =
                document.createElement("button");

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
    const categorySummary =
        document.getElementById("category-summary");

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
    const typeSummary =
        document.getElementById("type-summary");

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
    const muscleSummary =
        document.getElementById("muscle-summary");

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
    const equipmentSummary =
        document.getElementById("equipment-summary");

    equipmentSummary.innerHTML = "";

    const equipmentOptions =
        document.querySelectorAll(
            "#equipment-filters .filter-button"
        );

    const equipmentCount =
        [...equipmentOptions].filter(button => {
            const equipment =
                button.dataset.equipment;

            return (
                equipment &&
                equipment !== "all" &&
                equipment !== "none"
            );
        }).length;

    if (selectedEquipment.size === equipmentCount) {
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
    const progressionIncludeSummary =
        document.getElementById(
            "progression-include-summary"
        );

    const progressionExcludeSummary =
        document.getElementById(
            "progression-exclude-summary"
        );

    progressionIncludeSummary.innerHTML = "";
    progressionExcludeSummary.innerHTML = "";

    selectedProgressionsInclude.forEach(
        progression => {
            progressionIncludeSummary.appendChild(
                createSummaryButton(progression, () => {
                    selectedProgressionsInclude.delete(
                        progression
                    );

                    updateProgressionButtons();
                    displayExercises();
                })
            );
        }
    );

    selectedProgressionsExclude.forEach(
        progression => {
            progressionExcludeSummary.appendChild(
                createSummaryButton(progression, () => {
                    selectedProgressionsExclude.delete(
                        progression
                    );

                    updateProgressionButtons();
                    displayExercises();
                })
            );
        }
    );
}

