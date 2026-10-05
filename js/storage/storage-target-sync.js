import { subscribeStorageChanges } from './storage-change-events.js';
import { SYNC_METADATA_ID } from './sync-metadata.js';
import { SYNC_CONFIG_ID, loadSyncConfig } from './sync-config.js';
import { syncStorageBidirectionalNow } from './storage-sync-merge.js';

// ============================================================
// SYNCHRONISATION AUTOMATIQUE
// ============================================================

let syncTimer = null;
let unsubscribeStorageChanges = null;
let onDataImported = async () => {};
let onSyncComplete = async () => {};

function configureStorageTargetSync(dependencies = {}) {
    ({ onDataImported = async () => {}, onSyncComplete = async () => {} } = dependencies);
}

function scheduleStorageTargetSync(delay = 3000) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        syncTimer = null;
        syncStorageTargetNow();
    }, delay);
}

async function syncStorageTargetNow({ force = false } = {}) {
    try {
        const config = await loadSyncConfig();
        if (!config.target) return { status: 'no-target', imported: 0, exported: 0, conflicts: [] };
        if (!config.initialized) return { status: 'pairing-required', imported: 0, exported: 0, conflicts: [] };
        if (!force && config.mode !== 'automatic') return { status: 'manual-mode', imported: 0, exported: 0, conflicts: [] };

        const result = await syncStorageBidirectionalNow({ conflictPolicy: 'preserve' });
        if ((result?.imported ?? 0) > 0) await onDataImported(result);
        await onSyncComplete(result);
        return result;
    } catch (error) {
        console.error('Impossible de synchroniser les données Wilf :', error);
        const result = { status: 'error', error, imported: 0, exported: 0, conflicts: [] };
        await onSyncComplete(result);
        return result;
    }
}

function setupStorageTargetSync() {
    if (unsubscribeStorageChanges) return;
    unsubscribeStorageChanges = subscribeStorageChanges(change => {
        if (change?.store === 'settings' && [SYNC_METADATA_ID, SYNC_CONFIG_ID].includes(change?.id)) return;
        scheduleStorageTargetSync();
    });
}

export { configureStorageTargetSync, setupStorageTargetSync, scheduleStorageTargetSync, syncStorageTargetNow };
