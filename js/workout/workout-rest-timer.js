// ============================================================
// ÉTAT
// ============================================================

let page;
let host;
let expandedClock;
let compactClock;
let minusButton;
let plusButton;

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

    page.appendChild(host);
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

    if (host) {
        host.hidden = true;
    }

    page?.classList.remove(
        "has-active-rest"
    );
}

function completeWorkoutRestTimer() {
    if (!timer) return;

    const onComplete =
        timer.onComplete;

    stopWorkoutRestTimer();
    onComplete();
}

function skipWorkoutRestTimer() {
    completeWorkoutRestTimer();
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
        completeWorkoutRestTimer();
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
    if (!timer) return;

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

    clearInterval(interval);
    interval = null;

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
        onComplete = () => {}
    } = {}
) {
    stopWorkoutRestTimer();

    const duration =
        Math.max(
            0,
            Math.ceil(Number(seconds) || 0)
        );

    if (duration <= 0) {
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