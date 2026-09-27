import {
    getStoredSetting,
    putStoredSetting
} from "./storage-provider.js";

// ============================================================
// CONFIGURATION DE LA DESTINATION DES DONNÉES
// ============================================================

const STORAGE_TARGET_ID = "storage-target";
const STORAGE_TARGET_SCHEMA_VERSION = 2;

function createDefaultStorageTargetConfig() {
    return {
        id: STORAGE_TARGET_ID,
        schemaVersion: STORAGE_TARGET_SCHEMA_VERSION,
        updatedAt: Date.now(),
        type: "device",
        directoryUri: null,
        dataFileUri: null
    };
}

function normalizeStorageTargetConfig(config = {}) {
    const directoryUri =
        typeof config.directoryUri === "string" && config.directoryUri
            ? config.directoryUri
            : null;

    const directorySelected =
        config.type === "directory" &&
        Boolean(directoryUri);

    const dataFileUri =
        directorySelected &&
        typeof config.dataFileUri === "string" &&
        config.dataFileUri
            ? config.dataFileUri
            : null;

    return {
        id: STORAGE_TARGET_ID,
        schemaVersion: STORAGE_TARGET_SCHEMA_VERSION,
        updatedAt: Number(config.updatedAt) || Date.now(),
        type: directorySelected ? "directory" : "device",
        directoryUri: directorySelected ? directoryUri : null,
        dataFileUri
    };
}

async function loadStorageTargetConfig() {
    const stored =
        await getStoredSetting(STORAGE_TARGET_ID);

    if (stored) {
        return normalizeStorageTargetConfig(stored);
    }

    const config =
        createDefaultStorageTargetConfig();

    await putStoredSetting(config);

    return config;
}

async function saveStorageTargetConfig(config) {
    const record =
        normalizeStorageTargetConfig({
            ...config,
            updatedAt: Date.now()
        });

    await putStoredSetting(record);

    return record;
}

export {
    STORAGE_TARGET_ID,
    createDefaultStorageTargetConfig,
    loadStorageTargetConfig,
    saveStorageTargetConfig
};