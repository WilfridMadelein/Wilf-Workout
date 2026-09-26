import {
    getStoredPlans,
    putStoredPlan,
    deleteStoredPlan,
    requestPersistentStorage,
    getStoredSetting,
    putStoredSetting,
    getStoredWorkoutHistory,
    getStoredWorkoutHistoryEntry,
    putStoredWorkoutHistory,
    deleteStoredWorkoutHistory
} from "./indexed-db.js";

// ============================================================
// FOURNISSEUR DE STOCKAGE — APPAREIL
// ============================================================

const deviceStorageProvider = {
    id: "device",

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

export {
    deviceStorageProvider
};