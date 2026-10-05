import {
    isStorageDirectoryAvailable,
    chooseStorageDirectory,
    hasStorageDirectoryAccess,
    releaseStorageDirectory,
    readStorageDirectoryFile,
    writeStorageDirectoryFile
} from './storage-target.js';

// ============================================================
// DOSSIER DE SYNCHRONISATION — ANDROID + WEB
// ============================================================

function getPlatform() {
    return window.Capacitor?.getPlatform?.() ?? 'web';
}

function isWebDirectoryAvailable() {
    return getPlatform() !== 'android' && window.isSecureContext && typeof window.showDirectoryPicker === 'function';
}

function isSyncDirectoryAvailable() {
    return getPlatform() === 'android' ? isStorageDirectoryAvailable() : isWebDirectoryAvailable();
}

async function getWebDirectoryPermission(handle, request = false) {
    if (!handle) return false;
    const options = { mode: 'readwrite' };
    if (typeof handle.queryPermission === 'function' && await handle.queryPermission(options) === 'granted') return true;
    if (!request || typeof handle.requestPermission !== 'function') return false;
    return await handle.requestPermission(options) === 'granted';
}

async function chooseSyncDirectory() {
    if (getPlatform() === 'android') {
        const selected = await chooseStorageDirectory();
        if (!selected) return null;
        return { kind: 'android-directory', directoryUri: selected.uri, dataFileUri: null, name: selected.name || 'Dossier sélectionné' };
    }

    if (!isWebDirectoryAvailable()) throw new Error("La synchronisation par dossier n'est pas disponible dans ce navigateur.");

    try {
        const handle = await window.showDirectoryPicker({ id: 'wilf-sync-directory', mode: 'readwrite' });
        if (!await getWebDirectoryPermission(handle, true)) throw new Error("L'autorisation de lecture et d'écriture n'a pas été accordée.");
        return { kind: 'web-directory', directoryHandle: handle, name: handle.name || 'Dossier sélectionné' };
    } catch (error) {
        if (error?.name === 'AbortError') return null;
        throw error;
    }
}

async function hasSyncDirectoryAccess(target, request = false) {
    if (!target) return false;
    if (target.kind === 'android-directory') return await hasStorageDirectoryAccess(target.directoryUri) === true;
    if (target.kind === 'web-directory') return getWebDirectoryPermission(target.directoryHandle, request);
    return false;
}

async function requestSyncDirectoryAccess(target) {
    return hasSyncDirectoryAccess(target, true);
}

async function releaseSyncDirectory(target) {
    if (!target) return;
    if (target.kind === 'android-directory') await releaseStorageDirectory(target.directoryUri);
}

async function readWebDirectoryFile(handle, fileName) {
    if (!await getWebDirectoryPermission(handle, false)) throw new Error('Autorisation requise pour accéder au dossier de synchronisation.');

    try {
        const fileHandle = await handle.getFileHandle(fileName, { create: false });
        const file = await fileHandle.getFile();
        return { exists: true, content: await file.text(), lastModified: file.lastModified };
    } catch (error) {
        if (error?.name === 'NotFoundError') return { exists: false, content: null, lastModified: null };
        throw error;
    }
}

async function writeWebDirectoryFile(handle, fileName, content) {
    if (!await getWebDirectoryPermission(handle, false)) throw new Error('Autorisation requise pour modifier le dossier de synchronisation.');
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return { exists: true };
}

async function readSyncDirectoryFile(target, fileName) {
    if (target.kind === 'android-directory') {
        const result = await readStorageDirectoryFile({ directoryUri: target.directoryUri, fileUri: target.dataFileUri, fileName });
        return { ...result, target: result?.uri && result.uri !== target.dataFileUri ? { ...target, dataFileUri: result.uri } : target };
    }

    if (target.kind === 'web-directory') return { ...(await readWebDirectoryFile(target.directoryHandle, fileName)), target };
    throw new Error('Dossier de synchronisation invalide.');
}

async function writeSyncDirectoryFile(target, fileName, content) {
    if (target.kind === 'android-directory') {
        const result = await writeStorageDirectoryFile({ directoryUri: target.directoryUri, fileUri: target.dataFileUri, fileName, content, mimeType: 'application/json' });
        return { ...result, target: result?.uri && result.uri !== target.dataFileUri ? { ...target, dataFileUri: result.uri } : target };
    }

    if (target.kind === 'web-directory') return { ...(await writeWebDirectoryFile(target.directoryHandle, fileName, content)), target };
    throw new Error('Dossier de synchronisation invalide.');
}

export {
    isSyncDirectoryAvailable,
    chooseSyncDirectory,
    hasSyncDirectoryAccess,
    requestSyncDirectoryAccess,
    releaseSyncDirectory,
    readSyncDirectoryFile,
    writeSyncDirectoryFile
};
