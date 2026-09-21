import {
    renderExerciseMuscleMap,
    destroyExerciseMuscleMapsIn
} from "../exercises/exercise-muscle-map.js";

import {
    getProgressionName
} from "../exercises/exercise-search.js";

import {
    getWorkoutExerciseSides,
    getWorkoutSeriesLog,
    hasWorkoutExerciseLogs,
    addWorkoutSeries,
    removeWorkoutSeries,
    isWorkoutSeriesCompleted,
    updateWorkoutExerciseProgression,
    replacePendingSeriesProgression
} from "./workout-session.js";

// ============================================================
// DÉPENDANCES
// ============================================================

let getExercises = () => [];

function configureWorkoutOverview(dependencies) {
    getExercises = dependencies.getExercises;
}

// ============================================================
// EXERCICES
// ============================================================

function getWorkoutProgressionNeighbor(
    exercise,
    direction
) {
    const progression =
        getProgressionName(exercise);

    const currentOrder =
        Number(exercise?.prog_ordre);

    if (
        !progression ||
        Number.isNaN(currentOrder)
    ) {
        return null;
    }

    const progressionExercises =
        getExercises()
            .filter(
                item =>
                    getProgressionName(item) ===
                    progression
            )
            .filter(
                item =>
                    !Number.isNaN(
                        Number(item.prog_ordre)
                    )
            )
            .sort(
                (a, b) =>
                    Number(a.prog_ordre) -
                    Number(b.prog_ordre)
            );

    if (direction === 1) {
        return progressionExercises.find(
            item =>
                Number(item.prog_ordre) >
                currentOrder
        ) ?? null;
    }

    const previous =
        progressionExercises.filter(
            item =>
                Number(item.prog_ordre) <
                currentOrder
        );

    return previous.at(-1) ?? null;
}

function getPrimaryMuscleFamilies(exercise) {
    return [
        ...new Set(
            (
                exercise?.muscles_principaux ??
                []
            )
                .map(
                    muscle =>
                        muscle?.[0]
                )
                .filter(Boolean)
        )
    ];
}

function formatVolumeUnit(unit) {
    return unit === "sec"
        ? "sec"
        : "Rep";
}

function formatExerciseSeries(
    series,
    sideKey
) {
    const log =
        getWorkoutSeriesLog(
            series,
            sideKey
        );

    const values =
        log ?? series;

    return (
        `${values.value} ` +
        `${formatVolumeUnit(values.valueUnit)} ` +
        `X ${values.weight} ${values.weightUnit}`
    );
}

// ============================================================
// MODALES
// ============================================================

function confirmSeriesRemoval() {
    return new Promise(resolve => {
        const modal =
            document.createElement("div");

        modal.classList.add(
            "workout-action-modal"
        );

        modal.innerHTML = `
            <div class="workout-action-dialog" role="dialog" aria-modal="true">
                <h2>Supprimer une série ?</h2>

                <p>
                    Vous êtes sur le point de supprimer une série.
                    Voulez-vous continuer?
                </p>

                <div class="workout-action-buttons">
                    <button type="button" class="workout-action-delete">
                        Supprimer
                    </button>

                    <button type="button" class="workout-action-cancel">
                        Annuler
                    </button>
                </div>
            </div>
        `;

        function close(result) {
            modal.remove();
            resolve(result);
        }

        modal
            .querySelector(
                ".workout-action-delete"
            )
            .addEventListener(
                "click",
                () => close(true)
            );

        modal
            .querySelector(
                ".workout-action-cancel"
            )
            .addEventListener(
                "click",
                () => close(false)
            );

        modal.addEventListener(
            "click",
            event => {
                if (event.target === modal) {
                    close(false);
                }
            }
        );

        document.body.appendChild(modal);
    });
}

