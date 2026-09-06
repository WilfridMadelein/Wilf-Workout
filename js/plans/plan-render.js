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
let closePlanInstructionsPopup = () => {};
let getPlanExerciseDetailsLines = () => [];
let openCombinationMenu = () => {};
let moveExerciseWithinCombination = () => {};
let moveCombination = () => {};

function configurePlanRender(dependencies) {
    getCurrentPlan = dependencies.getCurrentPlan;
    getPlanExerciseList = dependencies.getPlanExerciseList;
    normalizeCombinationNumbers = dependencies.normalizeCombinationNumbers;
    displayExerciseDetails = dependencies.displayExerciseDetails;
    getProgressionName = dependencies.getProgressionName;
    getPlanProgressionNeighbor = dependencies.getPlanProgressionNeighbor;
    updatePlanExerciseProgression = dependencies.updatePlanExerciseProgression;
    closePlanInstructionsPopup = dependencies.closePlanInstructionsPopup;
    getPlanExerciseDetailsLines = dependencies.getPlanExerciseDetailsLines;
    openCombinationMenu = dependencies.openCombinationMenu;
    moveExerciseWithinCombination = dependencies.moveExerciseWithinCombination;
    moveCombination = dependencies.moveCombination;
}

// ============================================================
// AFFICHAGE DU PLAN
// ============================================================

function createPlanNumberInput(value, onChange, options = {}) {
    const container = document.createElement("div");
    container.classList.add("plan-number-control");

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.textContent = "▲";
    upButton.classList.add("plan-number-arrow");

    const input = document.createElement("input");
    input.type = "number";
    input.value = value ?? "";
    input.classList.add("plan-number-input");

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.textContent = "▼";
    downButton.classList.add("plan-number-arrow");

    if (options.min !== undefined) {
        input.min = options.min;
    }

    if (options.step !== undefined) {
        input.step = options.step;
    }

    function updateWidth() {
        const length = String(input.value || "0").length;
        input.style.width = `${Math.max(2, length + 1)}ch`;
    }

    function changeValue(amount) {
        const currentValue = Number(input.value) || 0;
        const step = Number(input.step) || 1;

        let newValue = currentValue + amount * step;

        if (input.min !== "") {
            newValue = Math.max(
                Number(input.min),
                newValue
            );
        }

        input.value = newValue;

        updateWidth();
        onChange(newValue);
    }

    upButton.addEventListener("click", () => {
        changeValue(1);
    });

    downButton.addEventListener("click", () => {
        changeValue(-1);
    });

    input.addEventListener("input", () => {
        updateWidth();
    });

    input.addEventListener("change", () => {
        const newValue = input.value === ""
            ? null
            : Number(input.value);

        updateWidth();
        onChange(newValue);
    });

    container.appendChild(upButton);
    container.appendChild(input);
    container.appendChild(downButton);

    updateWidth();

    return container;
}

// ============================================================
// RENDU DES EXERCICES DU PLAN
// ============================================================

