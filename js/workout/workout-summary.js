import { createProgressionPreferenceSelect } from "../training/progression-preferences.js";
import { getProgressionId, getProgressionName } from "../exercises/exercise-search.js";

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
    getExerciseRecordAchievements,
    groupEntriesBySeries
} from "../history/exercise-history.js";

import {
    formatExerciseRecordValue,
    renderExerciseHistoryPanel
} from "../history/exercise-history-view.js";

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
        `${volume} x ` +
        `${log.weight} ${log.weightUnit}`
    );
}

function formatSeriesEntry(entry) {
    const side = entry.sideKey === "left" ? "G: " : entry.sideKey === "right" ? "D: " : "";
    return `${side}${formatSeriesVolume(entry.log)}`;
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

function clearLogSelection(card) {
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

    const sideLabel = getWorkoutSideLabel(entry.sideKey);
    row.setAttribute("aria-label", `Série ${entry.series.number}${sideLabel ? ` | ${sideLabel}` : ""} : ${formatSeriesVolume(entry.log)}`);

    const volume =
        document.createElement("span");

    volume.textContent = formatSeriesEntry(entry);

    row.appendChild(volume);

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
    group,
    recordAchievements = []
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

    const historyButton = document.createElement("button");
    historyButton.type = "button";
    historyButton.classList.add("workout-summary-history-link");
    historyButton.textContent = group.exercise.nom;
    historyButton.setAttribute("aria-label", `Historique de ${group.exercise.nom}`);
    name.appendChild(historyButton);

    const progression = document.createElement("div");
    progression.classList.add("workout-summary-progression");
    const progressionName = document.createElement("span");
    progressionName.textContent = getProgressionName(group.exercise) || "—";
    progression.appendChild(progressionName);
    const preference = createProgressionPreferenceSelect(getProgressionId(group.exercise), getProgressionName(group.exercise));
    if (preference) progression.appendChild(preference);
    information.append(name, progression);

    if (recordAchievements.length) {
        const recordList = document.createElement("div");
        recordList.className = "workout-summary-new-record-list";
        recordAchievements.forEach(record => {
            const line = document.createElement("div");
            line.className = "workout-summary-new-record";
            line.textContent = `🏆 ${record.label} — ${formatExerciseRecordValue(record)}`;
            recordList.appendChild(line);
        });
        information.appendChild(recordList);
    }

    main.append(
        map,
        information
    );

    const details =
        document.createElement("div");

    details.classList.add(
        "workout-summary-exercise-details"
    );


const logs =
    document.createElement("div");

logs.classList.add(
    "workout-summary-log-list"
);

groupEntriesBySeries(group.entries).forEach(entries => {
    const line = document.createElement("div");
    line.classList.add("workout-summary-series-line");
    entries.forEach((entry, index) => {
        if (index > 0) {
            const separator = document.createElement("span");
            separator.classList.add("workout-summary-series-separator");
            separator.textContent = "|";
            separator.setAttribute("aria-hidden", "true");
            line.appendChild(separator);
        }
        line.appendChild(createLogItem(entry, card, session));
    });
    logs.appendChild(line);
});

details.appendChild(logs);

historyButton.addEventListener("click", event => {
    event.stopPropagation();
    renderExerciseHistory(group.exercise);
});

information.appendChild(details);
card.appendChild(main);

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

function renderExerciseHistory(exercise) {
    const host = page.querySelector("#workout-summary-exercise-history");
    if (!host) return;
    renderExerciseHistoryPanel(host, { exercise, workoutHistory: getWorkoutHistory(), onOpenWorkout: onOpenHistoryWorkout });
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
        const item =
            row.closest(
                ".workout-summary-log-item"
            );

        const editButton =
            item?.querySelector(
                ".workout-summary-edit-log"
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

    const seriesCount = groupEntriesBySeries(entries).length;
    page.querySelector(
        "#workout-summary-series-count"
    ).textContent =
        `${seriesCount} série` +
        `${seriesCount !== 1 ? "s" : ""}`;

    const recordHistory = getWorkoutHistory().some(item => String(item.id) === String(session.id)) ? getWorkoutHistory() : [session, ...getWorkoutHistory()];
    const achievementsByExercise = new Map(groups.map(group => {
        const historyRecords = getExerciseHistory(recordHistory, group.exercise);
        return [getExerciseKey(group.exercise), getExerciseRecordAchievements(historyRecords, session)];
    }));
    const newRecordCount = [...achievementsByExercise.values()].reduce((total, records) => total + records.length, 0);
    const recordCount = page.querySelector("#workout-summary-record-count");
    if (recordCount) recordCount.textContent = `🏆 ${newRecordCount} nouveau record${newRecordCount !== 1 ? "s" : ""}`;

    groups.forEach(group => {
        exerciseList.appendChild(createExerciseSummaryCard(session, group, achievementsByExercise.get(getExerciseKey(group.exercise)) ?? []));
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

            page.querySelectorAll(".workout-summary-exercise-card").forEach(card => {
                if (!card.contains(event.target)) clearLogSelection(card);
            });
        },
        true
    );
}

export {
    configureWorkoutSummary,
    setupWorkoutSummary,
    renderWorkoutSummary
};
