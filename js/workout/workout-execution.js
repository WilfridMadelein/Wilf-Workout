import {
    createWorkoutSession,
    findFirstPendingWorkoutTarget,
    findFirstPendingTargetInSet,
    findFirstPendingTargetInExercise,
    getNextPendingWorkoutTarget,
    saveWorkoutTargetLog,
    getRestAfterWorkoutTarget
} from "./workout-session.js";

import {
    renderWorkoutOverview,
    clearWorkoutOverview
} from "./workout-overview.js";

import {
    renderWorkoutExerciseView,
    clearWorkoutExerciseView
} from "./workout-exercise-view.js";

import {
    setupWorkoutRestTimer,
    startWorkoutRestTimer,
    stopWorkoutRestTimer,
    pauseWorkoutRestTimer,
    resumeWorkoutRestTimer,
    isWorkoutRestTimerActive
} from "./workout-rest-timer.js";

// ============================================================
// ÉTAT
// ============================================================

let page;
let exitButton;
let elapsedTime;
let timerToggleButton;
let planName;
let beginButton;
let content;
let exitModal;
let confirmExitButton;
let continueButton;
let finishButton;

let onFinishWorkout = async () => {};

let session = null;
let currentTarget = null;
let currentExerciseView = null;

let timerInterval = null;

// ============================================================
// CONFIGURATION
// ============================================================

function configureWorkoutExecution(dependencies) {
    ({
        page,
        exitButton,
        elapsedTime,
        timerToggleButton,
        planName,
        beginButton,
        content,
        exitModal,
        confirmExitButton,
        continueButton,
        finishButton,
        onFinishWorkout = async () => {}
    } = dependencies);
}

// ============================================================
// CHRONOMÈTRE GLOBAL
// ============================================================

function formatElapsedTime(totalSeconds) {
    const seconds =
        Math.max(
            0,
            Math.floor(totalSeconds)
        );

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const remainingSeconds =
        seconds % 60;

    if (hours > 0) {
        return (
            `${hours}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(remainingSeconds).padStart(2, "0")}`
        );
    }

    return (
        `${minutes}:` +
        `${String(remainingSeconds).padStart(2, "0")}`
    );
}

function getElapsedMilliseconds() {
    if (!session) return 0;

    const now =
        session.isPaused
            ? session.pausedAt
            : Date.now();

    return Math.max(
        0,
        now -
        session.startedAt -
        session.totalPausedMs
    );
}

function refreshElapsedTime() {
    if (!session) return;

    session.elapsedSeconds =
        Math.floor(
            getElapsedMilliseconds() /
            1000
        );

    elapsedTime.textContent =
        formatElapsedTime(
            session.elapsedSeconds
        );
}

function stopWorkoutTimerInterval() {
    if (!timerInterval) return;

    clearInterval(timerInterval);
    timerInterval = null;
}

function startWorkoutTimerInterval() {
    stopWorkoutTimerInterval();

    if (
        !session ||
        session.isPaused
    ) {
        return;
    }

    timerInterval =
        window.setInterval(
            refreshElapsedTime,
            1000
        );
}

function refreshTimerToggleButton() {
    if (!session) return;

    if (session.isPaused) {
        timerToggleButton.textContent = "▶";

        timerToggleButton.setAttribute(
            "aria-label",
            "Reprendre le chronomètre"
        );

        timerToggleButton.title =
            "Reprendre le chronomètre";

        return;
    }

    timerToggleButton.textContent = "⏸";

    timerToggleButton.setAttribute(
        "aria-label",
        "Mettre le chronomètre en pause"
    );

    timerToggleButton.title =
        "Mettre le chronomètre en pause";
}

function pauseWorkoutTimer() {
    if (
        !session ||
        session.isPaused
    ) {
        return;
    }

    refreshElapsedTime();

    session.isPaused = true;
    session.pausedAt = Date.now();

    stopWorkoutTimerInterval();
    pauseWorkoutRestTimer();

    refreshTimerToggleButton();
}

function resumeWorkoutTimer() {
    if (
        !session ||
        !session.isPaused
    ) {
        return;
    }

    session.totalPausedMs +=
        Date.now() -
        session.pausedAt;

    session.pausedAt = null;
    session.isPaused = false;

    resumeWorkoutRestTimer();
    refreshElapsedTime();
    startWorkoutTimerInterval();

    refreshTimerToggleButton();
}

function toggleWorkoutTimer() {
    if (!session) return;

    if (session.isPaused) {
        resumeWorkoutTimer();
    } else {
        pauseWorkoutTimer();
    }
}

// ============================================================
// ÉCRANS
// ============================================================

function getShell() {
    return page.querySelector(
        ".workout-execution-shell"
    );
}

