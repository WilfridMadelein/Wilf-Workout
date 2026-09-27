import {
    getStoredPlans,
    getStoredSetting,
    getStoredWorkoutHistory
} from "./storage-provider.js";

// ============================================================
// COPIE PORTABLE DES DONNÉES WILF
// ============================================================

const STORAGE_DATA_FORMAT =
    "wilf-workout-data";

const STORAGE_DATA_VERSION = 1;

async function createStorageSnapshot() {
    const [
        plans,
        settings,
        workoutHistory
    ] = await Promise.all([
        getStoredPlans(),
        getStoredSetting("app"),
        getStoredWorkoutHistory()
    ]);

    return {
        format: STORAGE_DATA_FORMAT,
        dataVersion: STORAGE_DATA_VERSION,
        savedAt: new Date().toISOString(),

        plans,
        settings: settings ?? null,
        workoutHistory
    };
}

export {
    STORAGE_DATA_FORMAT,
    STORAGE_DATA_VERSION,
    createStorageSnapshot
};