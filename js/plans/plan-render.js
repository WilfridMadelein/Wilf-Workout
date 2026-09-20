import {
    setupNumberInput
} from "../ui/ui.js";

import {
    renderExerciseMuscleMap,
    destroyExerciseMuscleMapsIn
} from "../exercises/exercise-muscle-map.js";

// ============================================================
// DÉPENDANCES
// ============================================================

let getCurrentPlan = () => null;
let getPlanExerciseList = () => null;
let normalizeCombinationNumbers = () => {};
let displayExerciseDetails = () => {};
let getProgressionName = () => "";
let getPlanProgressionNeighbor = () => null;
let updatePlanExerciseProgression = () => {};
let removeExerciseFromCurrentPlan = () => {};
let closePlanInstructionsPopup = () => {};
let getPlanExerciseDetailsLines = () => [];
let openCombinationMenu = () => {};
let moveExerciseWithinCombination = () => {};
let moveCombination = () => {};
let setCombinationSets = () => {};
let schedulePlanSave = () => {};
let getAlwaysShowInstructions = () => false;


function configurePlanRender(dependencies) {
    getCurrentPlan = dependencies.getCurrentPlan;
    getPlanExerciseList = dependencies.getPlanExerciseList;
    normalizeCombinationNumbers = dependencies.normalizeCombinationNumbers;
    displayExerciseDetails = dependencies.displayExerciseDetails;
    getProgressionName = dependencies.getProgressionName;
    getPlanProgressionNeighbor = dependencies.getPlanProgressionNeighbor;
    updatePlanExerciseProgression = dependencies.updatePlanExerciseProgression;
    removeExerciseFromCurrentPlan = dependencies.removeExerciseFromCurrentPlan;
    closePlanInstructionsPopup = dependencies.closePlanInstructionsPopup;
    getPlanExerciseDetailsLines = dependencies.getPlanExerciseDetailsLines;
    openCombinationMenu = dependencies.openCombinationMenu;
    moveExerciseWithinCombination = dependencies.moveExerciseWithinCombination;
    moveCombination = dependencies.moveCombination;
    setCombinationSets = dependencies.setCombinationSets;
    schedulePlanSave = dependencies.schedulePlanSave;
    getAlwaysShowInstructions = dependencies.getAlwaysShowInstructions;
}

// ============================================================
// AFFICHAGE DU PLAN
// ============================================================

function createPlanNumberInput(
    value,
    onChange,
    options = {}
) {
    const container =
        document.createElement("div");

    container.classList.add(
        "plan-number-control"
    );

    const upButton =
        document.createElement("button");

    upButton.type = "button";
    upButton.textContent = "▲";
    upButton.classList.add(
        "plan-number-arrow"
    );

    const input =
        document.createElement("input");

    input.type = "number";
    input.value = value ?? "";
    input.classList.add(
        "plan-number-input"
    );

    const downButton =
        document.createElement("button");

    downButton.type = "button";
    downButton.textContent = "▼";
    downButton.classList.add(
        "plan-number-arrow"
    );

    const control =
        setupNumberInput(input, {
            ...options,
            onChange
        });

const useSnapStep = () =>
    typeof options.snapStep === "function"
        ? options.snapStep()
        : options.snapStep === true;

upButton.addEventListener(
    "click",
    () => control.step(1, useSnapStep())
);

downButton.addEventListener(
    "click",
    () => control.step(-1, useSnapStep())
);

    container.append(
        upButton,
        input,
        downButton
    );

    return container;
}

function createVerticalArrowButtons({
    containerClass,
    buttonClass,
    upDisabled = false,
    downDisabled = false,
    onUp,
    onDown
}) {
    const container = document.createElement("div");
    container.classList.add(containerClass);

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "▲";
    up.classList.add(buttonClass);
    up.disabled = upDisabled;
    up.addEventListener("click", onUp);

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "▼";
    down.classList.add(buttonClass);
    down.disabled = downDisabled;
    down.addEventListener("click", onDown);

    container.append(up, down);
    return container;
}

// ============================================================
// RENDU DES EXERCICES DU PLAN
// ============================================================

