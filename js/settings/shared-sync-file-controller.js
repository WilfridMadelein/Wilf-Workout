import {
    loadSharedSyncFileConfig,
    saveSharedSyncFileConfig,
    clearSharedSyncFileConfig
} from "../storage/shared-sync-file-config.js";

import {
    isSharedSyncFileAvailable,
    chooseSharedSyncFile,
    hasSharedSyncFileAccess,
    requestSharedSyncFileAccess,
    readSharedSyncFile
} from "../storage/shared-sync-file.js";

import { clearSyncBaseline } from "../storage/sync-metadata.js";

// ============================================================
// FICHIER PARTAGÉ — INTERFACE
// ============================================================

let panel;
let chooseButton;
let disconnectButton;
let statusElement;

function configureSharedSyncFileController(dependencies) {
    ({ panel, chooseButton, disconnectButton, statusElement } = dependencies);
}

function validateWilfSyncFile(content) {
    let data;

    try {
        data = JSON.parse(content);
    } catch {
        throw new Error("Le fichier sélectionné ne contient pas un JSON valide.");
    }

    if (data?.format !== "wilf-workout-data") {
        throw new Error("Ce fichier n'est pas un fichier de synchronisation Wilf valide.");
    }

    return data;
}

async function refreshSharedSyncFileInterface() {
    if (!isSharedSyncFileAvailable()) {
        panel.hidden = true;
        return;
    }

    panel.hidden = false;

    const config = await loadSharedSyncFileConfig();
    const connected = Boolean(config.fileHandle);

    disconnectButton.hidden = !connected;

    if (!connected) {
        chooseButton.textContent = "Choisir le fichier partagé";
        statusElement.textContent = "Aucun fichier partagé sélectionné.";
        return;
    }

    const granted = await hasSharedSyncFileAccess(config.fileHandle);

    chooseButton.textContent = granted ? "Changer de fichier" : "Autoriser l'accès";
    statusElement.textContent = granted
        ? `Connecté : ${config.fileName}`
        : `Fichier mémorisé : ${config.fileName}. Autorisation requise.`;
}

async function setupSharedSyncFileController() {
    chooseButton.addEventListener("click", async () => {
        try {
            const config = await loadSharedSyncFileConfig();

            if (config.fileHandle && !await hasSharedSyncFileAccess(config.fileHandle)) {
                if (!await requestSharedSyncFileAccess(config.fileHandle)) throw new Error("Autorisation refusée.");
                await refreshSharedSyncFileInterface();
                return;
            }

            const selected = await chooseSharedSyncFile();
            if (!selected) return;

            const file = await readSharedSyncFile(selected.handle);
            validateWilfSyncFile(file.content);

            await saveSharedSyncFileConfig({ fileHandle: selected.handle, fileName: selected.name });
            await clearSyncBaseline();
            await refreshSharedSyncFileInterface();
        } catch (error) {
            console.error("Impossible de sélectionner le fichier partagé :", error);
            alert(error?.message || "Impossible d'utiliser ce fichier.");
        }
    });

    disconnectButton.addEventListener("click", async () => {
        await clearSharedSyncFileConfig();
        await clearSyncBaseline();
        await refreshSharedSyncFileInterface();
    });

    await refreshSharedSyncFileInterface();
}

export {
    configureSharedSyncFileController,
    setupSharedSyncFileController,
    refreshSharedSyncFileInterface
};