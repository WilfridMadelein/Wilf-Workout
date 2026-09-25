// ============================================================
// ÉTAT GLOBAL DE L'APPLICATION
// ============================================================

// ------------------------------------------------------------
// DOM — Exercices
// ------------------------------------------------------------

export const exerciseList = document.getElementById("exercise-list");
export const searchInput = document.getElementById("search-input");
export const exerciseBrowser = document.getElementById("exercise-browser");
export const pageExercises = document.getElementById("page-exercises");
export const planExerciseBrowserContainer = document.getElementById("plan-exercise-browser-container");
export const planExerciseList = document.getElementById("plan-exercise-list");

export const typeFilters = document.getElementById("type-filters");
export const muscleFilters = document.getElementById("muscle-filters");
export const submuscleFilters = document.getElementById("submuscle-filters");
export const equipmentFilters = document.getElementById("equipment-filters");
export const categoryFilters = document.getElementById("category-filters");
export const detailsContent = document.getElementById("details-content");

// ------------------------------------------------------------
// DOM — Navigation
// ------------------------------------------------------------

export const tabExercises = document.getElementById("tab-exercises");
export const tabPlans = document.getElementById("tab-plans");
export const pagePlans = document.getElementById("page-plans");
export const tabSettings = document.getElementById("tab-settings");
export const pageSettings = document.getElementById("page-settings");
export const pageWorkoutSummary = document.getElementById("page-workout-summary");
export const tabHistory = document.getElementById("tab-history");
export const pageHistory = document.getElementById("page-history");

// ------------------------------------------------------------
// DOM — Historique
// ------------------------------------------------------------

export const historyWorkoutList = document.getElementById("history-workout-list");
export const historyWorkoutsContent = document.getElementById("history-workouts-content");
export const historyPagination = document.getElementById("history-pagination");
export const historyPreviousPage = document.getElementById("history-previous-page");
export const historyNextPage = document.getElementById("history-next-page");
export const historyPageLabel = document.getElementById("history-page-label");

export const historyCalendarTitle = document.getElementById("history-calendar-title");
export const historyCalendarDays = document.getElementById("history-calendar-days");
export const historyCalendarPrevious = document.getElementById("history-calendar-previous");
export const historyCalendarNext = document.getElementById("history-calendar-next");

export const historySummaryMeta = document.getElementById("history-summary-meta");
export const historySummaryWorkoutName = document.getElementById("history-summary-workout-name");
export const historySummaryWorkoutDate = document.getElementById("history-summary-workout-date");
export const historyWorkoutSummaryHost = document.getElementById("history-workout-summary-host");

export const historyDeleteModal = document.getElementById("history-delete-modal");
export const cancelHistoryDeleteButton = document.getElementById("cancel-history-delete-button");
export const confirmHistoryDeleteButton = document.getElementById("confirm-history-delete-button");

// ------------------------------------------------------------
// DOM — Paramètres globaux
// ------------------------------------------------------------

export const settingsThemeSwitch =
    document.getElementById("settings-theme-switch");

export const settingsBodyModelSwitch =
    document.getElementById("settings-body-model-switch");

export const settingsBodyModelButtons = [
    ...document.querySelectorAll("[data-body-model]")];

export const settingsPlanSetsInput =
    document.getElementById("settings-plan-sets");

export const settingsPlanRepsInput =
    document.getElementById("settings-plan-reps");

export const settingsPlanTimeInput =
    document.getElementById("settings-plan-time");

export const settingsPlanRestInput =
    document.getElementById("settings-plan-rest");

export const settingsPlanWeightInput =
    document.getElementById("settings-plan-weight");

export const settingsPlanTempoInputs = [
    document.getElementById("settings-plan-tempo-1"),
    document.getElementById("settings-plan-tempo-2"),
    document.getElementById("settings-plan-tempo-3"),
    document.getElementById("settings-plan-tempo-4")
];

export const settingsWeightUnitSwitch =
    document.getElementById("settings-weight-unit-switch");

export const settingsWeightUnitButtons = [
    ...document.querySelectorAll(
        "[data-settings-weight-unit]"
    )
];

export const settingsPlanCategoryFilters =
    document.getElementById("settings-plan-category-filters");

export const settingsPlanEquipmentFilters =
    document.getElementById("settings-plan-equipment-filters");

export const settingsPlanAutoExcludeProgressions =
    document.getElementById("settings-plan-auto-exclude-progressions");

export const settingsPlanAutoAddEquipment =
    document.getElementById("settings-plan-auto-add-equipment");

export const settingsPlanAutoAddInstructions =
    document.getElementById("settings-plan-auto-add-instructions");

export const settingsPlanAlwaysShowInstructions =
    document.getElementById("settings-plan-always-show-instructions");

export const settingsSplitOrderSwitch =
    document.getElementById("settings-split-order-switch");

export const settingsSplitOrderLabel =
    document.getElementById("settings-split-order-label");

export const settingsSplitApplyNew =
    document.getElementById("settings-split-apply-new");

export const settingsSplitApplyAll =
    document.getElementById("settings-split-apply-all");

export const settingsAdvancedToggle =
    document.getElementById("settings-advanced-toggle");

export const settingsAdvancedPanel =
    document.getElementById("settings-advanced-panel");

// ------------------------------------------------------------
// DOM — Paramètres du plan
// ------------------------------------------------------------

export const planSetsInput = document.getElementById("plan-sets");
export const planRepsInput = document.getElementById("plan-reps");
export const planTimeInput = document.getElementById("plan-time");
export const planRestInput = document.getElementById("plan-rest");
export const planWeightInput = document.getElementById("plan-weight");

