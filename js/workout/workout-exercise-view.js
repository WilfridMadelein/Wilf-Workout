import { createWorkoutDurationTimer } from "./workout-duration-timer.js";

import { createProgressionPreferenceSelect } from "../training/progression-preferences.js";
import { setupNumberInput, normalizeNumber } from "../ui/ui.js";

import {
    renderExerciseMuscleMap,
    destroyExerciseMuscleMapsIn
} from "../exercises/exercise-muscle-map.js";

import { getProgressionId, getProgressionName } from "../exercises/exercise-search.js";

import {
    formatReserveToFailure,
    getReserveToFailureOptions,
    normalizeReserveToFailure
} from "../training/reserve-to-failure.js";

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

function createReserveToFailureSelect(draft) {
    const select = document.createElement("select");

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Non renseigné";
    select.appendChild(empty);

    const values = getReserveToFailureOptions(draft.value, draft.valueUnit);
    const current = normalizeReserveToFailure(draft.reserveToFailure);

    values.forEach(value => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = value === values.at(-1)
            ? `${value} + ${draft.valueUnit === "sec" ? "sec" : "rep"}`
            : formatReserveToFailure(value, draft.valueUnit);
        select.appendChild(option);
    });

    if (current !== null && !values.includes(current)) {
        const option = document.createElement("option");
        option.value = String(current);
        option.textContent = formatReserveToFailure(current, draft.valueUnit);
        select.appendChild(option);
    }

    select.value = current === null ? "" : String(current);

    select.addEventListener("change", () => {
        draft.reserveToFailure = normalizeReserveToFailure(select.value);
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

const durationTimerCleanup = new WeakMap();

function clearWorkoutExerciseView(container) {
    durationTimerCleanup.get(container)?.();
    durationTimerCleanup.delete(container);
    destroyExerciseMuscleMapsIn(container);
    container.replaceChildren();
}

function renderWorkoutExerciseView(container, session, target, {
    onBack = () => {},
    onLog = async () => {},
    logAvailable = true,
    isLastInSet = false,
    draftValues = null
} = {}) {
    clearWorkoutExerciseView(container);

    const workoutExercise = target.workoutExercise;
    const exercise = workoutExercise.exercise;
    const draft = { ...getWorkoutTargetValues(target), ...draftValues };
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

name.classList.add(
    "workout-exercise-title"
);

name.textContent =
    `S${target.set.group} - ${exercise.nom}`;

if (
    target.set?.isSuperset &&
    target.set?.colorIndex
) {
    name.classList.add(
        `workout-superset-color-${target.set.colorIndex}`
    );
}

    const progression = document.createElement("div");
    progression.classList.add("workout-exercise-screen-progression");
    progression.textContent = getProgressionName(exercise) || "—";

    const preference = createProgressionPreferenceSelect(getProgressionId(exercise), getProgressionName(exercise));
    if (preference) progression.appendChild(preference);

    heading.append(name, progression);
    header.append(back, heading);

    back.addEventListener("click", () => {
        onBack(target, draft);
    });

// ========================================================
// SÉRIE / CÔTÉ
// ========================================================

const seriesContext = document.createElement("div");
seriesContext.classList.add("workout-exercise-series-context");

const seriesLabel = document.createElement("strong");
seriesLabel.textContent = `Série ${target.series.number}`;

seriesContext.appendChild(seriesLabel);

if (workoutExercise.splitType === "split") {
    const side = document.createElement("span");
    side.textContent = ` | ${getWorkoutSideLabel(target.sideKey)}`;
    seriesContext.appendChild(side);
}

heading.appendChild(seriesContext);

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

    let durationTimer = null;
    durationTimerCleanup.set(container, () => durationTimer?.destroy());

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
            durationTimer?.refresh();
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
            updateDurationTimer();
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

    controls.append(
        createControlRow("Volume", volume),
        createControlRow("Poids", weight),
        createControlRow("Tempo", tempo)
    );

    function updateDurationTimer() {
        if (draft.valueUnit !== "sec" || completed) {
            durationTimer?.destroy();
            durationTimer?.element.remove();
            durationTimer = null;
            draft.exerciseTimer = null;
            return;
        }
        if (durationTimer) return;
        durationTimer = createWorkoutDurationTimer({
            getDuration: () => normalizeNumber(volumeNumber.querySelector("input").value, { min: 1, max: 999, decimals: 0 }),
            saved: draft.exerciseTimer,
            globallyPaused: session.isPaused
        });
        draft.exerciseTimer = null;
        controls.appendChild(durationTimer.element);
    }
    updateDurationTimer();
    volumeNumber.addEventListener("input", () => durationTimer?.refresh());

if (completed) {
    const reserve = document.createElement("div");
    reserve.classList.add("workout-exercise-control-values");
    reserve.appendChild(createReserveToFailureSelect(draft));

    controls.appendChild(
        createControlRow("Réserve avant échec", reserve)
    );
}

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

const logMainText = document.createElement("span");
logMainText.classList.add("workout-log-main-text");

logMainText.textContent =
    completed
        ? "Modifier le log"
        : "Log et continuer";

logButton.appendChild(logMainText);

if (!completed && isLastInSet) {
    const endSetText = document.createElement("span");
    endSetText.classList.add("workout-log-end-set");
    endSetText.textContent = "Fin du set";

    logButton.appendChild(endSetText);
}

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
    setLogAvailable,
    setTimerPaused: value => durationTimer?.setGlobalPaused(value),
    getDraft: () => ({
        ...structuredClone(draft),
        exerciseTimer: durationTimer?.snapshot() ?? null,
        value: normalizeNumber(volumeNumber.querySelector("input").value, { min: 1, max: 999, decimals: 0 }),
        weight: normalizeNumber(weightNumber.querySelector("input").value, { min: 0, max: 9999.9, decimals: 1 }),
        tempo: Object.fromEntries(["first", "second", "third", "fourth"].map((key, index) => [
            key, Math.max(0, Math.min(999, Number(tempo.querySelectorAll("input")[index].value) || 0))
        ]))
    })
};
}

export {
    renderWorkoutExerciseView,
    clearWorkoutExerciseView
};