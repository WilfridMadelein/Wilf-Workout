// ============================================================
// ÉVÉNEMENTS DE MODIFICATION DU STOCKAGE
// ============================================================

const listeners = new Set();

function subscribeStorageChanges(listener) {
    if (typeof listener !== "function") {
        throw new TypeError(
            "Le listener de stockage doit être une fonction."
        );
    }

    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

function notifyStorageChanged(change) {
    listeners.forEach(listener => {
        try {
            listener(change);
        } catch (error) {
            console.error(
                "Erreur dans un listener de stockage :",
                error
            );
        }
    });
}

export {
    subscribeStorageChanges,
    notifyStorageChanged
};
