import {
    getStoredPlans,
    getStoredSetting,
    getStoredWorkoutHistory
} from "./storage-provider.js";

import {
    loadSyncMetadata
} from "./sync-metadata.js";

// ============================================================
// COPIE PORTABLE DES DONNÉES WILF
// ============================================================

const STORAGE_DATA_FORMAT =
    "wilf-workout-data";

const STORAGE_DATA_VERSION = 2;

async function createStorageSnapshot() {
    const [
        plans,
        settings,
        workoutHistory,
        syncMetadata
    ] = await Promise.all([
        getStoredPlans(),
        getStoredSetting("app"),
        getStoredWorkoutHistory(),
        loadSyncMetadata()
    ]);

    return {
        format: STORAGE_DATA_FORMAT,
        dataVersion: STORAGE_DATA_VERSION,
        savedAt: new Date().toISOString(),

        plans,
        settings: settings ?? null,
        workoutHistory,

        tombstones: {
            plans:
                syncMetadata.tombstones.plans,

            workoutHistory:
                syncMetadata.tombstones.workoutHistory
        }
    };
}

function normalizeSnapshotTombstones(value) {
    if (!Array.isArray(value)) return [];

    return value
        .filter(item => item?.id != null)
        .map(item => ({
            id: item.id,
            deletedAt:
                Number(item.deletedAt) || 0
        }));
}

function parseStorageSnapshot(content) {
    let snapshot;

    try {
        snapshot =
            JSON.parse(content);
    } catch {
        throw new Error(
            "Le fichier de données Wilf contient un JSON invalide."
        );
    }

    if (
        !snapshot ||
        snapshot.format !== STORAGE_DATA_FORMAT
    ) {
        throw new Error(
            "Ce fichier n'est pas un fichier de données Wilf valide."
        );
    }

    const version =
        Number(snapshot.dataVersion);

    if (
        !Number.isInteger(version) ||
        version < 1 ||
        version > STORAGE_DATA_VERSION
    ) {
        throw new Error(
            "Version du fichier de données Wilf incompatible."
        );
    }

    if (!Array.isArray(snapshot.plans)) {
        throw new Error(
            "Liste de plans invalide."
        );
    }

    if (!Array.isArray(snapshot.workoutHistory)) {
        throw new Error(
            "Historique d'entraînement invalide."
        );
    }

    return {
        format: STORAGE_DATA_FORMAT,
        dataVersion: version,
        savedAt:
            snapshot.savedAt ?? null,

        plans:
            snapshot.plans,

        settings:
            snapshot.settings ?? null,

        workoutHistory:
            snapshot.workoutHistory,

        tombstones: {
            plans:
                normalizeSnapshotTombstones(
                    snapshot.tombstones?.plans
                ),

            workoutHistory:
                normalizeSnapshotTombstones(
                    snapshot.tombstones
                        ?.workoutHistory
                )
        }
    };
}

export {
    STORAGE_DATA_FORMAT,
    STORAGE_DATA_VERSION,
    createStorageSnapshot,
    parseStorageSnapshot
};