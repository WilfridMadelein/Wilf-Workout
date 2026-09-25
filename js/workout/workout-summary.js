import {
    renderExerciseMuscleMap,
    destroyExerciseMuscleMapsIn
} from "../exercises/exercise-muscle-map.js";

import {
    getWorkoutExerciseSides,
    getWorkoutSideLabel,
    getWorkoutSeriesLog,
    isWorkoutSetCompleted
} from "./workout-session.js";

import {
    workoutCompletionMessages
} from "../../data/workout-completion-messages.js";

import {
    getExerciseHistory,
    getExerciseRecords
} from "../history/exercise-history.js";

// ============================================================
// DÉPENDANCES
// ============================================================

let page;
let getAppSettings = () => ({ bodyModel: "male" });
let saveAppSettingsNow = async () => {};
let onClose = () => {};
let onEditLog = () => {};
let onSessionUpdated = async () => {};
let getWorkoutHistory = () => [];
let onOpenHistoryWorkout = async () => {};

let currentSession = null;
let isSetup = false;

let currentMode = "completion";

function configureWorkoutSummary(dependencies) {
    ({
        page,
        getAppSettings,
        saveAppSettingsNow,
        onClose = () => {},
        onEditLog = () => {},
        onSessionUpdated = async () => {},
        getWorkoutHistory = () => [],
        onOpenHistoryWorkout = async () => {}
    } = dependencies);
}

// ============================================================
// FORMAT
// ============================================================

function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (!minutes) return `${remainingSeconds} sec`;
    if (!remainingSeconds) return `${minutes} min`;
    return `${minutes} min ${remainingSeconds} sec`;
}

function formatTempo(tempo = {}) {
    return ["first", "second", "third", "fourth"]
        .map((key, index) => {
            const value = tempo[key] ?? 0;
            return value === 0 && (index === 0 || index === 2)
                ? "X"
                : value;
        })
        .join(" · ");
}

function formatSeriesVolume(log) {
    const unit =
        log.valueUnit === "sec"
            ? "sec"
            : "rep";

    const volume =
        `${log.value} ${unit}`;

    const weight =
        Number(log.weight) || 0;

    if (weight <= 0) {
        return volume;
    }

    return (
        `${volume} X ` +
        `${log.weight} ${log.weightUnit}`
    );
}

// ============================================================
// MESSAGE DE FÉLICITATION
// ============================================================

function getCompletionMessageById(id) {
    return workoutCompletionMessages.find(message => message.id === id) ?? null;
}

async function getCompletionMessage(session) {
    let message = getCompletionMessageById(session.completionMessageId);
    const settings = getAppSettings();

    if (!message) {
        const previousId = settings.lastWorkoutCompletionMessageId;

        const differentMessages =
            workoutCompletionMessages.filter(
                item => item.id !== previousId
            );

        const candidates =
            differentMessages.length
                ? differentMessages
                : workoutCompletionMessages;

        message =
            candidates[
                Math.floor(
                    Math.random() *
                    candidates.length
                )
            ] ?? null;

        if (message) {
            session.completionMessageId =
                message.id;

            settings.lastWorkoutCompletionMessageId =
                message.id;

            try {
                await saveAppSettingsNow(settings);
            } catch (error) {
                console.error(
                    "Impossible de sauvegarder le message de félicitation :",
                    error
                );
            }
        }
    }

    if (!message) return "Bien joué ;)";

    return settings.bodyModel === "female"
        ? message.female
        : message.male;
}

// ============================================================
// LOGS COMPLÉTÉS
// ============================================================

function getCompletedWorkoutEntries(session) {
    const entries = [];

    session.sets.forEach(set => {
        set.exercises.forEach(workoutExercise => {
            workoutExercise.series.forEach(series => {
                getWorkoutExerciseSides(
                    workoutExercise
                ).forEach(side => {
                    const log =
                        getWorkoutSeriesLog(
                            series,
                            side.key
                        );

                    if (!log?.completedAt) return;

                    entries.push({
                        set,
                        workoutExercise,
                        series,
                        sideKey: side.key,
                        log
                    });
                });
            });
        });
    });

    return entries;
}

function getExerciseKey(exercise) {
    return String(
        exercise?.ID ??
        exercise?.nom ??
        "exercise"
    );
}

function groupCompletedEntriesByExercise(entries) {
    const groups = new Map();

    entries.forEach(entry => {
        const exercise =
            entry.workoutExercise.exercise;

        const key =
            getExerciseKey(exercise);

        if (!groups.has(key)) {
            groups.set(key, {
                exercise,
                entries: []
            });
        }

        groups
            .get(key)
            .entries
            .push(entry);
    });

    return [...groups.values()];
}