function confirmProgressionReplacement() {
    return new Promise(resolve => {
        const modal =
            document.createElement("div");

        modal.classList.add(
            "workout-action-modal"
        );

        modal.innerHTML = `
            <div class="workout-action-dialog" role="dialog" aria-modal="true">
                <h2>Changer de progression ?</h2>

                <p>
                    Souhaitez-vous remplacer les prochaines séries par une autre progression?
                    Vos séries déjà complétées vont rester enregistrées dans le plan.
                </p>

                <div class="workout-action-buttons">
                    <button type="button" class="workout-action-confirm">
                        Changer de progression
                    </button>

                    <button type="button" class="workout-action-cancel">
                        Annuler
                    </button>
                </div>
            </div>
        `;

        function close(result) {
            modal.remove();
            resolve(result);
        }

        modal
            .querySelector(
                ".workout-action-confirm"
            )
            .addEventListener(
                "click",
                () => close(true)
            );

        modal
            .querySelector(
                ".workout-action-cancel"
            )
            .addEventListener(
                "click",
                () => close(false)
            );

        document.body.appendChild(modal);
    });
}

// ============================================================
// SÉRIES
// ============================================================

function createSeriesRow(
    workoutExercise,
    series,
    sideKey,
    onOpenExercise,
    onSeriesChanged
) {
    const row =
        document.createElement("div");

    row.classList.add(
        "workout-series-row"
    );

    row.classList.toggle(
        "is-completed",
        isWorkoutSeriesCompleted(
            series,
            sideKey
        )
    );

    const removeButton =
        document.createElement("button");

    removeButton.type = "button";
    removeButton.classList.add(
        "workout-series-remove"
    );

    removeButton.textContent = "−";
    removeButton.title =
        "Supprimer cette série";

    const number =
        document.createElement("span");

    number.classList.add(
        "workout-series-number"
    );

    number.textContent =
        `${series.number}.`;

    const values =
        document.createElement("span");

    values.classList.add(
        "workout-series-values"
    );

    values.textContent =
        formatExerciseSeries(
            series,
            sideKey
        );

    removeButton.addEventListener(
        "click",
        async event => {
            event.stopPropagation();

            const confirmed =
                await confirmSeriesRemoval();

            if (!confirmed) return;

            removeWorkoutSeries(
                workoutExercise,
                series.id
            );

            onSeriesChanged();
        }
    );

    row.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            onOpenExercise(
                workoutExercise,
                series,
                sideKey
            );
        }
    );

    row.append(
        removeButton,
        number,
        values
    );

    return row;
}

function createSeriesColumn(
    workoutExercise,
    side,
    onOpenExercise,
    onSeriesChanged
) {
    const column =
        document.createElement("div");

    column.classList.add(
        "workout-split-side"
    );

    const title =
        document.createElement("strong");

    title.classList.add(
        "workout-split-side-title"
    );

    title.textContent =
        side.label;

    const list =
        document.createElement("div");

    list.classList.add(
        "workout-series-list"
    );

    workoutExercise.series.forEach(
        series => {
            list.appendChild(
                createSeriesRow(
                    workoutExercise,
                    series,
                    side.key,
                    onOpenExercise,
                    onSeriesChanged
                )
            );
        }
    );

    column.append(
        title,
        list
    );

    return column;
}

// ============================================================
// PAUSE SPLIT
// ============================================================

function createSplitRestControl(
    workoutExercise
) {
    const control =
        document.createElement("div");

    control.classList.add(
        "workout-split-rest"
    );

    const title =
        document.createElement("span");

    title.classList.add(
        "workout-split-rest-title"
    );

    title.textContent = "Pause";

    const values =
        document.createElement("div");

    values.classList.add(
        "workout-split-rest-values"
    );

    const minus =
        document.createElement("button");

    minus.type = "button";
    minus.textContent = "−";

    const value =
        document.createElement("span");

    const plus =
        document.createElement("button");

    plus.type = "button";
    plus.textContent = "+";

    function refresh() {
        value.textContent =
            `${workoutExercise.splitRest} sec/repos`;
    }

    minus.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            workoutExercise.splitRest =
                Math.max(
                    0,
                    workoutExercise.splitRest - 15
                );

            refresh();
        }
    );

    plus.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            workoutExercise.splitRest =
                Math.min(
                    999,
                    workoutExercise.splitRest + 15
                );

            refresh();
        }
    );

    refresh();

    values.append(
        minus,
        value,
        plus
    );

    control.append(
        title,
        values
    );

    return control;
}

// ============================================================
// CARTE D'EXERCICE
// ============================================================

