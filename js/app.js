import { setupTimerNotifications } from "./workout/workout-timer-notifications.js";

// ============================================================
// MODULES
// ============================================================

import {
    configureSyncLifecycle,
    setupSyncLifecycle
} from "./storage/sync-lifecycle.js";

import {
    inspectStorageSync
} from "./storage/storage-sync-inspection.js";

import {
    configureStorageTargetSync,
    setupStorageTargetSync,
    syncStorageTargetNow
} from "./storage/storage-target-sync.js";

import {
    loadWorkoutHistory,
    saveWorkoutHistoryNow,
    deleteWorkoutHistoryFromStorage
} from "./storage/workout-history-storage.js";

import {
    createDefaultAppSettings,
    loadAppSettings,
    saveAppSettingsNow,
    scheduleAppSettingsSave
} from "./storage/settings-storage.js";

import {
    loadPlans,
    savePlanNow,
    schedulePlanSave,
    deletePlanFromStorage,
} from "./storage/plan-storage.js";

import {
    requestPersistentStorage
} from "./storage/storage-provider.js";

import {
    downloadBackup,
    readBackupFile,
    importBackup
} from "./storage/backup.js";

import {
    exerciseList,
    searchInput,
    exerciseBrowser,
    pageExercises,
    planExerciseBrowserContainer,
    planExerciseList,

    typeFilters,
    muscleFilters,
    submuscleFilters,
    equipmentFilters,
    categoryFilters,
    detailsContent,
    exercisePageHistoryHost,

    tabExercises,
    tabPlans,
    pagePlans,

    planSetsInput,
    planRepsInput,
    planTimeInput,
    planRestInput,
    planWeightInput,
    planWeightUnitButtons,
    planTempoInputs,

    planAutoExcludeProgressions,
    planAutoAddEquipment,
    planAutoAddInstructions,

planNotesInput,
planEquipmentEditor,
planEquipmentSelected,
addPlanEquipmentButton,
planEquipmentOptions,

planDeleteModal,
planDeleteMessage,
cancelPlanDeleteButton,
confirmPlanDeleteButton,
planNotesCounter,

newPlanButton,
autoPlanButton,
autoPlanPage,
downloadPlansButton,
    planPdfModal,
    planPdfSelectionList,
    cancelPlanPdfButton,
    confirmPlanPdfButton,
    planPdfSelectAll,

    plans,
    editPlanNameButton,
    currentPlanNameInput,
    planHome,
    plansList,
    planEditor,
    currentPlanName,
    backToPlansButton,
    startPlanWorkoutButton,

pageWorkoutExecution,
workoutExitButton,
workoutElapsedTime,
workoutTimerToggleButton,
workoutExecutionPlanName,
workoutBeginButton,
workoutExecutionContent,
workoutExitModal,
workoutConfirmExitButton,
workoutContinueButton,
workoutFinishButton,

    currentDetailExercise,
    currentDetailContext,
    setCurrentDetailExercise,
    setCurrentDetailContext,

    selectedTypes,
    selectedProgressionsInclude,
    selectedProgressionsExclude,
    selectedMuscleFamilies,
    selectedSubmuscles,
    selectedEquipment,
    selectedCategories,
    selectedPlanEquipment,
    selectedPlanCategories,

    searchPageState,
    planSearchState,

    exportBackupButton,
    importBackupButton,
    backupFileInput,
    backupImportModal,
    backupImportMessage,
    cancelBackupImportButton,
    confirmBackupImportButton,

    currentPlan,
    setCurrentPlan,

tabSettings,
pageSettings,
pageWorkoutSummary,

settingsThemeSwitch,
settingsBodyModelSwitch,
settingsBodyModelButtons,
settingsPlanSetsInput,
settingsPlanRepsInput,
settingsPlanTimeInput,
settingsPlanRestInput,
settingsPlanWeightInput,
settingsPlanTempoInputs,
settingsWeightUnitSwitch,
settingsWeightUnitButtons,

settingsPlanCategoryFilters,
settingsPlanEquipmentFilters,
settingsPlanAutoExcludeProgressions,
settingsPlanAutoAddEquipment,
settingsPlanAutoAddInstructions,
settingsPlanAlwaysShowInstructions,
settingsAdvancedToggle,
settingsAdvancedPanel,

settingsSplitOrderSwitch,
settingsSplitOrderLabel,
settingsSplitApplyNew,
settingsSplitApplyAll,

tabHistory,
pageHistory,

historyWorkoutList,
historyWorkoutsContent,
historyPagination,
historyPreviousPage,
historyNextPage,
historyPageLabel,

historyCalendarTitle,
historyCalendarDays,
historyCalendarPrevious,
historyCalendarNext,

historySummaryMeta,
historySummaryWorkoutName,
historySummaryWorkoutDate,
historyWorkoutSummaryHost,
historyExerciseSearchInput,
historyExerciseSearchList,
historyExerciseDetailsName,
historyExerciseDetailsContent,
historyExerciseHistoryHost,

historyDeleteModal,
cancelHistoryDeleteButton,
confirmHistoryDeleteButton,

planAutoAddCategories,
planIncludeNotes,
planAutoGenerationSection,
planAutoGenerationToggle,
planAutoGenerationContent,
planFiltersToggle,
planFiltersContent,
planSettingsToggle,
planSettingsContent,
planWorkoutMetadataToggle,
planWorkoutMetadata,

planNotesEditor,
planCategoryEditor,
planCategorySelected,
addPlanCategoryButton,
planCategoryOptions,

settingsPlanAutoAddCategories,
settingsPlanIncludeNotes,
settingsSyncCreateFileButton,
settingsSyncOpenFileButton,
settingsSyncAuthorizeFileButton,
settingsSyncDisconnectButton,
settingsSyncFileStatus,
settingsSyncControls,
settingsSyncModeAutoButton,
settingsSyncModeManualButton,
settingsSyncModeHelp,
settingsSyncPairing,
settingsSyncPairingMessage,
settingsSyncPairingPushButton,
settingsSyncPairingPullButton,
settingsSyncActions,
settingsSyncPushButton,
settingsSyncPullButton,
settingsSyncStatus,
settingsSyncDetail,
syncDisconnectModal,
cancelSyncDisconnectButton,
confirmSyncDisconnectButton,
} from "./app-state.js";

