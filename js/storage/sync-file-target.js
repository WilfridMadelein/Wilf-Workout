import { loadStorageTargetConfig, saveStorageTargetConfig } from "./storage-target-config.js";
import { isStorageDirectoryAvailable, readStorageDirectoryFile, writeStorageDirectoryFile } from "./storage-target.js";
import { loadSharedSyncFileConfig } from "./shared-sync-file-config.js";
import { hasSharedSyncFileAccess, readSharedSyncFile, writeSharedSyncFile } from "./shared-sync-file.js";

// ============================================================
// CIBLE ACTIVE DE SYNCHRONISATION
// ============================================================

const STORAGE_DATA_FILE = "wilf-workout-data.wilf";

async function getActiveSyncTarget() {
    const platform = window.Capacitor?.getPlatform?.() ?? "web";

    if (platform === "android") {
        const config = await loadStorageTargetConfig();

        if (config.type !== "directory" || !config.directoryUri) {
            return { type: "none", reason: "device-only" };
        }

        if (!isStorageDirectoryAvailable()) return { type: "none", reason: "unavailable" };
        return { type: "android-directory", config };
    }

    const config = await loadSharedSyncFileConfig();

    if (!config.fileHandle) return { type: "none", reason: "no-shared-file" };
    if (!await hasSharedSyncFileAccess(config.fileHandle)) return { type: "none", reason: "permission-required" };

    return { type: "web-file", handle: config.fileHandle };
}

async function readSyncFileTarget(target = null) {
    target ??= await getActiveSyncTarget();
    if (target.type === "none") return { available: false, reason: target.reason, target };

    if (target.type === "web-file") {
        const file = await readSharedSyncFile(target.handle);
        return { available: true, exists: true, content: file.content, target };
    }

    let { config } = target;
    const file = await readStorageDirectoryFile({
        directoryUri: config.directoryUri,
        fileUri: config.dataFileUri,
        fileName: STORAGE_DATA_FILE
    });

    if (file?.uri && file.uri !== config.dataFileUri) {
        config.dataFileUri = file.uri;
        config = await saveStorageTargetConfig(config);
        target.config = config;
    }

    return {
        available: true,
        exists: Boolean(file?.exists),
        content: file?.content ?? null,
        target
    };
}

async function writeSyncFileTarget(target, content) {
    if (!target || target.type === "none") throw new Error("Aucune cible de synchronisation disponible.");

    if (target.type === "web-file") {
        await writeSharedSyncFile(target.handle, content);
        return;
    }

    let { config } = target;
    const result = await writeStorageDirectoryFile({
        directoryUri: config.directoryUri,
        fileUri: config.dataFileUri,
        fileName: STORAGE_DATA_FILE,
        content,
        mimeType: "application/json"
    });

    if (result?.uri && result.uri !== config.dataFileUri) {
        config.dataFileUri = result.uri;
        config = await saveStorageTargetConfig(config);
        target.config = config;
    }
}

export {
    STORAGE_DATA_FILE,
    getActiveSyncTarget,
    readSyncFileTarget,
    writeSyncFileTarget
};