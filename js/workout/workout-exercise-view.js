import { setupNumberInput } from "../ui/ui.js";

import {
    renderExerciseMuscleMap,
    destroyExerciseMuscleMapsIn
} from "../exercises/exercise-muscle-map.js";

import { getProgressionName } from "../exercises/exercise-search.js";

import {
    getWorkoutSideLabel,
    getWorkoutTargetValues,
    isWorkoutSeriesCompleted
} from "./workout-session.js";

// ============================================================
// CONTRÔLES
// ============================================================

function createStepControl(value, options, onChange) {
    const control = document.createElement("div");
    control.classList.add("workout-step-control");

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";

    const input = document.createElement("input");
    input.type = "number";
    input.value = value;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";

    const numberControl = setupNumberInput(input, {
        ...options,
        onChange
    });

    minus.addEventListener("click", () => numberControl.step(-1, options.snapStep === true));
    plus.addEventListener("click", () => numberControl.step(1, options.snapStep === true));

    control.append(minus, input, plus);
    return control;
}

function createUnitSelect(values, selected, onChange) {
    const select = document.createElement("select");

    values.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });

    select.value = selected;

    select.addEventListener("change", () => {
        onChange(select.value);
    });

    return select;
}

// ============================================================
// TEMPO
// ============================================================

function createTempoEditor(tempo, onChange) {
    const container = document.createElement("div");
    container.classList.add("workout-tempo-editor");

    ["first", "second", "third", "fourth"].forEach((key, index) => {
        const input = document.createElement("input");

        input.type = "text";
        input.inputMode = "numeric";
        input.value =
            tempo[key] === 0 && (key === "first" || key === "third")
                ? "X"
                : tempo[key];

        input.addEventListener("change", () => {
            const raw = input.value.trim().toUpperCase();

            if (raw === "X") {
                tempo[key] = 0;
                input.value = "X";
            } else {
                const value = Math.max(0, Math.min(999, Number(raw) || 0));
                tempo[key] = value;
                input.value = value;
            }

            onChange();
        });

        container.appendChild(input);

        if (index < 3) {
            const separator = document.createElement("span");
            separator.textContent = "·";
            container.appendChild(separator);
        }
    });

    return container;
}

// ============================================================
// IMAGE AGRANDIE
// ============================================================

function openWorkoutMuscleMapModal(exercise) {
    const modal = document.createElement("div");
    modal.classList.add("workout-image-modal");

    const dialog = document.createElement("div");
    dialog.classList.add("workout-image-dialog");

    const close = document.createElement("button");
    close.type = "button";
    close.classList.add("workout-image-close");
    close.textContent = "×";

    const map = document.createElement("div");
    map.classList.add("exercise-muscle-map", "workout-image-large");

    close.addEventListener("click", () => {
        destroyExerciseMuscleMapsIn(dialog);
        modal.remove();
    });

    modal.addEventListener("click", event => {
        if (event.target !== modal) return;

        destroyExerciseMuscleMapsIn(dialog);
        modal.remove();
    });

    dialog.append(close, map);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    renderExerciseMuscleMap(map, exercise, { compact: false });
}

// ============================================================
// CONFIRMATION MODIFICATION
// ============================================================

function confirmLogModification() {
    return new Promise(resolve => {
        const modal = document.createElement("div");
        modal.classList.add("workout-action-modal");

        modal.innerHTML = `
            <div class="workout-action-dialog" role="dialog" aria-modal="true">
                <h2>Modifier une série ?</h2>
                <p>Vous êtes sur le point de modifier une série déjà exécutée. Continuer?</p>

                <div class="workout-action-buttons">
                    <button type="button" class="workout-action-confirm">Continuer</button>
                    <button type="button" class="workout-action-cancel">Annuler</button>
                </div>
            </div>
        `;

        function close(result) {
            modal.remove();
            resolve(result);
        }

        modal.querySelector(".workout-action-confirm").addEventListener("click", () => close(true));
        modal.querySelector(".workout-action-cancel").addEventListener("click", () => close(false));

        document.body.appendChild(modal);
    });
}

// ============================================================
// RENDU
// ============================================================

function clearWorkoutExerciseView(container) {
    destroyExerciseMuscleMapsIn(container);
    container.replaceChildren();
}

