import {
    refreshFilterSummaryCollapse,
    updateFilterSummaryCollapse
} from "../ui/filter-summary-collapse.js";

// ============================================================
// FILTRES DES NOUVEAUX PLANS
// ============================================================

let getAppSettings = () => null;
let scheduleAppSettingsSave = () => {};

let categoryContainer;
let equipmentContainer;
let autoExcludeCheckbox;

let getCategoryOptions = () => [];
let getEquipmentOptions = () => [];
let getRelevantEquipment = () => new Set();

// ============================================================
// CONFIGURATION
// ============================================================

function configureDefaultPlanFilters(dependencies) {
    ({
        getAppSettings,
        scheduleAppSettingsSave,
        categoryContainer,
        equipmentContainer,
        autoExcludeCheckbox,
        getCategoryOptions,
        getEquipmentOptions,
        getRelevantEquipment
    } = dependencies);
}

// ============================================================
// ÉTAT
// ============================================================

function getFilters() {
    const settings = getAppSettings();
    return settings?.planDefaults?.filters ?? null;
}

function getSelected(key, options) {
    const value = getFilters()?.[key];
    if (!Array.isArray(value)) return new Set(options);

    return new Set(
        value.filter(item => options.includes(item))
    );
}

function saveSelected(key, selected, options) {
    const settings = getAppSettings();
    if (!settings) return;

    settings.planDefaults.filters[key] =
        selected.size === options.length
            ? null
            : [...selected];

    scheduleAppSettingsSave(settings);
}

// ============================================================
// INTERFACE
// ============================================================

function closeDefaultFilterRows(except = null) {
    document
        .querySelectorAll(".settings-default-filter-row")
        .forEach(row => {
            if (row === except) return;

            const options = row.querySelector(".plan-filter-options");
            const arrow = row.querySelector(".plan-filter-arrow");
            const summary = row.querySelector(".plan-filter-summary");

            options?.classList.remove("open");
            if (arrow) arrow.textContent = "▼";
            if (summary) refreshFilterSummaryCollapse(summary);
        });
}

function createFilterRow(container, titleText, optionsId, summaryId) {
    const row = document.createElement("div");
    row.classList.add("plan-filter-row", "settings-default-filter-row");

    const title = document.createElement("button");
    title.type = "button";
    title.classList.add("plan-filter-title");

    const label = document.createElement("strong");
    label.textContent = titleText;

    const arrow = document.createElement("span");
    arrow.classList.add("plan-filter-arrow");
    arrow.textContent = "▼";

    const summary = document.createElement("div");
    summary.id = summaryId;
    summary.classList.add("plan-filter-summary");

    const options = document.createElement("div");
    options.id = optionsId;
    options.classList.add("plan-filter-options");

    title.append(label, arrow);
    row.append(title, summary, options);
    container.appendChild(row);

    title.addEventListener("click", event => {
        event.stopPropagation();

        const open = !options.classList.contains("open");

        closeDefaultFilterRows(row);
        options.classList.toggle("open", open);
        arrow.textContent = open ? "▲" : "▼";
        refreshFilterSummaryCollapse(summary);
    });

    return { row, summary, options };
}

function createSummaryButton(text) {
    const button = document.createElement("span");
    button.classList.add("summary-button");
    button.textContent = text;
    return button;
}

function updateSummary(summary, selected, options) {
    summary.replaceChildren();

    if (selected.size === options.length) {
        summary.appendChild(createSummaryButton("Tous"));
    } else if (selected.size === 0) {
        summary.appendChild(createSummaryButton("Aucun"));
    } else {
        [...selected]
            .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
            .forEach(item => summary.appendChild(createSummaryButton(item)));
    }

    updateFilterSummaryCollapse(summary);
}

function updateCategoryButtons() {
    const options = getCategoryOptions();
    const selected = getSelected("categories", options);

    categoryContainer
        .querySelectorAll("[data-category]")
        .forEach(button => {
            const category = button.dataset.category;

            button.classList.toggle(
                "active",
                category === "all"
                    ? selected.size === options.length
                    : selected.has(category)
            );
        });
}

function updateEquipmentButtons() {
    const options = getEquipmentOptions();
    const selected = getSelected("equipment", options);

    equipmentContainer
        .querySelectorAll("[data-equipment]")
        .forEach(button => {
            const equipment = button.dataset.equipment;

            button.classList.toggle(
                "active",
                equipment === "all"
                    ? selected.size === options.length
                    : equipment === "none"
                        ? selected.size === 0
                        : selected.has(equipment)
            );
        });
}

