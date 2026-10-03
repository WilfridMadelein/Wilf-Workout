import {
    getProgressionId
} from "../exercises/exercise-search.js";

import {
    getWorkoutExerciseSides,
    getWorkoutSeriesLog
} from "../workout/workout-session.js";

import {
    getFailureCapacity
} from "./reserve-to-failure.js";

import {
    getLastWeightUnit,
    getRepresentativeWeight
} from "./weight-estimation.js";

// ============================================================
// ÉTAT D'UNE PROGRESSION
// ============================================================

function getProgressionIndex(exercise) {
    const value = Number(exercise?.prog_ordre);
    return Number.isFinite(value) ? value : null;
}

function getWorkoutExerciseHistoryEntries(workoutExercise) {
    const entries = [];

    workoutExercise.series?.forEach(series => {
        getWorkoutExerciseSides(workoutExercise).forEach(side => {
            const log = getWorkoutSeriesLog(series, side.key);
            if (!log?.completedAt) return;

            entries.push({
                seriesNumber: series.number,
                sideKey: side.key,
                sideLabel: side.label,
                log,
                failureCapacity: getFailureCapacity(log)
            });
        });
    });

    return entries;
}

function getProgressionOccurrences(workoutHistory = [], progressionId) {
    const id = String(progressionId || "").trim();
    if (!id) return [];

    const occurrences = [];

    workoutHistory.forEach(session => {
        session.sets?.forEach(set => {
            set.exercises?.forEach(workoutExercise => {
                const exercise = workoutExercise.exercise;
                if (getProgressionId(exercise) !== id) return;

                const entries = getWorkoutExerciseHistoryEntries(workoutExercise);
                if (!entries.length) return;

                const logs = entries.map(entry => entry.log);
                const weightUnit = getLastWeightUnit(logs);

                occurrences.push({
                    sessionId: session.id,
                    startedAt: Number(session.startedAt) || 0,

                    exerciseId: exercise?.ID ?? null,
                    exerciseName: String(exercise?.nom ?? ""),

                    progressionId: id,
                    progressionIndex: getProgressionIndex(exercise),

                    entries,

                    representativeWeight:
                        getRepresentativeWeight(logs, {
                            unit: weightUnit
                        })
                });
            });
        });
    });

    return occurrences.sort(
        (first, second) =>
            second.startedAt - first.startedAt
    );
}

function getProgressionState(workoutHistory = [], progressionId) {
    const occurrences =
        getProgressionOccurrences(
            workoutHistory,
            progressionId
        );

    const latestOccurrence =
        occurrences[0] ?? null;

    return {
        progressionId:
            String(progressionId || "").trim(),

        occurrenceCount:
            occurrences.length,

        workoutCount:
            new Set(
                occurrences.map(
                    occurrence =>
                        occurrence.sessionId
                )
            ).size,

        latestOccurrence,

        latestProgressionIndex:
            latestOccurrence?.progressionIndex ??
            null,

        occurrences
    };
}

export {
    getProgressionIndex,
    getWorkoutExerciseHistoryEntries,
    getProgressionOccurrences,
    getProgressionState
};