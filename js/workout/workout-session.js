import { isIsometricExercise } from "../exercises/exercise-search.js";

import {
    getExerciseSplitType,
    normalizeSplitOrder
} from "../exercises/exercise-split.js";

// ============================================================
// OUTILS
// ============================================================

function createWorkoutId(prefix) {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    return `${prefix}-${id}`;
}

function cloneTempo(tempo = {}) {
    return {
        first: tempo.first ?? 0,
        second: tempo.second ?? 0,
        third: tempo.third ?? 0,
        fourth: tempo.fourth ?? 0
    };
}

// ============================================================
// SÉRIES
// ============================================================

function createWorkoutSeries(workoutExercise, number) {
    return {
        id: createWorkoutId("series"),
        number,
        value: workoutExercise.value,
        valueUnit: workoutExercise.valueUnit,
        weight: workoutExercise.weight,
        weightUnit: workoutExercise.weightUnit,
        tempo: cloneTempo(workoutExercise.tempo),
        rest: workoutExercise.rest,
        logs: {}
    };
}

function clonePendingSeries(series) {
    return {
        id: createWorkoutId("series"),
        number: series.number,
        value: series.value,
        valueUnit: series.valueUnit,
        weight: series.weight,
        weightUnit: series.weightUnit,
        tempo: cloneTempo(series.tempo),
        rest: series.rest,
        logs: {}
    };
}

function renumberWorkoutSeries(workoutExercise) {
    workoutExercise.series.forEach((series, index) => {
        series.number = index + 1;
    });
}

function addWorkoutSeries(workoutExercise) {
    const series = createWorkoutSeries(
        workoutExercise,
        workoutExercise.series.length + 1
    );

    workoutExercise.series.push(series);
    return series;
}

function removeWorkoutSeries(workoutExercise, seriesId) {
    const index = workoutExercise.series.findIndex(
        series => series.id === seriesId
    );

    if (index === -1) return false;

    workoutExercise.series.splice(index, 1);
    renumberWorkoutSeries(workoutExercise);

    return true;
}

// ============================================================
// EXERCICES
// ============================================================

function createWorkoutExercise(planExercise, planExerciseIndex) {
    const workoutExercise = {
        id: createWorkoutId("exercise"),
        sourcePlanExerciseIndex: planExerciseIndex,

        exercise: planExercise.exercise,
        splitType: getExerciseSplitType(planExercise.exercise),
        splitOrder: normalizeSplitOrder(planExercise.splitOrder),

        value: planExercise.value,
        valueUnit: planExercise.valueUnit,
        weight: planExercise.weight,
        weightUnit: planExercise.weightUnit,
        tempo: cloneTempo(planExercise.tempo),
        rest: planExercise.rest,

        splitRest: planExercise.rest,

        instructions: planExercise.details?.instructions ?? "",
        series: []
    };

    const seriesCount = Math.max(
        0,
        Math.floor(Number(planExercise.sets) || 0)
    );

    for (let index = 0; index < seriesCount; index += 1) {
        workoutExercise.series.push(
            createWorkoutSeries(workoutExercise, index + 1)
        );
    }

    return workoutExercise;
}

// ============================================================
// SESSION
// ============================================================

function createWorkoutSession(plan) {
    const sets = [];

    plan.exercises.forEach((planExercise, planExerciseIndex) => {
        const group = planExercise.combination?.group ?? 1;

        let set = sets.find(item => item.group === group);

        if (!set) {
            set = {
                id: createWorkoutId("set"),
                group,
                exercises: []
            };

            sets.push(set);
        }

        set.exercises.push(
            createWorkoutExercise(
                planExercise,
                planExerciseIndex
            )
        );
    });

    return {
        id: createWorkoutId("workout"),
        planId: plan.id,
        planName: plan.name,

        startedAt: Date.now(),
        elapsedSeconds: 0,

        isPaused: false,
        pausedAt: null,
        totalPausedMs: 0,

        screen: "overview",

        defaults: {
            reps: plan.defaults?.reps ?? 10,
            time: plan.defaults?.time ?? 30
        },

        sets
    };
}

