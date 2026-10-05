import { loadSyncConfig, updateSyncTarget } from './sync-config.js';
import { hasSyncDirectoryAccess, readSyncDirectoryFile, writeSyncDirectoryFile } from './sync-directory.js';

// ============================================================
// CIBLE ACTIVE DE SYNCHRONISATION
// ============================================================

const STORAGE_DATA_FILE = 'wilf-workout-sync.json';

async function getActiveSyncTarget() {
    const config = await loadSyncConfig();
    if (!config.target) return { type: 'none', reason: 'no-target', config };
    if (!await hasSyncDirectoryAccess(config.target, false)) return { type: 'none', reason: 'permission-required', config };
    return { type: 'directory', target: config.target, config };
}

async function readSyncFileTarget(active = null) {
    active ??= await getActiveSyncTarget();
    if (active.type === 'none') return { available: false, reason: active.reason, target: active.target ?? null, config: active.config };

    const result = await readSyncDirectoryFile(active.target, STORAGE_DATA_FILE);
    if (result.target !== active.target) {
        active.target = result.target;
        active.config.target = result.target;
        await updateSyncTarget(result.target);
    }

    return { available: true, exists: Boolean(result.exists), content: result.content ?? null, target: active.target, config: active.config };
}

async function writeSyncFileTarget(target, content) {
    if (!target) throw new Error('Aucun dossier de synchronisation disponible.');
    const result = await writeSyncDirectoryFile(target, STORAGE_DATA_FILE, content);
    if (result.target !== target) await updateSyncTarget(result.target);
    return result;
}

export { STORAGE_DATA_FILE, getActiveSyncTarget, readSyncFileTarget, writeSyncFileTarget };
