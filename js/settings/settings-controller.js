import {
    setupNumberInput,
    updateNumberInputWidth
} from "../ui/ui.js";

import {
    getSplitOrderText,
    normalizeSplitOrder
} from "../exercises/exercise-split.js";

let getAppSettings = () => null;
let scheduleAppSettingsSave = () => {};

let themeSwitch;
let bodyModelSwitch;
let bodyModelButtons;
let onBodyModelChange = () => {};
let setsInput;
let repsInput;
let timeInput;
let restInput;
let weightInput;
let tempoInputs;
let weightUnitSwitch;
let weightUnitButtons;

let autoAddCategoriesCheckbox;
let autoAddEquipmentCheckbox;
let includeNotesCheckbox;
let autoAddInstructionsCheckbox;
let alwaysShowInstructionsCheckbox;
let advancedToggle;
let advancedPanel;
let onAdvancedOpen = () => {};
let onAlwaysShowInstructionsChange = () => {};

let splitOrderSwitch;
let splitOrderLabel;
let splitApplyNewButton;
let splitApplyAllButton;

let pendingSplitOrder = "left-right";
let onApplySplitOrderToAll = async () => {};

// ============================================================
// CONFIGURATION
// ============================================================

function configureSettingsController(dependencies) {
    ({
        getAppSettings,
        scheduleAppSettingsSave,

        themeSwitch,
        bodyModelSwitch,
        bodyModelButtons,
        onBodyModelChange,
        setsInput,
        repsInput,
        timeInput,
        restInput,
        weightInput,
        tempoInputs,
        weightUnitSwitch,
        weightUnitButtons,
        autoAddCategoriesCheckbox,
        autoAddEquipmentCheckbox,
        includeNotesCheckbox,
        autoAddInstructionsCheckbox,
        alwaysShowInstructionsCheckbox,
        advancedToggle,
        advancedPanel,
        onAdvancedOpen,
        onAlwaysShowInstructionsChange,
        splitOrderSwitch,
        splitOrderLabel,
        splitApplyNewButton,
        splitApplyAllButton,
        onApplySplitOrderToAll,
    } = dependencies);
}

// ============================================================
// APPARENCE
// ============================================================

function applyAppTheme(theme) {
    document.documentElement.dataset.theme =
        theme === "dark" ? "dark" : "light";
}

function updateThemeSwitch(theme) {
    const dark = theme === "dark";

    themeSwitch.setAttribute(
        "aria-checked",
        String(dark)
    );
}

function updateBodyModelSwitch(model) {
    bodyModelButtons.forEach(button => {
        const active = button.dataset.bodyModel === model;
        button.classList.toggle("active",active);
        button.setAttribute("aria-pressed",String(active));
    });
}

function updateWeightUnitSwitch(unit) {
    weightUnitButtons.forEach(button => {
        const active =
            button.dataset.settingsWeightUnit === unit;

        button.classList.toggle("active", active);
    });
}

// ============================================================
// CHARGEMENT
// ============================================================

function refreshSettingsInterface() {
    const settings = getAppSettings();
    if (!settings) return;

    const defaults = settings.planDefaults;

    autoAddCategoriesCheckbox.checked = defaults.includeCategories;
    autoAddEquipmentCheckbox.checked = defaults.includeEquipment;
    includeNotesCheckbox.checked = defaults.includeNotes;
    autoAddInstructionsCheckbox.checked = defaults.autoAddDefaultInstructions;
    alwaysShowInstructionsCheckbox.checked = settings.alwaysShowInstructions;

    applyAppTheme(settings.theme);
    updateThemeSwitch(settings.theme);
    updateBodyModelSwitch(settings.bodyModel);

    setsInput.value = defaults.sets;
    repsInput.value = defaults.reps;
    timeInput.value = defaults.time;
    restInput.value = defaults.rest;
    weightInput.value = defaults.weight;

    const tempo = [
        defaults.tempo.first,
        defaults.tempo.second,
        defaults.tempo.third,
        defaults.tempo.fourth
    ];

    tempoInputs.forEach((input, index) => {
        const value = tempo[index];

        input.value =
            (index === 0 || index === 2) &&
            value === 0
                ? "X"
                : value;
    });

    updateWeightUnitSwitch(defaults.weightUnit);
    alwaysShowInstructionsCheckbox.checked =
        settings.alwaysShowInstructions === true;
    updateSplitOrderPreview(settings.splitOrder);

    [
        setsInput,
        repsInput,
        timeInput,
        restInput,
        weightInput,
        ...tempoInputs
    ].forEach(input => {
        updateNumberInputWidth(
            input,
            Number(input.dataset.minChars) || 3
        );
    });
}

// ============================================================
// PARAMÈTRES AVANCÉS
// ============================================================

function updateSplitOrderPreview(order) {
    pendingSplitOrder = normalizeSplitOrder(order);
    splitOrderLabel.textContent = getSplitOrderText(pendingSplitOrder);
}

function updateAdvancedPanel(open) {
    advancedPanel.hidden = !open;
    advancedToggle.setAttribute("aria-expanded", String(open));
    advancedToggle.textContent =
        open
            ? "Masquer les paramètres avancés"
            : "Accéder aux paramètres avancés";

    if (open) requestAnimationFrame(onAdvancedOpen);
}

// ============================================================
// INITIALISATION
// ============================================================

