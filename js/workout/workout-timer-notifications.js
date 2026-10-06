const PREFERENCE_KEY = "wilf-workout:timer-notifications:v1";
const timers = new Map();
const nativeQueues = new Map();
let enabled = false;
let requested = false;
let registration = null;
let statusElement = null;
let lastError = "";

const native = () => window.Capacitor?.getPlatform?.() === "android" ? window.Capacitor.Plugins?.WilfTimerNotifications : null;
const timerId = key => key === "rest" ? 2 : 1;

function report(error) {
    console.warn("Notifications des minuteurs indisponibles :", error);
    lastError = "Impossible de programmer une alerte. Vérifiez les autorisations de notification et d'alarme.";
    if (statusElement) statusElement.textContent = lastError;
}

function nativeOperation(key, operation) {
    const queue = (nativeQueues.get(key) ?? Promise.resolve()).then(operation).catch(report);
    nativeQueues.set(key, queue);
    return queue;
}

async function showBrowserAlert(title) {
    if (!enabled || !document.hidden || Notification.permission !== "granted") return;
    try {
        const options = { body: "Le minuteur est terminé. Revenez à votre entraînement.", tag: "wilf-workout-timer" };
        if (registration) await registration.showNotification(title, options);
        else {
            const notification = new Notification(title, options);
            notification.onclick = () => { window.focus(); notification.close(); };
        }
    } catch (error) { report(error); }
}

function schedule(key, state) {
    clearTimeout(state.timeout);
    if (!enabled) return;
    const plugin = native();
    if (plugin) {
        nativeOperation(key, () => plugin.schedule({ id: timerId(key), title: state.title, endAt: state.endAt, paused: state.paused, remainingSeconds: state.remainingSeconds }));
    } else if (!state.paused) {
        state.timeout = window.setTimeout(() => {
            if (timers.get(key) !== state) return;
            state.alerted = true;
            showBrowserAlert(state.title);
        }, Math.max(0, state.endAt - Date.now()));
    }
}

export function updateTimerNotification(key, options) {
    const previous = timers.get(key);
    // Les mises a jour d'affichage ne doivent pas reprogrammer l'alarme.
    if (previous && previous.endAt === options.endAt && previous.paused === options.paused && previous.remainingSeconds === options.remainingSeconds) return;
    clearTimeout(previous?.timeout);
    const state = { ...options, timeout: null, alerted: false };
    timers.set(key, state);
    schedule(key, state);
}

export function cancelTimerNotification(key) {
    const state = timers.get(key);
    clearTimeout(state?.timeout);
    timers.delete(key);
    if (state && native()) nativeOperation(key, () => native().cancel({ id: timerId(key) }));
}

export function finishTimerNotification(key) {
    const state = timers.get(key);
    clearTimeout(state?.timeout);
    timers.delete(key);
    if (native()) nativeOperation(key, () => native().complete({ id: timerId(key) }));
    else if (state && !state.alerted) showBrowserAlert(state.title);
}

export async function setupTimerNotifications() {
    const button = document.getElementById("settings-timer-notifications");
    const alarmButton = document.getElementById("settings-timer-alarms");
    statusElement = document.getElementById("settings-timer-notifications-status");
    if (!button || !alarmButton || !statusElement) return;
    try { requested = localStorage.getItem(PREFERENCE_KEY) === "true"; } catch {}
    async function refresh() {
        try {
            const plugin = native();
            const supported = Boolean(plugin || (window.isSecureContext && "Notification" in window));
            const permission = plugin ? await plugin.status() : { granted: supported && Notification.permission === "granted", exact: true };
            const previous = enabled;
            enabled = requested && permission.granted && permission.exact;
            button.disabled = !supported;
            button.textContent = requested ? "Désactiver les notifications" : "Activer les notifications";
            button.setAttribute("aria-pressed", String(requested));
            alarmButton.hidden = !(plugin && requested && permission.granted && !permission.exact);
            statusElement.textContent = !supported ? "Notifications indisponibles ici. Utilisez HTTPS, localhost ou l'APK Android." : !permission.granted && requested ? "Notifications refusées. Vous pouvez les autoriser dans les paramètres du navigateur ou du téléphone." : !permission.exact && requested ? "Autorisez les alarmes précises pour recevoir les alertes à l'heure prévue." : enabled ? (plugin ? "Alertes activées, avec décompte dans la notification Android." : "Alertes activées. Elles peuvent être retardées si le navigateur suspend la page; gardez-la ouverte.") : "Les notifications sont désactivées.";
            if (lastError && enabled) statusElement.textContent = lastError;
            if (enabled && !plugin && "serviceWorker" in navigator && !registration) {
                try { registration = await navigator.serviceWorker.register(new URL("./timer-notification-worker.js", import.meta.url)); }
                catch (error) { console.warn("Notifications persistantes indisponibles :", error); }
            }
            if (enabled && !previous) timers.forEach((state, key) => schedule(key, state));
            if (!enabled && previous) timers.forEach((state, key) => {
                clearTimeout(state.timeout);
                if (plugin) nativeOperation(key, () => plugin.cancel({ id: timerId(key) }));
            });
        } catch (error) { report(error); }
    }
    button.addEventListener("click", async () => {
        try {
            lastError = "";
            if (requested) requested = false;
            else {
                const plugin = native();
                if (plugin) await plugin.requestPermission();
                else await Notification.requestPermission();
                requested = true;
            }
            try { localStorage.setItem(PREFERENCE_KEY, String(requested)); } catch {}
            await refresh();
        } catch (error) { report(error); }
    });
    alarmButton.addEventListener("click", async () => {
        try { await native()?.requestAlarmAccess(); } catch (error) { report(error); }
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    window.addEventListener("focus", refresh);
    await refresh();
}