// ============================================================
// CÔTÉS
// ============================================================

function getWorkoutExerciseSides(workoutExercise) {
    if (workoutExercise.splitType !== "split") {
        return [{ key: "main", label: "" }];
    }

    if (workoutExercise.splitOrder === "right-left") {
        return [
            { key: "right", label: "Droite" },
            { key: "left", label: "Gauche" }
        ];
    }

    return [
        { key: "left", label: "Gauche" },
        { key: "right", label: "Droite" }
    ];
}

function getWorkoutSideLabel(sideKey) {
    if (sideKey === "left") return "Gauche";
    if (sideKey === "right") return "Droite";
    return "";
}

// ============================================================
// LOGS
// ============================================================

function getWorkoutSeriesLog(series, sideKey = "main") {
    return series.logs?.[sideKey] ?? null;
}

function hasWorkoutSeriesLogs(series) {
    return Object.keys(series.logs ?? {}).length > 0;
}

function hasWorkoutExerciseLogs(workoutExercise) {
    return workoutExercise.series.some(hasWorkoutSeriesLogs);
}

function isWorkoutSeriesCompleted(series, sideKey = "main") {
    return Boolean(
        getWorkoutSeriesLog(series, sideKey)?.completedAt
    );
}

function getWorkoutTargetValues(target) {
    const log = getWorkoutSeriesLog(
        target.series,
        target.sideKey
    );

    return {
        value: log?.value ?? target.series.value,
        valueUnit: log?.valueUnit ?? target.series.valueUnit,
        weight: log?.weight ?? target.series.weight,
        weightUnit: log?.weightUnit ?? target.series.weightUnit,
        tempo: cloneTempo(log?.tempo ?? target.series.tempo),
        rest: log?.rest ?? target.series.rest,
        notes: log?.notes ?? ""
    };
}

function saveWorkoutTargetLog(target, values) {
    target.series.logs[target.sideKey] = {
        value: values.value,
        valueUnit: values.valueUnit,
        weight: values.weight,
        weightUnit: values.weightUnit,
        tempo: cloneTempo(values.tempo),
        rest: values.rest,
        notes: values.notes ?? "",
        completedAt: Date.now()
    };
}

// ============================================================
// PROGRESSION
// ============================================================

function updateWorkoutExerciseProgression(
    workoutExercise,
    newExercise,
    defaults
) {
    const oldExercise = workoutExercise.exercise;
    const oldIsometric = isIsometricExercise(oldExercise);
    const newIsometric = isIsometricExercise(newExercise);

    workoutExercise.exercise = newExercise;
    workoutExercise.splitType =
        getExerciseSplitType(newExercise);

    if (!oldIsometric && newIsometric) {
        workoutExercise.value = defaults.time;
        workoutExercise.valueUnit = "sec";
    }

    if (oldIsometric && !newIsometric) {
        workoutExercise.value = defaults.reps;
        workoutExercise.valueUnit = "rep";
    }

    if (oldIsometric === newIsometric) return;

    workoutExercise.series.forEach(series => {
        if (hasWorkoutSeriesLogs(series)) return;

        series.value = workoutExercise.value;
        series.valueUnit = workoutExercise.valueUnit;
    });
}

function replacePendingSeriesProgression(
    set,
    workoutExercise,
    newExercise,
    defaults
) {
    const completedOrStarted = [];
    const pending = [];

    workoutExercise.series.forEach(series => {
        if (hasWorkoutSeriesLogs(series)) {
            completedOrStarted.push(series);
        } else {
            pending.push(series);
        }
    });

    workoutExercise.series = completedOrStarted;
    renumberWorkoutSeries(workoutExercise);

    const replacement = {
        ...workoutExercise,

        id: createWorkoutId("exercise"),
        series: pending.map(clonePendingSeries)
    };

    updateWorkoutExerciseProgression(
        replacement,
        newExercise,
        defaults
    );

    renumberWorkoutSeries(replacement);

    const index = set.exercises.indexOf(workoutExercise);

    set.exercises.splice(
        index + 1,
        0,
        replacement
    );

    return replacement;
}