import {
    configureAppController,
    saveSearchState,
    loadSearchState,
    setupAppController
} from "./app-controller.js";

import {
    configureHistoryController,
    setupHistoryController,
    setWorkoutHistory,
    refreshWorkoutHistory,
    setSelectedHistoryWorkout,
    showHistoryList,
    showHistorySummary,
    getHistorySummaryHost
} from "./history/history-controller.js";

import {
    configureExerciseHistoryController,
    setupExerciseHistoryController,
    openExercisePageHistory,
    closeExercisePageHistory,
    refreshExerciseHistoryViews
} from "./history/exercise-history-controller.js";

import {
    configureStorageSyncController,
    setupStorageSyncController,
    refreshStorageSyncInterface
} from "./settings/storage-sync-controller.js";

import {
    configureSettingsController,
    setupSettingsController,
    refreshSettingsInterface,
    applyAppTheme
} from "./settings/settings-controller.js";

import {
    configureDefaultPlanFilters,
    setupDefaultPlanFilters,
    refreshDefaultPlanFilters
} from "./settings/default-plan-filters.js";

import {
    normalizeSearchText,
    getSearchTerms,
    getProgressionId,
    getProgressionName,
    getProgressionDisplay,
    isIsometricExercise,
    findTermMatches,
    findValidTermCombination,
    getMatchQuality,
    getMatchPosition,
    getSearchCriteria,
    compareSearchCriteria,
    getExerciseSearchRanking,
    compareExercisesBySearch,
    escapeHtml,
    highlightSearchMatches
} from "./exercises/exercise-search.js";

import {
    configureExerciseFilters,

    createMuscleButtons,
    updateMuscleSpecialButtons,
    createSubmuscleButtons,
    removeSubmuscleContainer,
    exerciseMatchesMuscle,

    createEquipmentButtons,
    updateEquipmentAllButton,
    setupEquipmentAllButton,
    exerciseHasRequiredEquipment,
    exerciseMatchesEquipmentFilter,

    setupTypeButtons,
    updateTypeAllButton,

    setupCategoryButtons,
    exerciseMatchesCategoryFilter,
    getCategoryOptions,
    exerciseMatchesCategories,

    getRelevantEquipment,
    updateEquipmentRelevance,
    updateCategoryAllButton,

    getProgressionOptions,
    createProgressionOptions,
    createProgressionButton,
    updateProgressionButtons,
    exerciseMatchesProgression
} from "./exercises/exercise-filters.js";

import {
    configureExerciseDisplay,
    exerciseMatchesProgressionContext,
    getProgressionNeighbor,
    exerciseMatchesPlanProgressionFilter,
    exerciseHasRequiredEquipmentForPlan,
    getPlanProgressionNeighbor,
    updateProgressionNavigation
} from "./exercises/exercise-display.js";

import {
    configureExerciseList,
    displayExercises
} from "./exercises/exercise-list.js";

import {
    configureExerciseDetails,
    removeAddButton,
    displayExerciseDetails,
    getExerciseDetailsLines,
    getPlanExerciseDetailsLines,
    closePlanInstructionsPopup
} from "./exercises/exercise-details.js";

import {
    configureExerciseMuscleMap,
    refreshExerciseMuscleMapModel
} from "./exercises/exercise-muscle-map.js";

import {
    normalizeSplitOrder
} from "./exercises/exercise-split.js";

import {
    configureProgressionPreferences,
    refreshProgressionPreferenceControls
} from "./training/progression-preferences.js";

import {
    configureAutoPlanController,
    setupAutoPlanController
} from "./auto-plan/auto-plan-controller.js";

import {
    buildAutoPlanInput,
    getAutoPlanInputSummary
} from "./auto-plan/auto-plan-input.js";

import {
    buildExerciseCandidatePool
} from "./auto-plan/generator/workout-constraint.js";

import {
    scoreCandidatePool
} from "./auto-plan/generator/exercise-scoring.js";

import {
    buildWorkoutFromScoredPool
} from "./auto-plan/generator/workout-builder.js";

import {
    buildGeneratedPlan
} from "./auto-plan/generator/plan-output.js";

import {
    configurePlanRender,
    createPlanNumberInput,
    renderPlanExercises,
    openPlanExerciseInstructions
} from "./plans/plan-render.js";

import {
    configurePlanCombinations,
    getNextCombinationGroup,
    getCombinationGroups,
    normalizeCombinationNumbers,
    setCombinationSets,
    moveExerciseToCombination,
    moveExerciseToNewCombination,
    getAvailableCombinationGroups,
    openCombinationMenu,
    moveExerciseWithinCombination,
    moveCombination
} from "./plans/plan-combinations.js";

import {
    configurePlanManager,
    addExerciseToCurrentPlan,
    removeExerciseFromCurrentPlan,
    updatePlanExerciseProgression,
    removeAutoExcludedProgression,
    syncPlanAutoExcludedProgressions
} from "./plans/plan-manager.js";

