import { BODY_PART_ORDER } from "./workout-constraint.js";
import { getPrescriptionDurationSeconds } from "./time-estimator.js";

// ============================================================
// COMPOSITION DES SUPER-SETS
// ============================================================

const AUTO_PLAN_MAX_MULTI_SET_SIZE = 4;
const AUTO_PLAN_SOMETIMES_MAX_RATIO = 0.6;

function getStage(bodyPart) {
    return Number.isFinite(BODY_PART_ORDER[bodyPart]) ? BODY_PART_ORDER[bodyPart] : null;
}

function getStagePositions(exercises = []) {
    const stages = [...new Set(exercises.map(item => getStage(item.compositionBodyPart)).filter(stage => stage !== null))].sort((a, b) => a - b);
    return new Map(stages.map((stage, index) => [stage, index]));
}

function isCompatibleGroup(items = [], stagePositions = new Map()) {
    if (items.length < 2) return true;

    const positions = [...new Set(items.map(item => stagePositions.get(getStage(item.compositionBodyPart))).filter(position => Number.isInteger(position)))].sort((a, b) => a - b);
    if (!positions.length || positions.length > items.length) return false;

    for (let index = 1; index < positions.length; index += 1) {
        if (positions[index] - positions[index - 1] > 1) return false;
    }

    return true;
}

function shuffle(values, random) {
    const result = [...values];

    for (let index = result.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [result[index], result[target]] = [result[target], result[index]];
    }

    return result;
}

function createSometimesGroups(exercises, stagePositions, random) {
    const maximumSupersetExercises = Math.floor(exercises.length * AUTO_PLAN_SOMETIMES_MAX_RATIO / 2) * 2;
    const maximumPairs = Math.floor(maximumSupersetExercises / 2);
    if (!maximumPairs) return exercises.map(item => [item]);

    const starts = exercises.slice(0, -1).map((_, index) => index)
        .filter(index => isCompatibleGroup(exercises.slice(index, index + 2), stagePositions));
    if (!starts.length) return exercises.map(item => [item]);

    const targetPairs = 1 + Math.floor(random() * maximumPairs);
    const selectedStarts = new Set();
    const used = new Set();

    shuffle(starts, random).some(index => {
        if (used.has(index) || used.has(index + 1)) return false;
        selectedStarts.add(index);
        used.add(index);
        used.add(index + 1);
        return selectedStarts.size >= targetPairs;
    });

    const groups = [];
    for (let index = 0; index < exercises.length; index += 1) {
        if (selectedStarts.has(index)) {
            groups.push(exercises.slice(index, index + 2));
            index += 1;
        } else {
            groups.push([exercises[index]]);
        }
    }

    return groups;
}

function createAlwaysGroups(exercises, stagePositions, random) {
    const memo = new Map();

    function solve(index) {
        if (index >= exercises.length) return { score: 0, groups: [] };
        if (memo.has(index)) return memo.get(index);

        let best = null;
        const maximumSize = Math.min(AUTO_PLAN_MAX_MULTI_SET_SIZE, exercises.length - index);

        for (let size = 1; size <= maximumSize; size += 1) {
            const group = exercises.slice(index, index + size);
            if (size > 1 && !isCompatibleGroup(group, stagePositions)) continue;

            const next = solve(index + size);
            const groupedExercises = size > 1 ? size : 0;
            const score = next.score + groupedExercises * 100 + (size > 1 ? size * 3 : -25) + random() * 0.01;
            const candidate = { score, groups: [group, ...next.groups] };
            if (!best || candidate.score > best.score) best = candidate;
        }

        memo.set(index, best);
        return best;
    }

    return solve(0)?.groups ?? exercises.map(item => [item]);
}

function resolveSupersetMode(preference, random) {
    if (["none", "sometimes", "always"].includes(preference)) return preference;

    const roll = random();
    if (roll < 0.3) return "none";
    if (roll < 0.85) return "sometimes";
    return "always";
}

function normalizeGroupSets(group) {
    if (group.length < 2) return group.map(item => ({ ...item, prescription: { ...item.prescription, tempo: { ...item.prescription.tempo } } }));

    const groupSets = Math.min(...group.map(item => Math.max(1, Number(item.prescription?.sets) || 1)));
    return group.map(item => ({
        ...item,
        prescription: { ...item.prescription, sets: groupSets, tempo: { ...item.prescription.tempo } }
    }));
}

function createCompositionResult(groups, requestedPreference, appliedMode) {
    let combinationGroup = 0;
    const exercises = [];
    const setGroups = [];

    groups.forEach(group => {
        combinationGroup += 1;
        const normalized = normalizeGroupSets(group);
        const isSuperset = normalized.length > 1;

        normalized.forEach(item => exercises.push({
            ...item,
            combinationGroup,
            combinationSize: normalized.length,
            isSuperset,
            estimatedDurationSeconds: getPrescriptionDurationSeconds(item.prescription)
        }));

        setGroups.push({
            group: combinationGroup,
            size: normalized.length,
            isSuperset,
            bodyParts: normalized.map(item => item.compositionBodyPart),
            exerciseNames: normalized.map(item => item.candidate.exerciseName)
        });
    });

    const supersetGroups = setGroups.filter(group => group.isSuperset);
    const supersetExerciseCount = supersetGroups.reduce((total, group) => total + group.size, 0);

    return {
        exercises,
        groups: setGroups,
        requestedPreference,
        appliedMode,
        supersetGroupCount: supersetGroups.length,
        supersetExerciseCount,
        supersetRatio: exercises.length ? supersetExerciseCount / exercises.length : 0
    };
}

function composeWorkoutSupersets(exercises = [], preference = "indifferent", { random = Math.random } = {}) {
    const ordered = [...exercises];
    const appliedMode = resolveSupersetMode(preference, random);
    const stagePositions = getStagePositions(ordered);
    let groups;

    if (appliedMode === "none") groups = ordered.map(item => [item]);
    else if (appliedMode === "sometimes") groups = createSometimesGroups(ordered, stagePositions, random);
    else groups = createAlwaysGroups(ordered, stagePositions, random);

    return createCompositionResult(groups, preference, appliedMode);
}

export {
    AUTO_PLAN_MAX_MULTI_SET_SIZE,
    AUTO_PLAN_SOMETIMES_MAX_RATIO,
    getStagePositions,
    isCompatibleGroup,
    resolveSupersetMode,
    composeWorkoutSupersets
};
