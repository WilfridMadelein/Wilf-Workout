// ============================================================
// COMBINAISONS / SETS
// ============================================================

let getCurrentPlan = () => null;
let renderPlanExercises = () => {};

function configurePlanCombinations(dependencies) {
    getCurrentPlan = dependencies.getCurrentPlan;
    renderPlanExercises = dependencies.renderPlanExercises;
}

// ------------------------------------------------------------
// Numéro du prochain Set
// ------------------------------------------------------------

function getNextCombinationGroup() {
    const currentPlan = getCurrentPlan();

    if (!currentPlan || currentPlan.exercises.length === 0) {
        return 1;
    }

    const groups = currentPlan.exercises
        .map(planExercise => planExercise.combination?.group)
        .filter(group => Number.isInteger(group));

    if (groups.length === 0) {
        return 1;
    }

    return Math.max(...groups) + 1;
}

// ------------------------------------------------------------
// Liste des Sets dans leur ordre actuel
// ------------------------------------------------------------

function getCombinationGroups() {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return [];
    }

    const groups = [];

    currentPlan.exercises.forEach(planExercise => {
        const group = planExercise.combination?.group;

        if (
            !Number.isInteger(group) ||
            groups.includes(group)
        ) {
            return;
        }

        groups.push(group);
    });

    return groups;
}

// ------------------------------------------------------------
// Renumérotation des Sets
// ------------------------------------------------------------

function normalizeCombinationNumbers() {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return;
    }

    const groups = getCombinationGroups();
    const groupMapping = new Map();

    groups.forEach((group, index) => {
        groupMapping.set(group, index + 1);
    });

    currentPlan.exercises.forEach(planExercise => {
        const oldGroup =
            planExercise.combination?.group;

        if (groupMapping.has(oldGroup)) {
            planExercise.combination.group =
                groupMapping.get(oldGroup);
        }
    });
}

// ------------------------------------------------------------
// Déplacer un exercice vers un autre Set
// ------------------------------------------------------------

function moveExerciseToCombination(
    planExercise,
    targetGroup
) {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return;
    }

    const exercises = currentPlan.exercises;
    const currentIndex =
        exercises.indexOf(planExercise);

    if (currentIndex === -1) {
        return;
    }

    const currentGroup =
        planExercise.combination?.group;

    if (currentGroup === targetGroup) {
        return;
    }

    exercises.splice(currentIndex, 1);

    planExercise.combination.group =
        targetGroup;

    let insertIndex = -1;

    for (let i = 0; i < exercises.length; i++) {
        if (
            exercises[i].combination?.group ===
            targetGroup
        ) {
            insertIndex = i;
        }
    }

    if (insertIndex === -1) {
        exercises.push(planExercise);
    } else {
        exercises.splice(
            insertIndex + 1,
            0,
            planExercise
        );
    }

    normalizeCombinationNumbers();
    renderPlanExercises();
}

// ------------------------------------------------------------
// Créer un nouveau Set avec un exercice
// ------------------------------------------------------------

function moveExerciseToNewCombination(
    planExercise
) {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return;
    }

    const exercises = currentPlan.exercises;
    const currentIndex =
        exercises.indexOf(planExercise);

    if (currentIndex === -1) {
        return;
    }

    exercises.splice(currentIndex, 1);

    const newGroup =
        getNextCombinationGroup();

    planExercise.combination.group =
        newGroup;

    exercises.splice(
        currentIndex,
        0,
        planExercise
    );

    normalizeCombinationNumbers();
    renderPlanExercises();
}

// ------------------------------------------------------------
// Sets disponibles
// ------------------------------------------------------------

function getAvailableCombinationGroups() {
    return getCombinationGroups().sort(
        (a, b) => a - b
    );
}

// ------------------------------------------------------------
// Menu de changement de Set
// ------------------------------------------------------------

