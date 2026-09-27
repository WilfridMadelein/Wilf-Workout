import { getStoredSetting, putStoredSetting } from "./storage-provider.js";

// ============================================================
// FICHIER PARTAGÉ DE SYNCHRONISATION
// ============================================================

const SHARED_SYNC_FILE_ID = "shared-sync-file";
const SHARED_SYNC_FILE_SCHEMA_VERSION = 1;

function createDefaultSharedSyncFileConfig() {
    return {
        id: SHARED_SYNC_FILE_ID,
        schemaVersion: SHARED_SYNC_FILE_SCHEMA_VERSION,
        updatedAt: Date.now(),
        fileName: null,
        fileHandle: null
    };
}

function normalizeSharedSyncFileConfig(config = {}) {
    const fileHandle = config.fileHandle?.kind === "file" ? config.fileHandle : null;

    return {
        id: SHARED_SYNC_FILE_ID,
        schemaVersion: SHARED_SYNC_FILE_SCHEMA_VERSION,
        updatedAt: Number(config.updatedAt) || Date.now(),
        fileName: fileHandle ? config.fileName || fileHandle.name || null : null,
        fileHandle
    };
}

async function loadSharedSyncFileConfig() {
    const stored = await getStoredSetting(SHARED_SYNC_FILE_ID);
    return stored ? normalizeSharedSyncFileConfig(stored) : createDefaultSharedSyncFileConfig();
}

async function saveSharedSyncFileConfig(config) {
    const record = normalizeSharedSyncFileConfig({ ...config, updatedAt: Date.now() });
    await putStoredSetting(record);
    return record;
}

async function clearSharedSyncFileConfig() {
    return saveSharedSyncFileConfig(createDefaultSharedSyncFileConfig());
}

export {
    SHARED_SYNC_FILE_ID,
    createDefaultSharedSyncFileConfig,
    loadSharedSyncFileConfig,
    saveSharedSyncFileConfig,
    clearSharedSyncFileConfig
};