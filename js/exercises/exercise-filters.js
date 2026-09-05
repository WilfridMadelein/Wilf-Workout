// ============================================================
// FILTRES DES EXERCICES
// ============================================================

// ------------------------------------------------------------
// Catégories
// ------------------------------------------------------------

function exerciseMatchesCategoryFilter(exercise) {
    if (selectedCategories.size === 0) {
        return false;
    }

    const matchesCali =
        selectedCategories.has("cali") &&
        exercise.cali;

    const matchesGym =
        selectedCategories.has("gym") &&
        exercise.gym;

    return matchesCali || matchesGym;
}

function updateCategoryButtons() {
    const caliButton = document.querySelector(
        '[data-category="cali"]'
    );

    const gymButton = document.querySelector(
        '[data-category="gym"]'
    );

    if (caliButton) {
        caliButton.classList.toggle(
            "active",
            selectedCategories.has("cali")
        );
    }

    if (gymButton) {
        gymButton.classList.toggle(
            "active",
            selectedCategories.has("gym")
        );
    }
}

function createCategoryButtons() {
    const container =
        document.getElementById("category-filters");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const categories = [
        {
            id: "cali",
            label: "Cali"
        },
        {
            id: "gym",
            label: "Gym"
        }
    ];

    categories.forEach(category => {
        const button =
            document.createElement("button");

        button.classList.add("filter-button");
        button.dataset.category = category.id;
        button.textContent = category.label;

        button.classList.toggle(
            "active",
            selectedCategories.has(category.id)
        );

        button.addEventListener("click", () => {
            if (
                selectedCategories.has(
                    category.id
                )
            ) {
                selectedCategories.delete(
                    category.id
                );
            } else {
                selectedCategories.add(
                    category.id
                );
            }

            updateCategoryButtons();
            updateFilterSummaries();
            displayExercises();
        });

        container.appendChild(button);
    });
}

// ------------------------------------------------------------
// Équipements
// ------------------------------------------------------------

function exerciseHasRequiredEquipment(exercise) {
    if (
        !exercise.equipement ||
        exercise.equipement.length === 0
    ) {
        return true;
    }

    return exercise.equipement.every(
        equipmentGroup =>
            equipmentGroup.some(equipment => {

                if (equipment === "Aucun") {
                    return true;
                }

                return selectedEquipment.has(
                    equipment
                );
            })
    );
}

function exerciseMatchesEquipmentFilter(exercise) {
    if (selectedEquipment.size === 0) {
        return false;
    }

    return exerciseHasRequiredEquipment(
        exercise
    );
}

function updateEquipmentAllButton() {
    const allButton =
        document.querySelector(
            '[data-equipment="all"]'
        );

    if (!allButton) {
        return;
    }

    allButton.classList.toggle(
        "active",
        selectedEquipment.size ===
        equipmentOptions.length
    );
}

