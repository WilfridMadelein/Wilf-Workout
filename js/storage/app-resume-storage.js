// Etat local de cet appareil : ne fait pas partie des sauvegardes synchronisees.
const PAGE_KEY = "wilf-workout:last-page:v1";
const WORKOUT_KEY = "wilf-workout:active-workout:v1";
const pages = new Set(["exercises", "plans", "history", "settings"]);

function reportStorageError(error) {
    console.warn("Impossible de conserver ou de lire la reprise locale :", error);
}

export function loadLastPage() {
    try {
        const page = localStorage.getItem(PAGE_KEY);
        return pages.has(page) ? page : "exercises";
    } catch (error) {
        reportStorageError(error);
        return "exercises";
    }
}

export function saveLastPage(page) {
    if (!pages.has(page)) return;
    try { localStorage.setItem(PAGE_KEY, page); }
    catch (error) { reportStorageError(error); }
}

export function saveActiveWorkout(snapshot) {
    try {
        localStorage.setItem(WORKOUT_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), ...snapshot }));
        return true;
    } catch (error) {
        reportStorageError(error);
        return false;
    }
}

export function clearActiveWorkout() {
    try {
        localStorage.removeItem(WORKOUT_KEY);
        return true;
    } catch (error) {
        reportStorageError(error);
        return false;
    }
}

export function loadActiveWorkout() {
    try {
        const raw = localStorage.getItem(WORKOUT_KEY);
        if (!raw) return null;
        if (raw.length > 5000000) throw new Error("Reprise trop volumineuse.");
        const snapshot = JSON.parse(raw);
        const session = snapshot?.session;
        const object = value => value && typeof value === "object" && !Array.isArray(value);
        const finite = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
        if (![1, 2].includes(snapshot.version) || !finite(snapshot.savedAt) || !object(session) ||
            typeof session.id !== "string" || typeof session.planName !== "string" ||
            !finite(session.startedAt) || !finite(session.totalPausedMs) || !finite(session.elapsedSeconds) ||
            typeof session.isPaused !== "boolean" || (session.isPaused && !finite(session.pausedAt)) ||
            !["overview", "exercise"].includes(session.screen) || !object(session.defaults) ||
            !Array.isArray(session.sets) || session.sets.length > 500) throw new Error("Reprise incompatible.");
        for (const set of session.sets) {
            if (!object(set) || typeof set.id !== "string" || !Array.isArray(set.exercises) || set.exercises.length > 500) throw new Error("Bloc invalide.");
            for (const exercise of set.exercises) {
                if (!object(exercise) || typeof exercise.id !== "string" || !object(exercise.exercise) ||
                    !object(exercise.tempo) || !Array.isArray(exercise.series) || exercise.series.length > 500) throw new Error("Exercice invalide.");
                for (const series of exercise.series) {
                    if (!object(series) || typeof series.id !== "string" || !object(series.tempo) || !object(series.logs)) throw new Error("Serie invalide.");
                    if (Object.entries(series.logs).some(([side, log]) => !["main", "left", "right"].includes(side) || !object(log) || !object(log.tempo))) throw new Error("Log invalide.");
                }
            }
        }
        const validTarget = target => target == null || (object(target) && typeof target.exerciseId === "string" && typeof target.seriesId === "string" && ["main", "left", "right"].includes(target.sideKey));
        if (!validTarget(snapshot.target) || !validTarget(snapshot.reserveTarget)) throw new Error("Position invalide.");
        if (snapshot.draft != null && (!object(snapshot.draft) || !object(snapshot.draft.tempo))) throw new Error("Saisie invalide.");
        return snapshot;
    } catch (error) {
        // Conserver le record pour ne pas effacer une reprise incompatible.
        reportStorageError(error);
        return null;
    }
}