function showOverview() {
    if (!session) return;

    currentTarget = null;
    currentExerciseView = null;

    session.screen = "overview";

    getShell()?.classList.remove(
        "is-exercise-screen"
    );

    renderWorkoutOverview(
        content,
        session,
        {
            onFinish:
                finishWorkoutExecution,

            onOpenSet: set => {
                const target =
                    findFirstPendingTargetInSet(
                        session,
                        set.id
                    );

                if (target) {
                    showExercise(target);
                }
            },

            onOpenExercise: (
                workoutExercise,
                series = null,
                sideKey = null
            ) => {
                let target = null;

                if (
                    series &&
                    sideKey
                ) {
                    target = {
                        set:
                            session.sets.find(
                                set =>
                                    set.exercises.includes(
                                        workoutExercise
                                    )
                            ),

                        workoutExercise,
                        series,
                        sideKey
                    };
                } else {
                    target =
                        findFirstPendingTargetInExercise(
                            session,
                            workoutExercise.id
                        );
                }

                if (target) {
                    showExercise(target);
                }
            }
        }
    );

    page.scrollTop = 0;
}

function showExercise(target) {
    if (
        !session ||
        !target
    ) {
        return;
    }

    currentTarget = target;
    session.screen = "exercise";

    getShell()?.classList.add(
        "is-exercise-screen"
    );

    currentExerciseView =
        renderWorkoutExerciseView(
            content,
            session,
            target,
            {
                onBack:
                    showOverview,

                logAvailable:
                    !isWorkoutRestTimerActive(),

                onLog:
                    handleWorkoutLog
            }
        );

    page.scrollTop = 0;
}

// ============================================================
// LOG
// ============================================================

async function handleWorkoutLog(
    loggedTarget,
    values,
    { isEdit = false } = {}
) {
    if (!session) return;

    saveWorkoutTargetLog(
        loggedTarget,
        values
    );

    // Un log existant vient simplement d'être corrigé.
    if (isEdit) {
        showOverview();
        return;
    }

    const next =
        getNextPendingWorkoutTarget(
            session,
            loggedTarget
        );

    // Plus rien à exécuter.
    if (!next) {
        showOverview();
        return;
    }

    const restSeconds =
        getRestAfterWorkoutTarget(
            loggedTarget,
            next,
            values
        );

    if (restSeconds > 0) {
        startWorkoutRestTimer(
            restSeconds,
            {
                onComplete: () => {
                    currentExerciseView
                        ?.setLogAvailable(
                            true
                        );
                }
            }
        );

        if (session.isPaused) {
            pauseWorkoutRestTimer();
        }
    }

    showExercise(next);
}

// ============================================================
// SORTIE
// ============================================================

function openExitModal() {
    if (!session) return;

    exitModal.hidden = false;
}

function closeExitModal() {
    exitModal.hidden = true;
}

function leaveWorkoutExecution() {
    stopWorkoutTimerInterval();
    stopWorkoutRestTimer();

    clearWorkoutOverview(content);
    clearWorkoutExerciseView(content);

    session = null;
    currentTarget = null;
    currentExerciseView = null;

    exitModal.hidden = true;
    page.hidden = true;

    elapsedTime.textContent = "0:00";
    planName.textContent = "";

    document.body.classList.remove(
        "workout-execution-active"
    );

    getShell()?.classList.remove(
        "is-exercise-screen"
    );
}

// ============================================================
// FIN
// ============================================================

async function finishWorkoutExecution() {
    if (!session) return;

    refreshElapsedTime();
    stopWorkoutRestTimer();

    finishButton.disabled = true;

    try {
        await onFinishWorkout(session);
        leaveWorkoutExecution();
    } finally {
        finishButton.disabled = false;
    }
}

// ============================================================
// DÉMARRAGE
// ============================================================

function startWorkoutExecution(plan) {
    if (!plan) return;

    stopWorkoutTimerInterval();
    stopWorkoutRestTimer();

    session =
        createWorkoutSession(plan);

    currentTarget = null;
    currentExerciseView = null;

    planName.textContent =
        session.planName;

    elapsedTime.textContent =
        "0:00";

    exitModal.hidden = true;
    page.hidden = false;

    document.body.classList.add(
        "workout-execution-active"
    );

    refreshTimerToggleButton();

    showOverview();
    refreshElapsedTime();
    startWorkoutTimerInterval();
}

function getWorkoutExecutionSession() {
    return session;
}

// ============================================================
// INITIALISATION
// ============================================================

function setupWorkoutExecution() {
    setupWorkoutRestTimer(page);

    exitButton.addEventListener(
        "click",
        openExitModal
    );

    continueButton.addEventListener(
        "click",
        closeExitModal
    );

    confirmExitButton.addEventListener(
        "click",
        leaveWorkoutExecution
    );

    finishButton.addEventListener(
        "click",
        finishWorkoutExecution
    );

    timerToggleButton.addEventListener(
        "click",
        toggleWorkoutTimer
    );

    beginButton.addEventListener(
        "click",
        () => {
            if (!session) return;

            const target =
                findFirstPendingWorkoutTarget(
                    session
                );

            if (target) {
                showExercise(target);
            }
        }
    );
}

export {
    configureWorkoutExecution,
    setupWorkoutExecution,
    startWorkoutExecution,
    getWorkoutExecutionSession
};