import {
    getStoredSetting,
    putStoredSetting
} from "./storage-provider.js";

// ============================================================
// CONFIGURATION DE LA DESTINATION DES DONNÉES
// ============================================================

const STORAGE_TARGET_ID = "storage-target";
const STORAGE_TARGET_SCHEMA_VERSION = 1;

function createDefaultStorageTargetConfig() {
    return {
        id: STORAGE_TARGET_ID,
        schemaVersion: STORAGE_TARGET_SCHEMA_VERSION,
        updatedAt: Date.now(),
        type: "device",
        directoryUri: null
    };
}

function normalizeStorageTargetConfig(config = {}) {
    const directoryUri =
        typeof config.directoryUri === "string" && config.directoryUri
            ? config.directoryUri
            : null;

    return {
        id: STORAGE_TARGET_ID,
        schemaVersion: STORAGE_TARGET_SCHEMA_VERSION,
        updatedAt: Number(config.updatedAt) || Date.now(),
        type:
            config.type === "directory" && directoryUri
                ? "directory"
                : "device",
        directoryUri
    };
}

async function loadStorageTargetConfig() {
    const stored = await getStoredSetting(STORAGE_TARGET_ID);

    if (stored) return normalizeStorageTargetConfig(stored);

    const config = createDefaultStorageTargetConfig();
    await putStoredSetting(config);
    return config;
}

async function saveStorageTargetConfig(config) {
    config.updatedAt = Date.now();

    const record = normalizeStorageTargetConfig(config);
    record.updatedAt = config.updatedAt;

    await putStoredSetting(record);
    return record;
}

export {
    createDefaultStorageTargetConfig,
    loadStorageTargetConfig,
    saveStorageTargetConfig
};