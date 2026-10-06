import { enableWorkoutTimerSound } from "./workout-timer-sound.js";

import { saveActiveWorkout, loadActiveWorkout, clearActiveWorkout } from "../storage/app-resume-storage.js";
import { getWorkoutRestRemainingSeconds, isWorkoutRestManuallyPaused } from "./workout-rest-timer.js";

import {
    createWorkoutSession,
    hasWorkoutSessionLogs,
    applyWorkoutLogToFollowingSeries,
    findFirstPendingWorkoutTarget,
    findFirstPendingTargetInSet,
    findFirstPendingTargetInExercise,
    getNextPendingWorkoutTarget,
    isLastPendingTargetInSet,
    getWorkoutTargetValues,
    saveWorkoutTargetDraft,
    saveWorkoutTargetLog,
    setWorkoutTargetReserveToFailure,
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
let summaryEditReturn = null;
let recoveryInterval = null;
let activeReserveTarget = null;

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
        timerToggleButton.textContent = "▶︎";

        timerToggleButton.setAttribute(
            "aria-label",
            "Reprendre le chronomètre"
        );

        timerToggleButton.title =
            "Reprendre le chronomètre";

        return;
    }

    timerToggleButton.textContent = "❚❚";

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
    currentExerciseView?.setTimerPaused(true);

    refreshTimerToggleButton();
    persistWorkoutRecovery();
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
    currentExerciseView?.setTimerPaused(false);
    refreshElapsedTime();
    startWorkoutTimerInterval();

    refreshTimerToggleButton();
    persistWorkoutRecovery();
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

    clearWorkoutExerciseView(content);

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

                if (target) showExercise(target);
            },

            onStateChange: persistWorkoutRecovery
        }
    );

    page.scrollTop = 0;

    requestAnimationFrame(
        refreshOverviewScrollProgress
    );
}

function showExercise(target, draftValues = null) {
    if (
        !session ||
        !target
    ) {
        return;
    }

    clearWorkoutOverview(content);
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
    if (summaryEditReturn) {
        closeSummaryLogEditor();
        return;
    }

    saveWorkoutTargetDraft(backTarget, values);
    showOverview();
    persistWorkoutRecovery();
},

            draftValues: draftValues ?? undefined,
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

async function handleWorkoutLog(loggedTarget, values, { isEdit = false } = {}) {
    if (!session) return;
    saveWorkoutTargetLog(loggedTarget, values);

    if (isEdit) {
        persistWorkoutRecovery();
        if (summaryEditReturn) closeSummaryLogEditor();
        else showOverview();
        return;
    }

    applyWorkoutLogToFollowingSeries(loggedTarget, values);
    const next = getNextPendingWorkoutTarget(session, loggedTarget);
    const restSeconds = getRestAfterWorkoutTarget(loggedTarget, next);
    activeReserveTarget = loggedTarget;
    startWorkoutRestTimer(restSeconds, {
        feedback: {
            value: values.value,
            valueUnit: values.valueUnit,
            reserveToFailure: null,
            onChange: reserve => {
                setWorkoutTargetReserveToFailure(loggedTarget, reserve);
                activeReserveTarget = null;
                persistWorkoutRecovery();
            }
        },
        onComplete: () => { currentExerciseView?.setLogAvailable(true); persistWorkoutRecovery(); }
    });
    if (session.isPaused) pauseWorkoutRestTimer();
    if (next) showExercise(next);
    else showOverview();
    persistWorkoutRecovery();
}

// ============================================================
// MODIFICATION D'UN LOG DEPUIS LE RÉCAPITULATIF
// ============================================================

function closeSummaryLogEditor() {
    const onDone =
        summaryEditReturn;

    summaryEditReturn = null;

    leaveWorkoutExecution();
    onDone?.();
}

function editWorkoutLogFromSummary(
    summarySession,
    target,
    onDone = () => {}
) {
    if (
        !summarySession ||
        !target
    ) {
        return;
    }

    stopWorkoutTimerInterval();
    stopWorkoutRestTimer();

    session = summarySession;
    summaryEditReturn = onDone;

    page.hidden = false;
    exitModal.hidden = true;
    finishConfirmModal.hidden = true;

    document.body.classList.add(
        "workout-execution-active"
    );

    showExercise(target);
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
    if (!summaryEditReturn) clearActiveWorkout();
    clearInterval(recoveryInterval);
    recoveryInterval = null;
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
    activeReserveTarget = null;

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

    const completedSession =
        session;

    finishButton.disabled = true;
    finishConfirmFinishButton.disabled = true;

    try {
        leaveWorkoutExecution();

        await onFinishWorkout(
            completedSession
        );
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

    summaryEditReturn = null;
    currentTarget = null;
    currentExerciseView = null;
    activeReserveTarget = null;

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
    startWorkoutRecovery();
}

function getWorkoutExecutionSession() {
    return session;
}

// ============================================================
// INITIALISATION
// ============================================================

function setupWorkoutExecution() {
    page.addEventListener("pointerdown", enableWorkoutTimerSound);
    page.addEventListener("keydown", enableWorkoutTimerSound);
    page.addEventListener("input", () => queueMicrotask(persistWorkoutRecovery));
    page.addEventListener("change", () => queueMicrotask(persistWorkoutRecovery));
    page.addEventListener("click", () => queueMicrotask(persistWorkoutRecovery));
    window.addEventListener("pagehide", persistWorkoutRecovery);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) persistWorkoutRecovery();
    });
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
    editWorkoutLogFromSummary,
    getWorkoutExecutionSession
};

