import {
    setupNumberInput,
    updateNumberInputWidth
} from "../ui/ui.js";

let getAppSettings = () => null;
let scheduleAppSettingsSave = () => {};

let themeSwitch;
let setsInput;
let repsInput;
let timeInput;
let restInput;
let weightInput;
let tempoInputs;
let weightUnitSwitch;
let weightUnitButtons;

// ============================================================
// CONFIGURATION
// ============================================================

function configureSettingsController(dependencies) {
    ({
        getAppSettings,
        scheduleAppSettingsSave,

        themeSwitch,
        setsInput,
        repsInput,
        timeInput,
        restInput,
        weightInput,
        tempoInputs,
        weightUnitSwitch,
        weightUnitButtons
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

    applyAppTheme(settings.theme);
    updateThemeSwitch(settings.theme);

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

    refreshSettingsInterface();
}

export {
    configureSettingsController,
    setupSettingsController,
    refreshSettingsInterface,
    applyAppTheme
};