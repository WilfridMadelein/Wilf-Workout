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

// ------------------------------------------------------------
// DOM — Paramètres du plan
// ------------------------------------------------------------

export const planSetsInput = document.getElementById("plan-sets");
export const planRepsInput = document.getElementById("plan-reps");
export const planTimeInput = document.getElementById("plan-time");
export const planRestInput = document.getElementById("plan-rest");

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
export const planHome = document.getElementById("plan-home");
export const plansList = document.getElementById("plans-list");
export const planEditor = document.getElementById("plan-editor");
export const currentPlanName = document.getElementById("current-plan-name");
export const editPlanNameButton = document.getElementById("edit-plan-name-button");
export const currentPlanNameInput = document.getElementById("current-plan-name-input");
export const backToPlansButton = document.getElementById("back-to-plans-button");
export const planAutoExcludeProgressions = document.getElementById("plan-auto-exclude-progressions");

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