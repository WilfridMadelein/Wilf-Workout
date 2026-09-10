import {
    setupNumberInput,
    updateNumberInputWidth
} from "../ui/ui.js";

let getCurrentPlan;
let setCurrentPlan;

let newPlanButton;
let planHome;
let plansList;
let planEditor;
let currentPlanName;
let backToPlansButton;
let plans;
let editPlanNameButton;
let currentPlanNameInput;

let planSetsInput;
let planRepsInput;
let planTimeInput;
let planRestInput;
let planTempoInputs;

let planExerciseBrowserContainer;
let exerciseBrowser;

let getPlanSearchState;
let loadSearchState;
let displayExercises;
let renderPlanExercises;

let setCurrentDetailExercise;
let setCurrentDetailContext;

export function configurePlanController(dependencies) {
    ({
        getCurrentPlan,
        setCurrentPlan,

        newPlanButton,
        plans,
        planHome,
        plansList,
        planEditor,
        currentPlanName,
        editPlanNameButton,
        currentPlanNameInput,
        backToPlansButton,

        planSetsInput,
        planRepsInput,
        planTimeInput,
        planRestInput,
        planTempoInputs,

        planExerciseBrowserContainer,
        exerciseBrowser,

        getPlanSearchState,
        loadSearchState,
        displayExercises,
        renderPlanExercises,

        setCurrentDetailExercise,
        setCurrentDetailContext
    } = dependencies);
}

export function ensurePlanDefaults(plan) {
    if (!plan.defaults) {
        plan.defaults = {};
    }

    if (plan.defaults.sets == null) {
        plan.defaults.sets = 3;
    }

    if (plan.defaults.reps == null) {
        plan.defaults.reps = 10;
    }

    if (plan.defaults.time == null) {
        plan.defaults.time = 30;
    }

    if (plan.defaults.rest == null) {
        plan.defaults.rest = 60;
    }

    if (!plan.defaults.tempo) {
        plan.defaults.tempo = {};
    }

    if (
        plan.defaults.tempo.first == null ||
        plan.defaults.tempo.first === ""
    ) {
        plan.defaults.tempo.first = 3;
    }

    if (
        plan.defaults.tempo.second == null ||
        plan.defaults.tempo.second === ""
    ) {
        plan.defaults.tempo.second = 0;
    }

    if (
        plan.defaults.tempo.third == null ||
        plan.defaults.tempo.third === ""
    ) {
        plan.defaults.tempo.third = 1;
    }

    if (
        plan.defaults.tempo.fourth == null ||
        plan.defaults.tempo.fourth === ""
    ) {
        plan.defaults.tempo.fourth = 0;
    }
}

export function loadPlanDefaultsIntoInputs() {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) return;

    ensurePlanDefaults(currentPlan);

    planSetsInput.value = currentPlan.defaults.sets;
    planRepsInput.value = currentPlan.defaults.reps;
    planTimeInput.value = currentPlan.defaults.time;
    planRestInput.value = currentPlan.defaults.rest;

const tempoValues = [
    currentPlan.defaults.tempo.first,
    currentPlan.defaults.tempo.second,
    currentPlan.defaults.tempo.third,
    currentPlan.defaults.tempo.fourth
];

planTempoInputs.forEach((input, index) => {
    const value = tempoValues[index];
    const usesX = index === 0 || index === 2;

    input.value =
        usesX && value === 0
            ? "X"
            : value;
});

[
    planSetsInput,
    planRepsInput,
    planTimeInput,
    planRestInput,
    ...planTempoInputs
].forEach(input => {
    updateNumberInputWidth(
        input,
        Number(
            input.dataset.minChars
        ) || 3
    );
});

}

export function setupPlanDefaultInputs() {

    const bind = (
        input,
        options,
        save
    ) => {
        const control =
            setupNumberInput(input, {
                ...options,

                onChange: value => {
                    const plan =
                        getCurrentPlan();

                    if (!plan) return;

                    save(
                        plan.defaults,
                        value
                    );
                }
            });

        input
            .closest(
                ".plan-default-number-control"
            )
            ?.querySelectorAll(
                "[data-direction]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        control.step(
                             Number(button.dataset.direction),
                                options.snapStep === true
                        );
                    }
                );
            });
    };


    bind(
        planSetsInput,
        {
            min: 1,
            max: 999,
            step: 1,
            minChars: 3
        },
        (defaults, value) =>
            defaults.sets = value
    );

    bind(
        planRepsInput,
        {
            min: 1,
            max: 999,
            step: 1,
            minChars: 3
        },
        (defaults, value) =>
            defaults.reps = value
    );

    bind(
        planTimeInput,
        {
            min: 1,
            max: 999,
            step: 15,
            minChars: 3,
            snapStep: true
        },
        (defaults, value) =>
            defaults.time = value
    );

    bind(
        planRestInput,
        {
            min: 0,
            max: 999,
            step: 15,
            minChars: 3,
            snapStep: true
        },
        (defaults, value) =>
            defaults.rest = value
    );


    const tempoKeys = [
        "first",
        "second",
        "third",
        "fourth"
    ];

    planTempoInputs.forEach(
        (input, index) => {
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
                    defaults.tempo[
                        tempoKeys[index]
                    ] = value
            );
        }
    );
}


