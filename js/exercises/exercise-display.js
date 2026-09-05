// ============================================================
// AFFICHAGE DES EXERCICES
// ============================================================

function exerciseMatchesProgressionContext(exercise) {
    return (
        exerciseMatchesCategoryFilter(exercise) &&
        exerciseMatchesEquipmentFilter(exercise)
    );
}

// ------------------------------------------------------------
// Navigation dans une progression
// ------------------------------------------------------------

function getProgressionNeighbor(currentExercise, direction, context = "search") {
    const progression = getProgressionName(currentExercise);
    const currentOrder = Number(currentExercise.prog_ordre);

    if (!progression || Number.isNaN(currentOrder)) {
        return null;
    }

    const compatibleExercises = exercises
        .filter(exercise => getProgressionName(exercise) === progression)
        .filter(exercise => exerciseMatchesProgressionContext(exercise))
        .filter(exercise => {
            const order = Number(exercise.prog_ordre);
            return !Number.isNaN(order);
        });

    if (direction === 1) {
        return compatibleExercises
            .filter(exercise => Number(exercise.prog_ordre) > currentOrder)
            .sort((a, b) => Number(a.prog_ordre) - Number(b.prog_ordre))[0] || null;
    }

    if (direction === -1) {
        return compatibleExercises
            .filter(exercise => Number(exercise.prog_ordre) < currentOrder)
            .sort((a, b) => Number(b.prog_ordre) - Number(a.prog_ordre))[0] || null;
    }

    return null;
}

// ------------------------------------------------------------
// Progression — plan
// ------------------------------------------------------------

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
    return exercise.equipement.every(equipmentGroup =>
        equipmentGroup.some(equipment => {
            if (equipment === "Aucun") {
                return true;
            }

            return selectedPlanEquipment.has(equipment);
        })
    );
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
        .sort((a, b) => Number(a.prog_ordre) - Number(b.prog_ordre));

    if (direction === 1) {
        return progressionExercises.find(
            item => Number(item.prog_ordre) > currentOrder
        ) || null;
    }

    if (direction === -1) {
        const previousExercises = progressionExercises.filter(
            item => Number(item.prog_ordre) < currentOrder
        );

        return previousExercises[previousExercises.length - 1] || null;
    }

    return null;
}

// ------------------------------------------------------------
// Navigation visuelle de progression
// ------------------------------------------------------------

function updateProgressionNavigation(currentExercise, context = "search") {
    const upButton = document.getElementById("progression-up-button");
    const downButton = document.getElementById("progression-down-button");

    if (!upButton || !downButton) {
        return;
    }

    const nextExercise = getProgressionNeighbor(
        currentExercise,
        1,
        context
    );

    const previousExercise = getProgressionNeighbor(
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

// ============================================================
// EXPORTS
// ============================================================

export {
    exerciseMatchesProgressionContext,
    getProgressionNeighbor,
    exerciseMatchesPlanProgressionFilter,
    exerciseHasRequiredEquipmentForPlan,
    getPlanProgressionNeighbor,
    updateProgressionNavigation
};