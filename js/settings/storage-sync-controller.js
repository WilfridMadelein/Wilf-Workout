import { subscribeStorageChanges } from "../storage/storage-change-events.js";
import { SYNC_METADATA_ID } from "../storage/sync-metadata.js";

// ============================================================
// INTERFACE DE SYNCHRONISATION
// ============================================================

let syncButton;
let statusElement;
let inspectSync = async () => ({ available: false, reason: "device-only" });
let syncNow = async () => ({ status: "device-only", imported: 0, exported: 0, conflicts: [] });
let onDataImported = async () => {};

let refreshTimer = null;
let syncing = false;
let unsubscribeStorageChanges = null;

function configureStorageSyncController(dependencies) {
    ({ syncButton, statusElement, inspectSync, syncNow, onDataImported = async () => {} } = dependencies);
}

function setSyncStatus(message, state = "") {
    statusElement.textContent = message;

    if (state) statusElement.dataset.state = state;
    else delete statusElement.dataset.state;
}

function getInspectionMessage(result) {
    if (!result?.available) {
        if (result?.reason === "device-only") return { message: "Synchronisation désactivée : données sur cet appareil seulement.", state: "" };
        if (result?.reason === "no-shared-file") return { message: "Sélectionne un fichier de synchronisation partagé.", state: "" };
        if (result?.reason === "permission-required") return { message: "Autorisation requise pour accéder au fichier partagé.", state: "warning" };
        if (result?.reason === "missing-file") return { message: "Le fichier de synchronisation est introuvable.", state: "warning" };
        return { message: "Synchronisation indisponible.", state: "warning" };
    }

    switch (result.sync?.status) {
        case "same":
            return { message: "Synchronisé.", state: "ok" };
        case "local-changed":
            return { message: "Synchronisation des modifications...", state: "warning" };
        case "external-changed":
            return { message: "Nouvelles données disponibles.", state: "warning" };
        case "conflict":
            return { message: "Certaines modifications nécessitent ton attention.", state: "error" };
        case "untracked-equal":
            return { message: "Initialisation de la synchronisation...", state: "warning" };
        case "untracked-different":
            return { message: "Première synchronisation requise.", state: "warning" };
        default:
            return { message: "Vérification de la synchronisation...", state: "" };
    }
}

async function refreshStorageSyncInterface() {
    if (syncing) return;

    try {
        const result = await inspectSync();
        const status = getInspectionMessage(result);

        setSyncStatus(status.message, status.state);
        syncButton.disabled = ["device-only", "no-shared-file", "permission-required"].includes(result?.reason);
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

async function runStorageSync() {
    if (syncing) return;

    syncing = true;
    syncButton.disabled = true;
    setSyncStatus("Synchronisation en cours...");

    try {
        const result = await syncNow();

        if (result.imported > 0) await onDataImported(result);

        if (result.status === "merged-with-conflicts") {
            const count = result.conflicts?.length ?? 0;
            setSyncStatus(`Synchronisation partielle : ${count} conflit${count !== 1 ? "s" : ""} à résoudre.`, "error");
            return result;
        }

        if (result.status === "external-changed-during-sync") {
            setSyncStatus("Le fichier a changé pendant la synchronisation. Réessaie.", "warning");
            return result;
        }

        if (result.status === "missing-baseline") {
            setSyncStatus("Impossible de fusionner automatiquement : aucune base commune n'est connue.", "error");
            return result;
        }

        if (result.status === "missing-file") {
            setSyncStatus("Le fichier de synchronisation n'existe pas encore.", "warning");
            return result;
        }

        await refreshStorageSyncInterface();
        return result;
    } catch (error) {
        console.error("Synchronisation manuelle impossible :", error);
        setSyncStatus(error?.message || "Impossible de synchroniser les données.", "error");
        return null;
    } finally {
        syncing = false;
        syncButton.disabled = false;
    }
}

function setupStorageSyncController() {
    syncButton.addEventListener("click", runStorageSync);

    if (!unsubscribeStorageChanges) {
        unsubscribeStorageChanges = subscribeStorageChanges(change => {
            if (change?.store === "settings" && change?.id === SYNC_METADATA_ID) return;

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