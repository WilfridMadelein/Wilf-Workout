import { updateTimerNotification, cancelTimerNotification, finishTimerNotification } from "./workout-timer-notifications.js";

import { enableWorkoutTimerSound, playWorkoutTimerSignal } from "./workout-timer-sound.js";

export function createWorkoutDurationTimer({ getDuration, saved = null, globallyPaused = false }) {
    const host = document.createElement("section");
    host.className = "workout-duration-timer";
    host.setAttribute("aria-label", "Minuteur de l'exercice");
    const label = document.createElement("strong");
    const clock = document.createElement("output");
    clock.className = "workout-duration-clock";
    clock.setAttribute("aria-label", "Secondes restantes");
    const actions = document.createElement("div");
    actions.className = "workout-duration-actions";
    const button = (text, name) => {
        const control = document.createElement("button");
        control.type = "button";
        control.textContent = text;
        control.setAttribute("aria-label", name);
        actions.appendChild(control);
        return control;
    };
    const minus = button("-5", "Retirer cinq secondes au minuteur d'exercice");
    const toggle = button("▶︎", "Démarrer le minuteur d'exercice");
    const plus = button("+5", "Ajouter cinq secondes au minuteur d'exercice");
    const reset = button("↺", "Réinitialiser le minuteur d'exercice");
    host.append(label, clock, actions);
    let phase = "idle";
    let remainingMs = 0;
    let duration = 1;
    let paused = false;
    let globalPause = globallyPaused;
    let endsAt = 0;
    let lastSignal = null;
    let interval = null;
    const bounded = value => Math.max(1, Math.min(999, Math.round(Number(value) || 1)));
    if (saved && ["preparation", "active", "finished"].includes(saved.phase) && Number.isFinite(saved.remainingMs) && saved.remainingMs >= 0 && saved.remainingMs <= 999000) {
        phase = saved.phase;
        remainingMs = phase === "preparation" ? Math.min(3000, saved.remainingMs) : saved.remainingMs;
        duration = bounded(saved.duration);
        paused = true; // Reprise explicite apres fermeture de l'application.
    }
    const running = () => ["preparation", "active"].includes(phase) && !paused && !globalPause;
    const milliseconds = () => running() ? Math.max(0, endsAt - Date.now()) : remainingMs;
    function render() {
        label.textContent = phase === "preparation" ? "Départ dans" : phase === "finished" ? "Durée terminée" : "Minuteur de l'exercice";
        clock.textContent = `${phase === "idle" ? bounded(getDuration()) : Math.ceil(milliseconds() / 1000)} s`;
        const ready = phase === "idle" || phase === "finished";
        toggle.textContent = ready || paused || globalPause ? "▶︎" : "❚❚";
        toggle.setAttribute("aria-label", `${ready ? "Démarrer" : paused || globalPause ? "Reprendre" : "Mettre en pause"} le minuteur d'exercice`);
        toggle.disabled = globalPause;
        minus.disabled = plus.disabled = phase !== "active";
    }
    function syncNotification() {
        if (phase === "idle" || phase === "finished") {
            cancelTimerNotification("exercise");
            return;
        }
        const preparation = phase === "preparation" ? duration * 1000 : 0;
        updateTimerNotification("exercise", {
            title: "Exercice terminé",
            endAt: endsAt + preparation,
            paused: !running(),
            remainingSeconds: Math.ceil((milliseconds() + preparation) / 1000)
        });
    }

    function tick() {
        if (running()) {
            const seconds = Math.ceil(milliseconds() / 1000);
            if (seconds <= 3 && seconds !== lastSignal) {
                playWorkoutTimerSignal(seconds, phase === "preparation" ? "start" : "finish");
                lastSignal = seconds;
            }
            if (seconds === 0) {
                if (phase === "preparation") {
                    phase = "active";
                    remainingMs = duration * 1000;
                    endsAt += remainingMs;
                    lastSignal = null;
                    if (endsAt <= Date.now()) tick();
                    else syncNotification();
                } else {
                    finishTimerNotification("exercise");
                    phase = "finished";
                    remainingMs = 0;
                    clearInterval(interval);
                    interval = null;
                }
            }
        }
        render();
    }
    function startInterval() {
        clearInterval(interval);
        interval = window.setInterval(tick, 100);
        tick();
    }
    toggle.addEventListener("click", () => {
        enableWorkoutTimerSound();
        if (phase === "idle" || phase === "finished") {
            duration = bounded(getDuration());
            phase = "preparation";
            remainingMs = 3000;
            paused = false;
            lastSignal = null;
            endsAt = Date.now() + remainingMs;
        } else if (paused) {
            paused = false;
            endsAt = Date.now() + remainingMs;
        } else {
            remainingMs = milliseconds();
            paused = true;
        }
        startInterval();
        syncNotification();
    });
    function adjust(delta) {
        if (phase !== "active") return;
        remainingMs = Math.max(1000, Math.min(999000, milliseconds() + delta * 1000));
        endsAt = Date.now() + remainingMs;
        if (Math.ceil(remainingMs / 1000) > 3) lastSignal = null;
        syncNotification();
        render();
    }
    minus.addEventListener("click", () => adjust(-5));
    plus.addEventListener("click", () => adjust(5));
    reset.addEventListener("click", () => {
        clearInterval(interval);
        interval = null;
        cancelTimerNotification("exercise");
        phase = "idle";
        paused = false;
        remainingMs = 0;
        lastSignal = null;
        render();
    });
    render();
    return {
        element: host,
        refresh: render,
        setGlobalPaused(value) {
            if (value === globalPause) return;
            remainingMs = milliseconds();
            globalPause = value;
            endsAt = Date.now() + remainingMs;
            tick();
            syncNotification();
        },
        snapshot: () => ({ phase, remainingMs: milliseconds(), duration, paused }),
        destroy() { clearInterval(interval); interval = null; cancelTimerNotification("exercise"); }
    };
}
