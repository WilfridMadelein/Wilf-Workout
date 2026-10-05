import { getStoredSetting, putStoredSetting } from './storage-provider.js';

// ============================================================
// CONFIGURATION DE SYNCHRONISATION V2
// ============================================================

const SYNC_CONFIG_ID = 'sync-config-v2';
const SYNC_CONFIG_SCHEMA_VERSION = 1;

function createDefaultSyncConfig() {
    return { id: SYNC_CONFIG_ID, schemaVersion: SYNC_CONFIG_SCHEMA_VERSION, updatedAt: Date.now(), mode: 'automatic', initialized: false, target: null };
}

function normalizeTarget(target) {
    if (!target || typeof target !== 'object') return null;

    if (target.kind === 'android-directory' && typeof target.directoryUri === 'string' && target.directoryUri) {
        return {
            kind: 'android-directory',
            directoryUri: target.directoryUri,
            dataFileUri: typeof target.dataFileUri === 'string' && target.dataFileUri ? target.dataFileUri : null,
            name: typeof target.name === 'string' && target.name.trim() ? target.name.trim() : 'Dossier sélectionné'
        };
    }

    if (target.kind === 'web-directory' && target.directoryHandle?.kind === 'directory') {
        return {
            kind: 'web-directory',
            directoryHandle: target.directoryHandle,
            name: typeof target.name === 'string' && target.name.trim() ? target.name.trim() : target.directoryHandle.name || 'Dossier sélectionné'
        };
    }

    return null;
}

function normalizeSyncConfig(config = {}) {
    const target = normalizeTarget(config.target);
    return {
        id: SYNC_CONFIG_ID,
        schemaVersion: SYNC_CONFIG_SCHEMA_VERSION,
        updatedAt: Number(config.updatedAt) || Date.now(),
        mode: config.mode === 'manual' ? 'manual' : 'automatic',
        initialized: Boolean(target && config.initialized === true),
        target
    };
}

async function loadSyncConfig() {
    const stored = await getStoredSetting(SYNC_CONFIG_ID);
    if (stored) return normalizeSyncConfig(stored);
    const config = createDefaultSyncConfig();
    await putStoredSetting(config);
    return config;
}

async function saveSyncConfig(config) {
    const record = normalizeSyncConfig({ ...config, updatedAt: Date.now() });
    await putStoredSetting(record);
    return record;
}

async function setSyncTarget(target) {
    const config = await loadSyncConfig();
    config.target = normalizeTarget(target);
    config.initialized = false;
    return saveSyncConfig(config);
}

async function updateSyncTarget(target) {
    const config = await loadSyncConfig();
    config.target = normalizeTarget(target);
    return saveSyncConfig(config);
}

async function clearSyncTarget() {
    const config = await loadSyncConfig();
    config.target = null;
    config.initialized = false;
    return saveSyncConfig(config);
}

async function setSyncMode(mode) {
    const config = await loadSyncConfig();
    config.mode = mode === 'manual' ? 'manual' : 'automatic';
    return saveSyncConfig(config);
}

async function markSyncInitialized(initialized = true) {
    const config = await loadSyncConfig();
    config.initialized = Boolean(config.target && initialized);
    return saveSyncConfig(config);
}

export {
    SYNC_CONFIG_ID,
    createDefaultSyncConfig,
    normalizeSyncConfig,
    loadSyncConfig,
    saveSyncConfig,
    setSyncTarget,
    updateSyncTarget,
    clearSyncTarget,
    setSyncMode,
    markSyncInitialized
};