function createWorkoutExerciseCard(
    session,
    set,
    workoutExercise,
    onOpenExercise,
    onSetStructureChanged
) {
    const card =
        document.createElement("article");

    card.classList.add(
        "workout-exercise-card"
    );

    card.dataset.workoutExerciseId =
        workoutExercise.id;

    const header =
        document.createElement("div");

    header.classList.add(
        "workout-exercise-header"
    );

    const identity =
        document.createElement("div");

    identity.classList.add(
        "workout-exercise-identity"
    );

    const name =
        document.createElement("strong");

    name.classList.add(
        "workout-exercise-name"
    );

    const progression =
        document.createElement("div");

    progression.classList.add(
        "workout-exercise-progression"
    );

    const progressionButtons =
        document.createElement("div");

    progressionButtons.classList.add(
        "workout-exercise-progression-buttons"
    );

    const progressionUp =
        document.createElement("button");

    progressionUp.type = "button";
    progressionUp.textContent = "▲";

    const progressionDown =
        document.createElement("button");

    progressionDown.type = "button";
    progressionDown.textContent = "▼";

    const progressionName =
        document.createElement("span");

    progressionName.classList.add(
        "workout-exercise-progression-name"
    );

    progressionButtons.append(
        progressionUp,
        progressionDown
    );

    progression.append(
        progressionButtons,
        progressionName
    );

    identity.append(
        name,
        progression
    );

    header.appendChild(identity);

    const muscles =
        document.createElement("div");

    muscles.classList.add(
        "workout-exercise-muscles"
    );

    const body =
        document.createElement("div");

    body.classList.add(
        "workout-exercise-body"
    );

    card.append(
        header,
        muscles,
        body
    );

    // --------------------------------------------------------
    // Corps
    // --------------------------------------------------------

    function renderBody() {
        destroyExerciseMuscleMapsIn(body);
        body.replaceChildren();

        const muscleMap =
            document.createElement("div");

        muscleMap.classList.add(
            "exercise-muscle-map",
            "workout-exercise-muscle-map"
        );

        body.appendChild(muscleMap);

        if (
            workoutExercise.splitType ===
            "split"
        ) {
            body.classList.add(
                "is-split"
            );

            const split =
                document.createElement("div");

            split.classList.add(
                "workout-split-layout"
            );

            const sides =
                getWorkoutExerciseSides(
                    workoutExercise
                );

            const refreshSeries =
                () => renderBody();

            split.append(
                createSeriesColumn(
                    workoutExercise,
                    sides[0],
                    onOpenExercise,
                    refreshSeries
                ),

                createSplitRestControl(
                    workoutExercise
                ),

                createSeriesColumn(
                    workoutExercise,
                    sides[1],
                    onOpenExercise,
                    refreshSeries
                )
            );

            const actions =
                document.createElement("div");

            actions.classList.add(
                "workout-exercise-actions"
            );

            const add =
                document.createElement("button");

            add.type = "button";
            add.classList.add(
                "workout-add-series-button"
            );

            add.textContent =
                "Ajouter une série";

            const rest =
                document.createElement("span");

            rest.classList.add(
                "workout-exercise-rest"
            );

            rest.textContent =
                `Repos : ${workoutExercise.rest} sec`;

            add.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    addWorkoutSeries(
                        workoutExercise
                    );

                    renderBody();
                }
            );

            actions.append(
                add,
                rest
            );

            body.append(
                split,
                actions
            );
        } else {
            body.classList.remove(
                "is-split"
            );

            const information =
                document.createElement("div");

            information.classList.add(
                "workout-exercise-information"
            );

            const list =
                document.createElement("div");

            list.classList.add(
                "workout-series-list"
            );

            workoutExercise.series.forEach(
                series => {
                    list.appendChild(
                        createSeriesRow(
                            workoutExercise,
                            series,
                            "main",
                            onOpenExercise,
                            renderBody
                        )
                    );
                }
            );

            const add =
                document.createElement("button");

            add.type = "button";
            add.classList.add(
                "workout-add-series-button"
            );

            add.textContent =
                "Ajouter une série";

            const rest =
                document.createElement("div");

            rest.classList.add(
                "workout-exercise-rest"
            );

            rest.textContent =
                `Repos : ${workoutExercise.rest} sec`;

            add.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    addWorkoutSeries(
                        workoutExercise
                    );

                    renderBody();
                }
            );

            information.append(
                list,
                add,
                rest
            );

            body.appendChild(
                information
            );
        }

        renderExerciseMuscleMap(
            muscleMap,
            workoutExercise.exercise,
            { compact: true }
        );
    }

    // --------------------------------------------------------
    // Carte
    // --------------------------------------------------------

    function refreshCard() {
        const exercise =
            workoutExercise.exercise;

        const families =
            getPrimaryMuscleFamilies(
                exercise
            );

        name.textContent =
            exercise.nom;

        progressionName.textContent =
            getProgressionName(exercise) ||
            "—";

        muscles.textContent =
            families.join(" · ") || "—";

        progressionUp.disabled =
            !getWorkoutProgressionNeighbor(
                exercise,
                1
            );

        progressionDown.disabled =
            !getWorkoutProgressionNeighbor(
                exercise,
                -1
            );

        renderBody();
    }

    async function changeProgression(
        direction
    ) {
        const next =
            getWorkoutProgressionNeighbor(
                workoutExercise.exercise,
                direction
            );

        if (!next) return;

        // Aucun log : comportement simple.
        if (
            !hasWorkoutExerciseLogs(
                workoutExercise
            )
        ) {
            updateWorkoutExerciseProgression(
                workoutExercise,
                next,
                session.defaults
            );

            refreshCard();
            return;
        }

        // Au moins un log : on sépare l'exercice.
        const confirmed =
            await confirmProgressionReplacement();

        if (!confirmed) return;

        const replacement =
            replacePendingSeriesProgression(
                set,
                workoutExercise,
                next,
                session.defaults
            );

        refreshCard();

        const replacementCard =
            createWorkoutExerciseCard(
                session,
                set,
                replacement,
                onOpenExercise,
                onSetStructureChanged
            );

        card.after(
            replacementCard
        );

        onSetStructureChanged();
    }

    progressionUp.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            changeProgression(1);
        }
    );

    progressionDown.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            changeProgression(-1);
        }
    );

    card.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            onOpenExercise(
                workoutExercise
            );
        }
    );

    refreshCard();

    return card;
}

