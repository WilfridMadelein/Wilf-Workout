// ============================================================
// PRÉFÉRENCES DE PROGRESSION
// ============================================================

const PROGRESSION_PREFERENCES = ["more", "neutral", "less", "never"];

const PROGRESSION_PREFERENCE_LABELS = {
    more: "More",
    neutral: "Neutral",
    less: "Less",
    never: "Never"
};

let getAppSettings = () => null;
let scheduleAppSettingsSave = () => {};

function configureProgressionPreferences(dependencies) {
    getAppSettings = dependencies.getAppSettings;
    scheduleAppSettingsSave = dependencies.scheduleAppSettingsSave;
}

function normalizeProgressionPreference(value) {
    return PROGRESSION_PREFERENCES.includes(value) ? value : "neutral";
}

function normalizeProgressionPreferences(value = {}) {
    const normalized = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;

    Object.entries(value).forEach(([progressionId, preference]) => {
        const id = String(progressionId || "").trim();
        const nextPreference = normalizeProgressionPreference(preference);

        if (!id || ["__proto__", "prototype", "constructor"].includes(id) || nextPreference === "neutral") return;
        normalized[id] = nextPreference;
    });

    return normalized;
}

function getProgressionPreference(progressionId) {
    const id = String(progressionId || "").trim();
    if (!id) return "neutral";

    return normalizeProgressionPreference(
        getAppSettings()?.progressionPreferences?.[id]
    );
}

function refreshProgressionPreferenceControls(progressionId = null) {
    const targetId = progressionId == null ? null : String(progressionId).trim();

    document.querySelectorAll(".progression-preference-select").forEach(select => {
        if (targetId && select.dataset.progressionId !== targetId) return;
        applyProgressionPreferenceState(select, select.dataset.progressionId, select.dataset.progressionName);
    });
}

function setProgressionPreference(progressionId, preference) {
    const settings = getAppSettings();
    const id = String(progressionId || "").trim();
    if (!settings || !id) return;

    settings.progressionPreferences = normalizeProgressionPreferences(settings.progressionPreferences);

    const normalized = normalizeProgressionPreference(preference);
    if (normalized === "neutral") delete settings.progressionPreferences[id];
    else settings.progressionPreferences[id] = normalized;

    scheduleAppSettingsSave(settings);
    refreshProgressionPreferenceControls(id);
}

function applyProgressionPreferenceState(select, progressionId, progressionName) {
    const preference = getProgressionPreference(progressionId);
    const label = PROGRESSION_PREFERENCE_LABELS[preference];
    const name = progressionName || progressionId;

    select.value = preference;
    select.classList.remove("is-more", "is-neutral", "is-less", "is-never");
    select.classList.add(`is-${preference}`);
    select.title = `Préférence de ${name} : ${label}`;
    select.setAttribute("aria-label", `Préférence de la progression ${name} : ${label}`);
}

function createProgressionPreferenceSelect(progressionId, progressionName = progressionId) {
    const id = String(progressionId || "").trim();
    if (!id) return null;

    const select = document.createElement("select");
    select.classList.add("progression-preference-select");
    select.dataset.progressionId = id;
    select.dataset.progressionName = String(progressionName || id);

    PROGRESSION_PREFERENCES.forEach(preference => {
        const option = document.createElement("option");
        option.value = preference;
        option.textContent = PROGRESSION_PREFERENCE_LABELS[preference];
        select.appendChild(option);
    });

    applyProgressionPreferenceState(select, id, progressionName);

    select.addEventListener("pointerdown", event => event.stopPropagation());
    select.addEventListener("click", event => event.stopPropagation());
    select.addEventListener("change", event => {
        event.stopPropagation();
        setProgressionPreference(id, select.value);
    });

    return select;
}

export {
    configureProgressionPreferences,
    normalizeProgressionPreference,
    normalizeProgressionPreferences,
    getProgressionPreference,
    setProgressionPreference,
    createProgressionPreferenceSelect,
    refreshProgressionPreferenceControls
};