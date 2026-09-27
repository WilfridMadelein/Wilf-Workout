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
    loadSyncMetadata
} from "./sync-metadata.js";

import {
    createSyncBaseline,
    baselinesEqual,
    compareSyncBaselines
} from "./storage-sync-baseline.js";

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

    const [
        local,
        metadata
    ] = await Promise.all([
        createStorageSnapshot(),
        loadSyncMetadata()
    ]);

    const external =
        parseStorageSnapshot(
            file.content
        );

    const [
        localState,
        externalState
    ] = await Promise.all([
        createSyncBaseline(local),
        createSyncBaseline(external)
    ]);

    const baseline =
        metadata.baseline;

    if (!baseline) {
        return {
            available: true,
            local,
            external,

            sync: {
                hasBaseline: false,

                status:
                    baselinesEqual(
                        localState,
                        externalState
                    )
                        ? "untracked-equal"
                        : "untracked-different"
            },

            comparison: null
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

    let status = "same";

    if (
        !baselinesEqual(
            localState,
            externalState
        )
    ) {
        if (
            localChanged &&
            externalChanged
        ) {
            status = "conflict";
        } else if (localChanged) {
            status = "local-changed";
        } else if (externalChanged) {
            status = "external-changed";
        }
    }

    return {
        available: true,

        local,
        external,

        sync: {
            hasBaseline: true,
            status,
            localChanged,
            externalChanged
        },

        comparison:
            compareSyncBaselines(
                localState,
                externalState,
                baseline
            )
    };
}

export {
    inspectStorageSync
};