// ============================================================
// OVERVIEW
// ============================================================

function clearWorkoutOverview(container) {
    destroyExerciseMuscleMapsIn(container);
    container.replaceChildren();
}

function renderWorkoutOverview(
    container,
    session,
    {
        onFinish = () => {},
        onOpenSet = () => {},
        onOpenExercise = () => {}
    } = {}
) {
    clearWorkoutOverview(container);

    const overview =
        document.createElement("div");

    overview.classList.add(
        "workout-overview"
    );

    session.sets.forEach(set => {
        const block =
            document.createElement("section");

        block.classList.add(
            "workout-set"
        );

        block.dataset.workoutSetId =
            set.id;

        const header =
            document.createElement("div");

        header.classList.add(
            "workout-set-header"
        );

        const title =
            document.createElement("div");

        title.classList.add(
            "workout-set-title"
        );

        const setName =
            document.createElement("strong");

        setName.textContent =
            `Set ${set.group}`;

        const count =
            document.createElement("span");

        function refreshSetCount() {
            count.textContent =
                ` | ${set.exercises.length} ` +
                `exercice${set.exercises.length !== 1 ? "s" : ""}`;
        }

        refreshSetCount();

        title.append(
            setName,
            count
        );

        header.appendChild(title);

        const exercises =
            document.createElement("div");

        exercises.classList.add(
            "workout-set-exercises"
        );

        const openExercise = (
            workoutExercise,
            series = null,
            sideKey = null
        ) => {
            onOpenExercise(
                workoutExercise,
                series,
                sideKey
            );
        };

        set.exercises.forEach(
            workoutExercise => {
                exercises.appendChild(
                    createWorkoutExerciseCard(
                        session,
                        set,
                        workoutExercise,
                        openExercise,
                        refreshSetCount
                    )
                );
            }
        );

        block.addEventListener(
            "click",
            () => onOpenSet(set)
        );

        block.append(
            header,
            exercises
        );

        overview.appendChild(
            block
        );
    });

    const finish =
        document.createElement("button");

    finish.type = "button";

    finish.classList.add(
        "workout-overview-finish-button"
    );

    finish.textContent =
        "Finir l'entraînement";

    finish.addEventListener(
        "click",
        onFinish
    );

    overview.appendChild(finish);
    container.appendChild(overview);
}

export {
    configureWorkoutOverview,
    renderWorkoutOverview,
    clearWorkoutOverview
};