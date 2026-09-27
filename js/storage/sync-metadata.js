import {
    getStoredSetting,
    putStoredSetting
} from "./storage-provider.js";

// ============================================================
// MÉTADONNÉES DE SYNCHRONISATION
// ============================================================

const SYNC_METADATA_ID = "sync-metadata";
const SYNC_METADATA_SCHEMA_VERSION = 2;

function createDefaultSyncMetadata() {
    return {
        id: SYNC_METADATA_ID,
        schemaVersion: SYNC_METADATA_SCHEMA_VERSION,
        updatedAt: Date.now(),
        baseline: null,
        tombstones: {
            plans: [],
            workoutHistory: []
        }
    };
}

function normalizeTombstones(value) {
    if (!Array.isArray(value)) return [];

    return value
        .filter(item => item?.id != null)
        .map(item => ({
            id: item.id,
            deletedAt: Number(item.deletedAt) || Date.now()
        }));
}

function normalizeSyncMetadata(metadata = {}) {
    return {
        id: SYNC_METADATA_ID,
        schemaVersion: SYNC_METADATA_SCHEMA_VERSION,
        updatedAt: Number(metadata.updatedAt) || Date.now(),
        baseline:
            metadata.baseline &&
            typeof metadata.baseline === "object"
                ? metadata.baseline
                : null,
        tombstones: {
            plans: normalizeTombstones(
                metadata.tombstones?.plans
            ),
            workoutHistory: normalizeTombstones(
                metadata.tombstones?.workoutHistory
            )
        }
    };
}

async function loadSyncMetadata() {
    const stored =
        await getStoredSetting(SYNC_METADATA_ID);

    return stored
        ? normalizeSyncMetadata(stored)
        : createDefaultSyncMetadata();
}

async function saveSyncMetadata(metadata) {
    const record =
        normalizeSyncMetadata({
            ...metadata,
            updatedAt: Date.now()
        });

    await putStoredSetting(record);
    return record;
}

async function saveSyncBaseline(baseline) {
    const metadata =
        await loadSyncMetadata();

    metadata.baseline = baseline;

    return saveSyncMetadata(metadata);
}

async function clearSyncBaseline() {
    const metadata =
        await loadSyncMetadata();

    metadata.baseline = null;

    return saveSyncMetadata(metadata);
}

async function recordDeletion(type, id) {
    if (!["plans", "workoutHistory"].includes(type)) {
        throw new Error(
            `Type de tombstone inconnu : ${type}`
        );
    }

    const metadata =
        await loadSyncMetadata();

    metadata.tombstones[type] =
        metadata.tombstones[type]
            .filter(item => String(item.id) !== String(id));

    metadata.tombstones[type].push({
        id,
        deletedAt: Date.now()
    });

    await saveSyncMetadata(metadata);
}

async function removeDeletion(type, id) {
    const metadata =
        await loadSyncMetadata();

    metadata.tombstones[type] =
        metadata.tombstones[type]
            .filter(item => String(item.id) !== String(id));

    return saveSyncMetadata(metadata);
}

export {
    SYNC_METADATA_ID,
    createDefaultSyncMetadata,
    loadSyncMetadata,
    saveSyncMetadata,
    saveSyncBaseline,
    clearSyncBaseline,
    recordDeletion,
    removeDeletion
};