function openCombinationMenu(
    planExercise,
    button
) {
    if (!getCurrentPlan()) {
        return;
    }

    document
        .querySelectorAll(".combination-menu")
        .forEach(menu => menu.remove());

    const menu =
        document.createElement("div");

    menu.classList.add(
        "combination-menu"
    );

    const label =
        document.createElement("div");

    label.textContent =
        "Ajouter à :";

    label.classList.add(
        "combination-menu-label"
    );

    menu.appendChild(label);

    const select =
        document.createElement("select");

    select.classList.add(
        "combination-select"
    );

    const newOption =
        document.createElement("option");

    newOption.value = "new";
    newOption.textContent =
        "Nouveau Set";

    select.appendChild(newOption);

    getAvailableCombinationGroups()
        .forEach(group => {
            if (
                group ===
                planExercise.combination.group
            ) {
                return;
            }

            const option =
                document.createElement("option");

            option.value = group;
            option.textContent =
                `Set ${group}`;

            select.appendChild(option);
        });

    menu.appendChild(select);
    button.parentElement.appendChild(menu);

    select.addEventListener(
        "change",
        () => {
            if (select.value === "new") {
                moveExerciseToNewCombination(
                    planExercise
                );
            } else {
                moveExerciseToCombination(
                    planExercise,
                    Number(select.value)
                );
            }

            menu.remove();
        }
    );
}

// ------------------------------------------------------------
// Déplacer un exercice dans son Set
// ------------------------------------------------------------

function moveExerciseWithinCombination(
    planExercise,
    direction
) {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return;
    }

    const exercises =
        currentPlan.exercises;

    const index =
        exercises.indexOf(planExercise);

    if (index === -1) {
        return;
    }

    const group =
        planExercise.combination?.group;

    if (!Number.isInteger(group)) {
        return;
    }

    const sameGroupIndexes = [];

    exercises.forEach((item, i) => {
        if (
            item.combination?.group ===
            group
        ) {
            sameGroupIndexes.push(i);
        }
    });

    const position =
        sameGroupIndexes.indexOf(index);

    const targetPosition =
        position + direction;

    if (
        position === -1 ||
        targetPosition < 0 ||
        targetPosition >=
            sameGroupIndexes.length
    ) {
        return;
    }

    const targetIndex =
        sameGroupIndexes[targetPosition];

    [
        exercises[index],
        exercises[targetIndex]
    ] = [
        exercises[targetIndex],
        exercises[index]
    ];

    renderPlanExercises();
}

// ------------------------------------------------------------
// Déplacer un Set complet
// ------------------------------------------------------------

function moveCombination(
    group,
    direction
) {
    const currentPlan = getCurrentPlan();

    if (!currentPlan) {
        return;
    }

    const groups =
        getCombinationGroups();

    const groupPosition =
        groups.indexOf(group);

    const targetGroupPosition =
        groupPosition + direction;

    if (
        groupPosition === -1 ||
        targetGroupPosition < 0 ||
        targetGroupPosition >=
            groups.length
    ) {
        return;
    }

    // Nouvel ordre des Sets
    const reorderedGroups =
        [...groups];

    [
        reorderedGroups[groupPosition],
        reorderedGroups[targetGroupPosition]
    ] = [
        reorderedGroups[targetGroupPosition],
        reorderedGroups[groupPosition]
    ];

    // Regrouper les exercices par Set
    const exercisesByGroup =
        new Map();

    groups.forEach(currentGroup => {
        exercisesByGroup.set(
            currentGroup,
            currentPlan.exercises.filter(
                planExercise =>
                    planExercise
                        .combination
                        ?.group === currentGroup
            )
        );
    });

    // Reconstruire le tableau dans
    // le nouvel ordre des Sets
    const reorderedExercises =
        reorderedGroups.flatMap(
            currentGroup =>
                exercisesByGroup.get(
                    currentGroup
                ) || []
        );

    // Conserver le même tableau
    // pour ne pas casser les références
    currentPlan.exercises.splice(
        0,
        currentPlan.exercises.length,
        ...reorderedExercises
    );

    // Set 1, Set 2, Set 3...
    normalizeCombinationNumbers();

    renderPlanExercises();
}

// ============================================================
// EXPORTS
// ============================================================

export {
    configurePlanCombinations,
    getNextCombinationGroup,
    getCombinationGroups,
    normalizeCombinationNumbers,
    moveExerciseToCombination,
    moveExerciseToNewCombination,
    getAvailableCombinationGroups,
    openCombinationMenu,
    moveExerciseWithinCombination,
    moveCombination
};