function getExerciseTotals(group) {
    let repetitions = 0;
    let seconds = 0;

    group.entries.forEach(entry => {
        const value =
            Math.max(
                0,
                Number(entry.log.value) || 0
            );

        if (
            entry.log.valueUnit === "sec"
        ) {
            seconds += value;
            return;
        }

        const multiplier =
            entry.workoutExercise.splitType ===
            "alternate"
                ? 2
                : 1;

        repetitions +=
            value * multiplier;
    });

    return {
        repetitions,
        seconds
    };
}

function formatExerciseTotals(group) {
    const {
        repetitions,
        seconds
    } = getExerciseTotals(group);

    const parts = [];

    if (repetitions > 0) {
        parts.push(
            `${repetitions} répétition` +
            `${repetitions !== 1 ? "s" : ""}`
        );
    }

    if (seconds > 0) {
        parts.push(
            formatDuration(seconds)
        );
    }

    return parts.length
        ? `Total : ${parts.join(" · ")}`
        : "Total : —";
}

// ============================================================
// CONFETTIS
// ============================================================

function launchOrangeConfetti(
    container,
    session
) {
    container.replaceChildren();

    if (
        session.completionConfettiShown
    ) {
        return;
    }

    session.completionConfettiShown = true;

    for (
        let index = 0;
        index < 28;
        index += 1
    ) {
        const piece =
            document.createElement("span");

        piece.classList.add(
            "workout-summary-confetti-piece"
        );

        piece.style.setProperty(
            "--confetti-left",
            `${4 + Math.random() * 92}%`
        );

        piece.style.setProperty(
            "--confetti-delay",
            `${Math.random() * 0.45}s`
        );

        piece.style.setProperty(
            "--confetti-duration",
            `${1.5 + Math.random() * 1.1}s`
        );

        piece.style.setProperty(
            "--confetti-drift",
            `${-45 + Math.random() * 90}px`
        );

        piece.style.setProperty(
            "--confetti-rotation",
            `${180 + Math.random() * 540}deg`
        );

        container.appendChild(piece);
    }
}

// ============================================================
// DÉTAILS D'UN EXERCICE
// ============================================================

function setDetailsOpen(card, open) {
    const details =
        card.querySelector(
            ".workout-summary-exercise-details"
        );

    const toggle =
        card.querySelector(
            ".workout-summary-details-toggle"
        );

    card.classList.toggle(
        "is-details-open",
        open
    );

    details.hidden = !open;

    toggle.setAttribute(
        "aria-expanded",
        String(open)
    );

    if (open) return;

    card
        .querySelectorAll(
            ".workout-summary-log-row.is-selected"
        )
        .forEach(row => {
            row.classList.remove(
                "is-selected"
            );
        });

    card
        .querySelectorAll(
            ".workout-summary-edit-log"
        )
        .forEach(button => {
            button.hidden = true;
        });
}

function closeOtherDetails(
    currentCard = null
) {
    page
        .querySelectorAll(
            ".workout-summary-exercise-card.is-details-open"
        )
        .forEach(card => {
            if (card !== currentCard) {
                setDetailsOpen(
                    card,
                    false
                );
            }
        });
}

function createLogItem(
    entry,
    card,
    session
) {
    const item =
        document.createElement("div");

    item.classList.add(
        "workout-summary-log-item"
    );

    const row =
        document.createElement("button");

    row.type = "button";

    row.classList.add(
        "workout-summary-log-row"
    );

    row.dataset.workoutExerciseId =
        entry.workoutExercise.id;

    row.dataset.seriesId =
        entry.series.id;

    row.dataset.sideKey =
        entry.sideKey;

    const heading =
        document.createElement("strong");

    const sideLabel =
        getWorkoutSideLabel(
            entry.sideKey
        );

    heading.textContent =
        `Set ${entry.set.group} · ` +
        `Série ${entry.series.number}` +
        (
            sideLabel
                ? ` | ${sideLabel}`
                : ""
        );

    const volume =
        document.createElement("span");

    volume.textContent =
        formatSeriesVolume(
            entry.log
        );

    row.append(
        heading,
        volume
    );

    if (
        entry.log.notes?.trim()
    ) {
        const note =
            document.createElement("span");

        note.classList.add(
            "workout-summary-log-note"
        );

        note.textContent =
            `Note : ${entry.log.notes.trim()}`;

        row.appendChild(note);
    }

    const editButton =
        document.createElement("button");

    editButton.type = "button";

    editButton.classList.add(
        "workout-summary-edit-log"
    );

    editButton.textContent =
        "Modifier le log";

    editButton.hidden = true;

    row.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            card
                .querySelectorAll(
                    ".workout-summary-log-row.is-selected"
                )
                .forEach(otherRow => {
                    otherRow.classList.remove(
                        "is-selected"
                    );
                });

            card
                .querySelectorAll(
                    ".workout-summary-edit-log"
                )
                .forEach(otherButton => {
                    otherButton.hidden = true;
                });

            row.classList.add(
                "is-selected"
            );

            editButton.hidden = false;
        }
    );

    editButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            const returnState = {
                scrollY:
                    window.scrollY,

                workoutExerciseId:
                    entry.workoutExercise.id,

                seriesId:
                    entry.series.id,

                sideKey:
                    entry.sideKey
            };

            page.hidden = true;

            onEditLog(
                session,
                entry,
async () => {
    page.hidden = false;

    await onSessionUpdated(
        session
    );

await renderWorkoutSummary(session, {
    mode: currentMode,
    scrollToSummary: false,
    restoreState: returnState
});
}
            );
        }
    );

    item.append(
        row,
        editButton
    );

    return item;
}

