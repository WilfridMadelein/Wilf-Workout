// ============================================================
// AFFICHAGE DES EXERCICES
// ============================================================

// ------------------------------------------------------------
// DÉPENDANCES
// ------------------------------------------------------------

let getExercises = () => [];
let getSelectedPlanCategories = () => new Set();
let getSelectedPlanEquipment = () => new Set();

let getProgressionName = () => "";
let exerciseMatchesCategories = () => false;
let exerciseMatchesCategoryFilter = () => false;
let exerciseMatchesEquipmentFilter = () => false;

let displayExerciseDetails = () => {};

const progressionFamilyHistory = new Map();

function configureExerciseDisplay(dependencies) {
    getExercises = dependencies.getExercises;

    getSelectedPlanCategories =
        dependencies.getSelectedPlanCategories;

    getSelectedPlanEquipment =
        dependencies.getSelectedPlanEquipment;

    getProgressionName =
        dependencies.getProgressionName;

    exerciseMatchesCategories =
        dependencies.exerciseMatchesCategories;

    exerciseMatchesCategoryFilter =
        dependencies.exerciseMatchesCategoryFilter;

    exerciseMatchesEquipmentFilter =
        dependencies.exerciseMatchesEquipmentFilter;

    displayExerciseDetails =
        dependencies.displayExerciseDetails;
}

// ------------------------------------------------------------
// Contexte de progression
// ------------------------------------------------------------

function exerciseMatchesProgressionContext(exercise) {
    return (
        exerciseMatchesCategoryFilter(exercise) &&
        exerciseMatchesEquipmentFilter(exercise)
    );
}

