import {
    putStoredPlan,
    deleteStoredPlan,
    putStoredSetting,
    putStoredWorkoutHistory,
    deleteStoredWorkoutHistory
} from "./storage-provider.js";

import { loadStorageTargetConfig, saveStorageTargetConfig } from "./storage-target-config.js";
import { readStorageDirectoryFile, writeStorageDirectoryFile } from "./storage-target.js";
import { createStorageSnapshot, parseStorageSnapshot } from "./storage-snapshot.js";
import { loadSyncMetadata, saveSyncMetadata } from "./sync-metadata.js";
import { createSyncBaseline, baselinesEqual, compareSyncBaselines } from "./storage-sync-baseline.js";
import { migratePlanRecord } from "./plan-storage.js";
import { normalizeAppSettings } from "./settings-storage.js";
import { migrateWorkoutHistoryRecord } from "./workout-history-storage.js";

// ============================================================
// FUSION BIDIRECTIONNELLE LOCAL ↔ EXTERNE
// ============================================================

const STORAGE_DATA_FILE = "wilf-workout-data.wilf";

function getRecordTimestamp(record) {
    const value = Number(record?.updatedAt ?? record?.createdAt ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function findById(records, id) {
    return (records ?? []).find(record => String(record?.id) === String(id)) ?? null;
}

function getCollectionState(snapshot, collection, id) {
    const record = findById(snapshot?.[collection], id);
    const tombstone = findById(snapshot?.tombstones?.[collection], id);
    const recordTime = getRecordTimestamp(record);
    const deletedAt = Number(tombstone?.deletedAt) || 0;

    if (tombstone && deletedAt >= recordTime) return { type: "deleted", value: structuredClone(tombstone) };
    if (record) return { type: "record", value: structuredClone(record) };
    return null;
}

function setCollectionState(snapshot, collection, id, state) {
    snapshot[collection] ??= [];
    snapshot.tombstones ??= {};
    snapshot.tombstones[collection] ??= [];

    snapshot[collection] = snapshot[collection].filter(record => String(record?.id) !== String(id));
    snapshot.tombstones[collection] = snapshot.tombstones[collection].filter(record => String(record?.id) !== String(id));

    if (state?.type === "record") snapshot[collection].push(structuredClone(state.value));
    if (state?.type === "deleted") snapshot.tombstones[collection].push(structuredClone(state.value));
}

function removeMetadataTombstone(metadata, collection, id) {
    metadata.tombstones[collection] = metadata.tombstones[collection].filter(item => String(item.id) !== String(id));
}

function setMetadataTombstone(metadata, collection, tombstone) {
    removeMetadataTombstone(metadata, collection, tombstone.id);
    metadata.tombstones[collection].push(structuredClone(tombstone));
}

function normalizeCollectionState(collection, state) {
    if (!state || state.type === "deleted") return state;
    if (collection === "plans") return { type: "record", value: migratePlanRecord(state.value) };
    if (collection === "workoutHistory") return { type: "record", value: migrateWorkoutHistoryRecord(state.value) };
    throw new Error(`Collection de synchronisation inconnue : ${collection}`);
}

async function applyLocalCollectionState(collection, id, state, metadata) {
    if (!state) throw new Error(`État ${collection}/${id} absent sans tombstone.`);

    if (collection === "plans") {
        if (state.type === "deleted") {
            await deleteStoredPlan(id);
            setMetadataTombstone(metadata, "plans", state.value);
            return;
        }

        const record = migratePlanRecord(state.value);
        if (record?.id == null) throw new Error("Plan externe sans identifiant.");

        await putStoredPlan(record);
        removeMetadataTombstone(metadata, "plans", id);
        return;
    }

    if (collection === "workoutHistory") {
        if (state.type === "deleted") {
            await deleteStoredWorkoutHistory(id);
            setMetadataTombstone(metadata, "workoutHistory", state.value);
            return;
        }

        await putStoredWorkoutHistory(migrateWorkoutHistoryRecord(state.value));
        removeMetadataTombstone(metadata, "workoutHistory", id);
        return;
    }

    throw new Error(`Collection de synchronisation inconnue : ${collection}`);
}

function preserveConflictBaseline(nextBaseline, previousBaseline, conflicts) {
    conflicts.forEach(conflict => {
        if (conflict.collection === "settings") {
            nextBaseline.settings = previousBaseline.settings ?? null;
            return;
        }

        if (!["plans", "workoutHistory"].includes(conflict.collection)) return;

        const previous = previousBaseline[conflict.collection]?.[conflict.id];

        if (previous) {
            nextBaseline[conflict.collection][conflict.id] = structuredClone(previous);
            return;
        }

        delete nextBaseline[conflict.collection][conflict.id];
    });
}

async function syncStorageBidirectionalNow() {
    let config = await loadStorageTargetConfig();

    if (config.type !== "directory" || !config.directoryUri) {
        return { status: "device-only", imported: 0, exported: 0, conflicts: [] };
    }

    const file = await readStorageDirectoryFile({
        directoryUri: config.directoryUri,
        fileUri: config.dataFileUri,
        fileName: STORAGE_DATA_FILE
    });

    if (!file?.exists) return { status: "missing-file", imported: 0, exported: 0, conflicts: [] };

    if (file.uri && file.uri !== config.dataFileUri) {
        config.dataFileUri = file.uri;
        config = await saveStorageTargetConfig(config);
    }

    const localSnapshot = await createStorageSnapshot();
    const externalSnapshot = parseStorageSnapshot(file.content);
    const metadata = await loadSyncMetadata();

    const [localState, externalState] = await Promise.all([
        createSyncBaseline(localSnapshot),
        createSyncBaseline(externalSnapshot)
    ]);

    // Première baseline
    if (!metadata.baseline) {
        if (!baselinesEqual(localState, externalState)) {
            return { status: "missing-baseline", imported: 0, exported: 0, conflicts: [] };
        }

        metadata.baseline = localState;
        await saveSyncMetadata(metadata);
        return { status: "baseline-initialized", imported: 0, exported: 0, conflicts: [] };
    }

    const baseline = metadata.baseline;

    // Déjà synchronisé
    if (baselinesEqual(localState, externalState)) {
        metadata.baseline = localState;
        await saveSyncMetadata(metadata);
        return { status: "same", imported: 0, exported: 0, conflicts: [] };
    }

    const comparison = compareSyncBaselines(localState, externalState, baseline);
    const mergedLocal = structuredClone(localSnapshot);
    const mergedExternal = structuredClone(externalSnapshot);
    const localChanges = [];
    const conflicts = [];

    let externalDirty = false;
    let exported = 0;

    // --------------------------------------------------------
    // Paramètres
    // --------------------------------------------------------

    if (comparison.settings === "local-changed") {
        mergedExternal.settings = structuredClone(localSnapshot.settings);
        externalDirty = true;
        exported += 1;
    } else if (comparison.settings === "external-changed") {
        if (!externalSnapshot.settings || typeof externalSnapshot.settings !== "object") {
            conflicts.push({ collection: "settings", id: "app", reason: "missing-external-settings" });
        } else {
            mergedLocal.settings = normalizeAppSettings(externalSnapshot.settings);
            localChanges.push({ collection: "settings", id: "app" });
        }
    } else if (["conflict", "different"].includes(comparison.settings)) {
        conflicts.push({ collection: "settings", id: "app", reason: comparison.settings });
    }

    // --------------------------------------------------------
    // Plans + historique
    // --------------------------------------------------------

    for (const collection of ["plans", "workoutHistory"]) {
        comparison[collection].forEach(item => {
            const local = getCollectionState(localSnapshot, collection, item.id);
            const external = getCollectionState(externalSnapshot, collection, item.id);

            if (item.status === "local-changed") {
                if (!local && item.baseline) {
                    conflicts.push({ collection, id: item.id, reason: "missing-local-without-tombstone" });
                    return;
                }

                setCollectionState(mergedExternal, collection, item.id, local);
                externalDirty = true;
                exported += 1;
                return;
            }

            if (item.status === "external-changed") {
                if (!external && item.baseline) {
                    conflicts.push({ collection, id: item.id, reason: "missing-external-without-tombstone" });
                    return;
                }

                const normalizedExternal = normalizeCollectionState(collection, external);
                setCollectionState(mergedLocal, collection, item.id, normalizedExternal);
                localChanges.push({ collection, id: item.id, state: normalizedExternal });
                return;
            }

            if (["conflict", "different"].includes(item.status)) {
                conflicts.push({ collection, id: item.id, reason: item.status });
            }
        });
    }

    // --------------------------------------------------------
    // Vérification anti-écrasement concurrent
    // --------------------------------------------------------

    if (externalDirty) {
        const latestFile = await readStorageDirectoryFile({
            directoryUri: config.directoryUri,
            fileUri: config.dataFileUri,
            fileName: STORAGE_DATA_FILE
        });

        if (!latestFile?.exists) {
            return {
                status: "external-changed-during-sync",
                imported: 0,
                exported: 0,
                conflicts: [{ collection: "storage", id: STORAGE_DATA_FILE, reason: "file-disappeared" }]
            };
        }

        const latestExternal = parseStorageSnapshot(latestFile.content);
        const latestExternalState = await createSyncBaseline(latestExternal);

        if (!baselinesEqual(latestExternalState, externalState)) {
            return {
                status: "external-changed-during-sync",
                imported: 0,
                exported: 0,
                conflicts: [{ collection: "storage", id: STORAGE_DATA_FILE, reason: "concurrent-change" }]
            };
        }
    }

    // --------------------------------------------------------
    // Appliquer les changements externes au local
    // --------------------------------------------------------

    for (const change of localChanges) {
        if (change.collection === "settings") {
            await putStoredSetting(mergedLocal.settings);
            continue;
        }

        await applyLocalCollectionState(change.collection, change.id, change.state, metadata);
    }

    // --------------------------------------------------------
    // Appliquer les changements locaux à l'externe
    // --------------------------------------------------------

    if (externalDirty) {
        mergedExternal.savedAt = new Date().toISOString();

        const result = await writeStorageDirectoryFile({
            directoryUri: config.directoryUri,
            fileUri: config.dataFileUri,
            fileName: STORAGE_DATA_FILE,
            content: JSON.stringify(mergedExternal, null, 2),
            mimeType: "application/json"
        });

        if (result?.uri && result.uri !== config.dataFileUri) {
            config.dataFileUri = result.uri;
            await saveStorageTargetConfig(config);
        }
    }

    // --------------------------------------------------------
    // Nouvelle baseline
    // --------------------------------------------------------

    const mergedLocalState = await createSyncBaseline(mergedLocal);
    const nextBaseline = structuredClone(mergedLocalState);

    preserveConflictBaseline(nextBaseline, baseline, conflicts);

    metadata.baseline = nextBaseline;
    await saveSyncMetadata(metadata);

    return {
        status: conflicts.length ? "merged-with-conflicts" : "merged",
        imported: localChanges.length,
        exported,
        conflicts
    };
}

export { syncStorageBidirectionalNow };