import {
    configurePlanFilters,
    createPlanFilterRows,
    updatePlanFilterSummaries,
    loadPlanFilters,
    saveCurrentPlanFilters,
} from "./plans/plan-filters.js";

import {
    configurePlanController,
    ensurePlanDefaults,
    loadPlanDefaultsIntoInputs,
    setupPlanDefaultInputs,
    getPlanSetCount,
    getPlanPrimaryMuscles,
    renderPlansList,
    setupPlanController,
    addCategoriesToCurrentPlan,
    addEquipmentToCurrentPlan,
    addAndOpenPlan
} from "./plans/plan-controller.js";

import {
    configurePlanPdf,
    setupPlanPdf
} from "./plans/plan-pdf.js";

import {
    configureFilterUI,
    rebuildSearchFilterInterface,
    setupFilterRows,
    updateFilterSummaries
} from "./ui/filter-ui.js";

import {
    configureWorkoutSummary,
    setupWorkoutSummary,
    renderWorkoutSummary
} from "./workout/workout-summary.js";

import {
    configureWorkoutExecution,
    setupWorkoutExecution,
    startWorkoutExecution,
    editWorkoutLogFromSummary
} from "./workout/workout-execution.js";

import {
    configureWorkoutOverview
} from "./workout/workout-overview.js";

let appSettings = createDefaultAppSettings();

let workoutHistory = [];
let historySummaryReturnScrollY = 0;

function inspectWilfAutoPlanData(request = appSettings?.autoPlanLastRequest) {
    const input = buildAutoPlanInput({ request, exercises, workoutHistory, appSettings });

    console.table([getAutoPlanInputSummary(input)]);

    if (input.diagnostics.errors.length) console.error("Auto-plan — erreurs :", input.diagnostics.errors);
    if (input.diagnostics.warnings.length) console.warn("Auto-plan — avertissements :", input.diagnostics.warnings);

    return input;
}

function inspectWilfAutoPlanCandidates(request = appSettings?.autoPlanLastRequest) {
    const input = inspectWilfAutoPlanData(request);
    const pool = buildExerciseCandidatePool(exercises, input);

    console.table([{
        total: pool.summary.total,
        eligible: pool.summary.eligible,
        rejected: pool.summary.rejected
    }]);

    console.table([pool.summary.rejectedByReason]);

    console.table(
        Object.entries(pool.summary.bodyParts).map(([bodyPart, counts]) => ({
            bodyPart,
            matchingCandidates: counts.matching,
            primaryCandidates: counts.primary
        }))
    );

    return { input, ...pool };
}

function inspectWilfAutoPlanScores(request = appSettings?.autoPlanLastRequest) {
    const candidateResult = inspectWilfAutoPlanCandidates(request);
    const scored = scoreCandidatePool(candidateResult);

    console.table(
        scored.candidates.slice(0, 30).map(candidate => ({
            exercise: candidate.exerciseName,
            score: candidate.score,
            bodyPart: candidate.primaryBodyPart,
            progression: candidate.progressionIndex,
            latest: candidate.latestProgressionIndex,
            offset: candidate.progressionOffset,
            preference: candidate.progressionPreference,
            primaryTarget: candidate.primaryTargeted,
            preferenceScore: candidate.scoreBreakdown.preference,
            progressionScore: candidate.scoreBreakdown.progressionDistance,
            primaryScore: candidate.scoreBreakdown.primaryTarget
        }))
    );

    console.table([scored.scoring.overall]);

    console.table(
        Object.entries(scored.scoring.bodyParts).map(([bodyPart, stats]) => ({
            bodyPart,
            ...stats
        }))
    );

    return { input: candidateResult.input, ...scored };
}

function inspectWilfAutoPlanWorkout(request = appSettings?.autoPlanLastRequest) {
    const scored = inspectWilfAutoPlanScores(request);
    const workout = buildWorkoutFromScoredPool(scored, scored.input);

    console.table(
        workout.exercises.map((item, index) => ({
            order: index + 1,
            exercise: item.candidate.exerciseName,
            bodyPart: item.compositionBodyPart,
            coverage: item.selectionReason,
            score: item.candidate.score,
            progression: item.candidate.progressionIndex,
            latest: item.candidate.latestProgressionIndex,
            recent28Days: item.candidate.recentProgressionWorkoutCount,
            durationSeconds: item.estimatedDurationSeconds
        }))
    );

    console.table(
        Object.entries(workout.coverage).map(([bodyPart, coverage]) => ({
            bodyPart,
            status: coverage.status,
            exercise: coverage.exerciseName
        }))
    );

    console.table([{
        targetMinutes: Math.round(workout.targetDurationSeconds / 60),
        estimatedMinutes: workout.estimatedDurationMinutes,
        unusedMinutes: Math.round(workout.unusedDurationSeconds / 60)
    }]);

    return { ...scored, workout };
}

const workoutSummaryStandaloneParent = pageWorkoutSummary.parentElement;

function moveWorkoutSummaryToStandalone() {
    if (
        pageWorkoutSummary.parentElement ===
        workoutSummaryStandaloneParent
    ) {
        return;
    }

    workoutSummaryStandaloneParent.appendChild(
        pageWorkoutSummary
    );
}

function moveWorkoutSummaryToHistory() {
    const host =
        getHistorySummaryHost();

    if (
        pageWorkoutSummary.parentElement ===
        host
    ) {
        return;
    }

    host.appendChild(
        pageWorkoutSummary
    );
}