function serializeWorkoutTarget(target) {
    return target ? { exerciseId: target.workoutExercise.id, seriesId: target.series.id, sideKey: target.sideKey } : null;
}

function resolveWorkoutTarget(reference) {
    if (!session || !reference) return null;
    const set = session.sets.find(item => item.exercises.some(exercise => exercise.id === reference.exerciseId));
    const workoutExercise = set?.exercises.find(exercise => exercise.id === reference.exerciseId);
    const series = workoutExercise?.series.find(item => item.id === reference.seriesId);
    return set && workoutExercise && series ? { set, workoutExercise, series, sideKey: reference.sideKey } : null;
}

function persistWorkoutRecovery() {
    if (!session || summaryEditReturn) return;
    refreshElapsedTime();
    saveActiveWorkout({
        session,
        target: serializeWorkoutTarget(currentTarget),
        reserveTarget: serializeWorkoutTarget(activeReserveTarget),
        draft: session.screen === "exercise" ? currentExerciseView?.getDraft() ?? null : null,
        restSeconds: getWorkoutRestRemainingSeconds(),
        restManualPaused: isWorkoutRestManuallyPaused()
    });
}

function startWorkoutRecovery() {
    clearInterval(recoveryInterval);
    persistWorkoutRecovery();
    recoveryInterval = window.setInterval(persistWorkoutRecovery, 5000);
}

export function offerWorkoutResume() {
    const snapshot = loadActiveWorkout();
    if (!snapshot) return;
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "workout-resume-dialog workout-exit-dialog";
    dialog.setAttribute("aria-labelledby", "workout-resume-title");
    dialog.setAttribute("aria-describedby", "workout-resume-description");

    const title = document.createElement("h2");
    title.id = "workout-resume-title";
    title.textContent = "Reprendre l'entraînement en cours ?";
    const description = document.createElement("p");
    description.id = "workout-resume-description";
    description.textContent = "Un entraînement était encore en cours lors de votre dernière utilisation. Vous pouvez reprendre exactement là où vous vous étiez arrêté.";
    const warning = document.createElement("p");
    warning.className = "workout-exit-help";
    warning.textContent = "Si vous choisissez « Quitter l'entraînement », cette progression temporaire sera supprimée définitivement.";
    const name = document.createElement("p");
    name.className = "workout-resume-plan";
    name.textContent = `Entraînement : ${snapshot.session.planName}`;
    const error = document.createElement("p");
    error.setAttribute("role", "alert");
    const actions = document.createElement("div");
    actions.className = "workout-exit-actions";
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "workout-resume-button";
    resume.textContent = "Reprendre mon entraînement";
    const discard = document.createElement("button");
    discard.type = "button";
    discard.className = "workout-resume-discard";
    discard.textContent = "Quitter l'entraînement";

    function close() { dialog.close(); dialog.remove(); previousFocus?.focus(); }
    dialog.addEventListener("cancel", event => event.preventDefault());
    discard.addEventListener("click", () => {
        if (!clearActiveWorkout()) { error.textContent = "Impossible de supprimer la reprise locale. Veuillez réessayer."; return; }
        close();
    });
    resume.addEventListener("click", () => {
        session = snapshot.session;
        session.totalPausedMs = Math.max(0, Date.now() - session.startedAt - session.elapsedSeconds * 1000);
        session.pausedAt = session.isPaused ? Date.now() : null;
        summaryEditReturn = null;
        currentTarget = null;
        currentExerciseView = null;
        activeReserveTarget = null;
        planName.textContent = session.planName;
        exitModal.hidden = true;
        finishConfirmModal.hidden = true;
        page.hidden = false;
        document.body.classList.add("workout-execution-active");
        close();
        refreshTimerToggleButton();
        showOverview();

        const restoredTarget = resolveWorkoutTarget(snapshot.target);
        if (restoredTarget) showExercise(restoredTarget, snapshot.draft);
        activeReserveTarget = resolveWorkoutTarget(snapshot.reserveTarget);
        const reserveValues = activeReserveTarget ? getWorkoutTargetValues(activeReserveTarget) : null;
        if ((Number.isFinite(snapshot.restSeconds) && snapshot.restSeconds > 0) || activeReserveTarget) {
            startWorkoutRestTimer(snapshot.restSeconds, {
                paused: snapshot.restManualPaused === true,
                feedback: activeReserveTarget ? {
                    value: reserveValues.value,
                    valueUnit: reserveValues.valueUnit,
                    reserveToFailure: reserveValues.reserveToFailure,
                    onChange: reserve => {
                        setWorkoutTargetReserveToFailure(activeReserveTarget, reserve);
                        activeReserveTarget = null;
                        persistWorkoutRecovery();
                    }
                } : null,
                onComplete: () => { currentExerciseView?.setLogAvailable(true); persistWorkoutRecovery(); }
            });
            currentExerciseView?.setLogAvailable(false);
            if (session.isPaused) pauseWorkoutRestTimer();
        }
        refreshElapsedTime();
        startWorkoutTimerInterval();
        startWorkoutRecovery();
        (content.querySelector("button") ?? beginButton).focus();
    });
    actions.append(resume, discard);
    dialog.append(title, description, warning, name, error, actions);
    document.body.appendChild(dialog);
    dialog.showModal();
    resume.focus();
}
