// ============================================================
// INDEXEDDB
// ============================================================

const DB_NAME = "wilf-workout";
const PLAN_STORE = "plans";
const SETTINGS_STORE = "settings";

let databasePromise = null;

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function openDatabaseRequest(version = null) {
    return new Promise((resolve, reject) => {
        const request = version == null
            ? indexedDB.open(DB_NAME)
            : indexedDB.open(DB_NAME, version);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(PLAN_STORE)) {
                database.createObjectStore(PLAN_STORE, { keyPath: "id" });
            }

            if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                database.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        request.onblocked = () => {
            console.warn(
                "Mise à jour IndexedDB bloquée. Ferme les autres onglets Wilf Workout."
            );
        };
    });
}

function openDatabase() {
    if (databasePromise) return databasePromise;

    databasePromise = (async () => {
        let database = await openDatabaseRequest();

        const missingStore =
            !database.objectStoreNames.contains(PLAN_STORE) ||
            !database.objectStoreNames.contains(SETTINGS_STORE);

        if (missingStore) {
            const nextVersion = database.version + 1;

            database.close();
            database = await openDatabaseRequest(nextVersion);
        }

        database.onversionchange = () => {
            database.close();
            databasePromise = null;
        };

        return database;
    })().catch(error => {
        databasePromise = null;
        throw error;
    });

    return databasePromise;
}

async function getStoredPlans() {
    const database = await openDatabase();
    const transaction = database.transaction(PLAN_STORE, "readonly");

    return requestToPromise(
        transaction.objectStore(PLAN_STORE).getAll()
    );
}

async function putStoredPlan(plan) {
    const database = await openDatabase();
    const transaction = database.transaction(PLAN_STORE, "readwrite");
    const completed = transactionToPromise(transaction);

    transaction.objectStore(PLAN_STORE).put(plan);
    await completed;
}

async function deleteStoredPlan(id) {
    const database = await openDatabase();
    const transaction = database.transaction(PLAN_STORE, "readwrite");
    const completed = transactionToPromise(transaction);

    transaction.objectStore(PLAN_STORE).delete(id);
    await completed;
}

async function getStoredSetting(id) {
    const database = await openDatabase();
    const transaction = database.transaction(SETTINGS_STORE, "readonly");

    return requestToPromise(
        transaction.objectStore(SETTINGS_STORE).get(id)
    );
}

async function putStoredSetting(setting) {
    const database = await openDatabase();
    const transaction = database.transaction(SETTINGS_STORE, "readwrite");
    const completed = transactionToPromise(transaction);

    transaction.objectStore(SETTINGS_STORE).put(setting);
    await completed;
}

async function requestPersistentStorage() {
    if (!navigator.storage?.persist) return false;

    try {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
    } catch (error) {
        console.warn("Stockage persistant indisponible :", error);
        return false;
    }
}

export {
    openDatabase,
    getStoredPlans,
    putStoredPlan,
    deleteStoredPlan,
    requestPersistentStorage,
    getStoredSetting,
    putStoredSetting,
};