// ------------------------------------------------------------
// Navigation dans une progression
// ------------------------------------------------------------

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

    const compatibleExercises =
        getExercises()
            .filter(exercise =>
                getProgressionName(exercise) ===
                progression
            )
            .filter(exercise =>
                exerciseMatchesProgressionContext(
                    exercise
                )
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

// ------------------------------------------------------------
// Progression — plan
// ------------------------------------------------------------

function exerciseMatchesPlanProgressionFilter(
    exercise
) {
    const selectedPlanCategories =
        getSelectedPlanCategories();

    if (
        !exerciseMatchesCategories(
            exercise,
            selectedPlanCategories
        )
    ) {
        return false;
    }

    return exerciseHasRequiredEquipmentForPlan(
        exercise
    );
}

function exerciseHasRequiredEquipmentForPlan(
    exercise
) {
    const selectedPlanEquipment =
        getSelectedPlanEquipment();

    return exercise.equipement.every(
        equipmentGroup => {
            return equipmentGroup.some(
                equipment => {
                    if (equipment === "Aucun") {
                        return true;
                    }

                    return selectedPlanEquipment.has(
                        equipment
                    );
                }
            );
        }
    );
}

function getPlanProgressionNeighbor(
    exercise,
    direction
) {
    const progression =
        getProgressionName(exercise);

    const currentOrder =
        Number(exercise.prog_ordre);

    if (
        !progression ||
        Number.isNaN(currentOrder)
    ) {
        return null;
    }

    const progressionExercises =
        getExercises()
            .filter(item =>
                getProgressionName(item) ===
                progression
            )
            .filter(item =>
                exerciseMatchesPlanProgressionFilter(
                    item
                )
            )
            .filter(item =>
                !Number.isNaN(
                    Number(item.prog_ordre)
                )
            )
            .sort((a, b) =>
                Number(a.prog_ordre) -
                Number(b.prog_ordre)
            );

    if (direction === 1) {
        return progressionExercises.find(
            item =>
                Number(item.prog_ordre) >
                currentOrder
        ) || null;
    }

    if (direction === -1) {
        const previousExercises =
            progressionExercises.filter(
                item =>
                    Number(item.prog_ordre) <
                    currentOrder
            );

        return (
            previousExercises[
                previousExercises.length - 1
            ] || null
        );
    }

    return null;
}

// ------------------------------------------------------------
// Navigation entre progressions d'une même famille
// ------------------------------------------------------------

function getProgressionFamily(exercise) {
    return String(exercise?.prog_family || "").trim();
}

function getProgressionFamilyMemoryKey(exercise) {
    const family = getProgressionFamily(exercise);
    const progression = getProgressionName(exercise);
    return family && progression ? `${family}\u0000${progression}` : "";
}

function rememberProgressionFamilyExercise(exercise) {
    const key = getProgressionFamilyMemoryKey(exercise);
    if (!key) return;

    progressionFamilyHistory.set(key, {
        exerciseId: exercise?.ID ?? null,
        order: Number(exercise?.prog_ordre)
    });
}

function getFamilyProgressions(currentExercise, context = "search") {
    if (context !== "search") return [];

    const family = getProgressionFamily(currentExercise);
    if (!family) return [];

    const grouped = new Map();

    getExercises()
        .filter(exercise => getProgressionFamily(exercise) === family)
        .forEach(exercise => {
            const progression = getProgressionName(exercise);
            const order = Number(exercise?.prog_ordre);
            if (!progression || Number.isNaN(order)) return;

            if (!grouped.has(progression)) grouped.set(progression, []);
            grouped.get(progression).push(exercise);
        });

    return [...grouped.entries()]
        .map(([progression, exercises]) => ({
            progression,
            exercises: exercises.sort((first, second) => Number(first.prog_ordre) - Number(second.prog_ordre))
        }))
        .sort((first, second) => first.progression.localeCompare(second.progression, "fr", { sensitivity: "base" }));
}

function getClosestFamilyProgressionExercise(exercises, desiredOrder, memoryKey) {
    const remembered = progressionFamilyHistory.get(memoryKey);

    if (remembered) {
        const rememberedExercise = exercises.find(exercise =>
            remembered.exerciseId !== null && exercise?.ID === remembered.exerciseId
        );
        if (rememberedExercise) return rememberedExercise;

        const rememberedOrder = Number(remembered.order);
        if (Number.isFinite(rememberedOrder)) {
            const sameRememberedOrder = exercises.find(exercise => Number(exercise.prog_ordre) === rememberedOrder);
            if (sameRememberedOrder) return sameRememberedOrder;
        }
    }

    const sameOrder = exercises.find(exercise => Number(exercise.prog_ordre) === desiredOrder);
    if (sameOrder) return sameOrder;

    return [...exercises].sort((first, second) => {
        const firstOrder = Number(first.prog_ordre);
        const secondOrder = Number(second.prog_ordre);
        const distanceDifference = Math.abs(firstOrder - desiredOrder) - Math.abs(secondOrder - desiredOrder);
        return distanceDifference || firstOrder - secondOrder;
    })[0] || null;
}

function getProgressionFamilyNeighbor(currentExercise, direction, context = "search") {
    if (direction !== -1 && direction !== 1) return null;

    const progressions = getFamilyProgressions(currentExercise, context);
    if (progressions.length < 2) return null;

    const currentProgression = getProgressionName(currentExercise);
    const currentIndex = progressions.findIndex(item => item.progression === currentProgression);
    if (currentIndex < 0) return null;

    const targetIndex = (currentIndex + direction + progressions.length) % progressions.length;
    const target = progressions[targetIndex];
    const desiredOrder = Number(currentExercise?.prog_ordre);
    const memoryKey = `${getProgressionFamily(currentExercise)}\u0000${target.progression}`;

    return getClosestFamilyProgressionExercise(
        target.exercises,
        Number.isFinite(desiredOrder) ? desiredOrder : 0,
        memoryKey
    );
}

function updateProgressionFamilyNavigation(currentExercise, context = "search") {
    const previousButton = document.getElementById("progression-family-previous-button");
    const nextButton = document.getElementById("progression-family-next-button");
    if (!previousButton || !nextButton) return;

    const hideNavigation = (hidden = true) => {
        previousButton.hidden = hidden;
        nextButton.hidden = hidden;
        previousButton.disabled = true;
        nextButton.disabled = true;
        previousButton.onclick = null;
        nextButton.onclick = null;
    };

    if (context !== "search" || !getProgressionFamily(currentExercise)) {
        hideNavigation();
        return;
    }

    rememberProgressionFamilyExercise(currentExercise);

    const previousExercise = getProgressionFamilyNeighbor(currentExercise, -1, "search");
    const nextExercise = getProgressionFamilyNeighbor(currentExercise, 1, "search");
    if (!previousExercise || !nextExercise) {
        hideNavigation(false);
        return;
    }

    previousButton.hidden = false;
    nextButton.hidden = false;
    previousButton.disabled = false;
    nextButton.disabled = false;

    previousButton.onclick = () => displayExerciseDetails(previousExercise, "search");
    nextButton.onclick = () => displayExerciseDetails(nextExercise, "search");
}

// ------------------------------------------------------------
// Navigation visuelle de progression
// ------------------------------------------------------------

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

    updateProgressionFamilyNavigation(currentExercise, context);
}

// ============================================================
// EXPORTS
// ============================================================

export {
    configureExerciseDisplay,

    exerciseMatchesProgressionContext,
    getProgressionNeighbor,

    exerciseMatchesPlanProgressionFilter,
    exerciseHasRequiredEquipmentForPlan,
    getPlanProgressionNeighbor,

    getProgressionFamily,
    getFamilyProgressions,
    getProgressionFamilyNeighbor,
    updateProgressionFamilyNavigation,
    updateProgressionNavigation
};
