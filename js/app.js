// ============================================================
// MODULES
// ============================================================

import {
    loadPlans,
    savePlanNow,
    schedulePlanSave,
    deletePlanFromStorage,
} from "./storage/plan-storage.js";

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

    tabExercises,
    tabPlans,
    pagePlans,

    planSetsInput,
    planRepsInput,
    planTimeInput,
    planRestInput,
    planTempoInputs,
    planAutoExcludeProgressions,
    planAutoAddEquipment,

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
    downloadPlansButton,
    planPdfModal,
    planPdfSelectionList,
    cancelPlanPdfButton,
    confirmPlanPdfButton,

    plans,
    editPlanNameButton,
    currentPlanNameInput,
    planHome,
    plansList,
    planEditor,
    currentPlanName,
    backToPlansButton,

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

    currentPlan,
    setCurrentPlan
} from "./app-state.js";

import {
    configureAppController,
    saveSearchState,
    loadSearchState,
    setupAppController
} from "./app-controller.js";

import {
    normalizeSearchText,
    getSearchTerms,
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
    updatePlanFilterSummaries
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
    addEquipmentToCurrentPlan
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


// ============================================================
// CONFIGURATION DES MODULES
// ============================================================

configurePlanCombinations({
    getCurrentPlan: () => currentPlan,
    renderPlanExercises,
    schedulePlanSave,
});

configurePlanManager({
    getCurrentPlan: () => currentPlan,

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

    normalizeCombinationNumbers,
    displayExerciseDetails,
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
    displayExercises,
    renderPlanExercises,

    updateEquipmentAllButton,
    updateFilterSummaries,
    updateProgressionNavigation,

    getRelevantEquipment,
    updateCategoryAllButton,
    updateEquipmentRelevance,

    getAutoAddEquipmentToPlan: () => planAutoAddEquipment.checked,
    addEquipmentToCurrentPlan
});

createPlanFilterRows();

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
});

configureExerciseDetails({
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
    setCurrentDetailContext
    
});

configurePlanPdf({
    plans,

    downloadPlansButton,
    planPdfModal,
    planPdfSelectionList,
    cancelPlanPdfButton,
    confirmPlanPdfButton,

    getPlanSetCount,
    getPlanPrimaryMuscles
});

configurePlanController({
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

planAutoAddEquipment,
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
getSelectedPlanEquipment: () => selectedPlanEquipment,

    planSetsInput,
    planRepsInput,
    planTimeInput,
    planRestInput,
    planTempoInputs,

    planExerciseBrowserContainer,
    exerciseBrowser,

    getPlanSearchState: () => planSearchState,
    loadSearchState,
    displayExercises,
    renderPlanExercises,

    setCurrentDetailExercise,
    setCurrentDetailContext,
    syncPlanAutoExcludedProgressions,

    savePlanNow,
    deletePlanFromStorage,
    schedulePlanSave,

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
    exerciseBrowser,
    planExerciseBrowserContainer,

    tabExercises,
    tabPlans,

    planHome,
    renderPlansList,
    planEditor,

    removeAddButton,
    displayExercises,
    rebuildSearchFilterInterface,

    selectedTypes,
    selectedProgressionsInclude,
    selectedProgressionsExclude,
    selectedMuscleFamilies,
    selectedSubmuscles,
    selectedEquipment,
    selectedCategories,

    searchPageState,
    planSearchState,

    setCurrentDetailContext
});

// ============================================================
// INITIALISATION
// ============================================================

async function initializeApp() {
    try {
        const storedPlans = await loadPlans(exercises);
        plans.splice(0, plans.length, ...storedPlans);
    } catch (error) {
        console.error("Impossible de charger les plans sauvegardés :", error);
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

    createMuscleButtons();
    createEquipmentButtons();
    setupEquipmentAllButton();
    setupTypeButtons();
    setupCategoryButtons();
    createProgressionOptions();
    setupFilterRows();

    setupPlanDefaultInputs();
    setupPlanController();
    setupPlanPdf();
    setupAppController();

    displayExercises();
}

initializeApp();