function createExerciseSummaryCard(
    session,
    group
) {
    const card =
        document.createElement("article");

    card.classList.add(
        "workout-summary-exercise-card"
    );

    const main =
        document.createElement("div");

    main.classList.add(
        "workout-summary-exercise-main"
    );

    const map =
        document.createElement("div");

    map.classList.add(
        "exercise-muscle-map",
        "workout-summary-exercise-map"
    );

    const information =
        document.createElement("div");

    information.classList.add(
        "workout-summary-exercise-information"
    );

    const name =
        document.createElement("h3");

    name.textContent =
        group.exercise.nom;

    const total =
        document.createElement("strong");

    total.classList.add(
        "workout-summary-exercise-total"
    );

    total.textContent =
        formatExerciseTotals(group);

    const toggle =
        document.createElement("button");

    toggle.type = "button";

    toggle.classList.add(
        "workout-summary-details-toggle"
    );

    toggle.setAttribute(
        "aria-expanded",
        "false"
    );

    toggle.setAttribute(
        "aria-label",
        `Voir les séries de ${group.exercise.nom}`
    );

const historyButton = document.createElement("button");
historyButton.type = "button";
historyButton.classList.add("workout-summary-history-link");
historyButton.textContent = "Historique";

information.append(name, total, historyButton, toggle);

    main.append(
        map,
        information
    );

    const details =
        document.createElement("div");

    details.classList.add(
        "workout-summary-exercise-details"
    );

    details.hidden = true;

const logs =
    document.createElement("div");

logs.classList.add(
    "workout-summary-log-list"
);

group.entries.forEach(entry => {
    logs.appendChild(
        createLogItem(
            entry,
            card,
            session
        )
    );
});

details.appendChild(logs);

toggle.addEventListener(
    "click",
    event => {
        event.stopPropagation();

        const open =
            !card.classList.contains(
                "is-details-open"
            );

        closeOtherDetails(card);

        setDetailsOpen(
            card,
            open
        );
    }
);

historyButton.addEventListener("click", event => {
    event.stopPropagation();
    renderExerciseHistory(group.exercise);
});

card.append(
    main,
    details
);

    requestAnimationFrame(() => {
        if (!map.isConnected) return;

        renderExerciseMuscleMap(
            map,
            group.exercise,
            { compact: true }
        );
    });

    return card;
}

// ============================================================
// HISTORIQUE D'UN EXERCICE
// ============================================================

