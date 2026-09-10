let searchInput;
let pageExercises;
let pagePlans;
let exerciseBrowser;
let planExerciseBrowserContainer;

let tabExercises;
let tabPlans;

let planHome;
let renderPlansList;
let planEditor;

let removeAddButton;
let displayExercises;
let rebuildSearchFilterInterface;

let selectedTypes;
let selectedProgressionsInclude;
let selectedProgressionsExclude;
let selectedMuscleFamilies;
let selectedSubmuscles;
let selectedEquipment;
let selectedCategories;

let searchPageState;
let planSearchState;

let setCurrentDetailContext;

export function configureAppController(dependencies) {
    ({
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
    } = dependencies);
}

function cloneSubmuscles(source) {
    const result = new Map();

    source.forEach((submuscles, family) => {
        result.set(family, new Set(submuscles));
    });

    return result;
}

export function saveSearchState(state) {
    state.search = searchInput.value;

    state.types = new Set(selectedTypes);
    state.progressionsInclude =
        new Set(selectedProgressionsInclude);
    state.progressionsExclude =
        new Set(selectedProgressionsExclude);
    state.muscleFamilies =
        new Set(selectedMuscleFamilies);
    state.submuscles =
        cloneSubmuscles(selectedSubmuscles);
    state.equipment =
        new Set(selectedEquipment);
    state.categories =
        new Set(selectedCategories);
}

export function loadSearchState(state) {
    searchInput.value = state.search;

    selectedTypes.clear();
    state.types.forEach(type => {
        selectedTypes.add(type);
    });

    selectedProgressionsInclude.clear();
    state.progressionsInclude.forEach(progression => {
        selectedProgressionsInclude.add(progression);
    });

    selectedProgressionsExclude.clear();
    state.progressionsExclude.forEach(progression => {
        selectedProgressionsExclude.add(progression);
    });

    selectedMuscleFamilies.clear();
    state.muscleFamilies.forEach(family => {
        selectedMuscleFamilies.add(family);
    });

    selectedSubmuscles.clear();
    state.submuscles.forEach((submuscles, family) => {
        selectedSubmuscles.set(
            family,
            new Set(submuscles)
        );
    });

    selectedEquipment.clear();
    state.equipment.forEach(equipment => {
        selectedEquipment.add(equipment);
    });

    selectedCategories.clear();
    state.categories.forEach(category => {
        selectedCategories.add(category);
    });

    rebuildSearchFilterInterface();
}

export function setupAppController() {
    searchInput.addEventListener(
        "input",
        displayExercises
    );

    tabExercises.addEventListener("click", () => {
        saveSearchState(planSearchState);

        pageExercises.style.display = "block";
        pagePlans.style.display = "none";

        pageExercises
            .querySelector("#exercise-browser-container")
            .appendChild(exerciseBrowser);

        exerciseBrowser.style.display = "block";

        loadSearchState(searchPageState);

        tabExercises.classList.add("active");
        tabPlans.classList.remove("active");

        setCurrentDetailContext("search");

        removeAddButton();

        displayExercises();
    });

tabPlans.addEventListener("click", () => {
    saveSearchState(searchPageState);

    pageExercises.style.display = "none";
    pagePlans.style.display = "block";

    planEditor.style.display = "none";
    planHome.style.display = "block";

    renderPlansList();

    tabExercises.classList.remove("active");
    tabPlans.classList.add("active");

    setCurrentDetailContext("search");
});
}