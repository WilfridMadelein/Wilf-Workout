import {
    deviceStorageProvider
} from "./device-storage-provider.js";

import {
    notifyStorageChanged
} from "./storage-change-events.js";

// ============================================================
// FOURNISSEUR DE STOCKAGE ACTIF
// ============================================================

const REQUIRED_METHODS = [
    "getStoredPlans",
    "putStoredPlan",
    "deleteStoredPlan",
    "getStoredSetting",
    "putStoredSetting",
    "getStoredWorkoutHistory",
    "getStoredWorkoutHistoryEntry",
    "putStoredWorkoutHistory",
    "deleteStoredWorkoutHistory",
    "requestPersistentStorage"
];

let activeStorageProvider = deviceStorageProvider;

function validateStorageProvider(provider) {
    if (!provider?.id) {
        throw new Error("Fournisseur de stockage invalide : identifiant manquant.");
    }

    const missingMethod = REQUIRED_METHODS.find(
        method => typeof provider[method] !== "function"
    );

    if (missingMethod) {
        throw new Error(
            `Fournisseur de stockage invalide : ${missingMethod} est manquant.`
        );
    }
}

function getStorageProvider() {
    return activeStorageProvider;
}

function getStorageProviderId() {
    return activeStorageProvider.id;
}

function setStorageProvider(provider) {
    validateStorageProvider(provider);
    activeStorageProvider = provider;
}

async function getStoredPlans() {
    return activeStorageProvider.getStoredPlans();
}

async function getStoredSetting(id) {
    return activeStorageProvider.getStoredSetting(id);
}

async function getStoredWorkoutHistory() {
    return activeStorageProvider.getStoredWorkoutHistory();
}

async function getStoredWorkoutHistoryEntry(id) {
    return activeStorageProvider.getStoredWorkoutHistoryEntry(id);
}

async function requestPersistentStorage() {
    return activeStorageProvider.requestPersistentStorage();
}

async function putStoredPlan(plan) {
    const result =
        await activeStorageProvider.putStoredPlan(plan);

    notifyStorageChanged({
        store: "plans",
        action: "put",
        id: plan?.id ?? null
    });

    return result;
}

async function deleteStoredPlan(id) {
    const result =
        await activeStorageProvider.deleteStoredPlan(id);

    notifyStorageChanged({
        store: "plans",
        action: "delete",
        id
    });

    return result;
}

async function putStoredSetting(setting) {
    const result =
        await activeStorageProvider.putStoredSetting(setting);

    notifyStorageChanged({
        store: "settings",
        action: "put",
        id: setting?.id ?? null
    });

    return result;
}

async function putStoredWorkoutHistory(record) {
    const result =
        await activeStorageProvider.putStoredWorkoutHistory(record);

    notifyStorageChanged({
        store: "workoutHistory",
        action: "put",
        id: record?.id ?? null
    });

    return result;
}

async function deleteStoredWorkoutHistory(id) {
    const result =
        await activeStorageProvider.deleteStoredWorkoutHistory(id);

    notifyStorageChanged({
        store: "workoutHistory",
        action: "delete",
        id
    });

    return result;
}

export {
    getStorageProvider,
    getStorageProviderId,
    setStorageProvider,

    getStoredPlans,
    putStoredPlan,
    deleteStoredPlan,

    getStoredSetting,
    putStoredSetting,

    getStoredWorkoutHistory,
    getStoredWorkoutHistoryEntry,
    putStoredWorkoutHistory,
    deleteStoredWorkoutHistory,

    requestPersistentStorage
};