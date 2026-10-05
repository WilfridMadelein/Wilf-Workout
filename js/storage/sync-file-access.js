// ============================================================
// FICHIER DE SYNCHRONISATION — ANDROID + WEB
// ============================================================

const DEFAULT_SYNC_FILE_NAME = 'wilf-workout-sync.json';

function getPlatform() {
    return window.Capacitor?.getPlatform?.() ?? 'web';
}

function getNativePlugin() {
    if (getPlatform() !== 'android') return null;
    return window.Capacitor?.Plugins?.WilfStorage ?? null;
}

function isSyncFileAccessAvailable() {
    if (getPlatform() === 'android') return Boolean(getNativePlugin()?.openSyncFile && getNativePlugin()?.createSyncFile);
    return window.isSecureContext && typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
}

async function getWebFilePermission(handle, request = false) {
    if (!handle) return false;
    const options = { mode: 'readwrite' };
    if (typeof handle.queryPermission === 'function' && await handle.queryPermission(options) === 'granted') return true;
    if (!request || typeof handle.requestPermission !== 'function') return false;
    return await handle.requestPermission(options) === 'granted';
}

async function createSyncFileTarget() {
    const plugin = getNativePlugin();
    if (plugin) {
        const result = await plugin.createSyncFile({ fileName: DEFAULT_SYNC_FILE_NAME });
        if (result?.cancelled) return null;
        if (!result?.uri) throw new Error("Android n'a retourné aucun fichier.");
        return { kind: 'android-file', fileUri: result.uri, name: result.name || DEFAULT_SYNC_FILE_NAME };
    }

    if (!isSyncFileAccessAvailable()) throw new Error("La sélection d'un fichier de synchronisation n'est pas disponible dans ce navigateur.");
    try {
        const handle = await window.showSaveFilePicker({
            id: 'wilf-sync-file',
            suggestedName: DEFAULT_SYNC_FILE_NAME,
            types: [{ description: 'Synchronisation Wilf Workout', accept: { 'application/json': ['.json'] } }]
        });
        if (!await getWebFilePermission(handle, true)) throw new Error("L'autorisation de lecture et d'écriture n'a pas été accordée.");
        return { kind: 'web-file', fileHandle: handle, name: handle.name || DEFAULT_SYNC_FILE_NAME };
    } catch (error) {
        if (error?.name === 'AbortError') return null;
        throw error;
    }
}

async function openSyncFileTarget() {
    const plugin = getNativePlugin();
    if (plugin) {
        const result = await plugin.openSyncFile();
        if (result?.cancelled) return null;
        if (!result?.uri) throw new Error("Android n'a retourné aucun fichier.");
        return { kind: 'android-file', fileUri: result.uri, name: result.name || DEFAULT_SYNC_FILE_NAME };
    }

    if (!isSyncFileAccessAvailable()) throw new Error("La sélection d'un fichier de synchronisation n'est pas disponible dans ce navigateur.");
    try {
        const [handle] = await window.showOpenFilePicker({
            id: 'wilf-sync-file',
            multiple: false,
            types: [{ description: 'Synchronisation Wilf Workout', accept: { 'application/json': ['.json'] } }]
        });
        if (!await getWebFilePermission(handle, true)) throw new Error("L'autorisation de lecture et d'écriture n'a pas été accordée.");
        return { kind: 'web-file', fileHandle: handle, name: handle.name || DEFAULT_SYNC_FILE_NAME };
    } catch (error) {
        if (error?.name === 'AbortError') return null;
        throw error;
    }
}

async function hasSyncFileAccess(target, request = false) {
    if (!target) return false;
    if (target.kind === 'android-file') {
        const plugin = getNativePlugin();
        if (!plugin?.hasFileAccess) return false;
        return (await plugin.hasFileAccess({ uri: target.fileUri }))?.granted === true;
    }
    if (target.kind === 'web-file') return getWebFilePermission(target.fileHandle, request);
    return false;
}

async function requestSyncFileAccess(target) {
    if (target?.kind === 'android-file') return hasSyncFileAccess(target, false);
    return hasSyncFileAccess(target, true);
}

async function releaseSyncFile(target) {
    if (target?.kind !== 'android-file') return;
    const plugin = getNativePlugin();
    if (plugin?.releaseFile) await plugin.releaseFile({ uri: target.fileUri });
}

async function readSyncFile(target) {
    if (!target) throw new Error('Aucun fichier de synchronisation connecté.');
    if (!await hasSyncFileAccess(target, false)) throw new Error('Autorisation requise pour accéder au fichier de synchronisation.');

    if (target.kind === 'android-file') {
        const plugin = getNativePlugin();
        const result = await plugin.readTextFile({ uri: target.fileUri });
        return { content: result?.content ?? '', name: result?.name || target.name };
    }

    const file = await target.fileHandle.getFile();
    return { content: await file.text(), name: file.name || target.name, lastModified: file.lastModified };
}

async function writeSyncFile(target, content) {
    if (!target) throw new Error('Aucun fichier de synchronisation connecté.');
    if (!await hasSyncFileAccess(target, false)) throw new Error('Autorisation requise pour modifier le fichier de synchronisation.');

    if (target.kind === 'android-file') {
        const plugin = getNativePlugin();
        await plugin.writeTextFile({ uri: target.fileUri, content });
        return;
    }

    const writable = await target.fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

export {
    DEFAULT_SYNC_FILE_NAME,
    isSyncFileAccessAvailable,
    createSyncFileTarget,
    openSyncFileTarget,
    hasSyncFileAccess,
    requestSyncFileAccess,
    releaseSyncFile,
    readSyncFile,
    writeSyncFile
};