function createExerciseControlRow(label, control, className) {
    const row = document.createElement("div");
    const title = document.createElement("span");

    row.classList.add(
        "plan-exercise-control-row",
        className
    );

    title.classList.add(
        "plan-exercise-control-label"
    );

    title.textContent = `${label} :`;

    control.classList.add(
        "plan-exercise-control-values"
    );

    row.append(title, control);

    return row;
}

function renderPlanExercises() {
    const list = getPlanExerciseList();
    const plan = getCurrentPlan();

    destroyExerciseMuscleMapsIn(list);
    list.replaceChildren();

    if (!plan || plan.exercises.length === 0) {
        list.textContent = "Aucun exercice ajouté.";
        return;
    }

    normalizeCombinationNumbers();

    const planOrder = new Map(
        plan.exercises.map((item, index) => [
            item,
            index + 1
        ])
    );

    const groups = [];

    plan.exercises.forEach(planExercise => {
        const group = planExercise.combination.group;

        let groupData = groups.find(
            item => item.group === group
        );

        if (!groupData) {
            groupData = {
                group,
                exercises: []
            };

            groups.push(groupData);
        }

        groupData.exercises.push(planExercise);
    });


const workout =
    document.createElement("div");

workout.classList.add(
    "plan-workout-content"
);

    let supersetColorIndex = 0;


    groups.forEach((groupData, groupIndex) => {
        const group = groupData.group;
        const groupExercises =
            groupData.exercises;

        const isSuperset =
            groupExercises.length > 1;


        // ====================================================
        // SET
        // ====================================================

        const setBlock =
            document.createElement("section");

        setBlock.classList.add(
            "plan-set-block"
        );

if (isSuperset) {
    supersetColorIndex++;

    const color =
        ((supersetColorIndex - 1) % 3) + 1;

    setBlock.classList.add(
        "plan-set-superset",
        `plan-set-colored-${color}`
    );
} else {
    setBlock.classList.add(
        "plan-set-single"
    );
}


        // ----------------------------------------------------
        // Titre et ordre du Set
        // ----------------------------------------------------

        const setHeader =
            document.createElement("div");

        setHeader.classList.add(
            "plan-set-header"
        );

        const setOrder =
            createVerticalArrowButtons({
                containerClass:
                    "plan-set-order-buttons",

                buttonClass:
                    "plan-order-button",

                upDisabled:
                    groupIndex === 0,

                downDisabled:
                    groupIndex ===
                    groups.length - 1,

                onUp: () =>
                    moveCombination(
                        group,
                        -1
                    ),

                onDown: () =>
                    moveCombination(
                        group,
                        1
                    )
            });

        const setTitle =
            document.createElement("strong");

        setTitle.classList.add(
            "plan-set-title"
        );

        setTitle.textContent =
            `Set ${group}`;

        setHeader.append(
            setOrder,
            setTitle
        );

        setBlock.appendChild(setHeader);

        const setExercises =
    document.createElement("div");

setExercises.classList.add(
    "plan-set-exercises"
);

setBlock.appendChild(setExercises);


        // ====================================================
        // EXERCICES DU SET
        // ====================================================

        groupExercises.forEach(
            (planExercise, exerciseIndex) => {

                const exercise =
                    planExercise.exercise;

                const planIndex =
                    planOrder.get(planExercise);

                const shell =
                    document.createElement("div");

                shell.classList.add(
                    "plan-exercise-shell"
                );


// ------------------------------------------------
// Barre latérale : Set + ordre dans le Set
// ------------------------------------------------

const combinationButton =
    document.createElement("button");

combinationButton.type = "button";
combinationButton.textContent =
    `S${group}`;

combinationButton.classList.add(
    "plan-combination-button"
);

combinationButton.title =
    "Changer de Set";

combinationButton.addEventListener(
    "click",
    () => {
        openCombinationMenu(
            planExercise,
            combinationButton
        );
    }
);

const exerciseOrder =
    createVerticalArrowButtons({
        containerClass:
            "plan-exercise-order",

        buttonClass:
            "plan-order-button",

        upDisabled:
            !isSuperset ||
            exerciseIndex === 0,

        downDisabled:
            !isSuperset ||
            exerciseIndex ===
            groupExercises.length - 1,

        onUp: () =>
            moveExerciseWithinCombination(
                planExercise,
                -1
            ),

        onDown: () =>
            moveExerciseWithinCombination(
                planExercise,
                1
            )
    });

const exerciseRail =
    document.createElement("div");

exerciseRail.classList.add(
    "plan-exercise-rail"
);

exerciseRail.append(
    combinationButton,
    exerciseOrder
);

shell.appendChild(exerciseRail);


                const card =
                    document.createElement("div");

                card.classList.add(
                    "plan-exercise-card"
                );

const muscleMapWrap =
    document.createElement("div");

muscleMapWrap.classList.add(
    "plan-exercise-muscle-map-wrap"
);

const muscleMap =
    document.createElement("div");

muscleMap.classList.add(
    "exercise-muscle-map",
    "plan-exercise-muscle-map"
);

const muscleMapToggle =
    document.createElement("button");

muscleMapToggle.type = "button";

muscleMapToggle.classList.add(
    "plan-exercise-muscle-map-toggle"
);

muscleMapWrap.append(
    muscleMap,
    muscleMapToggle
);

function setMuscleMapCollapsed(collapsed) {
    planExercise.muscleMapCollapsed = collapsed;

    muscleMapWrap.classList.toggle(
        "is-collapsed",
        collapsed
    );

    muscleMapToggle.setAttribute(
        "aria-expanded",
        String(!collapsed)
    );

    muscleMapToggle.setAttribute(
        "aria-label",
        collapsed
            ? "Afficher le modèle musculaire"
            : "Masquer le modèle musculaire"
    );

    muscleMapToggle.title =
        collapsed
            ? "Afficher le modèle musculaire"
            : "Masquer le modèle musculaire";
}

muscleMapToggle.addEventListener(
    "click",
    () => {
        setMuscleMapCollapsed(
            !muscleMapWrap.classList.contains(
                "is-collapsed"
            )
        );
    }
);


                // =================================================
                // LIGNE 1
                // Numéro + exercice | progression
                // =================================================

                const line1 =
                    document.createElement("div");

                line1.classList.add(
                    "plan-exercise-line",
                    "plan-exercise-line-1"
                );


                const identity =
                    document.createElement("div");

                identity.classList.add(
                    "plan-exercise-identity"
                );


                const number =
                    document.createElement("span");

                number.classList.add(
                    "plan-exercise-number"
                );

                number.textContent =
                    `${planIndex} -`;


                const exerciseName =
                    document.createElement("button");

                exerciseName.type = "button";

                exerciseName.classList.add(
                    "plan-exercise-name"
                );

                exerciseName.textContent =
                    exercise.nom;

                exerciseName.addEventListener(
                    "click",
                    () => {
                        displayExerciseDetails(
                            exercise,
                            "plan"
                        );
                    }
                );

                identity.append(
                    number,
                    exerciseName
                );


                // Progression

                const progression =
                    document.createElement("div");

                progression.classList.add(
                    "plan-progression-cell"
                );


                const progressionName =
                    document.createElement("span");

                progressionName.classList.add(
                    "plan-progression-name"
                );

                progressionName.textContent =
                    getProgressionName(exercise) ||
                    "—";


                const nextProgression =
                    getPlanProgressionNeighbor(
                        exercise,
                        1
                    );

                const previousProgression =
                    getPlanProgressionNeighbor(
                        exercise,
                        -1
                    );


                const progressionButtons =
                    createVerticalArrowButtons({
                        containerClass:
                            "plan-progression-buttons",

                        buttonClass:
                            "plan-progression-button",

                        upDisabled:
                            !nextProgression,

                        downDisabled:
                            !previousProgression,

                        onUp: () => {
                            if (!nextProgression) return;

                            updatePlanExerciseProgression(
                                planExercise,
                                nextProgression
                            );

                            displayExerciseDetails(
                                nextProgression,
                                "plan"
                            );
                        },

                        onDown: () => {
                            if (!previousProgression) return;

                            updatePlanExerciseProgression(
                                planExercise,
                                previousProgression
                            );

                            displayExerciseDetails(
                                previousProgression,
                                "plan"
                            );
                        }
                    });


                progression.append(
                    progressionName,
                    progressionButtons
                );

                line1.append(
                    identity,
                    progression
                );


                // =================================================
                // LIGNE 2
                // Muscles | Poids
                // =================================================

                const line2 =
                    document.createElement("div");

                line2.classList.add(
                    "plan-exercise-line",
                    "plan-exercise-line-2"
                );


                const muscleFamilies = [
                    ...new Set(
                        exercise.muscles_principaux.map(
                            muscle => muscle[0]
                        )
                    )
                ];


                const muscles =
                    document.createElement("span");

                muscles.classList.add(
                    "plan-exercise-muscles"
                );

                const typeText =
                    Array.isArray(exercise.type)
                        ? exercise.type.join(" - ")
                        : exercise.type || "";

                const muscleText =
                muscleFamilies.join(" - ");

                muscles.textContent =
                    [typeText, muscleText]
                        .filter(Boolean)
                        .join(" | ") || "—";


                const weight =
                    document.createElement("div");

                weight.classList.add(
                    "plan-value-container",
                    "plan-weight-control"
                );


                weight.appendChild(
                    createPlanNumberInput(
                        planExercise.weight,
                        value => {
                            planExercise.weight = value ?? 0;
                            schedulePlanSave(getCurrentPlan());
                        },
                        {
                            min: 0,
                            max: 9999.9,
                            step: 2.5,
                            decimals: 1,
                            minChars: 1,
                            snapStep: true
                        }
                    )
                );


                const weightUnit =
                    document.createElement("select");

                weightUnit.classList.add(
                    "plan-weight-unit"
                );

                ["lbs", "kg"].forEach(unit => {
                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value = unit;
                    option.textContent = unit;

                    weightUnit.appendChild(
                        option
                    );
                });

                weightUnit.value =
                    planExercise.weightUnit;

                weightUnit.addEventListener("change", () => {
                        planExercise.weightUnit = weightUnit.value;
                        schedulePlanSave(getCurrentPlan());
                    }
                );


                weight.appendChild(weightUnit);

                const weightRow =
                    createExerciseControlRow(
                        "Poids", weight,"plan-exercise-weight-row");

                line2.append(
                    muscles, weightRow);


                // =================================================
                // LIGNE 3
                // Séries X Volume | Tempo | Repos
                // =================================================

                const line3 =
                    document.createElement("div");

                line3.classList.add(
                    "plan-exercise-line",
                    "plan-exercise-line-3"
                );


                // Séries

                const setsControl =
                    createPlanNumberInput(
                        planExercise.sets,
                        value => {
                            setCombinationSets(planExercise, value ?? 1);
                            renderPlanExercises();
                        },
                        {
                            min: 1,
                            max: 999,
                            step: 1,
                            minChars: 1
                        }
                    );


                // X

                const multiplier =
                    document.createElement("span");

                multiplier.classList.add(
                    "plan-volume-multiplier"
                );

                multiplier.textContent = "X";


                // Volume

                const volume =
                    document.createElement("div");

                volume.classList.add(
                    "plan-value-container",
                    "plan-volume-control"
                );


                volume.appendChild(
                    createPlanNumberInput(
                        planExercise.value,
                        value => {
                            planExercise.value = value ?? 1;
                            schedulePlanSave(getCurrentPlan());
                        },
                        {
                            min: 1,
                            max: 999,

                            step: () =>
                                planExercise.valueUnit ===
                                "sec"
                                    ? 15
                                    : 1,

                            snapStep: () =>
                                planExercise.valueUnit ===
                                "sec",

                            minChars: 1
                        }
                    )
                );


                const valueUnit =
                    document.createElement("select");

                valueUnit.classList.add(
                    "plan-value-unit"
                );

                [
                    ["rep", "Rep"],
                    ["sec", "sec"]
                ].forEach(([value, text]) => {
                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value = value;
                    option.textContent = text;

                    valueUnit.appendChild(option);
                });

                valueUnit.value =
                    planExercise.valueUnit;

                valueUnit.addEventListener("change", () => {
                        planExercise.valueUnit = valueUnit.value;
                        schedulePlanSave(getCurrentPlan());
                    }
                );

                volume.appendChild(valueUnit);


                // Tempo

                const tempo =
                    document.createElement("div");

                tempo.classList.add(
                    "plan-tempo-container"
                );


                [
                    "first",
                    "second",
                    "third",
                    "fourth"
                ].forEach((key, index) => {

                    tempo.appendChild(
                        createPlanNumberInput(
                            planExercise.tempo[key],

                            value => {
                                planExercise.tempo[key] = value ?? 0;
                                schedulePlanSave(getCurrentPlan());
                            },

                            {
                                min: 0,
                                max: 999,
                                step: 1,
                                minChars: 1,

                                zeroDisplay:
                                    key === "first" ||
                                    key === "third"
                                        ? "X"
                                        : null
                            }
                        )
                    );


                    if (index < 3) {
                        const separator =
                            document.createElement(
                                "span"
                            );

                        separator.textContent = "·";

                        separator.classList.add(
                            "plan-tempo-separator"
                        );

                        tempo.appendChild(separator);
                    }
                });


                // Repos

                const rest =
                    document.createElement("div");

                rest.classList.add(
                    "plan-rest-control"
                );


                rest.appendChild(
                    createPlanNumberInput(
                        planExercise.rest,

                        value => {
                            planExercise.rest = value ?? 0;
                            schedulePlanSave(getCurrentPlan());
                        },

                        {
                            min: 0,
                            max: 999,
                            step: 15,
                            snapStep: true,
                            minChars: 1
                        }
                    )
                );


                const restLabels =
                    document.createElement("div");

                restLabels.classList.add(
                    "plan-rest-labels"
                );


                const seconds =
                    document.createElement("span");

                seconds.textContent = "sec";


                const restText =
                    document.createElement("span");

                restText.textContent = "repos";


                restLabels.append(
                    seconds,
                    restText
                );

rest.appendChild(restLabels);

const volumeGroup =
    document.createElement("div");

volumeGroup.classList.add(
    "plan-line3-volume"
);

volumeGroup.append(
    setsControl,
    multiplier,
    volume
);

const volumeRow =
    createExerciseControlRow(
        "Volume",
        volumeGroup,
        "plan-exercise-volume-row"
    );

const tempoRow =
    createExerciseControlRow(
        "Tempo",
        tempo,
        "plan-exercise-tempo-row"
    );

const restRow =
    createExerciseControlRow(
        "Repos",
        rest,
        "plan-exercise-rest-row"
    );

line3.append(
    volumeRow,
    tempoRow,
    restRow
);


                // =================================================
                // LIGNE 4
                // Instructions | poubelle
                // =================================================

                const line4 =
                    document.createElement("div");

                line4.classList.add(
                    "plan-exercise-line",
                    "plan-exercise-line-4"
                );


const exerciseArrayIndex = plan.exercises.indexOf(planExercise);

let instructionsControl;

if (getAlwaysShowInstructions()) {
    line4.classList.add("has-inline-instructions");
    instructionsControl = createInlineInstructionsEditor(planExercise);
} else {
    const instructionsButton = document.createElement("button");

    instructionsButton.type = "button";
    instructionsButton.textContent = "Instructions";
    instructionsButton.classList.add("plan-instructions-button");
    instructionsButton.dataset.planExerciseIndex = exerciseArrayIndex;

    instructionsButton.addEventListener("click", () => {
        openPlanExerciseInstructions(planExercise, exerciseArrayIndex);
    });

    instructionsControl = instructionsButton;
}

                // Suppression

                const deleteButton =
                    document.createElement("button");

                deleteButton.type =
                    "button";

                deleteButton.textContent = "🗑";

                deleteButton.classList.add(
                    "plan-delete-button"
                );

                deleteButton.title =
                    "Supprimer l'exercice";

                deleteButton.setAttribute(
                    "aria-label",
                    `Supprimer ${exercise.nom} du plan`
                );

                deleteButton.addEventListener(
                    "click",
                    () => {
                        removeExerciseFromCurrentPlan(
                            planExercise
                        );
                    }
                );


                line4.append(instructionsControl, deleteButton);


                card.append(
                    line1,
                    muscleMapWrap,
                    line2,
                    line3,
                    line4
                );

                shell.appendChild(card);
                setExercises.appendChild(shell);

                renderExerciseMuscleMap(
                    muscleMap,
                    exercise,
                    { compact: true }
                );

                setMuscleMapCollapsed(
                    planExercise.muscleMapCollapsed === true
                );
            }
        );

        workout.appendChild(setBlock);
    });

    list.appendChild(workout);
}