function updateEquipmentRelevance() {
    const categories = getSelected("categories", getCategoryOptions());
    const relevant = getRelevantEquipment(categories);

    equipmentContainer
        .querySelectorAll("[data-equipment]")
        .forEach(button => {
            const equipment = button.dataset.equipment;
            if (equipment === "all" || equipment === "none") return;

            button.classList.toggle(
                "equipment-irrelevant",
                !relevant.has(equipment)
            );
        });
}

function refreshDefaultPlanFilters() {
    const settings = getAppSettings();
    if (!settings) return;

    const categories = getCategoryOptions();
    const equipment = getEquipmentOptions();

    const selectedCategories = getSelected("categories", categories);
    const selectedEquipment = getSelected("equipment", equipment);

    autoExcludeCheckbox.checked =
        settings.planDefaults.filters.autoExcludeProgressions !== false;

    updateCategoryButtons();
    updateEquipmentButtons();
    updateEquipmentRelevance();

    updateSummary(
        document.getElementById("settings-plan-category-summary"),
        selectedCategories,
        categories
    );

    updateSummary(
        document.getElementById("settings-plan-equipment-summary"),
        selectedEquipment,
        equipment
    );
}

// ============================================================
// INITIALISATION
// ============================================================

function setupDefaultPlanFilters() {
    categoryContainer.replaceChildren();
    equipmentContainer.replaceChildren();

    const category = createFilterRow(
        categoryContainer,
        "Catégorie",
        "settings-plan-category-filter-options",
        "settings-plan-category-summary"
    );

    const equipment = createFilterRow(
        equipmentContainer,
        "Équipements",
        "settings-plan-equipment-filter-options",
        "settings-plan-equipment-summary"
    );

    const allCategories = document.createElement("button");
    allCategories.type = "button";
    allCategories.classList.add("filter-button");
    allCategories.dataset.category = "all";
    allCategories.textContent = "Tous";

    allCategories.addEventListener("click", event => {
        event.stopPropagation();

        const options = getCategoryOptions();
        saveSelected("categories", new Set(options), options);

        refreshDefaultPlanFilters();
    });

    category.options.appendChild(allCategories);

    getCategoryOptions().forEach(categoryName => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("filter-button");
        button.dataset.category = categoryName;
        button.textContent = categoryName;

        button.addEventListener("click", event => {
            event.stopPropagation();

            const options = getCategoryOptions();
            const selected = getSelected("categories", options);

            selected.has(categoryName)
                ? selected.delete(categoryName)
                : selected.add(categoryName);

            saveSelected("categories", selected, options);
            refreshDefaultPlanFilters();
        });

        category.options.appendChild(button);
    });

    const allEquipment = document.createElement("button");
    allEquipment.type = "button";
    allEquipment.classList.add("filter-button");
    allEquipment.dataset.equipment = "all";
    allEquipment.textContent = "Tous";

    allEquipment.addEventListener("click", event => {
        event.stopPropagation();

        const options = getEquipmentOptions();
        saveSelected("equipment", new Set(options), options);

        refreshDefaultPlanFilters();
    });

    const noEquipment = document.createElement("button");
    noEquipment.type = "button";
    noEquipment.classList.add("filter-button");
    noEquipment.dataset.equipment = "none";
    noEquipment.textContent = "Aucun";

    noEquipment.addEventListener("click", event => {
        event.stopPropagation();

        saveSelected("equipment", new Set(), getEquipmentOptions());
        refreshDefaultPlanFilters();
    });

    equipment.options.append(allEquipment, noEquipment);

    getEquipmentOptions().forEach(equipmentName => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("filter-button");
        button.dataset.equipment = equipmentName;
        button.textContent = equipmentName;

        button.addEventListener("click", event => {
            event.stopPropagation();

            const options = getEquipmentOptions();
            const selected = getSelected("equipment", options);

            selected.has(equipmentName)
                ? selected.delete(equipmentName)
                : selected.add(equipmentName);

            saveSelected("equipment", selected, options);
            refreshDefaultPlanFilters();
        });

        equipment.options.appendChild(button);
    });

    autoExcludeCheckbox.addEventListener("change", () => {
        const settings = getAppSettings();
        if (!settings) return;

        settings.planDefaults.filters.autoExcludeProgressions =
            autoExcludeCheckbox.checked;

        scheduleAppSettingsSave(settings);
    });

    document.addEventListener("click", event => {
        if (event.target.closest(".settings-default-filter-row")) return;
        closeDefaultFilterRows();
    });

    refreshDefaultPlanFilters();
}

export {
    configureDefaultPlanFilters,
    setupDefaultPlanFilters,
    refreshDefaultPlanFilters
};