function renderWorkoutExerciseView(container, session, target, {
    onBack = () => {},
    onLog = async () => {},
    logAvailable = true
} = {}) {
    clearWorkoutExerciseView(container);

    const workoutExercise = target.workoutExercise;
    const exercise = workoutExercise.exercise;
    const draft = getWorkoutTargetValues(target);
    const completed = isWorkoutSeriesCompleted(target.series, target.sideKey);

    const page = document.createElement("div");
    page.classList.add("workout-exercise-screen");

    // ========================================================
    // EN-TÊTE
    // ========================================================

    const header = document.createElement("header");
    header.classList.add("workout-exercise-screen-header");

    const back = document.createElement("button");
    back.type = "button";
    back.classList.add("workout-exercise-back");
    back.textContent = "←";
    back.setAttribute("aria-label", "Retour à l'entraînement");

    const heading = document.createElement("div");
    heading.classList.add("workout-exercise-screen-heading");

    const name = document.createElement("h1");
    name.textContent = exercise.nom;

    const progression = document.createElement("div");
    progression.classList.add("workout-exercise-screen-progression");
    progression.textContent = getProgressionName(exercise) || "—";

    heading.append(name, progression);
    header.append(back, heading);

    back.addEventListener("click", onBack);

    // ========================================================
    // SPLIT
    // ========================================================

    if (workoutExercise.splitType === "split") {
        const side = document.createElement("strong");
        side.classList.add("workout-exercise-side");
        side.textContent = getWorkoutSideLabel(target.sideKey);
        heading.appendChild(side);
    }

    // ========================================================
    // IMAGE
    // ========================================================

    const mapButton = document.createElement("button");
    mapButton.type = "button";
    mapButton.classList.add("workout-exercise-screen-map-button");

    const map = document.createElement("div");

    map.classList.add(
        "exercise-muscle-map",
        "workout-exercise-screen-map"
    );

    mapButton.appendChild(map);

    mapButton.addEventListener("click", () => {
        openWorkoutMuscleMapModal(exercise);
    });

    // ========================================================
    // CONTRÔLES
    // ========================================================

    const controls = document.createElement("div");
    controls.classList.add("workout-exercise-controls");

    function createControlRow(labelText, control) {
        const row = document.createElement("div");
        row.classList.add("workout-exercise-control-row");

        const label = document.createElement("strong");
        label.textContent = `${labelText} :`;

        row.append(label, control);
        return row;
    }

    // Volume

    const volume = document.createElement("div");
    volume.classList.add("workout-exercise-control-values");

    const volumeNumber = createStepControl(
        draft.value,
        {
            min: 1,
            max: 999,
            step: () => draft.valueUnit === "sec" ? 15 : 1,
            minChars: 1
        },
        value => {
            draft.value = value ?? 1;
        }
    );

    const volumeUnit = createUnitSelect(
        [
            ["rep", "Rep"],
            ["sec", "sec"]
        ],
        draft.valueUnit,
        value => {
            draft.valueUnit = value;
        }
    );

    volume.append(volumeNumber, volumeUnit);

    // Poids

    const weight = document.createElement("div");
    weight.classList.add("workout-exercise-control-values");

    const weightNumber = createStepControl(
        draft.weight,
        {
            min: 0,
            max: 9999.9,
            step: 2.5,
            decimals: 1,
            minChars: 1,
            snapStep: true
        },
        value => {
            draft.weight = value ?? 0;
        }
    );

    const weightUnit = createUnitSelect(
        [
            ["lbs", "lbs"],
            ["kg", "kg"]
        ],
        draft.weightUnit,
        value => {
            draft.weightUnit = value;
        }
    );

    weight.append(weightNumber, weightUnit);

    // Tempo

    const tempo = createTempoEditor(
        draft.tempo,
        () => {}
    );

    // Repos

    const rest = document.createElement("div");
    rest.classList.add("workout-exercise-control-values");

    const restNumber = createStepControl(
        draft.rest,
        {
            min: 0,
            max: 999,
            step: 15,
            minChars: 1,
            snapStep: true
        },
        value => {
            draft.rest = value ?? 0;
        }
    );

    const restUnit = document.createElement("span");
    restUnit.textContent = "sec";

    rest.append(restNumber, restUnit);

    controls.append(
        createControlRow("Volume", volume),
        createControlRow("Poids", weight),
        createControlRow("Tempo", tempo),
        createControlRow("Repos", rest)
    );

    // ========================================================
    // INSTRUCTIONS
    // ========================================================

    const instructions = document.createElement("section");
    instructions.classList.add("workout-exercise-instructions");

    const instructionsTitle = document.createElement("h2");
    instructionsTitle.textContent = "Instructions";

    const instructionsText = document.createElement("p");
    instructionsText.textContent = workoutExercise.instructions || "Aucune instruction.";

    instructions.append(instructionsTitle, instructionsText);

    // ========================================================
    // NOTES
    // ========================================================

    const notes = document.createElement("label");
    notes.classList.add("workout-exercise-notes");

    const notesTitle = document.createElement("strong");
    notesTitle.textContent = "Notes";

    const textarea = document.createElement("textarea");
    textarea.maxLength = 500;
    textarea.value = draft.notes;
    textarea.placeholder = "Ajouter une note...";

    textarea.addEventListener("input", () => {
        draft.notes = textarea.value.slice(0, 500);
    });

    notes.append(notesTitle, textarea);

// ========================================================
// LOG
// ========================================================

const logArea =
    document.createElement("div");

logArea.classList.add(
    "workout-log-area"
);

const logButton =
    document.createElement("button");

logButton.type = "button";

logButton.classList.add(
    "workout-log-button",
    completed
        ? "is-edit"
        : "is-new"
);

logButton.textContent =
    completed
        ? "Modifier le log"
        : "Log et continuer";

function setLogAvailable(available) {
    logArea.hidden = !available;
}

setLogAvailable(logAvailable);

logButton.addEventListener(
    "click",
    async () => {
        if (completed) {
            const confirmed =
                await confirmLogModification();

            if (!confirmed) return;
        }

        logButton.disabled = true;

        try {
            await onLog(
                target,
                draft,
                {
                    isEdit: completed
                }
            );
        } finally {
            logButton.disabled = false;
        }
    }
);

logArea.appendChild(logButton);

page.append(
    header,
    mapButton,
    controls,
    instructions,
    notes,
    logArea
);

container.appendChild(page);

renderExerciseMuscleMap(
    map,
    exercise,
    { compact: true }
);

return {
    setLogAvailable
};
}

export {
    renderWorkoutExerciseView,
    clearWorkoutExerciseView
};