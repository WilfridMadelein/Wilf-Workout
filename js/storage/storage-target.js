// ============================================================
// DESTINATION NATIVE DES DONNÉES
// ============================================================

function getWilfStoragePlugin() {
    const capacitor = window.Capacitor;

    if (capacitor?.getPlatform?.() !== "android") return null;

    return capacitor.Plugins?.WilfStorage ?? null;
}

function isStorageDirectoryAvailable() {
    return getWilfStoragePlugin() !== null;
}

async function chooseStorageDirectory() {
    const plugin = getWilfStoragePlugin();

    if (!plugin) {
        throw new Error(
            "Le choix d'un dossier n'est pas disponible sur cette plateforme."
        );
    }

    const result = await plugin.chooseDirectory();

    if (result?.cancelled) return null;

    if (!result?.uri) {
        throw new Error(
            "Android n'a retourné aucun dossier."
        );
    }

    return {
        uri: result.uri
    };
}

async function hasStorageDirectoryAccess(uri) {
    const plugin = getWilfStoragePlugin();
    if (!plugin || !uri) return null;

    const result =
        await plugin.hasDirectoryAccess({ uri });

    return result.granted === true;
}

async function releaseStorageDirectory(uri) {
    const plugin = getWilfStoragePlugin();
    if (!plugin || !uri) return;

    await plugin.releaseDirectory({ uri });
}

async function saveNativeTextFile({
    fileName,
    content,
    mimeType = "application/octet-stream"
}) {
    const plugin = getWilfStoragePlugin();
    if (!plugin) return null;

    return plugin.saveTextFile({
        fileName,
        content,
        mimeType
    });
}

async function writeStorageDirectoryFile({
    directoryUri,
    fileUri = null,
    fileName,
    content,
    mimeType = "application/json"
}) {
    const plugin =
        getWilfStoragePlugin();

    if (!plugin) {
        throw new Error(
            "L'écriture dans un dossier n'est pas disponible sur cette plateforme."
        );
    }

    if (!directoryUri) {
        throw new Error(
            "Aucun dossier de données n'est sélectionné."
        );
    }

    return plugin.writeDirectoryTextFile({
        directoryUri,
        fileUri,
        fileName,
        content,
        mimeType
    });
}

export {
    isStorageDirectoryAvailable,
    chooseStorageDirectory,
    hasStorageDirectoryAccess,
    releaseStorageDirectory,
    saveNativeTextFile,
    writeStorageDirectoryFile
};