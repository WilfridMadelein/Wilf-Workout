// ============================================================
// SYNCHRONISATION AU RETOUR DANS L'APPLICATION
// ============================================================

let syncNow = async () => null;
let onDataImported = async () => {};
let refreshSyncInterface = async () => {};

let syncTimer = null;
let syncing = false;
let lastSyncAt = 0;

function configureSyncLifecycle(dependencies) {
    ({ syncNow, onDataImported, refreshSyncInterface } = dependencies);
}

function scheduleLifecycleSync(delay = 500) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(runLifecycleSync, delay);
}

async function runLifecycleSync() {
    if (syncing || document.hidden) return;
    if (Date.now() - lastSyncAt < 1500) return;

    syncing = true;

    try {
        const result = await syncNow();

        if ((result?.imported ?? 0) > 0) await onDataImported(result);
        await refreshSyncInterface();
    } catch (error) {
        console.error("Synchronisation au retour dans Wilf impossible :", error);
    } finally {
        lastSyncAt = Date.now();
        syncing = false;
    }
}

async function setupSyncLifecycle() {
    const appPlugin = window.Capacitor?.Plugins?.App;

    if (appPlugin?.addListener) {
        await appPlugin.addListener("appStateChange", ({ isActive }) => {
            if (isActive) scheduleLifecycleSync();
        });

        return;
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) scheduleLifecycleSync();
    });

    window.addEventListener("focus", () => scheduleLifecycleSync());
}

export {
    configureSyncLifecycle,
    setupSyncLifecycle
};