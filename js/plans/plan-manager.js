// ============================================================
// GESTION DU PLAN
// ============================================================

// ------------------------------------------------------------
// Ajouter / supprimer
// ------------------------------------------------------------

function addExerciseToCurrentPlan(exercise) {
    if (!currentPlan) {
        return;
    }

    const isIso = isIsometricExercise(exercise);

    currentPlan.exercises.push({
        exercise,
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

    normalizeCombinationNumbers();
    renderPlanExercises();
}

// ------------------------------------------------------------
// Progression
// ------------------------------------------------------------

function updatePlanExerciseProgression(
    planExercise,
    newExercise
) {
    if (!currentPlan) {
        return;
    }

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
        planExercise.value =
            currentPlan.defaults.time;

        planExercise.valueUnit = "sec";
    }

    if (oldIsIso && !newIsIso) {
        planExercise.value =
            currentPlan.defaults.reps;

        planExercise.valueUnit = "rep";
    }

    renderPlanExercises();
}

// ------------------------------------------------------------
// Déplacement d'un exercice
// ------------------------------------------------------------

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

    [
        exercises[index],
        exercises[newIndex]
    ] = [
        exercises[newIndex],
        exercises[index]
    ];

    normalizeCombinationNumbers();
    renderPlanExercises();
}

// ============================================================
// EXPORTS
// ============================================================

export {
    addExerciseToCurrentPlan,
    removeExerciseFromCurrentPlan,
    updatePlanExerciseProgression,
    movePlanExercise
};