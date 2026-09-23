import {
    createWorkoutSession,
    hasWorkoutSessionLogs,
    applyWorkoutLogToFollowingSeries,
    findFirstPendingWorkoutTarget,
    findFirstPendingTargetInSet,
    findFirstPendingTargetInExercise,
    getNextPendingWorkoutTarget,
    isLastPendingTargetInSet,
    saveWorkoutTargetDraft,
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
let scrollProgress;
let scrollProgressFill;

let finishConfirmModal;
let finishConfirmContinueButton;
let finishConfirmFinishButton;

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
// PROGRESSION DE SCROLL
// ============================================================

function refreshOverviewScrollProgress() {
    if (
        !session ||
        session.screen !== "overview" ||
        !scrollProgressFill
    ) {
        return;
    }

    const maxScroll =
        Math.max(
            0,
            page.scrollHeight -
            page.clientHeight
        );

    const progress =
        maxScroll > 0
            ? Math.min(
                1,
                Math.max(
                    0,
                    page.scrollTop / maxScroll
                )
            )
            : 1;

    scrollProgressFill.style.width =
        `${progress * 100}%`;
}

function showOverviewScrollProgress() {
    scrollProgress.hidden = false;

    requestAnimationFrame(
        refreshOverviewScrollProgress
    );
}

function hideOverviewScrollProgress() {
    scrollProgress.hidden = true;
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
    showOverviewScrollProgress();

    beginButton.textContent =
    hasWorkoutSessionLogs(session)
        ? "Continuer"
        : "Débuter";

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

    requestAnimationFrame(
        refreshOverviewScrollProgress
    );
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
    hideOverviewScrollProgress();

    getShell()?.classList.add(
        "is-exercise-screen"
    );

currentExerciseView =
    renderWorkoutExerciseView(
        content,
        session,
        target,
        {
            onBack: (backTarget, values) => {
                saveWorkoutTargetDraft(
                    backTarget,
                    values
                );

                showOverview();
            },

            logAvailable:
                !isWorkoutRestTimerActive(),

            isLastInSet:
                isLastPendingTargetInSet(
                    session,
                    target
                ),

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

    applyWorkoutLogToFollowingSeries(
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
        next
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

    // Aucun log : probablement un démarrage accidentel.
    if (!hasWorkoutSessionLogs(session)) {
        leaveWorkoutExecution();
        return;
    }

    exitModal.hidden = false;
}

function closeExitModal() {
    exitModal.hidden = true;
}

function openFinishConfirmModal() {
    finishConfirmModal.hidden = false;
}

function closeFinishConfirmModal() {
    finishConfirmModal.hidden = true;
}

function leaveWorkoutExecution() {
    stopWorkoutTimerInterval();
    stopWorkoutRestTimer();

    clearWorkoutOverview(content);
    clearWorkoutExerciseView(content);

    hideOverviewScrollProgress();

    if (scrollProgressFill) {
        scrollProgressFill.style.width = "0";
    }

    session = null;
    currentTarget = null;
    currentExerciseView = null;

    exitModal.hidden = true;
    finishConfirmModal.hidden = true;
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

async function completeWorkoutExecution() {
    if (!session) return;

    refreshElapsedTime();
    stopWorkoutRestTimer();

    finishButton.disabled = true;
    finishConfirmFinishButton.disabled = true;

    try {
        await onFinishWorkout(session);
        leaveWorkoutExecution();
    } finally {
        finishButton.disabled = false;
        finishConfirmFinishButton.disabled = false;
    }
}

function finishWorkoutExecution() {
    if (!session) return;

    if (!hasWorkoutSessionLogs(session)) {
        leaveWorkoutExecution();
        return;
    }

    if (findFirstPendingWorkoutTarget(session)) {
        openFinishConfirmModal();
        return;
    }

    completeWorkoutExecution();
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
    scrollProgress =
        page.querySelector(
            "#workout-overview-scroll-progress"
        );

    scrollProgressFill =
        page.querySelector(
            "#workout-overview-scroll-progress-fill"
        );

    finishConfirmModal =
    page.querySelector(
        "#workout-finish-confirm-modal"
    );

    finishConfirmContinueButton =
    page.querySelector(
        "#workout-finish-confirm-continue"
    );

    finishConfirmFinishButton =
    page.querySelector(
        "#workout-finish-confirm-finish"
    );

    page.addEventListener(
        "scroll",
        refreshOverviewScrollProgress,
        { passive: true }
    );

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
    () => {
        closeExitModal();
        finishWorkoutExecution();
    }
    );

    finishConfirmContinueButton.addEventListener(
    "click",
    closeFinishConfirmModal
    );

    finishConfirmFinishButton.addEventListener(
    "click",
    async () => {
        closeFinishConfirmModal();
        await completeWorkoutExecution();
    }
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