import { subscribeStorageChanges } from "./storage-change-events.js";
import { createStorageSnapshot, parseStorageSnapshot } from "./storage-snapshot.js";
import { loadSyncMetadata, saveSyncBaseline, SYNC_METADATA_ID } from "./sync-metadata.js";
import { createSyncBaseline, baselinesEqual } from "./storage-sync-baseline.js";
import { readSyncFileTarget, writeSyncFileTarget } from "./sync-file-target.js";

// ============================================================
// COPIE AUTOMATIQUE VERS LA CIBLE DE SYNCHRONISATION
// ============================================================

let syncTimer = null;
let syncRunning = false;
let syncPending = false;
let unsubscribeStorageChanges = null;

function scheduleStorageTargetSync(delay = 3000) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        syncTimer = null;
        syncStorageTargetNow();
    }, delay);
}

async function syncStorageTargetNow() {
    if (syncRunning) {
        syncPending = true;
        return { status: "pending" };
    }

    syncRunning = true;

    try {
        const file = await readSyncFileTarget();
        if (!file.available) return { status: file.reason };

        const localSnapshot = await createStorageSnapshot();

        if (!file.exists) {
            await writeSyncFileTarget(file.target, JSON.stringify(localSnapshot, null, 2));
            await saveSyncBaseline(await createSyncBaseline(localSnapshot));
            return { status: "created" };
        }

        const externalSnapshot = parseStorageSnapshot(file.content);
        const [localState, externalState, metadata] = await Promise.all([
            createSyncBaseline(localSnapshot),
            createSyncBaseline(externalSnapshot),
            loadSyncMetadata()
        ]);

        const baseline = metadata.baseline;

        if (!baseline) {
            if (baselinesEqual(localState, externalState)) {
                await saveSyncBaseline(localState);
                return { status: "baseline-initialized" };
            }

            return { status: "needs-initial-resolution" };
        }

        const localChanged = !baselinesEqual(localState, baseline);
        const externalChanged = !baselinesEqual(externalState, baseline);

        if (baselinesEqual(localState, externalState)) {
            if (localChanged || externalChanged) await saveSyncBaseline(localState);
            return { status: "same", localChanged, externalChanged };
        }

        if (externalChanged) {
            return {
                status: localChanged ? "conflict" : "external-changed",
                localChanged,
                externalChanged
            };
        }

        if (localChanged) {
            await writeSyncFileTarget(file.target, JSON.stringify(localSnapshot, null, 2));
            await saveSyncBaseline(localState);
            return { status: "exported", localChanged: true, externalChanged: false };
        }

        return { status: "unchanged" };
    } catch (error) {
        console.error("Impossible de synchroniser la copie durable Wilf :", error);
        return { status: "error", error };
    } finally {
        syncRunning = false;

        if (syncPending) {
            syncPending = false;
            scheduleStorageTargetSync(500);
        }
    }
}

function setupStorageTargetSync() {
    if (unsubscribeStorageChanges) return;

    unsubscribeStorageChanges = subscribeStorageChanges(change => {
        if (change?.store === "settings" && change?.id === SYNC_METADATA_ID) return;
        scheduleStorageTargetSync();
    });

    scheduleStorageTargetSync(0);
}

export {
    setupStorageTargetSync,
    scheduleStorageTargetSync,
    syncStorageTargetNow
};