// ------------------------------------------------------------
// Résumé d'un plan
// ------------------------------------------------------------

function getPlanSetCount(plan) {
    return new Set(
        plan.exercises
            .map(item => item.combination?.group)
            .filter(Number.isInteger)
    ).size;
}

function getPlanPrimaryMuscles(plan) {
    const muscles = new Set();

    plan.exercises.forEach(planExercise => {
        planExercise.exercise?.muscles_principaux
            ?.forEach(([family]) => {
                if (family) {
                    muscles.add(family);
                }
            });
    });

    return [...muscles];
}


// ------------------------------------------------------------
// Ouvrir un plan
// ------------------------------------------------------------

function openPlan(plan) {
    setCurrentPlan(plan);
    ensurePlanDefaults(plan);

    planHome.style.display = "none";
    planEditor.style.display = "block";

    currentPlanName.textContent = plan.name;
    currentPlanName.hidden = false;

    currentPlanNameInput.value = plan.name;
    currentPlanNameInput.hidden = true;

    loadPlanDefaultsIntoInputs();
    renderPlanExercises();

    planExerciseBrowserContainer.appendChild(
        exerciseBrowser
    );

    exerciseBrowser.style.display = "block";

    loadSearchState(
        getPlanSearchState()
    );

    displayExercises();
}


// ------------------------------------------------------------
// Liste des plans
// ------------------------------------------------------------

export function renderPlansList() {
    plansList.replaceChildren();

    plans.forEach(plan => {
        const card =
            document.createElement("button");

        card.type = "button";
        card.classList.add("plan-card");

        const exerciseCount =
            plan.exercises.length;

        const setCount =
            getPlanSetCount(plan);

        const muscles =
            getPlanPrimaryMuscles(plan);


        const title =
            document.createElement("span");

        title.classList.add(
            "plan-card-title"
        );

        title.textContent = plan.name;


        const exercises =
            document.createElement("span");

        exercises.classList.add(
            "plan-card-info"
        );

        exercises.textContent =
            `${exerciseCount} exercice${exerciseCount !== 1 ? "s" : ""}`;


        const sets =
            document.createElement("span");

        sets.classList.add(
            "plan-card-info"
        );

        sets.textContent =
            `${setCount} set${setCount !== 1 ? "s" : ""}`;


        const muscleList =
            document.createElement("span");

        muscleList.classList.add(
            "plan-card-muscles"
        );

        muscleList.textContent =
            muscles.length > 0
                ? muscles.join(", ")
                : "Aucun muscle principal";


        card.append(
            title,
            exercises,
            sets,
            muscleList
        );

        card.addEventListener(
            "click",
            () => openPlan(plan)
        );

        plansList.appendChild(card);
    });
}


// ------------------------------------------------------------
// Modifier le nom
// ------------------------------------------------------------

function startPlanNameEditing() {
    const plan = getCurrentPlan();

    if (!plan) return;

    currentPlanNameInput.value =
        plan.name;

    currentPlanName.hidden = true;
    currentPlanNameInput.hidden = false;

    currentPlanNameInput.focus();
    currentPlanNameInput.select();
}

function finishPlanNameEditing() {
    const plan = getCurrentPlan();

    if (
        !plan ||
        currentPlanNameInput.hidden
    ) {
        return;
    }

    const name =
        currentPlanNameInput.value.trim();

    if (name) {
        plan.name = name;
    }

    currentPlanName.textContent =
        plan.name;

    currentPlanNameInput.hidden = true;
    currentPlanName.hidden = false;

    renderPlansList();
}

export function setupPlanController() {

    newPlanButton.addEventListener(
        "click",
        () => {
            const plan = {
                id: Date.now(),
                name: `Plan ${plans.length + 1}`,
                defaults: {},
                exercises: []
            };

            ensurePlanDefaults(plan);

            plans.push(plan);

            renderPlansList();
            openPlan(plan);
        }
    );


    editPlanNameButton.addEventListener(
        "click",
        startPlanNameEditing
    );

    currentPlanName.addEventListener(
        "click",
        startPlanNameEditing
    );


    currentPlanNameInput.addEventListener(
        "blur",
        finishPlanNameEditing
    );

    currentPlanNameInput.addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                event.preventDefault();
                currentPlanNameInput.blur();
            }

            if (event.key === "Escape") {
                event.preventDefault();

                currentPlanNameInput.value =
                    getCurrentPlan()?.name ?? "";

                currentPlanNameInput.blur();
            }
        }
    );


    backToPlansButton.addEventListener(
        "click",
        () => {
            finishPlanNameEditing();

            planEditor.style.display = "none";
            planHome.style.display = "block";

            renderPlansList();

            setCurrentDetailExercise(null);
            setCurrentDetailContext("search");
        }
    );
}