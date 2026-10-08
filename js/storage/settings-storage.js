import { normalizeSupersetRest } from "../plans/plan-rest.js";
import {
    getStoredSetting,
    putStoredSetting
} from "./storage-provider.js";

import {
    normalizeProgressionPreferences
} from "../training/progression-preferences.js";

import {
    normalizeSplitOrder
} from "../exercises/exercise-split.js";

import {
    normalizeAutoPlanLastRequest
} from "../auto-plan/auto-plan-settings.js";

// ============================================================
// PARAMÈTRES GLOBAUX
// ============================================================

const APP_SETTINGS_ID = "app";
const SETTINGS_SCHEMA_VERSION = 4;

let saveTimer = null;

function normalizeDefaultFilterList(value) {
    if (value == null) return null;
    if (!Array.isArray(value)) return null;

    return [
        ...new Set(
            value.filter(item => typeof item === "string")
        )
    ];
}

function normalizePlanDefaults(defaults = {}) {
    return {
        sets: defaults.sets ?? 3,
        reps: defaults.reps ?? 10,
        time: defaults.time ?? 30,
        rest: defaults.rest ?? 60,
        supersetRest: normalizeSupersetRest(defaults.supersetRest, 15),
        weight: defaults.weight ?? 0,

        weightUnit: ["kg", "lbs"].includes(defaults.weightUnit)
            ? defaults.weightUnit
            : "lbs",

        tempo: {
            first: defaults.tempo?.first ?? 3,
            second: defaults.tempo?.second ?? 0,
            third: defaults.tempo?.third ?? 1,
            fourth: defaults.tempo?.fourth ?? 0
        },

        filters: {
            categories: normalizeDefaultFilterList(defaults.filters?.categories),
            equipment: normalizeDefaultFilterList(defaults.filters?.equipment),
            autoExcludeProgressions: defaults.filters?.autoExcludeProgressions !== false
        },

        includeCategories: defaults.includeCategories === true,
        includeEquipment: defaults.includeEquipment === true,
        includeNotes: defaults.includeNotes === true,
        autoAddDefaultInstructions: defaults.autoAddDefaultInstructions !== false

    };
}

function createDefaultAppSettings() {
    return {
        id: APP_SETTINGS_ID,
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        updatedAt: Date.now(),
        theme: "light",
        bodyModel: "male",
        muscleFilterRole: "primary",
        alwaysShowInstructions: false,
        splitOrder: "left-right",
        lastWorkoutCompletionMessageId: null,
        progressionPreferences: {},
        autoPlanLastRequest: null,
        planDefaults: normalizePlanDefaults()
    };
}

function normalizeAppSettings(settings = {}) {
    return {
        id: APP_SETTINGS_ID,
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        updatedAt: Number(settings.updatedAt) || Date.now(),
        theme: settings.theme === "dark" ? "dark" : "light",
        bodyModel: settings.bodyModel === "female" ? "female" : "male",
        muscleFilterRole: settings.muscleFilterRole === "primary-secondary" ? "primary-secondary" : "primary",
        alwaysShowInstructions: settings.alwaysShowInstructions === true,
        splitOrder: normalizeSplitOrder(settings.splitOrder),

lastWorkoutCompletionMessageId:
    typeof settings.lastWorkoutCompletionMessageId === "string"
        ? settings.lastWorkoutCompletionMessageId
        : null,

progressionPreferences: normalizeProgressionPreferences(settings.progressionPreferences),
autoPlanLastRequest: normalizeAutoPlanLastRequest(settings.autoPlanLastRequest),
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
    normalizeAppSettings,
    loadAppSettings,
    saveAppSettingsNow,
    scheduleAppSettingsSave
};
