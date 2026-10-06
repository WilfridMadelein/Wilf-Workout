import {
    formatReserveToFailure,
    getReserveToFailureOptions,
    normalizeReserveToFailure
} from "../training/reserve-to-failure.js";

// ============================================================
// ÉTAT
// ============================================================

let page;
let host;
let expandedClock;
let compactClock;
let minusButton;
let plusButton;

let reserveDialog;
let reserveProgress;
let reserveFeedback;
let reserveQuestion;
let reserveSelect;
let reserveIgnoreButton;

let timer = null;
let interval = null;
let isSetup = false;

// ============================================================
// FORMAT
// ============================================================

function formatRestTime(totalSeconds) {
    const seconds =
        Math.max(
            0,
            Math.ceil(totalSeconds)
        );

    const minutes =
        Math.floor(seconds / 60);

    const remainingSeconds =
        seconds % 60;

    return (
        `${minutes}:` +
        `${String(remainingSeconds).padStart(2, "0")}`
    );
}

// ============================================================
// DOM
// ============================================================

function createRestTimer() {
    host =
        document.createElement("div");

    host.classList.add(
        "workout-rest-timer"
    );

    host.hidden = true;

    host.innerHTML = `
        <div class="workout-rest-expanded">
            <div class="workout-rest-controls">
                <button
                    type="button"
                    class="workout-rest-minus"
                    aria-label="Retirer 15 secondes"
                >
                    −
                </button>

                <button
                    type="button"
                    class="workout-rest-expanded-clock"
                    aria-label="Temps de repos"
                >
                    0:00
                </button>

                <button
                    type="button"
                    class="workout-rest-plus"
                    aria-label="Ajouter 15 secondes"
                >
                    +
                </button>
            </div>
<div class="workout-rest-feedback" hidden>
    <label class="workout-rest-feedback-label">
        <span id="workout-reserve-question" class="workout-rest-feedback-question"></span>
        <select class="workout-rest-feedback-select"></select>
    </label>

    <button type="button" class="workout-rest-feedback-ignore">
        Ignorer
    </button>
</div>
            <button
                type="button"
                class="workout-rest-skip"
            >
                Skip
            </button>
        </div>

        <div class="workout-rest-compact">
            <button
                type="button"
                class="workout-rest-compact-skip"
            >
                skip
            </button>

            <button
                type="button"
                class="workout-rest-compact-clock"
                aria-label="Agrandir le minuteur de repos"
            >
                0:00
            </button>
        </div>
    `;

    expandedClock =
        host.querySelector(
            ".workout-rest-expanded-clock"
        );

    compactClock =
        host.querySelector(
            ".workout-rest-compact-clock"
        );

    minusButton =
        host.querySelector(
            ".workout-rest-minus"
        );

    plusButton =
        host.querySelector(
            ".workout-rest-plus"
        );
reserveFeedback = host.querySelector(".workout-rest-feedback");
reserveQuestion = host.querySelector(".workout-rest-feedback-question");
reserveSelect = host.querySelector(".workout-rest-feedback-select");
reserveIgnoreButton = host.querySelector(".workout-rest-feedback-ignore");
    page.appendChild(host);
    reserveDialog = document.createElement("dialog");
    reserveDialog.classList.add("workout-reserve-dialog");
    reserveDialog.setAttribute("aria-labelledby", "workout-reserve-question");
    reserveProgress = document.createElement("div");
    reserveProgress.classList.add("workout-reserve-progress");
    reserveProgress.setAttribute("aria-hidden", "true");
    reserveDialog.appendChild(reserveProgress);
    page.appendChild(reserveDialog);
    reserveDialog.addEventListener("cancel", event => {
        event.preventDefault();
        finishReserveFeedback(null);
    });
}

// ============================================================
// FEEDBACK AVANT ÉCHEC
// ============================================================

function clearReserveFeedback() {
    if (!reserveFeedback) return;

    if (timer) timer.reserveFeedback = null;
    if (reserveDialog.open) reserveDialog.close();
    if (host.parentNode === reserveDialog) page.appendChild(host);
    reserveFeedback.hidden = true;
    reserveSelect.replaceChildren();
}

function finishReserveFeedback(value) {
    if (!timer?.reserveFeedback) return;
    const onChange = timer.reserveFeedback.onChange;
    clearReserveFeedback();
    onChange(value);
    refreshRestTimer();
}

function configureReserveFeedback(feedback) {
    clearReserveFeedback();
    if (!feedback || !timer) return;

    const valueUnit = feedback.valueUnit === "sec" ? "sec" : "rep";
    const options = getReserveToFailureOptions(feedback.value, valueUnit);

    reserveQuestion.textContent = valueUnit === "sec"
        ? "Combien de secondes auriez-vous pu faire de plus avant l'échec ?"
        : "Combien de répétitions auriez-vous pu faire de plus avant l'échec ?";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choisir...";
    reserveSelect.appendChild(placeholder);

    options.forEach(value => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = value === options.at(-1)
            ? `${value} + ${valueUnit}`
            : formatReserveToFailure(value, valueUnit);
        reserveSelect.appendChild(option);
    });

    const selected = normalizeReserveToFailure(feedback.reserveToFailure);
    reserveSelect.value = selected === null ? "" : String(selected);

    timer.reserveFeedback = {
        endsAt: Date.now() + 30000,
        onChange: feedback.onChange ?? (() => {})
    };

    reserveFeedback.hidden = false;
    reserveProgress.style.transform = "scaleX(1)";
    reserveDialog.appendChild(host);
    reserveDialog.showModal();
    reserveSelect.focus();
}

// ============================================================
// TEMPS
// ============================================================

