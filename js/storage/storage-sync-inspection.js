import { readSyncFileTarget } from "./sync-file-target.js";

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

function summarizeComparison(comparison) {
    const statuses = [
        comparison.settings,
        ...comparison.plans.map(item => item.status),
        ...comparison.workoutHistory.map(item => item.status)
    ];

    if (statuses.some(status => ["conflict", "different"].includes(status))) return "conflict";

    const localChanged = statuses.includes("local-changed");
    const externalChanged = statuses.includes("external-changed");

    if (localChanged && externalChanged) return "mergeable";
    if (localChanged) return "local-changed";
    if (externalChanged) return "external-changed";

    return "same";
}

async function inspectStorageSync() {
    const file = await readSyncFileTarget();

    if (!file.available) {
        return { available: false, reason: file.reason };
    }

    if (!file.exists) {
        return { available: false, reason: "missing-file" };
    }

    const [local, metadata] = await Promise.all([
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

 const localChanged = !baselinesEqual(localState, baseline);
const externalChanged = !baselinesEqual(externalState, baseline);
const comparison = compareSyncBaselines(localState, externalState, baseline);
const status = summarizeComparison(comparison);

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

        comparison
    };
}

export {
    inspectStorageSync
};