function createEquipmentButtons() {
    const container =
        document.getElementById(
            "equipment-filters"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const allButton =
        document.createElement("button");

    allButton.classList.add(
        "filter-button"
    );

    allButton.dataset.equipment = "all";
    allButton.textContent = "Tous";

    allButton.addEventListener("click", () => {
        if (
            selectedEquipment.size ===
            equipmentOptions.length
        ) {
            selectedEquipment.clear();
        } else {
            selectedEquipment.clear();

            equipmentOptions.forEach(
                equipment =>
                    selectedEquipment.add(
                        equipment
                    )
            );
        }

        createEquipmentButtons();
        updateFilterSummaries();
        displayExercises();
    });

    container.appendChild(allButton);

    equipmentOptions.forEach(equipment => {
        const button =
            document.createElement("button");

        button.classList.add(
            "filter-button"
        );

        button.dataset.equipment = equipment;
        button.textContent = equipment;

        button.classList.toggle(
            "active",
            selectedEquipment.has(equipment)
        );

        button.addEventListener("click", () => {
            if (
                selectedEquipment.has(
                    equipment
                )
            ) {
                selectedEquipment.delete(
                    equipment
                );
            } else {
                selectedEquipment.add(
                    equipment
                );
            }

            updateEquipmentAllButton();
            updateFilterSummaries();
            displayExercises();
        });

        container.appendChild(button);
    });

    updateEquipmentAllButton();
}

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

function createTypeButtons() {
    const container =
        document.getElementById(
            "type-filters"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const types = [
        ...new Set(
            exercises
                .map(exercise => exercise.type)
                .filter(Boolean)
        )
    ].sort();

    types.forEach(type => {
        const button =
            document.createElement("button");

        button.classList.add(
            "filter-button"
        );

        button.textContent = type;

        button.classList.toggle(
            "active",
            selectedTypes.has(type)
        );

        button.addEventListener("click", () => {
            if (selectedTypes.has(type)) {
                selectedTypes.delete(type);
            } else {
                selectedTypes.add(type);
            }

            updateFilterSummaries();
            displayExercises();
        });

        container.appendChild(button);
    });
}

// ------------------------------------------------------------
// Progressions
// ------------------------------------------------------------

function getProgressionOptions() {
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

function createProgressionOptions() {
    const includeContainer =
        document.getElementById(
            "progression-include-options"
        );

    const excludeContainer =
        document.getElementById(
            "progression-exclude-options"
        );

    if (
        !includeContainer ||
        !excludeContainer
    ) {
        return;
    }

    includeContainer.innerHTML = "";
    excludeContainer.innerHTML = "";

    const progressions =
        getProgressionOptions();

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
    const button =
        document.createElement("button");

    button.classList.add(
        "filter-button"
    );

    button.textContent = progression;

    button.classList.toggle(
        "active",
        selectedSet.has(progression)
    );

    button.addEventListener("click", () => {
        if (selectedSet.has(progression)) {
            selectedSet.delete(progression);
        } else {
            oppositeSet.delete(progression);
            selectedSet.add(progression);
        }

        updateProgressionButtons();
        updateFilterSummaries();
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
            const progression =
                button.textContent;

            button.classList.toggle(
                "active",
                selectedProgressionsInclude.has(
                    progression
                )
            );
        });

    document
        .querySelectorAll(
            "#progression-exclude-options .filter-button"
        )
        .forEach(button => {
            const progression =
                button.textContent;

            button.classList.toggle(
                "active",
                selectedProgressionsExclude.has(
                    progression
                )
            );
        });
}

function exerciseMatchesProgression(exercise) {
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

// ------------------------------------------------------------
// Muscles
// ------------------------------------------------------------

function createMuscleButtons() {
    const allButton =
        document.createElement("button");

    allButton.classList.add(
        "filter-button",
        "active"
    );

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
                button.classList.remove(
                    "active"
                )
            );

        allButton.classList.add("active");

        submuscleFilters.innerHTML = "";

        displayExercises();
    });

    muscleFilters.appendChild(
        allButton
    );

    muscleFamilies.forEach(family => {
        const button =
            document.createElement("button");

        button.classList.add(
            "filter-button"
        );

        button.textContent = family;
        button.dataset.muscle = family;

        button.addEventListener("click", () => {
            if (
                selectedMuscleFamilies.has(
                    family
                )
            ) {
                selectedMuscleFamilies.delete(
                    family
                );

                selectedSubmuscles.delete(
                    family
                );

                button.classList.remove(
                    "active"
                );

                removeSubmuscleContainer(
                    family
                );
            } else {
                selectedMuscleFamilies.add(
                    family
                );

                button.classList.add(
                    "active"
                );

                createSubmuscleButtons(
                    family
                );
            }

            updateMuscleSpecialButtons();
            displayExercises();
        });

        muscleFilters.appendChild(
            button
        );
    });
}

function updateMuscleSpecialButtons() {
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
                submuscles.add(
                    muscle[1]
                );
            }
        });
    });

    if (submuscles.size === 0) {
        return;
    }

    if (
        !selectedSubmuscles.has(family)
    ) {
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

                if (
                    checkbox.checked
                ) {
                    selected.add(
                        submuscle
                    );
                } else {
                    selected.delete(
                        submuscle
                    );
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

    submuscleFilters.appendChild(
        container
    );
}

function removeSubmuscleContainer(family) {
    const container =
        submuscleFilters.querySelector(
            `[data-family="${CSS.escape(family)}"]`
        );

    if (container) {
        container.remove();
    }
}

function exerciseMatchesMuscle(exercise) {
    if (
        selectedMuscleFamilies.size === 0
    ) {
        return true;
    }

    const allMuscles = [
        ...(exercise.muscles_principaux || []),
        ...(exercise.muscles_secondaires || [])
    ];

    return [
        ...selectedMuscleFamilies
    ].every(family => {
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
    });
}

// ============================================================
// EXPORTS
// ============================================================

export {
    exerciseMatchesCategoryFilter,
    updateCategoryButtons,
    createCategoryButtons,
    exerciseHasRequiredEquipment,
    exerciseMatchesEquipmentFilter,
    updateEquipmentAllButton,
    createEquipmentButtons,
    createTypeButtons,
    getProgressionOptions,
    createProgressionOptions,
    createProgressionButton,
    updateProgressionButtons,
    exerciseMatchesProgression,
    createMuscleButtons,
    updateMuscleSpecialButtons,
    createSubmuscleButtons,
    removeSubmuscleContainer,
    exerciseMatchesMuscle
};