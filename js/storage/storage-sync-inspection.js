import { loadSyncConfig } from './sync-config.js';
import { readSyncFileTarget } from './sync-file-target.js';
import { createStorageSnapshot, parseStorageSnapshot } from './storage-snapshot.js';
import { loadSyncMetadata } from './sync-metadata.js';
import { createSyncBaseline, baselinesEqual, compareSyncBaselines } from './storage-sync-baseline.js';

// ============================================================
// INSPECTION DE LA SYNCHRONISATION
// ============================================================

function summarizeComparison(comparison) {
    const statuses = [comparison.settings, ...comparison.plans.map(item => item.status), ...comparison.workoutHistory.map(item => item.status)];
    if (statuses.some(status => ['conflict', 'different'].includes(status))) return 'conflict';

    const localChanged = statuses.includes('local-changed');
    const externalChanged = statuses.includes('external-changed');
    if (localChanged && externalChanged) return 'mergeable';
    if (localChanged) return 'local-changed';
    if (externalChanged) return 'external-changed';
    return 'same';
}

function getRecordTimestamp(record) {
    const value = Number(record?.updatedAt ?? record?.createdAt ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function findRecord(snapshot, collection, id) {
    return (snapshot?.[collection] ?? []).find(record => String(record?.id) === String(id)) ?? null;
}

function buildConflictDetails(comparison, local, external) {
    const details = [];
    if (['conflict', 'different'].includes(comparison.settings)) {
        details.push({ collection: 'settings', id: 'app', label: 'Paramètres', localUpdatedAt: getRecordTimestamp(local.settings), externalUpdatedAt: getRecordTimestamp(external.settings) });
    }

    for (const collection of ['plans', 'workoutHistory']) {
        comparison[collection].filter(item => ['conflict', 'different'].includes(item.status)).forEach(item => {
            const localRecord = findRecord(local, collection, item.id);
            const externalRecord = findRecord(external, collection, item.id);
            const fallback = collection === 'plans' ? 'Plan' : 'Entraînement';
            const label = localRecord?.name ?? localRecord?.planName ?? externalRecord?.name ?? externalRecord?.planName ?? fallback;
            details.push({
                collection,
                id: item.id,
                label,
                localUpdatedAt: getRecordTimestamp(localRecord),
                externalUpdatedAt: getRecordTimestamp(externalRecord)
            });
        });
    }

    return details;
}

async function inspectStorageSync() {
    const config = await loadSyncConfig();
    if (!config.target) return { available: false, reason: 'no-target', config };

    const file = await readSyncFileTarget();
    if (!file.available) return { available: false, reason: file.reason, config };

    if (!config.initialized) {
        return {
            available: true,
            config,
            sync: { status: file.exists ? 'pairing-existing' : 'pairing-empty', hasBaseline: false },
            comparison: null,
            conflicts: []
        };
    }

    if (!file.exists) return { available: true, config, sync: { status: 'missing-file', hasBaseline: false }, comparison: null, conflicts: [] };

    const [local, metadata] = await Promise.all([createStorageSnapshot(), loadSyncMetadata()]);
    const external = parseStorageSnapshot(file.content);
    const [localState, externalState] = await Promise.all([createSyncBaseline(local), createSyncBaseline(external)]);
    const baseline = metadata.baseline;

    if (!baseline) {
        return {
            available: true,
            config,
            local,
            external,
            sync: { status: baselinesEqual(localState, externalState) ? 'baseline-missing-equal' : 'baseline-missing-different', hasBaseline: false },
            comparison: null,
            conflicts: []
        };
    }

    const comparison = compareSyncBaselines(localState, externalState, baseline);
    return {
        available: true,
        config,
        local,
        external,
        sync: {
            hasBaseline: true,
            status: summarizeComparison(comparison),
            localChanged: !baselinesEqual(localState, baseline),
            externalChanged: !baselinesEqual(externalState, baseline)
        },
        comparison,
        conflicts: buildConflictDetails(comparison, local, external)
    };
}

export { inspectStorageSync };
