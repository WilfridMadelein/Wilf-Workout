import {
    subscribeStorageChanges
} from "./storage-change-events.js";

import {
    createStorageSnapshot
} from "./storage-snapshot.js";

import {
    loadStorageTargetConfig,
    saveStorageTargetConfig
} from "./storage-target-config.js";

import {
    isStorageDirectoryAvailable,
    writeStorageDirectoryFile
} from "./storage-target.js";

// ============================================================
// COPIE AUTOMATIQUE VERS LE DOSSIER CHOISI
// ============================================================

const STORAGE_DATA_FILE =
    "wilf-workout-data.wilf";

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
        return false;
    }

    syncRunning = true;

    try {
        let config =
            await loadStorageTargetConfig();

        if (
            config.type !== "directory" ||
            !config.directoryUri
        ) {
            return false;
        }

        if (!isStorageDirectoryAvailable()) {
            return false;
        }

        const snapshot =
            await createStorageSnapshot();

        const result =
            await writeStorageDirectoryFile({
                directoryUri:
                    config.directoryUri,

                fileUri:
                    config.dataFileUri,

                fileName:
                    STORAGE_DATA_FILE,

                content:
                    JSON.stringify(
                        snapshot,
                        null,
                        2
                    ),

                mimeType:
                    "application/json"
            });

        /*
         * Première écriture :
         * conserver l'URI exacte du document créé.
         */
        if (
            result?.uri &&
            result.uri !== config.dataFileUri
        ) {
            config.dataFileUri =
                result.uri;

            config =
                await saveStorageTargetConfig(
                    config
                );
        }

        return true;
    } catch (error) {
        console.error(
            "Impossible de mettre à jour la copie durable Wilf :",
            error
        );

        return false;
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

    unsubscribeStorageChanges =
        subscribeStorageChanges(change => {
            /*
             * Modifier la configuration du stockage
             * ne signifie pas que les données utilisateur
             * elles-mêmes ont changé.
             */
            if (
                change?.store === "settings" &&
                change?.id === "storage-target"
            ) {
                return;
            }

            scheduleStorageTargetSync();
        });

    scheduleStorageTargetSync(0);
}

export {
    setupStorageTargetSync,
    scheduleStorageTargetSync,
    syncStorageTargetNow
};