export const planWeightUnitButtons = [
    ...document.querySelectorAll("[data-weight-unit]")
];

export const planTempoInputs = [
    document.getElementById("plan-tempo-1"),
    document.getElementById("plan-tempo-2"),
    document.getElementById("plan-tempo-3"),
    document.getElementById("plan-tempo-4")
];

// ------------------------------------------------------------
// DOM — Plans
// ------------------------------------------------------------

export const newPlanButton = document.getElementById("new-plan-button");
export const downloadPlansButton = document.getElementById("download-plans-button");
export const planPdfModal = document.getElementById("plan-pdf-modal");
export const planPdfSelectionList = document.getElementById("plan-pdf-selection-list");
export const planPdfSelectAll = document.getElementById("plan-pdf-select-all");
export const cancelPlanPdfButton = document.getElementById("cancel-plan-pdf-button");
export const confirmPlanPdfButton = document.getElementById("confirm-plan-pdf-button");

export const planHome = document.getElementById("plan-home");
export const plansList = document.getElementById("plans-list");
export const planEditor = document.getElementById("plan-editor");
export const currentPlanName = document.getElementById("current-plan-name");
export const editPlanNameButton = document.getElementById("edit-plan-name-button");
export const currentPlanNameInput = document.getElementById("current-plan-name-input");
export const backToPlansButton = document.getElementById("back-to-plans-button");
export const startPlanWorkoutButton = document.getElementById("start-plan-workout-button");
export const planAutoExcludeProgressions = document.getElementById("plan-auto-exclude-progressions");

export const planAutoAddEquipment = document.getElementById("plan-auto-add-equipment");
export const planAutoAddInstructions = document.getElementById("plan-auto-add-instructions");
export const planNotesCounter = document.getElementById("plan-notes-counter");

export const planNotesInput = document.getElementById("plan-notes-input");
export const planEquipmentEditor = document.getElementById("plan-equipment-editor");
export const planEquipmentSelected = document.getElementById("plan-equipment-selected");
export const addPlanEquipmentButton = document.getElementById("add-plan-equipment-button");
export const planEquipmentOptions = document.getElementById("plan-equipment-options");

export const planDeleteModal = document.getElementById("plan-delete-modal");
export const planDeleteMessage = document.getElementById("plan-delete-message");
export const cancelPlanDeleteButton = document.getElementById("cancel-plan-delete-button");
export const confirmPlanDeleteButton = document.getElementById("confirm-plan-delete-button");

export const exportBackupButton = document.getElementById("export-backup-button");
export const importBackupButton = document.getElementById("import-backup-button");
export const backupFileInput = document.getElementById("backup-file-input");
export const backupImportModal = document.getElementById("backup-import-modal");
export const backupImportMessage = document.getElementById("backup-import-message");
export const cancelBackupImportButton = document.getElementById("cancel-backup-import-button");
export const confirmBackupImportButton = document.getElementById("confirm-backup-import-button");

// ------------------------------------------------------------
// DOM — Exécution d'un entraînement
// ------------------------------------------------------------

export const pageWorkoutExecution =
    document.getElementById("page-workout-execution");

export const workoutExitButton =
    document.getElementById("workout-exit-button");

export const workoutElapsedTime =
    document.getElementById("workout-elapsed-time");

export const workoutTimerToggleButton =
    document.getElementById("workout-timer-toggle-button");

export const workoutExecutionPlanName =
    document.getElementById("workout-execution-plan-name");

export const workoutBeginButton =
    document.getElementById("workout-begin-button");

export const workoutExecutionContent =
    document.getElementById("workout-execution-content");

export const workoutExitModal =
    document.getElementById("workout-exit-modal");

export const workoutConfirmExitButton =
    document.getElementById("workout-confirm-exit-button");

export const workoutContinueButton =
    document.getElementById("workout-continue-button");

export const workoutFinishButton =
    document.getElementById("workout-finish-button");

// ------------------------------------------------------------
// État — Détails
// ------------------------------------------------------------

export let currentDetailExercise = null;
export let currentDetailContext = "search";

export function setCurrentDetailExercise(exercise) {
    currentDetailExercise = exercise;
}

export function setCurrentDetailContext(context) {
    currentDetailContext = context;
}

// ------------------------------------------------------------
// État — Filtres
// ------------------------------------------------------------

export const selectedTypes = new Set();
export const selectedProgressionsInclude = new Set();
export const selectedProgressionsExclude = new Set();
export const selectedMuscleFamilies = new Set();
export const selectedSubmuscles = new Map();

export const selectedEquipment = new Set();
export const selectedCategories = new Set();

export const selectedPlanEquipment = new Set();
export const selectedPlanCategories = new Set();

// ------------------------------------------------------------
// État — Recherche
// ------------------------------------------------------------

export const searchPageState = {
    search: "",
    types: new Set(),
    progressionsInclude: new Set(),
    progressionsExclude: new Set(),
    muscleFamilies: new Set(),
    submuscles: new Map(),
    equipment: new Set(),
    categories: new Set()
};

export const planSearchState = {
    search: "",
    types: new Set(),
    progressionsInclude: new Set(),
    progressionsExclude: new Set(),
    muscleFamilies: new Set(),
    submuscles: new Map(),
    equipment: new Set(),
    categories: new Set()
};

// ------------------------------------------------------------
// État — Plan actuel
// ------------------------------------------------------------

export const plans = [];

export let currentPlan = null;

export function setCurrentPlan(plan) {
    currentPlan = plan;
}