function formatHistoryDate(timestamp) {
    return new Intl.DateTimeFormat("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp)).replaceAll(".", "");
}

function formatHistoryValue(value, unit) {
    if (unit === "sec") return formatDuration(value);
    return `${value} rep${Number(value) !== 1 ? "s" : ""}`;
}

function formatHistoryEntry(entry) {
    const value = formatHistoryValue(entry.log.value, entry.log.valueUnit);
    const weight = Math.max(0, Number(entry.log.weight) || 0);
    const side = entry.sideLabel ? ` · ${entry.sideLabel}` : "";
    return `Série ${entry.seriesNumber}${side} : ${value}${weight > 0 ? ` X ${entry.log.weight} ${entry.log.weightUnit}` : ""}`;
}

function createRecordItem(label, value) {
    const item = document.createElement("div");
    item.className = "workout-summary-history-record";

    const title = document.createElement("span");
    title.textContent = label;

    const result = document.createElement("strong");
    result.textContent = value;

    item.append(title, result);
    return item;
}

function renderExerciseRecords(container, records) {
    const values = [];

    if (records.totalValue) values.push([
        records.totalValue.unit === "sec" ? "Durée totale" : "Répétitions totales",
        formatHistoryValue(records.totalValue.value, records.totalValue.unit)
    ]);

    if (records.singleValue) values.push([
        records.singleValue.unit === "sec" ? "Durée en une série" : "Répétitions en une série",
        formatHistoryValue(records.singleValue.value, records.singleValue.unit)
    ]);

    if (records.singleVolume) values.push(["Volume en une série", `${Math.round(records.singleVolume.value * 100) / 100} ${records.singleVolume.unit}`]);
    if (records.totalVolume) values.push(["Volume total", `${Math.round(records.totalVolume.value * 100) / 100} ${records.totalVolume.unit}`]);
    if (records.maxWeight) values.push(["Poids utilisé", `${records.maxWeight.weight} ${records.maxWeight.unit}`]);
    if (!values.length) return;

    const section = document.createElement("section");
    section.className = "workout-summary-history-records";

    const title = document.createElement("h4");
    title.textContent = "Records";

    const list = document.createElement("div");
    list.className = "workout-summary-history-record-list";
    values.forEach(([label, value]) => list.appendChild(createRecordItem(label, value)));

    section.append(title, list);
    container.appendChild(section);
}

function createExerciseHistoryWorkout(record) {
    const row = document.createElement("article");
    row.className = "workout-summary-history-workout";

    const dateColumn = document.createElement("div");
    dateColumn.className = "workout-summary-history-date-column";

    const dateButton = document.createElement("button");
    dateButton.type = "button";
    dateButton.className = "workout-summary-history-date";
    dateButton.textContent = formatHistoryDate(record.session.startedAt);

    const openWorkoutButton = document.createElement("button");
    openWorkoutButton.type = "button";
    openWorkoutButton.className = "workout-summary-edit-log workout-summary-history-open-workout";
    openWorkoutButton.textContent = "Voir l'entraînement complet";
    openWorkoutButton.hidden = true;

    dateButton.addEventListener("click", () => { openWorkoutButton.hidden = !openWorkoutButton.hidden; });
    openWorkoutButton.addEventListener("click", () => onOpenHistoryWorkout(record.session));

    dateColumn.append(dateButton, openWorkoutButton);

    const series = document.createElement("div");
    series.className = "workout-summary-history-series";

    record.entries.forEach(entry => {
        const line = document.createElement("div");
        line.textContent = formatHistoryEntry(entry);
        series.appendChild(line);
    });

    row.append(dateColumn, series);
    return row;
}

function renderExerciseHistory(exercise) {
    const host = page.querySelector("#workout-summary-exercise-history");
    if (!host) return;

    const records = getExerciseHistory(getWorkoutHistory(), exercise);
    host.replaceChildren();
    host.hidden = false;

    const panel = document.createElement("section");
    panel.className = "workout-summary-history-panel is-open";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "workout-summary-history-toggle";
    toggle.setAttribute("aria-expanded", "true");

    const title = document.createElement("strong");
    title.textContent = `Historique — ${exercise.nom}`;

    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");

    toggle.append(title, arrow);

    const content = document.createElement("div");
    content.className = "workout-summary-history-content";

    renderExerciseRecords(content, getExerciseRecords(records));

    const workouts = document.createElement("div");
    workouts.className = "workout-summary-history-workouts";

    if (records.length) {
        records.forEach(record => workouts.appendChild(createExerciseHistoryWorkout(record)));
    } else {
        const empty = document.createElement("p");
        empty.className = "workout-summary-history-empty";
        empty.textContent = "Aucun historique enregistré pour cet exercice.";
        workouts.appendChild(empty);
    }

    content.appendChild(workouts);

    toggle.addEventListener("click", () => {
        const open = !panel.classList.contains("is-open");
        panel.classList.toggle("is-open", open);
        content.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
    });

    panel.append(toggle, content);
    host.appendChild(panel);

    requestAnimationFrame(() => host.scrollIntoView({ block: "nearest", behavior: "smooth" }));
}

// ============================================================
// RETOUR APRÈS MODIFICATION D'UN LOG
// ============================================================

function restoreWorkoutSummaryState(state) {
    if (!state) return;

    const rows = [
        ...page.querySelectorAll(
            ".workout-summary-log-row"
        )
    ];

    const row =
        rows.find(item =>
            item.dataset.workoutExerciseId ===
                state.workoutExerciseId &&
            item.dataset.seriesId ===
                state.seriesId &&
            item.dataset.sideKey ===
                state.sideKey
        );

    if (row) {
        const card =
            row.closest(
                ".workout-summary-exercise-card"
            );

        const item =
            row.closest(
                ".workout-summary-log-item"
            );

        const editButton =
            item?.querySelector(
                ".workout-summary-edit-log"
            );

        closeOtherDetails(card);

        setDetailsOpen(
            card,
            true
        );

        row.classList.add(
            "is-selected"
        );

        if (editButton) {
            editButton.hidden = false;
        }
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo({
                top: state.scrollY,
                behavior: "auto"
            });
        });
    });
}