async function openWorkoutSummary(
    session
) {
    try {
        await saveWorkoutHistoryNow(
            session,
            {
                markCompleted: true
            }
        );

        workoutHistory =
            await loadWorkoutHistory();

        refreshWorkoutHistory(workoutHistory);
        refreshExerciseHistoryViews();
    } catch (error) {
        console.error(
            "Impossible de sauvegarder l'entraînement dans l'historique.",
            error
        );

        alert(
            "L'entraînement est terminé, mais son historique n'a pas pu être sauvegardé."
        );
    }

    moveWorkoutSummaryToStandalone();

    pageExercises.style.display =
        "none";

    pagePlans.style.display =
        "none";

    pageHistory.style.display =
        "none";

    pageSettings.style.display =
        "none";

    pageWorkoutSummary.hidden =
        false;

    tabExercises.classList.remove(
        "active"
    );

    tabHistory.classList.remove(
        "active"
    );

    tabSettings.classList.remove(
        "active"
    );

    tabPlans.classList.add(
        "active"
    );

    setCurrentDetailContext(
        "search"
    );

    await renderWorkoutSummary(
        session,
        {
            mode: "completion"
        }
    );
}

function closeWorkoutSummary(session, { mode } = {}) {
    pageWorkoutSummary.hidden = true;

    if (mode === "history") {
        showHistoryList();
        requestAnimationFrame(() => window.scrollTo({ top: historySummaryReturnScrollY, behavior: "auto" }));
        return;
    }

    moveWorkoutSummaryToStandalone();
    tabPlans.click();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

async function openWorkoutSummaryFromHistory(session) {
    const historyWasVisible = pageHistory.style.display === "block";
    historySummaryReturnScrollY = historyWasVisible ? window.scrollY : 0;

    if (!historyWasVisible) tabHistory.click();

    setSelectedHistoryWorkout(session);
    moveWorkoutSummaryToHistory();
    showHistorySummary();
    pageWorkoutSummary.hidden = false;

    await renderWorkoutSummary(session, {
        mode: "history",
        scrollToSummary: false
    });
}

async function openWorkoutSummaryFromExerciseHistory(session) {
    await openWorkoutSummaryFromHistory(session);
    requestAnimationFrame(() => document.querySelector(".history-summary-section")?.scrollIntoView({ block: "start", behavior: "smooth" }));
}

async function deleteWorkoutFromHistory(session) {
    await deleteWorkoutHistoryFromStorage(session.id);
    workoutHistory = await loadWorkoutHistory();
    pageWorkoutSummary.hidden = true;
    refreshExerciseHistoryViews();
    return workoutHistory;
}

async function applySplitOrderToAllPlans(order) {
    const splitOrder =
        normalizeSplitOrder(order);

    plans.forEach(plan => {
        plan.exercises.forEach(planExercise => {
            planExercise.splitOrder =
                splitOrder;
        });
    });

    await Promise.all(
        plans.map(plan =>
            savePlanNow(plan)
        )
    );

    renderPlansList();

    if (currentPlan) {
        renderPlanExercises();
    }
}

async function reloadSyncedAppData() {
    appSettings = await loadAppSettings();
    applyAppTheme(appSettings.theme);
    refreshSettingsInterface();
    refreshDefaultPlanFilters();
    refreshProgressionPreferenceControls();

    const storedPlans = await loadPlans(exercises);
    plans.splice(0, plans.length, ...storedPlans);
    renderPlansList();

    workoutHistory = await loadWorkoutHistory();
    setWorkoutHistory(workoutHistory);
    refreshExerciseHistoryViews();
}

// ============================================================
// CONFIGURATION DES MODULES
// ============================================================

configureProgressionPreferences({
    getAppSettings: () => appSettings,
    scheduleAppSettingsSave
});

configureAutoPlanController({
    page: autoPlanPage,
    openButton: autoPlanButton,
    planHome,
    planEditor,
    getAppSettings: () => appSettings,
    saveAppSettingsNow,
    getCategoryOptions,
    getEquipmentOptions: () => equipmentOptions,
    getExercises: () => exercises,

    getDefaultPlanEquipment: () => {
        const value = appSettings?.planDefaults?.filters?.equipment;
        return Array.isArray(value)
            ? value.filter(item => equipmentOptions.includes(item))
            : [...equipmentOptions];
    },

    navigationButtons: [
        tabExercises,
        tabPlans,
        tabHistory,
        tabSettings
    ],

onCreatePlan: async request => {
    const input = buildAutoPlanInput({ request, exercises, workoutHistory, appSettings });

    if (!input.diagnostics.valid) {
        alert("Les données nécessaires au plan automatique sont incomplètes.");
        return;
    }

    const pool = buildExerciseCandidatePool(exercises, input);
    const usableCandidateCount = pool.candidates.length + (pool.summary?.secondaryFallbackEligible ?? 0);
    if (!usableCandidateCount) {
        alert("Aucun exercice ne correspond aux paramètres sélectionnés, même en utilisant les muscles secondaires comme dernier recours.");
        return;
    }

    const scored = scoreCandidatePool(pool);
    const workout = buildWorkoutFromScoredPool(scored, input);
    if (!workout.exercises.length) {
        alert("Des exercices correspondent aux paramètres, mais aucun plan cohérent n'a pu être construit.");
        return;
    }

    const plan = buildGeneratedPlan({
        request,
        workout,
        planNumber: plans.length + 1,
        defaultPlanSettings: appSettings.planDefaults,
        defaultSplitOrder: appSettings.splitOrder
    });

    await addAndOpenPlan(plan);
    autoPlanPage.hidden = true;
}
});

configureSyncLifecycle({
    syncNow: syncStorageTargetNow,
    refreshSyncInterface: refreshStorageSyncInterface
});

configureHistoryController({
    page: pageHistory,
    workoutList: historyWorkoutList,
    workoutsContent: historyWorkoutsContent,
    pagination: historyPagination,
    previousPageButton: historyPreviousPage,
    nextPageButton: historyNextPage,
    pageLabel: historyPageLabel,

    calendarTitle: historyCalendarTitle,
    calendarDays: historyCalendarDays,
    calendarPreviousButton: historyCalendarPrevious,
    calendarNextButton: historyCalendarNext,

    summaryHost: historyWorkoutSummaryHost,
    summaryMeta: historySummaryMeta,
    summaryName: historySummaryWorkoutName,
    summaryDate: historySummaryWorkoutDate,

    deleteModal: historyDeleteModal,
    cancelDeleteButton: cancelHistoryDeleteButton,
    confirmDeleteButton: confirmHistoryDeleteButton,

    onOpenWorkout: openWorkoutSummaryFromHistory,
    onDeleteWorkout: deleteWorkoutFromHistory
});

configureExerciseMuscleMap({
    getAppSettings: () => appSettings
});

configureExerciseHistoryController({
    exercisePageHistoryHost,
    historySearchInput: historyExerciseSearchInput,
    historyExerciseList: historyExerciseSearchList,
    historyExerciseName: historyExerciseDetailsName,
    historyExerciseDetails: historyExerciseDetailsContent,
    historyExerciseHistoryHost,
    getExercises: () => exercises,
    getWorkoutHistory: () => workoutHistory,
    onOpenWorkout: openWorkoutSummaryFromExerciseHistory
});

configureStorageSyncController({
    createFileButton: settingsSyncCreateFileButton,
    openFileButton: settingsSyncOpenFileButton,
    authorizeButton: settingsSyncAuthorizeFileButton,
    disconnectButton: settingsSyncDisconnectButton,
    fileStatus: settingsSyncFileStatus,
    controls: settingsSyncControls,
    modeAutoButton: settingsSyncModeAutoButton,
    modeManualButton: settingsSyncModeManualButton,
    modeHelp: settingsSyncModeHelp,
    pairingPanel: settingsSyncPairing,
    pairingMessage: settingsSyncPairingMessage,
    pairingPushButton: settingsSyncPairingPushButton,
    pairingPullButton: settingsSyncPairingPullButton,
    actions: settingsSyncActions,
    pushButton: settingsSyncPushButton,
    pullButton: settingsSyncPullButton,
    status: settingsSyncStatus,
    detail: settingsSyncDetail,
    disconnectModal: syncDisconnectModal,
    disconnectCancelButton: cancelSyncDisconnectButton,
    disconnectConfirmButton: confirmSyncDisconnectButton,
    onDataImported: reloadSyncedAppData
});

configureStorageTargetSync({
    onDataImported: reloadSyncedAppData,
    onSyncComplete: refreshStorageSyncInterface
});

configureSettingsController({
    getAppSettings: () => appSettings,
    scheduleAppSettingsSave,

    themeSwitch: settingsThemeSwitch,
    bodyModelSwitch: settingsBodyModelSwitch,
    bodyModelButtons: settingsBodyModelButtons,
    onBodyModelChange: refreshExerciseMuscleMapModel,
    onAlwaysShowInstructionsChange: renderPlanExercises,
    setsInput: settingsPlanSetsInput,
    repsInput: settingsPlanRepsInput,
    timeInput: settingsPlanTimeInput,
    restInput: settingsPlanRestInput,
    weightInput: settingsPlanWeightInput,
    tempoInputs: settingsPlanTempoInputs,
    weightUnitSwitch: settingsWeightUnitSwitch,
    weightUnitButtons: settingsWeightUnitButtons,
    autoAddCategoriesCheckbox: settingsPlanAutoAddCategories,
    autoAddEquipmentCheckbox: settingsPlanAutoAddEquipment,
    includeNotesCheckbox: settingsPlanIncludeNotes,
    autoAddInstructionsCheckbox: settingsPlanAutoAddInstructions,
    alwaysShowInstructionsCheckbox: settingsPlanAlwaysShowInstructions,

    advancedToggle: settingsAdvancedToggle,
    advancedPanel: settingsAdvancedPanel,
    onAdvancedOpen: refreshDefaultPlanFilters,

    splitOrderSwitch: settingsSplitOrderSwitch,
    splitOrderLabel: settingsSplitOrderLabel,
    splitApplyNewButton: settingsSplitApplyNew,
    splitApplyAllButton: settingsSplitApplyAll,
    onApplySplitOrderToAll: applySplitOrderToAllPlans,
});

configureDefaultPlanFilters({
    getAppSettings: () => appSettings,
    scheduleAppSettingsSave,

    categoryContainer: settingsPlanCategoryFilters,
    equipmentContainer: settingsPlanEquipmentFilters,
    autoExcludeCheckbox: settingsPlanAutoExcludeProgressions,

    getCategoryOptions,
    getEquipmentOptions: () => equipmentOptions,
    getRelevantEquipment
});

configurePlanCombinations({
    getCurrentPlan: () => currentPlan,
    renderPlanExercises,
    schedulePlanSave,
});

configurePlanManager({
    getCurrentPlan: () => currentPlan,
    getDefaultSplitOrder: () => appSettings.splitOrder,

    getSelectedProgressionsExclude: () => selectedProgressionsExclude,
    getPlanSearchState: () => planSearchState,
    getAutoExcludeProgressions: () =>  planAutoExcludeProgressions.checked,

    updateProgressionButtons,
    displayExercises,
    renderPlanExercises,
    closePlanInstructionsPopup,

    schedulePlanSave,
});

configurePlanRender({
    getCurrentPlan: () => currentPlan,
    getPlanExerciseList: () => planExerciseList,
    getAlwaysShowInstructions: () =>
        appSettings?.alwaysShowInstructions === true,

    normalizeCombinationNumbers,
    displayExerciseDetails,
    getProgressionId,
    getProgressionName,
    getPlanProgressionNeighbor,
    updatePlanExerciseProgression,
    removeExerciseFromCurrentPlan,
    closePlanInstructionsPopup,
    getPlanExerciseDetailsLines,

    openCombinationMenu,
    setCombinationSets,
    moveExerciseWithinCombination,
    moveCombination,

    schedulePlanSave,
});

configurePlanFilters({
    getCurrentPlan: () => currentPlan,
    getCurrentDetailExercise: () => currentDetailExercise,
    getCurrentDetailContext: () => currentDetailContext,

    getSelectedPlanCategories: () => selectedPlanCategories,
    getSelectedPlanEquipment: () => selectedPlanEquipment,

    getSelectedCategories: () => selectedCategories,
    getSelectedEquipment: () => selectedEquipment,

    getEquipmentOptions: () => equipmentOptions,

    getCategoryOptions,
    exerciseMatchesCategories,

    getPlanSearchState: () => planSearchState,

    saveSearchState,
    loadSearchState,
    schedulePlanSave,

    getAutoExcludeProgressions:
    () => planAutoExcludeProgressions.checked,

    setAutoExcludeProgressions: value => {
    planAutoExcludeProgressions.checked = value;
    },

    displayExercises,
    renderPlanExercises,

    updateEquipmentAllButton,
    updateFilterSummaries,
    updateProgressionNavigation,

    getRelevantEquipment,
    updateCategoryAllButton,
    updateEquipmentRelevance,

    getAutoAddCategoriesToPlan: () => planAutoAddCategories.checked,
    addCategoriesToCurrentPlan,
    getAutoAddEquipmentToPlan: () => planAutoAddEquipment.checked,
    addEquipmentToCurrentPlan
});

createPlanFilterRows();
planAutoExcludeProgressions.addEventListener(
    "change",
    saveCurrentPlanFilters
);

configureExerciseFilters({
    getSelectedCategories: () => selectedCategories,
    getSelectedEquipment: () => selectedEquipment,
    getSelectedTypes: () => selectedTypes,
    getSelectedProgressionsInclude:
        () => selectedProgressionsInclude,
    getSelectedProgressionsExclude:
        () => selectedProgressionsExclude,
    getSelectedMuscleFamilies:
        () => selectedMuscleFamilies,
    getSelectedSubmuscles:
        () => selectedSubmuscles,

    getEquipmentOptions: () => equipmentOptions,
    getMuscleFamilies: () => muscleFamilies,
    getExercises: () => exercises,

    getMuscleFilters: () => muscleFilters,
    getSubmuscleFilters: () => submuscleFilters,
    getEquipmentFilters: () => equipmentFilters,
    getTypeFilters: () => typeFilters,

    getSearchTerms,
    findValidTermCombination,
    getSearchCriteria,
    compareSearchCriteria,

    displayExercises,
    updateFilterSummaries
});

configureExerciseDisplay({
    getExercises: () => exercises,

    getSelectedPlanCategories:
        () => selectedPlanCategories,

    getSelectedPlanEquipment:
        () => selectedPlanEquipment,

    getProgressionName,

    exerciseMatchesCategoryFilter,
    exerciseMatchesCategories,
    exerciseMatchesEquipmentFilter,

    displayExerciseDetails
});

configureExerciseList({
    getExercises: () => exercises,

    getSearchInput: () => searchInput,
    getExerciseList: () => exerciseList,
    getExerciseCount: () =>
        document.getElementById("exercise-count"),

    getIsPlanContext: () =>
        pagePlans.style.display === "block" &&
        planEditor.style.display === "block",

    getSelectedTypes: () => selectedTypes,

    setCurrentDetailContext,

    getSearchTerms,
    getProgressionId,
    getProgressionName,
    getProgressionDisplay,

    findValidTermCombination,
    getExerciseSearchRanking,
    compareExercisesBySearch,
    highlightSearchMatches,

    exerciseMatchesCategoryFilter,
    exerciseMatchesEquipmentFilter,
    exerciseMatchesMuscle,
    exerciseMatchesProgression,

    removeAddButton,
    updateFilterSummaries,
    updatePlanFilterSummaries,

    displayExerciseDetails,
    addExerciseToCurrentPlan,
    saveCurrentPlanFilters,
});

configureExerciseDetails({
    getProgressionId,
    getProgressionName,
    getProgressionDisplay,

    updateProgressionNavigation,

    getSelectedPlanEquipment:
        () => selectedPlanEquipment,

    addExerciseToCurrentPlan,

    getPagePlans:
        () => pagePlans,

    getPlanEditor:
        () => planEditor,

    getCurrentDetailContext:
        () => currentDetailContext,

    setCurrentDetailExercise,
    setCurrentDetailContext,
    onOpenExerciseHistory: openExercisePageHistory,
    onExerciseDetailsChanged: closeExercisePageHistory
});

configurePlanPdf({
    plans,

    downloadPlansButton,
    planPdfModal,
    planPdfSelectionList,
    planPdfSelectAll,
    cancelPlanPdfButton,
    confirmPlanPdfButton,

    getPlanSetCount,
    getPlanPrimaryMuscles
});

configureWorkoutOverview({
    getExercises: () => exercises
});

configureWorkoutSummary({
    page: pageWorkoutSummary,
    getAppSettings: () => appSettings,
    saveAppSettingsNow,
    onClose: closeWorkoutSummary,
    onEditLog: editWorkoutLogFromSummary,
    getWorkoutHistory: () => workoutHistory,
    onOpenHistoryWorkout: openWorkoutSummaryFromExerciseHistory,

    onSessionUpdated: async session => {
        try {
            await saveWorkoutHistoryNow(session);
            workoutHistory = await loadWorkoutHistory();
            refreshWorkoutHistory(workoutHistory);
            refreshExerciseHistoryViews();
        } catch (error) {
            console.error("Impossible de mettre à jour l'historique.", error);
            alert("La modification a été appliquée, mais elle n'a pas pu être sauvegardée dans l'historique.");
        }
    }
});

configureWorkoutExecution({
    page: pageWorkoutExecution,
    exitButton: workoutExitButton,
    elapsedTime: workoutElapsedTime,
    timerToggleButton: workoutTimerToggleButton,
    planName: workoutExecutionPlanName,
    beginButton: workoutBeginButton,
    content: workoutExecutionContent,
    exitModal: workoutExitModal,
    confirmExitButton: workoutConfirmExitButton,
    continueButton: workoutContinueButton,
    finishButton: workoutFinishButton,
    onFinishWorkout: openWorkoutSummary
});

configurePlanController({
    getDefaultPlanSettings:
    () => appSettings.planDefaults,
    getCurrentPlan: () => currentPlan,
    setCurrentPlan,

    newPlanButton,
    plans,
    editPlanNameButton,
    currentPlanNameInput,
    planHome,
    plansList,
    planEditor,
    currentPlanName,
    backToPlansButton,
    startPlanWorkoutButton,
startWorkout: startWorkoutExecution,

planAutoAddEquipment,
planAutoAddInstructions,
planNotesInput,
planNotesCounter,
planEquipmentEditor,
planEquipmentSelected,
addPlanEquipmentButton,
planEquipmentOptions,

planDeleteModal,
planDeleteMessage,
cancelPlanDeleteButton,
confirmPlanDeleteButton,

getEquipmentOptions: () => equipmentOptions,
getCategoryOptions,
getSelectedPlanCategories: () => selectedPlanCategories,
getSelectedPlanEquipment: () => selectedPlanEquipment,

    planSetsInput,
    planRepsInput,
    planTimeInput,
    planRestInput,
    planWeightInput,
    planWeightUnitButtons,
    planTempoInputs,

    planExerciseBrowserContainer,
    exerciseBrowser,

    loadPlanFilters,
    saveCurrentPlanFilters,
    displayExercises,
    renderPlanExercises,

    setCurrentDetailExercise,
    setCurrentDetailContext,
    syncPlanAutoExcludedProgressions,

    savePlanNow,
    deletePlanFromStorage,
    schedulePlanSave,
    requestPersistentStorage,

planAutoAddCategories,
planIncludeNotes,

planAutoGenerationSection,
planAutoGenerationToggle,
planAutoGenerationContent,
planFiltersToggle,
planFiltersContent,
planSettingsToggle,
planSettingsContent,
planWorkoutMetadataToggle,
planWorkoutMetadata,

planNotesEditor,
planCategoryEditor,
planCategorySelected,
addPlanCategoryButton,
planCategoryOptions,    

});

configureFilterUI({
    getSelectedCategories: () => selectedCategories,
    getSelectedTypes: () => selectedTypes,
    getSelectedEquipment: () => selectedEquipment,
    getSelectedMuscleFamilies: () => selectedMuscleFamilies,
    getSelectedSubmuscles: () => selectedSubmuscles,
    getSelectedProgressionsInclude: () =>
        selectedProgressionsInclude,
    getSelectedProgressionsExclude: () =>
        selectedProgressionsExclude,
    getSubmuscleFilters: () => submuscleFilters,

    createSubmuscleButtons,
    updateEquipmentAllButton,
    updateProgressionButtons,

    getCategoryOptions,
    updateCategoryAllButton,
    updateEquipmentRelevance,

    onProgressionExcludeRemoved: progression => {
    if (
        pagePlans.style.display === "block" &&
        planEditor.style.display === "block"
    ) {
        removeAutoExcludedProgression(progression);
    }
    },

    displayExercises
});

configureAppController({
    searchInput,
    pageExercises,
    pagePlans,
    pageHistory,
    pageSettings,
    pageWorkoutSummary,
    exerciseBrowser,
    planExerciseBrowserContainer,

    tabExercises,
    tabPlans,
    tabHistory,
    tabSettings,

    planHome,
    renderPlansList,
    planEditor,

    removeAddButton,
    displayExercises,
    rebuildSearchFilterInterface,
    saveCurrentPlanFilters,

    selectedTypes,
    selectedProgressionsInclude,
    selectedProgressionsExclude,
    selectedMuscleFamilies,
    selectedSubmuscles,
    selectedEquipment,
    selectedCategories,

    searchPageState,
    setCurrentDetailContext
});

// ============================================================
// SAUVEGARDE / IMPORT
// ============================================================

let pendingBackupImport = null;

function closeBackupImportModal() {
    pendingBackupImport = null;
    backupImportModal.hidden = true;
    backupFileInput.value = "";
}

function setupBackupControls() {
    exportBackupButton.addEventListener("click", async () => {
        try {
            await saveAppSettingsNow(
                appSettings,
                { touch: false }
            );

            await downloadBackup(plans);
        } catch (error) {
            console.error("Impossible de créer la sauvegarde :", error);
            alert("Impossible de créer la sauvegarde.");
        }
    });

    importBackupButton.addEventListener("click", () => {
        backupFileInput.click();
    });

    backupFileInput.addEventListener("change", async () => {
        const file = backupFileInput.files?.[0];
        if (!file) return;

        try {
            const backup = await readBackupFile(file);
            pendingBackupImport = backup;

            const planCount = backup.plans.length;
            const workoutCount = backup.workoutHistory?.length ?? 0;
            const exportDate = new Date(backup.exportedAt);

            const dateText = Number.isNaN(exportDate.getTime())
                ? ""
                : ` du ${new Intl.DateTimeFormat("fr-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }).format(exportDate)}`;

backupImportMessage.textContent =
    `Cette sauvegarde${dateText} contient ${planCount} plan${planCount !== 1 ? "s" : ""} et ` +
    `${workoutCount} entraînement${workoutCount !== 1 ? "s" : ""}. ` +
    `Wilf conservera la version la plus récemment modifiée de chaque élément.`;

            backupImportModal.hidden = false;
        } catch (error) {
            console.error("Sauvegarde invalide :", error);
            alert(error.message || "Impossible de lire cette sauvegarde.");
            backupFileInput.value = "";
        }
    });

    cancelBackupImportButton.addEventListener(
        "click",
        closeBackupImportModal
    );

    confirmBackupImportButton.addEventListener("click", async () => {
        if (!pendingBackupImport) return;

        confirmBackupImportButton.disabled = true;

        try {
const result = await importBackup(pendingBackupImport, exercises);

plans.splice(0, plans.length, ...result.plans);
renderPlansList();

workoutHistory = result.workoutHistory;
setWorkoutHistory(workoutHistory);

appSettings = await loadAppSettings();
refreshSettingsInterface();
refreshDefaultPlanFilters();
refreshProgressionPreferenceControls();

            closeBackupImportModal();

alert(
    `Import terminé.\n` +
    `Plans : ${result.added} ajouté${result.added !== 1 ? "s" : ""}, ${result.updated} mis à jour, ${result.kept} conservé${result.kept !== 1 ? "s" : ""}.\n` +
    `Historique : ${result.historyAdded} ajouté${result.historyAdded !== 1 ? "s" : ""}, ${result.historyUpdated} mis à jour, ${result.historyKept} conservé${result.historyKept !== 1 ? "s" : ""}.`
);
        } catch (error) {
            console.error("Impossible d'importer la sauvegarde :", error);
            alert(error.message || "Impossible d'importer cette sauvegarde.");
        } finally {
            confirmBackupImportButton.disabled = false;
        }
    });

    backupImportModal.addEventListener("click", event => {
        if (event.target === backupImportModal) {
            closeBackupImportModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            !backupImportModal.hidden
        ) {
            closeBackupImportModal();
        }
    });
}

// ============================================================
// INITIALISATION
// ============================================================

async function initializeApp() {
    // Synchronisation automatique avant le chargement de l’interface.
    try {
        const syncResult = await syncStorageTargetNow();
        if (!["no-target", "manual-mode", "pairing-required", "same"].includes(syncResult.status)) console.info("Synchronisation Wilf :", syncResult);
    } catch (error) {
        console.error("Impossible de synchroniser les données au démarrage :", error);
    }

    try {
        appSettings = await loadAppSettings();
    } catch (error) {
        console.error("Impossible de charger les paramètres :", error);
        appSettings = createDefaultAppSettings();
    }

    applyAppTheme(appSettings.theme);

    try {
        const storedPlans = await loadPlans(exercises);
        plans.splice(0, plans.length, ...storedPlans);
    } catch (error) {
        console.error("Impossible de charger les plans sauvegardés :", error);
    }

    try {
        workoutHistory = await loadWorkoutHistory();
        setWorkoutHistory(workoutHistory);
    } catch (error) {
        console.error("Impossible de charger l'historique :", error);
        workoutHistory = [];
        setWorkoutHistory([]);
    }

    equipmentOptions.forEach(equipment => {
        selectedEquipment.add(equipment);
        selectedPlanEquipment.add(equipment);

        searchPageState.equipment.add(equipment);
        planSearchState.equipment.add(equipment);
    });

    getCategoryOptions().forEach(category => {
        selectedCategories.add(category);
        selectedPlanCategories.add(category);

        searchPageState.categories.add(category);
        planSearchState.categories.add(category);
    });

    createPlanFilterRows();
    planAutoExcludeProgressions.addEventListener(
    "change",
    saveCurrentPlanFilters
    );

    createMuscleButtons();
    createEquipmentButtons();
    setupEquipmentAllButton();
    setupTypeButtons();
    setupCategoryButtons();
    createProgressionOptions();
    setupFilterRows();

    setupSettingsController();
    await setupTimerNotifications();
    await setupStorageSyncController();
    setupStorageTargetSync();
    await setupSyncLifecycle();
    window.inspectWilfStorageSync = inspectStorageSync;
    window.inspectWilfAutoPlanData = inspectWilfAutoPlanData;
    window.inspectWilfAutoPlanCandidates = inspectWilfAutoPlanCandidates;
    window.inspectWilfAutoPlanScores = inspectWilfAutoPlanScores;
    window.inspectWilfAutoPlanWorkout = inspectWilfAutoPlanWorkout;
    setupDefaultPlanFilters();
    setupPlanDefaultInputs();
    setupWorkoutSummary();
    setupWorkoutExecution();
    setupHistoryController();
    setupExerciseHistoryController();
    setupAutoPlanController();
    setupPlanController();
    setupPlanPdf();
    setupBackupControls();
    setupAppController();

    displayExercises();
}

initializeApp();