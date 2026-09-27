// ============================================================
// ACCÈS WEB AU FICHIER PARTAGÉ
// ============================================================

function isSharedSyncFileAvailable() {
    const platform = window.Capacitor?.getPlatform?.() ?? "web";
    return platform !== "android" && window.isSecureContext && typeof window.showOpenFilePicker === "function";
}

async function getSharedSyncFilePermission(handle, request = false) {
    if (!handle) return false;

    const options = { mode: "readwrite" };

    if (typeof handle.queryPermission === "function" && await handle.queryPermission(options) === "granted") return true;
    if (!request || typeof handle.requestPermission !== "function") return false;

    return await handle.requestPermission(options) === "granted";
}

async function chooseSharedSyncFile() {
    if (!isSharedSyncFileAvailable()) throw new Error("Le choix d'un fichier partagé n'est pas disponible dans ce navigateur.");

    try {
        const [handle] = await window.showOpenFilePicker({
            id: "wilf-sync-file",
            multiple: false,
            excludeAcceptAllOption: false,
            types: [{
                description: "Données Wilf Workout",
                accept: { "application/json": [".wilf", ".json"] }
            }]
        });

        if (!await getSharedSyncFilePermission(handle, true)) {
            throw new Error("L'autorisation de lecture et d'écriture n'a pas été accordée.");
        }

        return { handle, name: handle.name };
    } catch (error) {
        if (error?.name === "AbortError") return null;
        throw error;
    }
}

async function hasSharedSyncFileAccess(handle) {
    return getSharedSyncFilePermission(handle, false);
}

async function requestSharedSyncFileAccess(handle) {
    return getSharedSyncFilePermission(handle, true);
}

async function readSharedSyncFile(handle) {
    if (!await hasSharedSyncFileAccess(handle)) throw new Error("Autorisation requise pour accéder au fichier partagé.");

    const file = await handle.getFile();

    return {
        name: file.name,
        lastModified: file.lastModified,
        content: await file.text()
    };
}

async function writeSharedSyncFile(handle, content) {
    if (!await hasSharedSyncFileAccess(handle)) throw new Error("Autorisation requise pour modifier le fichier partagé.");

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
}

export {
    isSharedSyncFileAvailable,
    chooseSharedSyncFile,
    hasSharedSyncFileAccess,
    requestSharedSyncFileAccess,
    readSharedSyncFile,
    writeSharedSyncFile
};