import {
    putStoredPlan,
    deleteStoredPlan,
    putStoredSetting,
    putStoredWorkoutHistory,
    deleteStoredWorkoutHistory
} from "./storage-provider.js";
import { SYNC_TARGET_ID, readSyncFileTarget, writeSyncFileTarget } from "./sync-file-target.js";
import { createStorageSnapshot, parseStorageSnapshot } from "./storage-snapshot.js";
import { loadSyncMetadata, saveSyncMetadata } from "./sync-metadata.js";
import { createSyncBaseline, baselinesEqual, compareSyncBaselines } from "./storage-sync-baseline.js";
import { migratePlanRecord } from "./plan-storage.js";
import { normalizeAppSettings } from "./settings-storage.js";
import { migrateWorkoutHistoryRecord } from "./workout-history-storage.js";

// ============================================================
// FUSION BIDIRECTIONNELLE LOCAL ↔ EXTERNE
// ============================================================

const CONFLICT_POLICIES = new Set(["preserve", "local", "external"]);
let syncQueue = Promise.resolve();

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
        if (previous) nextBaseline[conflict.collection][conflict.id] = structuredClone(previous);
        else delete nextBaseline[conflict.collection][conflict.id];
    });
}

function createEmptyBaseline() {
    return { schemaVersion: 1, plans: {}, settings: null, workoutHistory: {} };
}

function normalizeConflictPolicy(value) {
    return CONFLICT_POLICIES.has(value) ? value : "preserve";
}

function addConflict(conflicts, collection, id, reason) {
    conflicts.push({ collection, id, reason });
}

function resolveSettingsConflict({ conflictPolicy, localSnapshot, externalSnapshot, mergedLocal, mergedExternal, localChanges, conflicts }) {
    if (conflictPolicy === "local") {
        mergedExternal.settings = structuredClone(localSnapshot.settings);
        return { externalDirty: true, exported: 1 };
    }

    if (conflictPolicy === "external") {
        if (!externalSnapshot.settings || typeof externalSnapshot.settings !== "object") {
            addConflict(conflicts, "settings", "app", "missing-external-settings");
            return { externalDirty: false, exported: 0 };
        }
        mergedLocal.settings = normalizeAppSettings(externalSnapshot.settings);
        localChanges.push({ collection: "settings", id: "app" });
        return { externalDirty: false, exported: 0 };
    }

    const localTime = getRecordTimestamp(localSnapshot.settings);
    const externalTime = getRecordTimestamp(externalSnapshot.settings);
    if (localTime > externalTime) {
        mergedExternal.settings = structuredClone(localSnapshot.settings);
        return { externalDirty: true, exported: 1 };
    }
    if (externalTime > localTime) {
        mergedLocal.settings = normalizeAppSettings(externalSnapshot.settings);
        localChanges.push({ collection: "settings", id: "app" });
        return { externalDirty: false, exported: 0 };
    }

    addConflict(conflicts, "settings", "app", "conflict");
    return { externalDirty: false, exported: 0 };
}

function resolveCollectionConflict({ conflictPolicy, collection, item, localSnapshot, externalSnapshot, mergedLocal, mergedExternal, localChanges, conflicts }) {
    const local = getCollectionState(localSnapshot, collection, item.id);
    const external = getCollectionState(externalSnapshot, collection, item.id);

    if (conflictPolicy === "local") {
        if (!local && item.baseline) {
            addConflict(conflicts, collection, item.id, "missing-local-without-tombstone");
            return { externalDirty: false, exported: 0 };
        }
        setCollectionState(mergedExternal, collection, item.id, local);
        return { externalDirty: true, exported: 1 };
    }

    if (conflictPolicy === "external") {
        if (!external && item.baseline) {
            addConflict(conflicts, collection, item.id, "missing-external-without-tombstone");
            return { externalDirty: false, exported: 0 };
        }
        const normalizedExternal = normalizeCollectionState(collection, external);
        setCollectionState(mergedLocal, collection, item.id, normalizedExternal);
        localChanges.push({ collection, id: item.id, state: normalizedExternal });
        return { externalDirty: false, exported: 0 };
    }

    addConflict(conflicts, collection, item.id, item.status);
    return { externalDirty: false, exported: 0 };
}

async function verifyExternalUnchanged(file, expectedState) {
    const latestFile = await readSyncFileTarget({ type: 'file', target: file.target, config: file.config });
    if (!latestFile.available || !latestFile.exists) return { ok: false, reason: "file-disappeared" };
    const latestExternal = parseStorageSnapshot(latestFile.content);
    const latestExternalState = await createSyncBaseline(latestExternal);
    return { ok: baselinesEqual(latestExternalState, expectedState), reason: "concurrent-change" };
}

