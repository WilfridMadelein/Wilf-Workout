import { subscribeStorageChanges } from "../storage/storage-change-events.js";
import { SYNC_METADATA_ID } from "../storage/sync-metadata.js";

// ============================================================
// INTERFACE DE SYNCHRONISATION
// ============================================================

let statusElement;
let inspectSync = async () => ({ available: false, reason: "device-only" });
let syncNow = async () => ({ status: "device-only", imported: 0, exported: 0, conflicts: [] });
let onDataImported = async () => {};

let refreshTimer = null;
let syncing = false;
let unsubscribeStorageChanges = null;

function configureStorageSyncController(dependencies) {
    ({ statusElement, inspectSync, syncNow, onDataImported = async () => {} } = dependencies);
}

function setSyncStatus(message, state = "") {
    statusElement.textContent = message;

    if (state) statusElement.dataset.state = state;
    else delete statusElement.dataset.state;
}

function getInspectionMessage(result) {
    if (!result?.available) {
        if (result?.reason === "device-only") return { message: "Synchronisation désactivée.", state: "" };
        if (result?.reason === "no-shared-file") return { message: "Aucun fichier de synchronisation sélectionné.", state: "" };
        if (result?.reason === "permission-required") return { message: "Autorisation requise pour synchroniser.", state: "warning" };
        if (result?.reason === "missing-file") return { message: "Fichier de synchronisation introuvable.", state: "warning" };
        return { message: "Synchronisation indisponible.", state: "warning" };
    }

    switch (result.sync?.status) {
        case "same":
            return { message: "Synchronisé.", state: "ok" };

        case "local-changed":
        case "external-changed":
        case "mergeable":
        case "untracked-equal":
        case "untracked-different":
            return { message: "Synchronisation...", state: "syncing" };

        case "conflict":
            return { message: "Synchronisation en attente : deux versions différentes ont été détectées.", state: "warning" };

        default:
            return { message: "Synchronisation...", state: "syncing" };
    }
}

async function refreshStorageSyncInterface() {
    if (syncing) return;

    try {
        const result = await inspectSync();
        const status = getInspectionMessage(result);

        setSyncStatus(status.message, status.state);
    } catch (error) {
        console.error("Impossible de vérifier la synchronisation :", error);
        setSyncStatus("Impossible de vérifier la synchronisation.", "error");
        syncButton.disabled = false;
    }
}

function scheduleStorageSyncInterfaceRefresh(delay = 3500) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refreshStorageSyncInterface();
    }, delay);
}


function setupStorageSyncController() {
    if (!unsubscribeStorageChanges) {
        unsubscribeStorageChanges = subscribeStorageChanges(change => {
            if (change?.store === "settings" && change?.id === SYNC_METADATA_ID) return;

            setSyncStatus("Synchronisation...", "syncing");

            const storageTargetChanged = change?.store === "settings" && change?.id === "storage-target";
            scheduleStorageSyncInterfaceRefresh(storageTargetChanged ? 300 : 3500);
        });
    }

    refreshStorageSyncInterface();
}

export {
    configureStorageSyncController,
    setupStorageSyncController,
    refreshStorageSyncInterface
};