// ============================================================
// INSTRUCTIONS
// ============================================================

function ensurePlanExerciseInstructions(planExercise) {
    planExercise.details ??= {};

    if (planExercise.details.instructions == null) {
        planExercise.details.instructions =
            getPlanExerciseDetailsLines(planExercise.exercise).join("\n");
    }

    return planExercise.details.instructions;
}

function createInlineInstructionsEditor(planExercise) {
    const field = document.createElement("label");
    field.classList.add("plan-instructions-inline");

    const title = document.createElement("span");
    title.classList.add("plan-instructions-inline-title");
    title.textContent = "Instructions";

    const textarea = document.createElement("textarea");
    textarea.classList.add("plan-instructions-inline-textarea");
    textarea.maxLength = 200;
    textarea.value = ensurePlanExerciseInstructions(planExercise);

    textarea.addEventListener("input", () => {
        planExercise.details.instructions = textarea.value.slice(0, 200);
        schedulePlanSave(getCurrentPlan());
    });

    field.append(title, textarea);
    return field;
}

function openPlanExerciseInstructions(
    planExercise,
    index
) {
    if (!getCurrentPlan()) {
        return;
    }

    closePlanInstructionsPopup();

    const instructions = ensurePlanExerciseInstructions(planExercise);

    const popup =
        document.createElement("div");

    popup.classList.add(
        "plan-instructions-popup"
    );

    const muscleMap =
    document.createElement("div");

    muscleMap.classList.add(
        "exercise-muscle-map",
        "plan-exercise-muscle-map"
    );

    const textarea =
        document.createElement("textarea");

    textarea.classList.add(
        "plan-instructions-textarea"
    );

    textarea.maxLength = 200;
    textarea.value = instructions;

    popup.appendChild(textarea);

    popup.addEventListener(
        "click",
        event => {
            event.stopPropagation();
        }
    );

    document.body.appendChild(popup);

    const button = document.querySelector(
        `.plan-instructions-button[data-plan-exercise-index="${index}"]`
    );

    if (button) {
        const rect =
            button.getBoundingClientRect();

        popup.style.left =
            `${rect.left + window.scrollX}px`;

        popup.style.top =
            `${rect.bottom + window.scrollY + 5}px`;
    }

    textarea.focus();

    function saveInstructions() {
        planExercise.details.instructions = textarea.value.slice(0, 200);
        schedulePlanSave(getCurrentPlan());
    }

    popup._saveInstructions =
        saveInstructions;

    textarea.addEventListener(
        "input",
        saveInstructions
    );

    function closeOnOutsideClick(event) {
        if (popup.contains(event.target)) {
            return;
        }

        saveInstructions();
        popup.remove();

        document.removeEventListener(
            "click",
            closeOnOutsideClick
        );

        popup._closeHandler = null;
    }

    popup._closeHandler =
        closeOnOutsideClick;

    setTimeout(() => {
        document.addEventListener(
            "click",
            closeOnOutsideClick
        );
    }, 0);
}

// ============================================================
// EXPORTS
// ============================================================

export {
    configurePlanRender,
    createPlanNumberInput,
    renderPlanExercises,
    openPlanExerciseInstructions
};