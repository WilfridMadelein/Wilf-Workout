// ============================================================
// DÉTAILS DES EXERCICES
// ============================================================

// ------------------------------------------------------------
// DÉPENDANCES
// ------------------------------------------------------------

let getProgressionDisplay = () => "";
let updateProgressionNavigation = () => {};

let getSelectedPlanEquipment = () => new Set();

let addExerciseToCurrentPlan = () => {};

let getPagePlans = () => null;
let getPlanEditor = () => null;

let getCurrentDetailContext = () => "search";
let setCurrentDetailExercise = () => {};
let setCurrentDetailContext = () => {};

function configureExerciseDetails(dependencies) {
    getProgressionDisplay =
        dependencies.getProgressionDisplay;

    updateProgressionNavigation =
        dependencies.updateProgressionNavigation;

    getSelectedPlanEquipment =
        dependencies.getSelectedPlanEquipment;

    addExerciseToCurrentPlan =
        dependencies.addExerciseToCurrentPlan;

    getPagePlans =
        dependencies.getPagePlans;

    getPlanEditor =
        dependencies.getPlanEditor;

    getCurrentDetailContext =
        dependencies.getCurrentDetailContext;

    setCurrentDetailExercise =
        dependencies.setCurrentDetailExercise;

    setCurrentDetailContext =
        dependencies.setCurrentDetailContext;
}

// ------------------------------------------------------------
// Bouton Ajouter
// ------------------------------------------------------------

function removeAddButton() {
    const addButton =
        document.getElementById(
            "add-exercise-to-plan-button"
        );

    if (addButton) {
        addButton.remove();
    }
}

// ------------------------------------------------------------
// Affichage des détails
// ------------------------------------------------------------

function displayExerciseDetails(
    exercise,
    context = "search"
) {
    const nameElement =
        document.getElementById(
            "details-exercise-name"
        );

    const infoElement =
        document.getElementById(
            "details-exercise-info"
        );

    const header =
        document.querySelector(
            ".exercise-detail-header"
        );

    if (
        !nameElement ||
        !infoElement ||
        !header
    ) {
        return;
    }

    const pagePlans =
        getPagePlans();

    const planEditor =
        getPlanEditor();

    const isReallyInPlan =
        pagePlans &&
        planEditor &&
        pagePlans.style.display === "block" &&
        planEditor.style.display === "block";

    if (!isReallyInPlan) {
        context = "search";
    }

    setCurrentDetailExercise(exercise);
    setCurrentDetailContext(context);

    removeAddButton();

    if (context === "plan") {
        const addButton =
            document.createElement("button");

        addButton.id =
            "add-exercise-to-plan-button";

        addButton.textContent =
            "Ajouter";

        addButton.addEventListener(
            "click",
            () => {
                const currentContext =
                    getCurrentDetailContext();

                const currentPagePlans =
                    getPagePlans();

                const currentPlanEditor =
                    getPlanEditor();

                if (
                    currentContext !== "plan" ||
                    !currentPagePlans ||
                    !currentPlanEditor ||
                    currentPagePlans.style.display !== "block" ||
                    currentPlanEditor.style.display !== "block"
                ) {
                    return;
                }

                addExerciseToCurrentPlan(
                    exercise
                );
            }
        );

        header.appendChild(addButton);
    }

    nameElement.textContent =
        exercise.nom;

    infoElement.innerHTML = `
        <p>
            <strong>Progression :</strong>
            ${getProgressionDisplay(exercise) || "—"}
        </p>

        <p>
            <strong>Muscles principaux :</strong><br>
            ${exercise.muscles_principaux
                .map(
                    muscle =>
                        `${muscle[0]} — ${muscle[1]}`
                )
                .join("<br>")}
        </p>

        <p>
            <strong>Muscles secondaires :</strong><br>
            ${exercise.muscles_secondaires
                .map(
                    muscle =>
                        `${muscle[0]} — ${muscle[1]}`
                )
                .join("<br>")}
        </p>

        <p>
            <strong>Type :</strong>
            ${exercise.type}
        </p>

        <p>
            <strong>Catégorie :</strong>
            ${exercise.catégorie?.join(", ") || "—"}
        </p>

        ${getExerciseDetailsLines(exercise)
            .map(line => `<p>${line}</p>`)
            .join("")}
    `;

    updateProgressionNavigation(
        exercise,
        context
    );
}

