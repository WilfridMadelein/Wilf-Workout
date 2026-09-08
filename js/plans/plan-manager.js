// ============================================================
// GESTION DES EXERCICES DU PLAN
// ============================================================

import { isIsometricExercise } from "../exercises/exercise-search.js";

import {
    getNextCombinationGroup,
    normalizeCombinationNumbers
} from "./plan-combinations.js";

let getCurrentPlan = () => null;
let renderPlanExercises = () => {};
let closePlanInstructionsPopup = () => {};

function configurePlanManager(dependencies) {
    getCurrentPlan = dependencies.getCurrentPlan;
    renderPlanExercises = dependencies.renderPlanExercises;
    closePlanInstructionsPopup =
        dependencies.closePlanInstructionsPopup;
}

// ------------------------------------------------------------
// Ajouter un exercice au plan
// ------------------------------------------------------------

function addExerciseToCurrentPlan(exercise) {
    const currentPlan = getCurrentPlan();

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

        valueUnit: isIso
            ? "sec"
            : "rep",

        rest: currentPlan.defaults.rest,

        tempo: {
            first: currentPlan.defaults.tempo.first,
            second: currentPlan.defaults.tempo.second,
            third: currentPlan.defaults.tempo.third,
            fourth: currentPlan.defaults.tempo.fourth
        },

        weight: 0,
        weightUnit: "lbs",

        combination: {
            group: getNextCombinationGroup()
        }
    });

    renderPlanExercises();
}

// ------------------------------------------------------------
// Supprimer un exercice du plan
// ------------------------------------------------------------

function removeExerciseFromCurrentPlan(planExercise) {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return;
    }

    const index =
        currentPlan.exercises.indexOf(planExercise);

    if (index === -1) {
        return;
    }

    closePlanInstructionsPopup();

    currentPlan.exercises.splice(index, 1);

    normalizeCombinationNumbers();
    renderPlanExercises();
}

// ------------------------------------------------------------
// Changer la progression d'un exercice
// ------------------------------------------------------------

function updatePlanExerciseProgression(
    planExercise,
    newExercise
) {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return;
    }

    const oldExercise =
        planExercise.exercise;

    const oldIsIso =
        isIsometricExercise(oldExercise);

    const newIsIso =
        isIsometricExercise(newExercise);

    closePlanInstructionsPopup();

    planExercise.exercise =
        newExercise;

    if (!planExercise.details) {
        planExercise.details = {};
    }

    planExercise.details.instructions = null;

    // Passage exercice normal → isométrique
    if (!oldIsIso && newIsIso) {
        planExercise.value =
            currentPlan.defaults.time;

        planExercise.valueUnit =
            "sec";
    }

    // Passage isométrique → exercice normal
    if (oldIsIso && !newIsIso) {
        planExercise.value =
            currentPlan.defaults.reps;

        planExercise.valueUnit =
            "rep";
    }

    renderPlanExercises();
}


// ============================================================
// EXPORTS
// ============================================================

export {
    configurePlanManager,
    addExerciseToCurrentPlan,
    removeExerciseFromCurrentPlan,
    updatePlanExerciseProgression,
};