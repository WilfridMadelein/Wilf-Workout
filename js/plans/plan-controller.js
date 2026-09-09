import {
    setupNumberInput,
    updateNumberInputWidth
} from "../ui/ui.js";

let getCurrentPlan;
let setCurrentPlan;

let newPlanButton;
let createPlanButton;
let cancelPlanButton;
let planHome;
let planCreator;
let planNameInput;
let plansList;
let planEditor;
let currentPlanName;
let backToPlansButton;

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
        createPlanButton,
        cancelPlanButton,
        planHome,
        planCreator,
        planNameInput,
        plansList,
        planEditor,
        currentPlanName,
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
        plan.defaults.rest = 90;
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
        plan.defaults.tempo.second = 1;
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

    planTempoInputs[0].value =
        currentPlan.defaults.tempo.first;

    planTempoInputs[1].value =
        currentPlan.defaults.tempo.second;

    planTempoInputs[2].value =
        currentPlan.defaults.tempo.third;

    planTempoInputs[3].value =
        currentPlan.defaults.tempo.fourth;

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
                    minChars: 1
                },
                (defaults, value) =>
                    defaults.tempo[
                        tempoKeys[index]
                    ] = value
            );
        }
    );
}

export function setupPlanController() {
    newPlanButton.addEventListener("click", () => {
        planHome.style.display = "none";
        planCreator.style.display = "block";

        planNameInput.value = "";
        planNameInput.focus();
    });

    cancelPlanButton.addEventListener("click", () => {
        planCreator.style.display = "none";
        planHome.style.display = "block";
    });

    createPlanButton.addEventListener("click", () => {
        const planName =
            planNameInput.value.trim();

        if (planName === "") {
            alert("Veuillez entrer un nom de plan.");
            return;
        }

        const plan = {
            id: Date.now(),
            name: planName,

            defaults: {
                sets: 3,
                reps: 10,
                time: 30,
                rest: 90,

                tempo: {
                    first: 3,
                    second: 1,
                    third: 1,
                    fourth: 0
                }
            },

            exercises: []
        };

        plansList.innerHTML = `
            <div class="plan-card">
                <h3>${plan.name}</h3>
                <p>0 exercice</p>
                <button class="open-plan-button">
                    Ouvrir le plan
                </button>
            </div>
        `;

        const openPlanButton =
            plansList.querySelector(
                ".open-plan-button"
            );

        openPlanButton.addEventListener("click", () => {
            setCurrentPlan(plan);

            ensurePlanDefaults(plan);

            planHome.style.display = "none";
            planEditor.style.display = "block";

            currentPlanName.textContent =
                plan.name;

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
        });

        planCreator.style.display = "none";
        planHome.style.display = "block";
    });

    backToPlansButton.addEventListener("click", () => {
        planEditor.style.display = "none";
        planHome.style.display = "block";

        setCurrentDetailExercise(null);
        setCurrentDetailContext("search");
    });
}