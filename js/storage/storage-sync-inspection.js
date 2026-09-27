import {
    loadStorageTargetConfig,
    saveStorageTargetConfig
} from "./storage-target-config.js";

import {
    readStorageDirectoryFile
} from "./storage-target.js";

import {
    createStorageSnapshot,
    parseStorageSnapshot
} from "./storage-snapshot.js";

import {
    compareCollection
} from "./storage-sync-compare.js";

// ============================================================
// INSPECTION DE LA SYNCHRONISATION
// ============================================================

const STORAGE_DATA_FILE =
    "wilf-workout-data.wilf";

async function inspectStorageSync() {
    let config =
        await loadStorageTargetConfig();

    if (
        config.type !== "directory" ||
        !config.directoryUri
    ) {
        return {
            available: false,
            reason: "device-only"
        };
    }

    const file =
        await readStorageDirectoryFile({
            directoryUri:
                config.directoryUri,

            fileUri:
                config.dataFileUri,

            fileName:
                STORAGE_DATA_FILE
        });

    if (!file?.exists) {
        return {
            available: false,
            reason: "missing-file"
        };
    }

    if (
        file.uri &&
        file.uri !== config.dataFileUri
    ) {
        config.dataFileUri =
            file.uri;

        await saveStorageTargetConfig(
            config
        );
    }

    const local =
        await createStorageSnapshot();

    const external =
        parseStorageSnapshot(
            file.content
        );

    return {
        available: true,

        local,
        external,

        plans:
            compareCollection({
                localRecords:
                    local.plans,

                externalRecords:
                    external.plans,

                localTombstones:
                    local.tombstones.plans,

                externalTombstones:
                    external.tombstones.plans
            }),

        workoutHistory:
            compareCollection({
                localRecords:
                    local.workoutHistory,

                externalRecords:
                    external.workoutHistory,

                localTombstones:
                    local.tombstones
                        .workoutHistory,

                externalTombstones:
                    external.tombstones
                        .workoutHistory
            })
    };
}

export {
    inspectStorageSync
};