// ------------------------------------------------------------
// Détails généraux d'un exercice
// ------------------------------------------------------------

function getExerciseDetailsLines(exercise) {
    const lines = [];

    const gripValues = [
        "Neutre",
        "Pronation",
        "Supination"
    ];

    const footPositionValues = [
        "Intérieur",
        "Avant",
        "Extérieur"
    ];

    if (exercise.pronation) {
        const values =
            Array.isArray(exercise.pronation)
                ? exercise.pronation
                : [exercise.pronation];

        const grips =
            values.filter(value =>
                gripValues.includes(value)
            );

        const footPositions =
            values.filter(value =>
                footPositionValues.includes(value)
            );

        if (grips.length > 0) {
            lines.push(
                `Grip : ${grips.join(" / ")}`
            );
        }

        if (footPositions.length > 0) {
            lines.push(
                `Position des pieds : ${footPositions.join(" / ")}`
            );
        }
    }

    if (
        exercise.equipement &&
        exercise.equipement.length > 0
    ) {
        const equipmentGroups =
            exercise.equipement
                .map(group =>
                    group.join(" ou ")
                )
                .join(" + ");

        lines.push(
            `Équipement : ${equipmentGroups}`
        );
    }

    return lines;
}

// ------------------------------------------------------------
// Détails d'un exercice dans un plan
// ------------------------------------------------------------

function getPlanExerciseDetailsLines(exercise) {
    const lines = [];

    const gripValues = [
        "Neutre",
        "Pronation",
        "Supination"
    ];

    const footPositionValues = [
        "Intérieur",
        "Avant",
        "Extérieur"
    ];

    if (exercise.pronation) {
        const values =
            Array.isArray(exercise.pronation)
                ? exercise.pronation
                : [exercise.pronation];

        const grips =
            values.filter(value =>
                gripValues.includes(value)
            );

        const footPositions =
            values.filter(value =>
                footPositionValues.includes(value)
            );

        if (grips.length > 0) {
            lines.push(
                `Grip : ${grips.join(" / ")}`
            );
        }

        if (footPositions.length > 0) {
            lines.push(
                `Position des pieds : ${footPositions.join(" / ")}`
            );
        }
    }

    if (
        exercise.equipement &&
        exercise.equipement.length > 0
    ) {
        const equipmentGroups =
            exercise.equipement
                .map(group => {
                    const availableEquipment =
                        group.filter(equipment => {
                            if (equipment === "Aucun") {
                                return true;
                            }

                            return getSelectedPlanEquipment()
                                .has(equipment);
                        });

                    return availableEquipment;
                })
                .filter(group =>
                    group.length > 0
                );

        if (equipmentGroups.length > 0) {
            const equipmentText =
                equipmentGroups
                    .map(group =>
                        group.join(" OU ")
                    )
                    .join(" ET ");

            lines.push(
                `Équipement : ${equipmentText}`
            );
        }
    }

    return lines;
}

// ------------------------------------------------------------
// Popup d'instructions du plan
// ------------------------------------------------------------

function closePlanInstructionsPopup(
    save = true
) {
    const popup =
        document.querySelector(
            ".plan-instructions-popup"
        );

    if (!popup) {
        return;
    }

    if (
        save &&
        popup._saveInstructions
    ) {
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

// ============================================================
// EXPORTS
// ============================================================

export {
    configureExerciseDetails,

    removeAddButton,
    displayExerciseDetails,

    getExerciseDetailsLines,
    getPlanExerciseDetailsLines,

    closePlanInstructionsPopup
};