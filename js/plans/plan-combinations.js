// ============================================================
// COMBINAISONS / SETS
// ============================================================

function getNextCombinationGroup() {
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

function getCombinationGroups() {
    if (!currentPlan) {
        return [];
    }

    const groups = [];

    currentPlan.exercises.forEach(planExercise => {
        const group = planExercise.combination?.group;

        if (!Number.isInteger(group) || groups.includes(group)) {
            return;
        }

        groups.push(group);
    });

    return groups;
}

function normalizeCombinationNumbers() {
    if (!currentPlan) {
        return;
    }

    const groups = getCombinationGroups();
    const groupMapping = new Map();

    groups.forEach((group, index) => {
        groupMapping.set(group, index + 1);
    });

    currentPlan.exercises.forEach(planExercise => {
        const oldGroup = planExercise.combination?.group;

        if (groupMapping.has(oldGroup)) {
            planExercise.combination.group =
                groupMapping.get(oldGroup);
        }
    });
}

function moveExerciseToCombination(planExercise, targetGroup) {
    if (!currentPlan) {
        return;
    }

    const planExercises = currentPlan.exercises;
    const currentIndex = planExercises.indexOf(planExercise);

    if (currentIndex === -1) {
        return;
    }

    const currentGroup = planExercise.combination?.group;

    if (currentGroup === targetGroup) {
        return;
    }

    planExercises.splice(currentIndex, 1);
    planExercise.combination.group = targetGroup;

    let insertIndex = -1;

    for (let i = 0; i < planExercises.length; i++) {
        if (planExercises[i].combination?.group === targetGroup) {
            insertIndex = i;
        }
    }

    if (insertIndex === -1) {
        planExercises.push(planExercise);
    } else {
        planExercises.splice(insertIndex + 1, 0, planExercise);
    }

    normalizeCombinationNumbers();
    renderPlanExercises();
}

function moveExerciseToNewCombination(planExercise) {
    if (!currentPlan) {
        return;
    }

    const planExercises = currentPlan.exercises;
    const currentIndex = planExercises.indexOf(planExercise);

    if (currentIndex === -1) {
        return;
    }

    planExercises.splice(currentIndex, 1);

    const newGroup = getNextCombinationGroup();
    planExercise.combination.group = newGroup;

    planExercises.splice(currentIndex, 0, planExercise);

    normalizeCombinationNumbers();
    renderPlanExercises();
}

function getAvailableCombinationGroups() {
    return getCombinationGroups().sort(
        (a, b) => a - b
    );
}

function openCombinationMenu(planExercise, button) {
    if (!currentPlan) {
        return;
    }

    document
        .querySelectorAll(".combination-menu")
        .forEach(menu => menu.remove());

    const menu = document.createElement("div");
    menu.classList.add("combination-menu");

    const label = document.createElement("div");
    label.textContent = "Ajouter à :";
    label.classList.add("combination-menu-label");

    menu.appendChild(label);

    const select = document.createElement("select");
    select.classList.add("combination-select");

    const newOption = document.createElement("option");
    newOption.value = "new";
    newOption.textContent = "Nouveau Set";
    select.appendChild(newOption);

    getAvailableCombinationGroups().forEach(group => {
        if (group === planExercise.combination.group) {
            return;
        }

        const option = document.createElement("option");
        option.value = group;
        option.textContent = `Set ${group}`;

        select.appendChild(option);
    });

    menu.appendChild(select);
    button.parentElement.appendChild(menu);

    select.addEventListener("change", () => {
        if (select.value === "new") {
            moveExerciseToNewCombination(planExercise);
        } else {
            moveExerciseToCombination(
                planExercise,
                Number(select.value)
            );
        }

        menu.remove();
    });
}

function moveExerciseWithinCombination(planExercise, direction) {
    if (!currentPlan) {
        return;
    }

    const planExercises = currentPlan.exercises;
    const index = planExercises.indexOf(planExercise);

    if (index === -1) {
        return;
    }

    const group = planExercise.combination?.group;

    if (!Number.isInteger(group)) {
        return;
    }

    const sameGroupIndexes = [];

    planExercises.forEach((item, i) => {
        if (item.combination?.group === group) {
            sameGroupIndexes.push(i);
        }
    });

    const position = sameGroupIndexes.indexOf(index);
    const targetPosition = position + direction;

    if (
        position === -1 ||
        targetPosition < 0 ||
        targetPosition >= sameGroupIndexes.length
    ) {
        return;
    }

    const targetIndex = sameGroupIndexes[targetPosition];

    [planExercises[index], planExercises[targetIndex]] =
        [planExercises[targetIndex], planExercises[index]];

    renderPlanExercises();
}

function moveCombination(planExercise, direction) {
    if (!currentPlan) {
        return;
    }

    const planExercises = currentPlan.exercises;
    const group = planExercise.combination?.group;

    if (!Number.isInteger(group)) {
        return;
    }

    const groupIndexes = [];

    planExercises.forEach((item, index) => {
        if (item.combination?.group === group) {
            groupIndexes.push(index);
        }
    });

    if (groupIndexes.length === 0) {
        return;
    }

    const firstIndex = groupIndexes[0];
    const groups = getCombinationGroups();
    const groupPosition = groups.indexOf(group);
    const targetGroupPosition = groupPosition + direction;

    if (
        targetGroupPosition < 0 ||
        targetGroupPosition >= groups.length
    ) {
        return;
    }

    const targetGroup = groups[targetGroupPosition];
    const targetIndexes = [];

    planExercises.forEach((item, index) => {
        if (item.combination?.group === targetGroup) {
            targetIndexes.push(index);
        }
    });

    if (targetIndexes.length === 0) {
        return;
    }

    const targetFirstIndex = targetIndexes[0];
    const targetLastIndex =
        targetIndexes[targetIndexes.length - 1];

    const combinationExercises = planExercises.splice(
        firstIndex,
        groupIndexes.length
    );

    let insertIndex;

    if (direction === -1) {
        insertIndex = targetFirstIndex;
    } else {
        insertIndex =
            targetLastIndex -
            (firstIndex < targetFirstIndex
                ? groupIndexes.length
                : 0) +
            1;
    }

    planExercises.splice(
        insertIndex,
        0,
        ...combinationExercises
    );

    normalizeCombinationNumbers();
    renderPlanExercises();
}

// ============================================================
// EXPORTS
// ============================================================

export {
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