function renderPlanExercises() {
    getPlanExerciseList().innerHTML = "";

    if (!getCurrentPlan() || getCurrentPlan().exercises.length === 0) {
        getPlanExerciseList().textContent = "Aucun exercice ajouté.";
        return;
    }

    normalizeCombinationNumbers();

    const table = document.createElement("table");
    table.classList.add("plan-exercise-table");

    const headers = [
        "Exercices",
        "Progression",
        "Muscles",
        "Poids",
        "Séries",
        "Volume",
        "Tempo",
        "Pause",
        "Instructions",
        "Set",
    ];

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    headers.forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Regroupe les exercices par combinaison.
    const groups = [];

    getCurrentPlan().exercises.forEach(planExercise => {
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

    const tbody = document.createElement("tbody");

    groups.forEach((groupData, groupIndex) => {
        const {
            group,
            exercises: groupExercises
        } = groupData;

        groupExercises.forEach(
            (planExercise, exerciseIndex) => {
                const exercise = planExercise.exercise;
                const row = document.createElement("tr");

                const colorPosition = (group - 1) % 6;

                if (colorPosition === 0) {
                    row.classList.add(
                        "plan-set-colored-1"
                    );
                }

                if (colorPosition === 2) {
                    row.classList.add(
                        "plan-set-colored-2"
                    );
                }

                if (colorPosition === 4) {
                    row.classList.add(
                        "plan-set-colored-3"
                    );
                }

                row.classList.add(`plan-set-${group}`);

                // ------------------------------------------------
                // Exercice
                // ------------------------------------------------

                const exerciseCell =
                    document.createElement("td");

                const exerciseName =
                    document.createElement("button");

                exerciseName.classList.add(
                    "plan-exercise-name"
                );

                exerciseName.textContent = exercise.nom;

                exerciseName.addEventListener(
                    "click",
                    () => {
                        displayExerciseDetails(
                            exercise,
                            "plan"
                        );
                    }
                );

                exerciseCell.appendChild(exerciseName);
                row.appendChild(exerciseCell);

                // ------------------------------------------------
                // Progression
                // ------------------------------------------------

                const progressionCell =
                    document.createElement("td");

                const progressionContainer =
                    document.createElement("div");

                progressionContainer.classList.add(
                    "plan-progression-cell"
                );

                const progressionName =
                    document.createElement("span");

                progressionName.textContent =
                    getProgressionName(exercise) || "—";

                const progressionButtons =
                    document.createElement("div");

                progressionButtons.classList.add(
                    "plan-progression-buttons"
                );

                const progressionUp =
                    document.createElement("button");

                progressionUp.textContent = "▲";
                progressionUp.classList.add(
                    "plan-progression-button"
                );

                const progressionDown =
                    document.createElement("button");

                progressionDown.textContent = "▼";
                progressionDown.classList.add(
                    "plan-progression-button"
                );

                progressionButtons.appendChild(
                    progressionUp
                );

                progressionButtons.appendChild(
                    progressionDown
                );

                progressionContainer.appendChild(
                    progressionName
                );

                progressionContainer.appendChild(
                    progressionButtons
                );

                progressionCell.appendChild(
                    progressionContainer
                );

                row.appendChild(progressionCell);

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

                progressionUp.disabled =
                    !nextProgression;

                progressionDown.disabled =
                    !previousProgression;

                progressionUp.addEventListener(
                    "click",
                    () => {
                        if (!nextProgression) {
                            return;
                        }

                        updatePlanExerciseProgression(
                            planExercise,
                            nextProgression
                        );

                        displayExerciseDetails(
                            nextProgression,
                            "plan"
                        );
                    }
                );

                progressionDown.addEventListener(
                    "click",
                    () => {
                        if (!previousProgression) {
                            return;
                        }

                        updatePlanExerciseProgression(
                            planExercise,
                            previousProgression
                        );

                        displayExerciseDetails(
                            previousProgression,
                            "plan"
                        );
                    }
                );

                // ------------------------------------------------
                // Muscles
                // ------------------------------------------------

                const musclesCell =
                    document.createElement("td");

                const muscleFamilies = [
                    ...new Set(
                        exercise.muscles_principaux.map(
                            muscle => muscle[0]
                        )
                    )
                ];

                musclesCell.textContent =
                    muscleFamilies.length
                        ? muscleFamilies.join(" / ")
                        : "—";

                row.appendChild(musclesCell);

                // ------------------------------------------------
                // Poids
                // ------------------------------------------------

                const weightCell =
                    document.createElement("td");

                const weightContainer =
                    document.createElement("div");

                weightContainer.classList.add(
                    "plan-value-container"
                );

                weightContainer.appendChild(
                    createPlanNumberInput(
                        planExercise.weight,
                        value => {
                            planExercise.weight =
                                value ?? 0;
                        },
                        {
                            min: 0,
                            step: 0.5
                        }
                    )
                );

                const weightUnitSelect =
                    document.createElement("select");

                ["lbs", "kg"].forEach(unit => {
                    const option =
                        document.createElement("option");

                    option.value = unit;
                    option.textContent = unit;
                    option.selected =
                        planExercise.weightUnit === unit;

                    weightUnitSelect.appendChild(option);
                });

                weightUnitSelect.classList.add(
                    "plan-weight-unit"
                );

                weightUnitSelect.addEventListener(
                    "change",
                    () => {
                        planExercise.weightUnit =
                            weightUnitSelect.value;
                    }
                );

                weightContainer.appendChild(
                    weightUnitSelect
                );

                weightCell.appendChild(
                    weightContainer
                );

                row.appendChild(weightCell);

                // ------------------------------------------------
                // Séries
                // ------------------------------------------------

                const setsCell =
                    document.createElement("td");

                setsCell.appendChild(
                    createPlanNumberInput(
                        planExercise.sets,
                        value => {
                            planExercise.sets =
                                value ?? 0;
                        },
                        {
                            min: 1,
                            step: 1
                        }
                    )
                );

                row.appendChild(setsCell);

                // ------------------------------------------------
                // Volume
                // ------------------------------------------------

                const repsTimeCell =
                    document.createElement("td");

                const repsTimeContainer =
                    document.createElement("div");

                repsTimeContainer.classList.add(
                    "plan-value-container"
                );

                repsTimeContainer.appendChild(
                    createPlanNumberInput(
                        planExercise.value,
                        value => {
                            planExercise.value =
                                value ?? 0;
                        },
                        {
                            min: 1,
                            step: 1
                        }
                    )
                );

                const valueUnitSelect =
                    document.createElement("select");

                [
                    ["rep", "rep"],
                    ["sec", "sec"]
                ].forEach(([value, text]) => {
                    const option =
                        document.createElement("option");

                    option.value = value;
                    option.textContent = text;

                    valueUnitSelect.appendChild(option);
                });

                valueUnitSelect.value =
                    planExercise.valueUnit;

                valueUnitSelect.addEventListener(
                    "change",
                    () => {
                        planExercise.valueUnit =
                            valueUnitSelect.value;
                    }
                );

                valueUnitSelect.classList.add(
                    "plan-value-unit"
                );

                repsTimeContainer.appendChild(
                    valueUnitSelect
                );

                repsTimeCell.appendChild(
                    repsTimeContainer
                );

                row.appendChild(repsTimeCell);

                // ------------------------------------------------
                // Tempo
                // ------------------------------------------------

                const tempoCell =
                    document.createElement("td");

                const tempoContainer =
                    document.createElement("div");

                tempoContainer.classList.add(
                    "plan-tempo-container"
                );

                [
                    "first",
                    "second",
                    "third",
                    "fourth"
                ].forEach((key, index) => {
                    const tempoControl =
                        createPlanNumberInput(
                            planExercise.tempo[key],
                            value => {
                                planExercise.tempo[key] =
                                    value ?? 0;
                            },
                            {
                                min: 0,
                                step: 1
                            }
                        );

                    tempoContainer.appendChild(
                        tempoControl
                    );

                    if (index < 3) {
                        const separator =
                            document.createElement("span");

                        separator.textContent = "·";
                        separator.classList.add(
                            "plan-tempo-separator"
                        );

                        tempoContainer.appendChild(
                            separator
                        );
                    }
                });

                tempoCell.appendChild(
                    tempoContainer
                );

                row.appendChild(tempoCell);

                // ------------------------------------------------
                // Pause
                // ------------------------------------------------

                const restCell =
                    document.createElement("td");

                const restContainer =
                    document.createElement("div");

                restContainer.classList.add(
                    "plan-value-container"
                );

                restContainer.appendChild(
                    createPlanNumberInput(
                        planExercise.rest,
                        value => {
                            planExercise.rest =
                                value ?? 0;
                        },
                        {
                            min: 0,
                            step: 1
                        }
                    )
                );

                const restUnit =
                    document.createElement("span");

                restUnit.textContent = "sec";
                restUnit.classList.add(
                    "plan-static-unit"
                );

                restContainer.appendChild(
                    restUnit
                );

                restCell.appendChild(
                    restContainer
                );

                row.appendChild(restCell);

                // ------------------------------------------------
                // Instructions
                // ------------------------------------------------

                const instructionsCell =
                    document.createElement("td");

                const instructionsButton =
                    document.createElement("button");

                instructionsButton.textContent =
                    "Instructions";

                instructionsButton.classList.add(
                    "plan-instructions-button"
                );

                instructionsButton.dataset
                    .planExerciseIndex =
                    getCurrentPlan().exercises.indexOf(
                        planExercise
                    );

                instructionsButton.addEventListener(
                    "click",
                    () => {
                        openPlanExerciseInstructions(
                            planExercise,
                            getCurrentPlan().exercises.indexOf(
                                planExercise
                            )
                        );
                    }
                );

                instructionsCell.appendChild(
                    instructionsButton
                );

                row.appendChild(instructionsCell);

                // ------------------------------------------------
                // Combinaison
                // ------------------------------------------------

                const combinationCell =
                    document.createElement("td");

                const combinationButton =
                    document.createElement("button");

                combinationButton.textContent =
                    `S${group}`;

                combinationButton.classList.add(
                    "plan-combination-button"
                );

                combinationButton.addEventListener(
                    "click",
                    () => {
                        openCombinationMenu(
                            planExercise,
                            combinationButton
                        );
                    }
                );

                combinationCell.appendChild(
                    combinationButton
                );

                row.appendChild(combinationCell);

                // ------------------------------------------------
                // Ordre dans la combinaison
                // ------------------------------------------------

                const combinationOrderCell =
                    document.createElement("td");

                if (groupExercises.length > 1) {
                    const buttons =
                        document.createElement("div");

                    buttons.classList.add(
                        "plan-combination-exercise-buttons"
                    );

                    const upButton =
                        document.createElement("button");

                    upButton.textContent = "▲";
                    upButton.classList.add(
                        "plan-order-button"
                    );

                    upButton.disabled =
                        exerciseIndex === 0;

                    upButton.addEventListener(
                        "click",
                        () => {
                            moveExerciseWithinCombination(
                                planExercise,
                                -1
                            );
                        }
                    );

                    const downButton =
                        document.createElement("button");

                    downButton.textContent = "▼";
                    downButton.classList.add(
                        "plan-order-button"
                    );

                    downButton.disabled =
                        exerciseIndex ===
                        groupExercises.length - 1;

                    downButton.addEventListener(
                        "click",
                        () => {
                            moveExerciseWithinCombination(
                                planExercise,
                                1
                            );
                        }
                    );

                    buttons.appendChild(upButton);
                    buttons.appendChild(downButton);

                    combinationOrderCell.appendChild(
                        buttons
                    );
                }

                row.appendChild(
                    combinationOrderCell
                );

                // ------------------------------------------------
                // Ordre des combinaisons
                // ------------------------------------------------

                if (exerciseIndex === 0) {
                    const groupOrderCell =
                        document.createElement("td");

                    groupOrderCell.rowSpan =
                        groupExercises.length;

                    groupOrderCell.classList.add(
                        "plan-combination-group-order"
                    );

                    const buttons =
                        document.createElement("div");

                    buttons.classList.add(
                        "plan-combination-group-order-container"
                    );

                    const upButton =
                        document.createElement("button");

                    upButton.textContent = "▲";
                    upButton.classList.add(
                        "plan-order-button"
                    );

                    upButton.disabled =
                        groupIndex === 0;

                    upButton.addEventListener(
                        "click",
                        () => {
                            moveCombination(
                                group,
                                -1
                            );
                        }
                    );

                    const downButton =
                        document.createElement("button");

                    downButton.textContent = "▼";
                    downButton.classList.add(
                        "plan-order-button"
                    );

                    downButton.disabled =
                        groupIndex ===
                        groups.length - 1;

                    downButton.addEventListener(
                        "click",
                        () => {
                            moveCombination(
                                group,
                                1
                            );
                        }
                    );

                    buttons.appendChild(upButton);
                    buttons.appendChild(downButton);

                    groupOrderCell.appendChild(
                        buttons
                    );

                    row.appendChild(
                        groupOrderCell
                    );
                }

                tbody.appendChild(row);
            }
        );
    });

    table.appendChild(tbody);
    getPlanExerciseList().appendChild(table);
}

// ============================================================
// INSTRUCTIONS
// ============================================================

function openPlanExerciseInstructions(
    planExercise,
    index
) {
    if (!getCurrentPlan()) {
        return;
    }

    closePlanInstructionsPopup();

    if (!planExercise.details) {
        planExercise.details = {};
    }

    const exercise = planExercise.exercise;

    if (planExercise.details.instructions == null) {
        const parts =
            getPlanExerciseDetailsLines(exercise);

        planExercise.details.instructions =
            parts.join("\n");
    }

    const popup =
        document.createElement("div");

    popup.classList.add(
        "plan-instructions-popup"
    );

    const textarea =
        document.createElement("textarea");

    textarea.classList.add(
        "plan-instructions-textarea"
    );

    textarea.maxLength = 200;
    textarea.value =
        planExercise.details.instructions;

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
        planExercise.details.instructions =
            textarea.value.slice(0, 200);
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