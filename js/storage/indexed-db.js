// ============================================================
// INDEXEDDB
// ============================================================

const DB_NAME = "wilf-workout";
const DB_VERSION = 1;
const PLAN_STORE = "plans";

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

function openDatabase() {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(PLAN_STORE)) {
                database.createObjectStore(PLAN_STORE, { keyPath: "id" });
            }
        };

        request.onsuccess = () => {
            const database = request.result;

            database.onversionchange = () => {
                database.close();
                databasePromise = null;
            };

            resolve(database);
        };

        request.onerror = () => {
            databasePromise = null;
            reject(request.error);
        };
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
    requestPersistentStorage
};