// ============================================================
// RENDU
// ============================================================

async function renderWorkoutSummary(
    session,
    {
        mode = "completion",
        scrollToSummary = true,
        restoreState = null
    } = {}
) {
    if (!session) return;

    currentSession = session;
    currentMode = mode;
    session.screen = "summary";

    page.hidden = false;

    const exerciseList =
        page.querySelector(
            "#workout-summary-exercise-list"
        );

    destroyExerciseMuscleMapsIn(
        exerciseList
    );

    exerciseList.replaceChildren();

 const exerciseHistory = page.querySelector("#workout-summary-exercise-history");

if (exerciseHistory) {
    exerciseHistory.replaceChildren();
    exerciseHistory.hidden = true;
}   

    const entries =
        getCompletedWorkoutEntries(
            session
        );

    const groups =
        groupCompletedEntriesByExercise(
            entries
        );

const completedSetCount =
    session.sets.filter(
        isWorkoutSetCompleted
    ).length;

const hero = page.querySelector(".workout-summary-hero");
const thanksButton = page.querySelector("#workout-summary-thanks-button");
const confetti = page.querySelector("#workout-summary-confetti");
const showCelebration = mode === "completion";

hero.hidden = !showCelebration;
thanksButton.hidden = !showCelebration;

if (showCelebration) page.querySelector("#workout-summary-message").textContent = await getCompletionMessage(session);
else confetti.replaceChildren();

    page.querySelector(
        "#workout-summary-duration"
    ).textContent =
        formatClock(
            session.elapsedSeconds
        );

    page.querySelector(
        "#workout-summary-set-count"
    ).textContent =
        `${completedSetCount} set` +
        `${completedSetCount !== 1 ? "s" : ""}`;

    page.querySelector(
        "#workout-summary-exercise-count"
    ).textContent =
        `${groups.length} exercice` +
        `${groups.length !== 1 ? "s" : ""}`;

    page.querySelector(
        "#workout-summary-series-count"
    ).textContent =
        `${entries.length} série` +
        `${entries.length !== 1 ? "s" : ""}`;

    groups.forEach(group => {
        exerciseList.appendChild(
            createExerciseSummaryCard(
                session,
                group
            )
        );
    });

if (showCelebration) launchOrangeConfetti(confetti, session);

if (restoreState) {
    restoreWorkoutSummaryState(
        restoreState
    );

    return;
}

if (
    scrollToSummary &&
    window.matchMedia(
        "(max-width: 700px)"
    ).matches
) {
        requestAnimationFrame(() => {
            page.scrollIntoView({
                block: "start",
                behavior: "auto"
            });
        });
    }
}

function closeWorkoutSummary() {
    const exerciseList = page.querySelector("#workout-summary-exercise-list");
    destroyExerciseMuscleMapsIn(exerciseList);

    const closedSession = currentSession;
    const closedMode = currentMode;

    page.hidden = true;
    currentSession = null;
    currentMode = "completion";

    onClose(closedSession, { mode: closedMode });
}

// ============================================================
// INITIALISATION
// ============================================================

function setupWorkoutSummary() {
    if (isSetup) return;
    isSetup = true;

    page.querySelector(
        "#workout-summary-exit-button"
    ).addEventListener(
        "click",
        closeWorkoutSummary
    );

    page.querySelector(
        "#workout-summary-thanks-button"
    ).addEventListener(
        "click",
        closeWorkoutSummary
    );

    document.addEventListener(
        "pointerdown",
        event => {
            if (
                !currentSession ||
                page.hidden
            ) {
                return;
            }

            const openCard =
                page.querySelector(
                    ".workout-summary-exercise-card.is-details-open"
                );

            if (
                !openCard ||
                openCard.contains(
                    event.target
                )
            ) {
                return;
            }

            setDetailsOpen(
                openCard,
                false
            );
        },
        true
    );
}

export {
    configureWorkoutSummary,
    setupWorkoutSummary,
    renderWorkoutSummary
};