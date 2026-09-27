import {
    subscribeStorageChanges
} from "./storage-change-events.js";

import {
    createStorageSnapshot,
    parseStorageSnapshot
} from "./storage-snapshot.js";

import {
    loadStorageTargetConfig,
    saveStorageTargetConfig
} from "./storage-target-config.js";

import {
    loadSyncMetadata,
    saveSyncBaseline,
    SYNC_METADATA_ID
} from "./sync-metadata.js";

import {
    createSyncBaseline,
    baselinesEqual
} from "./storage-sync-baseline.js";

import {
    isStorageDirectoryAvailable,
    readStorageDirectoryFile,
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

async function writeSnapshot(
    config,
    snapshot
) {
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

    return config;
}

async function syncStorageTargetNow() {
    if (syncRunning) {
        syncPending = true;

        return {
            status: "pending"
        };
    }

    syncRunning = true;

    try {
        let config =
            await loadStorageTargetConfig();

        if (
            config.type !== "directory" ||
            !config.directoryUri
        ) {
            return {
                status: "device-only"
            };
        }

        if (!isStorageDirectoryAvailable()) {
            return {
                status: "unavailable"
            };
        }

        const localSnapshot =
            await createStorageSnapshot();

        let file =
            await readStorageDirectoryFile({
                directoryUri:
                    config.directoryUri,

                fileUri:
                    config.dataFileUri,

                fileName:
                    STORAGE_DATA_FILE
            });

        /*
         * Aucun fichier externe :
         * il est sécuritaire de créer la première copie.
         */
        if (!file?.exists) {
            config =
                await writeSnapshot(
                    config,
                    localSnapshot
                );

            const baseline =
                await createSyncBaseline(
                    localSnapshot
                );

            await saveSyncBaseline(
                baseline
            );

            return {
                status: "created"
            };
        }

        if (
            file.uri &&
            file.uri !== config.dataFileUri
        ) {
            config.dataFileUri =
                file.uri;

            config =
                await saveStorageTargetConfig(
                    config
                );
        }

        const externalSnapshot =
            parseStorageSnapshot(
                file.content
            );

        const [
            localState,
            externalState,
            metadata
        ] = await Promise.all([
            createSyncBaseline(
                localSnapshot
            ),

            createSyncBaseline(
                externalSnapshot
            ),

            loadSyncMetadata()
        ]);

        const baseline =
            metadata.baseline;

        /*
         * Première utilisation de la nouvelle
         * logique de synchronisation.
         */
        if (!baseline) {
            if (
                baselinesEqual(
                    localState,
                    externalState
                )
            ) {
                await saveSyncBaseline(
                    localState
                );

                return {
                    status:
                        "baseline-initialized"
                };
            }

            console.warn(
                "Wilf n'a pas écrasé le fichier externe : les données locales et externes diffèrent sans base de synchronisation."
            );

            return {
                status:
                    "needs-initial-resolution"
            };
        }

        const localChanged =
            !baselinesEqual(
                localState,
                baseline
            );

        const externalChanged =
            !baselinesEqual(
                externalState,
                baseline
            );

        /*
         * Les deux côtés contiennent exactement
         * les mêmes données.
         */
        if (
            baselinesEqual(
                localState,
                externalState
            )
        ) {
            if (
                localChanged ||
                externalChanged
            ) {
                await saveSyncBaseline(
                    localState
                );
            }

            return {
                status: "same",
                localChanged,
                externalChanged
            };
        }

        /*
         * Un autre appareil a modifié le fichier.
         *
         * IMPORTANT :
         * ne surtout pas l'écraser maintenant.
         */
        if (externalChanged) {
            const status =
                localChanged
                    ? "conflict"
                    : "external-changed";

            console.warn(
                `Synchronisation Wilf suspendue : ${status}.`
            );

            return {
                status,
                localChanged,
                externalChanged
            };
        }

        /*
         * Seul cet appareil a changé.
         * L'export est sécuritaire.
         */
        if (
            localChanged &&
            !externalChanged
        ) {
            await writeSnapshot(
                config,
                localSnapshot
            );

            await saveSyncBaseline(
                localState
            );

            return {
                status: "exported",
                localChanged: true,
                externalChanged: false
            };
        }

        return {
            status: "unchanged"
        };
    } catch (error) {
        console.error(
            "Impossible de synchroniser la copie durable Wilf :",
            error
        );

        return {
            status: "error",
            error
        };
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
             * La base de synchronisation est
             * strictement locale.
             */
            if (
                change?.store === "settings" &&
                change?.id === SYNC_METADATA_ID
            ) {
                return;
            }

            scheduleStorageTargetSync();
        });

    /*
     * Ceci est maintenant sécuritaire :
     * syncStorageTargetNow() lit toujours
     * l'externe AVANT d'écrire.
     */
    scheduleStorageTargetSync(0);
}

export {
    setupStorageTargetSync,
    scheduleStorageTargetSync,
    syncStorageTargetNow
};