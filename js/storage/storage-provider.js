import {
    deviceStorageProvider
} from "./device-storage-provider.js";

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

async function putStoredPlan(plan) {
    return activeStorageProvider.putStoredPlan(plan);
}

async function deleteStoredPlan(id) {
    return activeStorageProvider.deleteStoredPlan(id);
}

async function getStoredSetting(id) {
    return activeStorageProvider.getStoredSetting(id);
}

async function putStoredSetting(setting) {
    return activeStorageProvider.putStoredSetting(setting);
}

async function getStoredWorkoutHistory() {
    return activeStorageProvider.getStoredWorkoutHistory();
}

async function getStoredWorkoutHistoryEntry(id) {
    return activeStorageProvider.getStoredWorkoutHistoryEntry(id);
}

async function putStoredWorkoutHistory(record) {
    return activeStorageProvider.putStoredWorkoutHistory(record);
}

async function deleteStoredWorkoutHistory(id) {
    return activeStorageProvider.deleteStoredWorkoutHistory(id);
}

async function requestPersistentStorage() {
    return activeStorageProvider.requestPersistentStorage();
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