// ============================================================
// ORDRE D'EXÉCUTION
// ============================================================

function getWorkoutTargets(session) {
    const targets = [];

    session.sets.forEach(set => {
        const maxSeries = Math.max(
            0,
            ...set.exercises.map(
                exercise => exercise.series.length
            )
        );

        for (
            let seriesIndex = 0;
            seriesIndex < maxSeries;
            seriesIndex += 1
        ) {
            set.exercises.forEach(workoutExercise => {
                const series =
                    workoutExercise.series[seriesIndex];

                if (!series) return;

                getWorkoutExerciseSides(
                    workoutExercise
                ).forEach(side => {
                    targets.push({
                        set,
                        workoutExercise,
                        series,
                        sideKey: side.key
                    });
                });
            });
        }
    });

    return targets;
}

function isSameWorkoutTarget(first, second) {
    return (
        first?.workoutExercise?.id ===
            second?.workoutExercise?.id &&
        first?.series?.id ===
            second?.series?.id &&
        first?.sideKey ===
            second?.sideKey
    );
}

function findFirstPendingWorkoutTarget(session) {
    return getWorkoutTargets(session).find(
        target =>
            !isWorkoutSeriesCompleted(
                target.series,
                target.sideKey
            )
    ) ?? null;
}

function findFirstPendingTargetInSet(session, setId) {
    return getWorkoutTargets(session).find(
        target =>
            target.set.id === setId &&
            !isWorkoutSeriesCompleted(
                target.series,
                target.sideKey
            )
    ) ?? null;
}

function findFirstPendingTargetInExercise(
    session,
    exerciseId
) {
    return getWorkoutTargets(session).find(
        target =>
            target.workoutExercise.id === exerciseId &&
            !isWorkoutSeriesCompleted(
                target.series,
                target.sideKey
            )
    ) ?? null;
}

function getNextPendingWorkoutTarget(
    session,
    currentTarget
) {
    const targets = getWorkoutTargets(session);

    const index = targets.findIndex(
        target =>
            isSameWorkoutTarget(
                target,
                currentTarget
            )
    );

    for (
        let offset = 1;
        offset <= targets.length;
        offset += 1
    ) {
        const target =
            targets[
                (index + offset) %
                targets.length
            ];

        if (
            !isWorkoutSeriesCompleted(
                target.series,
                target.sideKey
            )
        ) {
            return target;
        }
    }

    return null;
}

// ============================================================
// REPOS ENTRE DEUX TARGETS
// ============================================================

function getRestAfterWorkoutTarget(
    target,
    nextTarget,
    loggedValues
) {
    const workoutExercise =
        target.workoutExercise;

    if (
        workoutExercise.splitType === "split" &&
        nextTarget?.workoutExercise?.id ===
            workoutExercise.id &&
        nextTarget?.series?.id ===
            target.series.id
    ) {
        const sides =
            getWorkoutExerciseSides(
                workoutExercise
            );

        if (
            target.sideKey === sides[0]?.key &&
            nextTarget.sideKey === sides[1]?.key
        ) {
            return Math.max(
                0,
                Number(
                    workoutExercise.splitRest
                ) || 0
            );
        }
    }

    return Math.max(
        0,
        Number(loggedValues.rest) || 0
    );
}

export {
    createWorkoutSession,

    getWorkoutExerciseSides,
    getWorkoutSideLabel,

    addWorkoutSeries,
    removeWorkoutSeries,

    getWorkoutSeriesLog,
    hasWorkoutSeriesLogs,
    hasWorkoutExerciseLogs,
    isWorkoutSeriesCompleted,
    getWorkoutTargetValues,
    saveWorkoutTargetLog,

    updateWorkoutExerciseProgression,
    replacePendingSeriesProgression,

    findFirstPendingWorkoutTarget,
    findFirstPendingTargetInSet,
    findFirstPendingTargetInExercise,
    getNextPendingWorkoutTarget,

    getRestAfterWorkoutTarget
};