async function runStorageSync(conflictPolicy) {
    const file = await readSyncFileTarget();
    if (!file.available) return { status: file.reason, policy: conflictPolicy, imported: 0, exported: 0, conflicts: [] };

    const localSnapshot = await createStorageSnapshot();
    if (!file.exists) {
        if (conflictPolicy === "external") return { status: "missing-file", policy: conflictPolicy, imported: 0, exported: 0, conflicts: [] };
        await writeSyncFileTarget(file.target, JSON.stringify(localSnapshot, null, 2));
        const metadata = await loadSyncMetadata();
        metadata.baseline = await createSyncBaseline(localSnapshot);
        await saveSyncMetadata(metadata);
        return { status: "created", policy: conflictPolicy, imported: 0, exported: 1, conflicts: [] };
    }

    const externalSnapshot = parseStorageSnapshot(file.content);
    const metadata = await loadSyncMetadata();
    const [localState, externalState] = await Promise.all([createSyncBaseline(localSnapshot), createSyncBaseline(externalSnapshot)]);

    if (!metadata.baseline && baselinesEqual(localState, externalState)) {
        metadata.baseline = localState;
        await saveSyncMetadata(metadata);
        return { status: "baseline-initialized", policy: conflictPolicy, imported: 0, exported: 0, conflicts: [] };
    }

    const firstPairing = !metadata.baseline;
    const baseline = metadata.baseline ?? createEmptyBaseline();

    if (baselinesEqual(localState, externalState)) {
        metadata.baseline = localState;
        await saveSyncMetadata(metadata);
        return { status: "same", policy: conflictPolicy, imported: 0, exported: 0, conflicts: [] };
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
        if (!externalSnapshot.settings || typeof externalSnapshot.settings !== "object") addConflict(conflicts, "settings", "app", "missing-external-settings");
        else {
            mergedLocal.settings = normalizeAppSettings(externalSnapshot.settings);
            localChanges.push({ collection: "settings", id: "app" });
        }
    } else if (["conflict", "different"].includes(comparison.settings)) {
        const resolved = resolveSettingsConflict({ conflictPolicy, localSnapshot, externalSnapshot, mergedLocal, mergedExternal, localChanges, conflicts });
        externalDirty ||= resolved.externalDirty;
        exported += resolved.exported;
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
                    addConflict(conflicts, collection, item.id, "missing-local-without-tombstone");
                    return;
                }
                setCollectionState(mergedExternal, collection, item.id, local);
                externalDirty = true;
                exported += 1;
                return;
            }

            if (item.status === "external-changed") {
                if (!external && item.baseline) {
                    addConflict(conflicts, collection, item.id, "missing-external-without-tombstone");
                    return;
                }
                const normalizedExternal = normalizeCollectionState(collection, external);
                setCollectionState(mergedLocal, collection, item.id, normalizedExternal);
                localChanges.push({ collection, id: item.id, state: normalizedExternal });
                return;
            }

            if (["conflict", "different"].includes(item.status)) {
                const resolved = resolveCollectionConflict({ conflictPolicy, collection, item, localSnapshot, externalSnapshot, mergedLocal, mergedExternal, localChanges, conflicts });
                externalDirty ||= resolved.externalDirty;
                exported += resolved.exported;
            }
        });
    }

    // --------------------------------------------------------
    // Vérification anti-écrasement concurrent
    // --------------------------------------------------------

    if (externalDirty || localChanges.length) {
        const verification = await verifyExternalUnchanged(file, externalState);
        if (!verification.ok) {
            return {
                status: "external-changed-during-sync",
                policy: conflictPolicy,
                imported: 0,
                exported: 0,
                conflicts: [{ collection: "storage", id: SYNC_TARGET_ID, reason: verification.reason }]
            };
        }
    }

    // --------------------------------------------------------
    // Protection de la copie locale pendant une synchronisation en arrière-plan
    // --------------------------------------------------------

    if (localChanges.length || externalDirty) {
        const currentLocalState = await createSyncBaseline(await createStorageSnapshot());
        if (!baselinesEqual(currentLocalState, localState)) {
            return { status: "local-changed-during-sync", policy: conflictPolicy, imported: 0, exported: 0, conflicts: [] };
        }
    }

    // --------------------------------------------------------
    // Appliquer les changements
    // --------------------------------------------------------

    for (const change of localChanges) {
        if (change.collection === "settings") {
            await putStoredSetting(mergedLocal.settings);
            continue;
        }
        await applyLocalCollectionState(change.collection, change.id, change.state, metadata);
    }

    if (externalDirty) {
        mergedExternal.savedAt = new Date().toISOString();
        await writeSyncFileTarget(file.target, JSON.stringify(mergedExternal, null, 2));
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
        status: conflicts.length ? "merged-with-conflicts" : firstPairing ? "paired" : "merged",
        policy: conflictPolicy,
        imported: localChanges.length,
        exported,
        conflicts
    };
}

function syncStorageBidirectionalNow({ conflictPolicy = "preserve" } = {}) {
    const policy = normalizeConflictPolicy(conflictPolicy);
    const operation = syncQueue.then(() => runStorageSync(policy), () => runStorageSync(policy));
    syncQueue = operation.catch(() => undefined);
    return operation;
}

function pushStorageNow() {
    return syncStorageBidirectionalNow({ conflictPolicy: "local" });
}

function pullStorageNow() {
    return syncStorageBidirectionalNow({ conflictPolicy: "external" });
}

export { syncStorageBidirectionalNow, pushStorageNow, pullStorageNow };
