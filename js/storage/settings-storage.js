import {
    getStoredSetting,
    putStoredSetting
} from "./indexed-db.js";

// ============================================================
// PARAMÈTRES GLOBAUX
// ============================================================

const APP_SETTINGS_ID = "app";
const SETTINGS_SCHEMA_VERSION = 1;

let saveTimer = null;

function normalizePlanDefaults(defaults = {}) {
    return {
        sets: defaults.sets ?? 3,
        reps: defaults.reps ?? 10,
        time: defaults.time ?? 30,
        rest: defaults.rest ?? 60,
        weight: defaults.weight ?? 0,
        weightUnit: ["kg", "lbs"].includes(defaults.weightUnit)
            ? defaults.weightUnit
            : "lbs",

        tempo: {
            first: defaults.tempo?.first ?? 3,
            second: defaults.tempo?.second ?? 0,
            third: defaults.tempo?.third ?? 1,
            fourth: defaults.tempo?.fourth ?? 0
        }
    };
}

function createDefaultAppSettings() {
    return {
        id: APP_SETTINGS_ID,
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        updatedAt: Date.now(),
        theme: "light",
        planDefaults: normalizePlanDefaults()
    };
}

function normalizeAppSettings(settings = {}) {
    return {
        id: APP_SETTINGS_ID,
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        updatedAt: Number(settings.updatedAt) || Date.now(),
        theme: settings.theme === "dark" ? "dark" : "light",
        planDefaults: normalizePlanDefaults(settings.planDefaults)
    };
}

async function loadAppSettings() {
    const stored = await getStoredSetting(APP_SETTINGS_ID);

    if (stored) return normalizeAppSettings(stored);

    const settings = createDefaultAppSettings();
    await putStoredSetting(settings);

    return settings;
}

async function saveAppSettingsNow(settings, { touch = true } = {}) {
    if (touch || !settings.updatedAt) settings.updatedAt = Date.now();

    const record = normalizeAppSettings(settings);
    record.updatedAt = settings.updatedAt;

    await putStoredSetting(record);
}

function scheduleAppSettingsSave(settings, delay = 250) {
    settings.updatedAt = Date.now();
    clearTimeout(saveTimer);

    saveTimer = setTimeout(async () => {
        saveTimer = null;

        try {
            await saveAppSettingsNow(settings, { touch: false });
        } catch (error) {
            console.error("Impossible de sauvegarder les paramètres :", error);
        }
    }, delay);
}

export {
    createDefaultAppSettings,
    loadAppSettings,
    saveAppSettingsNow,
    scheduleAppSettingsSave
};