function getRemainingSeconds() {
    if (!timer) return 0;

    if (timer.paused) {
        return timer.remainingSeconds;
    }

    return Math.max(
        0,
        Math.ceil(
            (
                timer.endsAt -
                Date.now()
            ) / 1000
        )
    );
}

function refreshRestTimer() {
    if (!timer) return;

    if (timer.reserveFeedback) {
        const remaining = Math.max(0, timer.reserveFeedback.endsAt - Date.now());
        reserveProgress.style.transform = `scaleX(${remaining / 30000})`;
        if (remaining <= 0) {
            finishReserveFeedback(null);
            return;
        }
    }

    const seconds =
        getRemainingSeconds();

    const text =
        formatRestTime(seconds);

    expandedClock.textContent = text;
    compactClock.textContent = text;

    host.classList.toggle(
        "is-expanded",
        timer.expanded
    );

    host.classList.toggle(
        "is-paused",
        timer.paused
    );

    if (seconds <= 0) {
        completeWorkoutRestTimer();
    }
}

function startInterval() {
    clearInterval(interval);

    interval =
        window.setInterval(
            refreshRestTimer,
            250
        );
}

// ============================================================
// FIN / SKIP
// ============================================================

function stopWorkoutRestTimer() {
    clearInterval(interval);
    interval = null;
    timer = null;

    if (host) host.hidden = true;
    clearReserveFeedback();

    page?.classList.remove(
        "has-active-rest"
    );
}

function completeWorkoutRestTimer() {
    if (!timer || timer.reserveFeedback) return;

    const onComplete =
        timer.onComplete;

    stopWorkoutRestTimer();
    onComplete();
}

function skipWorkoutRestTimer() {
    if (!timer) return;
    timer.remainingSeconds = 0;
    timer.endsAt = Date.now();
    refreshRestTimer();
}

// ============================================================
// AJUSTEMENT
// ============================================================

function adjustWorkoutRestTimer(delta) {
    if (!timer) return;

    const next =
        Math.max(
            0,
            getRemainingSeconds() + delta
        );

    if (next <= 0) {
        skipWorkoutRestTimer();
        return;
    }

    timer.remainingSeconds = next;

    if (!timer.paused) {
        timer.endsAt =
            Date.now() + next * 1000;
    }

    refreshRestTimer();
}

// ============================================================
// AFFICHAGE
// ============================================================

function expandWorkoutRestTimer() {
    if (!timer) return;

    timer.expanded = true;
    refreshRestTimer();
}

function collapseWorkoutRestTimer() {
    if (!timer || timer.reserveFeedback) return;

    timer.expanded = false;
    refreshRestTimer();
}

// ============================================================
// PAUSE GLOBALE
// ============================================================

function pauseWorkoutRestTimer() {
    if (!timer || timer.paused) return;

    timer.remainingSeconds =
        getRemainingSeconds();

    timer.paused = true;

    refreshRestTimer();
}

function resumeWorkoutRestTimer() {
    if (!timer || !timer.paused) return;

    timer.paused = false;

    timer.endsAt =
        Date.now() +
        timer.remainingSeconds * 1000;

    startInterval();
    refreshRestTimer();
}

// ============================================================
// DÉMARRAGE
// ============================================================

function startWorkoutRestTimer(
    seconds,
    {
        onComplete = () => {},
        feedback = null
    } = {}
) {
    stopWorkoutRestTimer();

    const duration =
        Math.max(
            0,
            Math.ceil(Number(seconds) || 0)
        );

    if (duration <= 0 && !feedback) {
        onComplete();
        return;
    }

    timer = {
        remainingSeconds: duration,
        endsAt:
            Date.now() +
            duration * 1000,

        paused: false,
        expanded: true,

        onComplete
    };

    host.hidden = false;
    host.classList.add("is-expanded");
    configureReserveFeedback(feedback);

    page.classList.add(
        "has-active-rest"
    );

    startInterval();
    refreshRestTimer();
}

function isWorkoutRestTimerActive() {
    return Boolean(timer);
}

// ============================================================
// INITIALISATION
// ============================================================

function setupWorkoutRestTimer(
    workoutPage
) {
    if (isSetup) return;

    isSetup = true;
    page = workoutPage;

    createRestTimer();

    minusButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            adjustWorkoutRestTimer(-15);
        }
    );

    plusButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            adjustWorkoutRestTimer(15);
        }
    );

reserveSelect.addEventListener("change", event => {
    event.stopPropagation();
    if (!timer?.reserveFeedback) return;

    finishReserveFeedback(normalizeReserveToFailure(reserveSelect.value));
});

reserveIgnoreButton.addEventListener("click", event => {
    event.stopPropagation();

    finishReserveFeedback(null);
});

    host
        .querySelector(
            ".workout-rest-skip"
        )
        .addEventListener(
            "click",
            event => {
                event.stopPropagation();
                skipWorkoutRestTimer();
            }
        );

    host
        .querySelector(
            ".workout-rest-compact-skip"
        )
        .addEventListener(
            "click",
            event => {
                event.stopPropagation();
                skipWorkoutRestTimer();
            }
        );

    compactClock.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            expandWorkoutRestTimer();
        }
    );

    document.addEventListener(
        "pointerdown",
        event => {
            if (
                !timer ||
                !timer.expanded ||
                host.contains(event.target)
            ) {
                return;
            }

            collapseWorkoutRestTimer();
        },
        true
    );
}

export {
    setupWorkoutRestTimer,

    startWorkoutRestTimer,
    stopWorkoutRestTimer,

    pauseWorkoutRestTimer,
    resumeWorkoutRestTimer,

    isWorkoutRestTimerActive
};

export function getWorkoutRestRemainingSeconds() {
    return getRemainingSeconds();
}
