import { EXERCISE_RECORD_ORDER } from "./exercise-history.js";

const STORAGE_KEY = "wilf-history-chart-preferences";
const TYPES = { exercise: EXERCISE_RECORD_ORDER, workout: ["countWeek", "durationWeek", "durationSession"] };
const RANGES = { exercise: [8, 12, 26, 0], workout: [8, 12, 26, 52, 0] };
let preferences;

function loadPreferences() {
    if (preferences) return preferences;
    preferences = { exercise: { byMetric: {} }, workout: { byMetric: {} } };
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        Object.keys(TYPES).forEach(group => {
            if (TYPES[group].includes(saved?.[group]?.selectedMetric)) preferences[group].selectedMetric = saved[group].selectedMetric;
            TYPES[group].forEach(metric => {
                const value = saved?.[group]?.byMetric?.[metric];
                if (!value || typeof value !== "object") return;
                const setting = {};
                if (RANGES[group].includes(value.range)) setting.range = value.range;
                if (group === "workout" && Number.isInteger(value.weekStart) && value.weekStart >= 0 && value.weekStart <= 6) setting.weekStart = value.weekStart;
                preferences[group].byMetric[metric] = setting;
            });
        });
    } catch { /* Les valeurs par défaut restent utilisables si le stockage est indisponible. */ }
    return preferences;
}

function getSelectedChartMetric(group) {
    return loadPreferences()[group]?.selectedMetric;
}

function getChartPreferences(group, metric) {
    return { ...(loadPreferences()[group]?.byMetric[metric] ?? {}) };
}

function saveChartPreferences(group, metric, setting = {}) {
    if (!TYPES[group]?.includes(metric)) return;
    const saved = loadPreferences();
    saved[group].selectedMetric = metric;
    const value = saved[group].byMetric[metric] ?? {};
    if (RANGES[group].includes(setting.range)) value.range = setting.range;
    if (group === "workout" && Number.isInteger(setting.weekStart) && setting.weekStart >= 0 && setting.weekStart <= 6) value.weekStart = setting.weekStart;
    saved[group].byMetric[metric] = value;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
    catch (error) { console.warn("Impossible de sauvegarder les préférences des graphiques :", error); }
}

export { getSelectedChartMetric, getChartPreferences, saveChartPreferences };