function setupSettingsController() {
    const bind = (input, options, save) => {
        const control = setupNumberInput(input, {
            ...options,

            onChange: value => {
                const settings = getAppSettings();
                if (!settings) return;

                save(settings.planDefaults, value);
                scheduleAppSettingsSave(settings);
            }
        });

        input
            .closest(".plan-default-number-control")
            ?.querySelectorAll("[data-direction]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    control.step(
                        Number(button.dataset.direction),
                        options.snapStep === true
                    );
                });
            });
    };

    bind(
        setsInput,
        { min: 1, max: 999, step: 1, minChars: 3 },
        (defaults, value) => defaults.sets = value
    );

    bind(
        repsInput,
        { min: 1, max: 999, step: 1, minChars: 3 },
        (defaults, value) => defaults.reps = value
    );

    bind(
        timeInput,
        {
            min: 1,
            max: 999,
            step: 15,
            minChars: 3,
            snapStep: true
        },
        (defaults, value) => defaults.time = value
    );

    bind(
        restInput,
        {
            min: 0,
            max: 999,
            step: 15,
            minChars: 3,
            snapStep: true
        },
        (defaults, value) => defaults.rest = value
    );

    bind(
        weightInput,
        {
            min: 0,
            max: 9999.9,
            step: 2.5,
            decimals: 1,
            minChars: 3,
            snapStep: true
        },
        (defaults, value) => defaults.weight = value
    );

    const tempoKeys = [
        "first",
        "second",
        "third",
        "fourth"
    ];

    tempoInputs.forEach((input, index) => {
        bind(
            input,
            {
                min: 0,
                max: 999,
                step: 1,
                minChars: 1,
                zeroDisplay:
                    index === 0 || index === 2
                        ? "X"
                        : null
            },
            (defaults, value) =>
                defaults.tempo[tempoKeys[index]] = value
        );
    });

    themeSwitch.addEventListener("click", () => {
        const settings = getAppSettings();
        if (!settings) return;

        settings.theme =
            settings.theme === "dark"
                ? "light"
                : "dark";

        applyAppTheme(settings.theme);
        updateThemeSwitch(settings.theme);
        scheduleAppSettingsSave(settings);
    });

bodyModelSwitch.addEventListener("click", () => {
    const settings = getAppSettings();
    if (!settings) return;

    settings.bodyModel =
        settings.bodyModel === "male"
            ? "female"
            : "male";

    updateBodyModelSwitch(settings.bodyModel);
    scheduleAppSettingsSave(settings);
    onBodyModelChange();
});

    weightUnitSwitch.addEventListener("click", () => {
        const settings = getAppSettings();
        if (!settings) return;

        settings.planDefaults.weightUnit =
            settings.planDefaults.weightUnit === "kg"
                ? "lbs"
                : "kg";

        updateWeightUnitSwitch(
            settings.planDefaults.weightUnit
        );

        scheduleAppSettingsSave(settings);
    });

autoAddCategoriesCheckbox.addEventListener("change", () => {
    const settings = getAppSettings();
    if (!settings) return;
    settings.planDefaults.includeCategories = autoAddCategoriesCheckbox.checked;
    scheduleAppSettingsSave(settings);
});

autoAddEquipmentCheckbox.addEventListener("change", () => {
    const settings = getAppSettings();
    if (!settings) return;
    settings.planDefaults.includeEquipment = autoAddEquipmentCheckbox.checked;
    scheduleAppSettingsSave(settings);
});

includeNotesCheckbox.addEventListener("change", () => {
    const settings = getAppSettings();
    if (!settings) return;
    settings.planDefaults.includeNotes = includeNotesCheckbox.checked;
    scheduleAppSettingsSave(settings);
});

autoAddInstructionsCheckbox.addEventListener("change", () => {
    const settings = getAppSettings();
    if (!settings) return;

    settings.planDefaults.autoAddDefaultInstructions = autoAddInstructionsCheckbox.checked;
    scheduleAppSettingsSave(settings);
});

alwaysShowInstructionsCheckbox.addEventListener("change", () => {
    const settings = getAppSettings();
    if (!settings) return;

    settings.alwaysShowInstructions = alwaysShowInstructionsCheckbox.checked;

    scheduleAppSettingsSave(settings);
    onAlwaysShowInstructionsChange();
}); 

splitOrderSwitch.addEventListener("click", () => {
    updateSplitOrderPreview(
        pendingSplitOrder === "left-right"
            ? "right-left"
            : "left-right"
    );
});

splitApplyNewButton.addEventListener("click", () => {
    const settings = getAppSettings();
    if (!settings) return;

    settings.splitOrder = pendingSplitOrder;
    scheduleAppSettingsSave(settings);
});

splitApplyAllButton.addEventListener("click", async () => {
    const settings = getAppSettings();
    if (!settings) return;

    settings.splitOrder = pendingSplitOrder;
    scheduleAppSettingsSave(settings);

    splitApplyAllButton.disabled = true;

    try {
        await onApplySplitOrderToAll(pendingSplitOrder);
    } finally {
        splitApplyAllButton.disabled = false;
    }
});

advancedToggle.addEventListener("click", () => {
    updateAdvancedPanel(advancedPanel.hidden);
});

updateAdvancedPanel(false);

    refreshSettingsInterface();
}

export {
    configureSettingsController,
    setupSettingsController,
    refreshSettingsInterface,
    applyAppTheme
};