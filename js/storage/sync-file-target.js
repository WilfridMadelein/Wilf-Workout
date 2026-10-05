import { loadSyncConfig } from './sync-config.js';
import { hasSyncFileAccess, readSyncFile, writeSyncFile } from './sync-file-access.js';

// ============================================================
// CIBLE ACTIVE DE SYNCHRONISATION — FICHIER CANONIQUE
// ============================================================

const SYNC_TARGET_ID = 'shared-sync-file';

async function getActiveSyncTarget() {
    const config = await loadSyncConfig();
    if (!config.target) return { type: 'none', reason: 'no-target', config };
    if (!await hasSyncFileAccess(config.target, false)) return { type: 'none', reason: 'permission-required', config, target: config.target };
    return { type: 'file', target: config.target, config };
}

async function readSyncFileTarget(active = null) {
    active ??= await getActiveSyncTarget();
    if (active.type === 'none') return { available: false, reason: active.reason, target: active.target ?? null, config: active.config };
    const result = await readSyncFile(active.target);
    const content = typeof result.content === 'string' ? result.content : '';
    return { available: true, exists: content.trim().length > 0, content, target: active.target, config: active.config };
}

async function writeSyncFileTarget(target, content) {
    if (!target) throw new Error('Aucun fichier de synchronisation disponible.');
    await writeSyncFile(target, content);
    return { target };
}

export { SYNC_TARGET_ID, getActiveSyncTarget, readSyncFileTarget, writeSyncFileTarget };
