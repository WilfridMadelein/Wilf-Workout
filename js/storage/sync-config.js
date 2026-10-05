import { getStoredSetting, putStoredSetting } from './storage-provider.js';

// ============================================================
// CONFIGURATION DE SYNCHRONISATION V3 — FICHIER CANONIQUE
// ============================================================

const SYNC_CONFIG_ID = 'sync-config-v3';
const SYNC_CONFIG_SCHEMA_VERSION = 1;

function createDefaultSyncConfig() {
    return { id: SYNC_CONFIG_ID, schemaVersion: SYNC_CONFIG_SCHEMA_VERSION, updatedAt: Date.now(), mode: 'automatic', initialized: false, target: null };
}

function normalizeTarget(target) {
    if (!target || typeof target !== 'object') return null;
    if (target.kind === 'android-file' && typeof target.fileUri === 'string' && target.fileUri) {
        return { kind: 'android-file', fileUri: target.fileUri, name: typeof target.name === 'string' && target.name.trim() ? target.name.trim() : 'Fichier de synchronisation' };
    }
    if (target.kind === 'web-file' && target.fileHandle?.kind === 'file') {
        return { kind: 'web-file', fileHandle: target.fileHandle, name: typeof target.name === 'string' && target.name.trim() ? target.name.trim() : target.fileHandle.name || 'Fichier de synchronisation' };
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
    clearSyncTarget,
    setSyncMode,
    markSyncInitialized
};
