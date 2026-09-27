
import {
    clearSyncBaseline
} from "../storage/sync-metadata.js";

// ============================================================
// DESTINATION DES DONNÉES
// ============================================================

let getStorageTargetConfig = () => null;
let saveStorageTargetConfig = async () => null;

let deviceButton;
let directoryButton;
let statusElement;

let isDirectoryAvailable = () => false;
let chooseDirectory = async () => null;
let hasDirectoryAccess = async () => null;
let releaseDirectory = async () => {};

function configureStorageTargetController(dependencies) {
    ({
        getStorageTargetConfig,
        saveStorageTargetConfig,
        deviceButton,
        directoryButton,
        statusElement,
        isDirectoryAvailable,
        chooseDirectory,
        hasDirectoryAccess,
        releaseDirectory
    } = dependencies);
}

function refreshStorageTargetInterface() {
    const config = getStorageTargetConfig();
    if (!config) return;

    const directorySelected =
        config.type === "directory" &&
        Boolean(config.directoryUri);

    deviceButton.classList.toggle(
        "active",
        !directorySelected
    );

    directoryButton.classList.toggle(
        "active",
        directorySelected
    );

    deviceButton.setAttribute(
        "aria-pressed",
        String(!directorySelected)
    );

    directoryButton.setAttribute(
        "aria-pressed",
        String(directorySelected)
    );

    directoryButton.disabled =
        !isDirectoryAvailable();

    if (!isDirectoryAvailable()) {
        statusElement.textContent =
            "Le choix d'un dossier est disponible dans l'application Android.";
        return;
    }

    statusElement.textContent =
        directorySelected
            ? "Wilf conserve automatiquement une copie de ses données dans le dossier sélectionné."
            : "Les données sont actuellement conservées uniquement sur cet appareil.";
}

async function setupStorageTargetController() {
    let config = getStorageTargetConfig();

    if (
        config?.type === "directory" &&
        config.directoryUri &&
        isDirectoryAvailable()
    ) {
        try {
            const granted =
                await hasDirectoryAccess(
                    config.directoryUri
                );

            if (granted === false) {
                config.type = "device";
                config.directoryUri = null;
                config.dataFileUri = null;
                await clearSyncBaseline();
                config =
                    await saveStorageTargetConfig(
                        config
                    );
            }
        } catch (error) {
            console.warn(
                "Impossible de vérifier l'accès au dossier :",
                error
            );
        }
    }

    deviceButton.addEventListener("click", async () => {
        let current = getStorageTargetConfig();
        if (!current) return;

        const previousUri =
            current.directoryUri;

        current.type = "device";
        current.directoryUri = null;
        current.dataFileUri = null;
        await clearSyncBaseline();

        try {
            await saveStorageTargetConfig(current);

            if (previousUri) {
                try {
                    await releaseDirectory(
                        previousUri
                    );
                } catch (error) {
                    console.warn(
                        "Impossible de libérer l'ancien dossier :",
                        error
                    );
                }
            }

            refreshStorageTargetInterface();
        } catch (error) {
            console.error(
                "Impossible de modifier l'emplacement des données :",
                error
            );
        }
    });

    directoryButton.addEventListener("click", async () => {
        if (!isDirectoryAvailable()) return;

        directoryButton.disabled = true;

        try {
            const selected =
                await chooseDirectory();

            if (!selected) return;

            let current =
                getStorageTargetConfig();

const previousUri =
    current.directoryUri;

current.type = "directory";
current.directoryUri = selected.uri;

if (previousUri !== selected.uri) {
    current.dataFileUri = null;

    await clearSyncBaseline();
}

            await saveStorageTargetConfig(
                current
            );

            if (
                previousUri &&
                previousUri !== selected.uri
            ) {
                try {
                    await releaseDirectory(
                        previousUri
                    );
                } catch (error) {
                    console.warn(
                        "Impossible de libérer l'ancien dossier :",
                        error
                    );
                }
            }

            refreshStorageTargetInterface();
        } catch (error) {
            console.error(
                "Impossible de sélectionner le dossier :",
                error
            );

            alert(
                error?.message ||
                "Impossible d'utiliser ce dossier pour les données Wilf."
            );
        } finally {
            directoryButton.disabled =
                !isDirectoryAvailable();
        }
    });

    refreshStorageTargetInterface();
}

export {
    configureStorageTargetController,
    setupStorageTargetController,
    refreshStorageTargetInterface
};