import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runsArg = process.argv.find(arg => arg.startsWith("--runs="));
const seedArg = process.argv.find(arg => arg.startsWith("--seed="));
const runs = Math.max(1, Number(runsArg?.split("=")[1]) || 1000);
const seed = Number(seedArg?.split("=")[1]) || 12345;
const referenceAt = Date.UTC(2026, 9, 4, 12, 0, 0);

// ============================================================
// RANDOM REPRODUCTIBLE
// ============================================================

function createRandom(seedValue) {
    let state = seedValue >>> 0;

    return () => {
        state += 0x6D2B79F5;

        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);

        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

const random = createRandom(seed);

// ============================================================
// CHARGEMENT DES MODULES ES DE L'APPLICATION
// ============================================================

const context = vm.createContext({
    console,
    Date,
    Math,
    Set,
    Map,
    Object,
    Array,
    Number,
    String,
    Boolean,
    JSON,
    Intl
});

const moduleCache = new Map();

async function loadModule(filePath, transform = null) {
    const absolutePath = resolve(filePath);

    if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);

    let code = await readFile(absolutePath, "utf8");
    if (transform) code = transform(code);

    const identifier = pathToFileURL(absolutePath).href;

    const module = new vm.SourceTextModule(code, {
        context,
        identifier,
        initializeImportMeta: meta => { meta.url = identifier; }
    });

    moduleCache.set(absolutePath, module);

    await module.link(async (specifier, referencingModule) => {
        if (!specifier.startsWith(".")) {
            throw new Error(`Import externe non supporté dans le simulateur : ${specifier}`);
        }

        const dependencyPath = fileURLToPath(
            new URL(specifier, referencingModule.identifier)
        );

        return loadModule(dependencyPath);
    });

    await module.evaluate();

    return module;
}

// ============================================================
// OUTILS
// ============================================================

function sample(values) {
    return values[Math.floor(random() * values.length)];
}

function randomSubset(values, { min = 0, probability = 0.5 } = {}) {
    const selected = values.filter(() => random() < probability);

    while (selected.length < Math.min(min, values.length)) {
        const value = sample(values);
        if (!selected.includes(value)) selected.push(value);
    }

    return selected;
}

function getUniqueExerciseValues(exercises, key) {
    return [
        ...new Set(
            exercises
                .flatMap(exercise =>
                    Array.isArray(exercise?.[key])
                        ? exercise[key]
                        : [exercise?.[key]]
                )
                .filter(Boolean)
        )
    ];
}

function getEquipmentOptions(exercises) {
    return [
        ...new Set(
            exercises
                .flatMap(exercise => (exercise.equipement ?? []).flat())
                .filter(value => value && value !== "Aucun")
        )
    ];
}

function getSubmuscles(exercises, family) {
    return [
        ...new Set(
            exercises
                .flatMap(exercise => [
                    ...(exercise.muscles_principaux ?? []),
                    ...(exercise.muscles_secondaires ?? [])
                ])
                .filter(muscle => muscle?.[0] === family && muscle?.[1])
                .map(muscle => muscle[1])
        )
    ];
}

// ============================================================
// HISTORIQUE / PROGRESSIONS SYNTHÉTIQUES
// ============================================================

function buildProgressions(exercises) {
    const groups = new Map();

    exercises.forEach(exercise => {
        const id = String(exercise.prog_group || "").trim();
        const index = Number(exercise.prog_ordre);

        if (!id || !Number.isFinite(index)) return;

        const group = groups.get(id) ?? {
            id,
            indexes: []
        };

        group.indexes.push(index);
        groups.set(id, group);
    });

    return [...groups.values()].map(group => {
        const indexes = [...new Set(group.indexes)].sort((a, b) => a - b);
        const known = random() < 0.7;
        const recentCount = known ? Math.floor(random() * 7) : 0;
        const latestProgressionIndex = known ? sample(indexes) : null;

        const preferenceRoll = random();

        const preference =
            preferenceRoll < 0.03 ? "never" :
            preferenceRoll < 0.10 ? "less" :
            preferenceRoll < 0.18 ? "more" :
            "neutral";

        const occurrences = Array.from(
            { length: recentCount },
            (_, index) => ({
                sessionId: `${group.id}-${index}`,
                startedAt:
                    referenceAt -
                    Math.floor(random() * 28) *
                    24 * 60 * 60 * 1000
            })
        );

        return {
            id: group.id,
            preference,

            state: {
                latestProgressionIndex,
                occurrenceCount: occurrences.length,
                occurrences
            }
        };
    });
}

// ============================================================
// SCÉNARIOS
// ============================================================

function buildScenario(
    exercises,
    bodyPartsConfig,
    categories,
    types,
    equipment
) {
    const bodyParts = randomSubset(
        Object.keys(bodyPartsConfig),
        {
            min: 1,
            probability: 0.55
        }
    );

    const muscles = {};
    const muscleTargets = [];

    bodyParts.forEach(bodyPart => {
        const config = bodyPartsConfig[bodyPart];

        const options =
            config.mode === "submuscles"
                ? getSubmuscles(
                    exercises,
                    config.family
                )
                : [...config.values];

        const selected =
            randomSubset(
                options,
                {
                    min: 1,
                    probability: 0.75
                }
            );

        muscles[bodyPart] = selected;

        selected.forEach(value => {
            muscleTargets.push(
                config.mode === "submuscles"
                    ? {
                        bodyPart,
                        family: config.family,
                        submuscle: value
                    }
                    : {
                        bodyPart,
                        family: value,
                        submuscle: null
                    }
            );
        });
    });

    const durationMinutes =
        15 +
        Math.floor(random() * 22) * 5;

    const request = {
        durationMinutes,

        goals: [
            sample([
                "strength",
                "hypertrophy",
                "endurance"
            ])
        ],

        bodyParts,
        muscles,

        types:
            randomSubset(
                types,
                {
                    min: 1,
                    probability: 0.7
                }
            ),

        categories:
            randomSubset(
                categories,
                {
                    min: 1,
                    probability: 0.6
                }
            ),

        equipment:
            random() < 0.25
                ? [...equipment]
                : randomSubset(
                    equipment,
                    {
                        probability: 0.55
                    }
                ),

        planPriorities: {
            sets: 2 + Math.floor(random() * 4),
            reps: 6 + Math.floor(random() * 10),
            time: 20 + Math.floor(random() * 5) * 10,
            rest: 30 + Math.floor(random() * 7) * 15,

            weight: 0,
            weightUnit: "lbs",

            tempo: {
                first: 3,
                second: 0,
                third: 1,
                fourth: 0
            },

            includeNotes: false,
            autoAddDefaultInstructions: true
        },

        supersetPreference:
            sample([
                "indifferent",
                "none",
                "sometimes",
                "always"
            ])
    };

    return {
        referenceAt,
        request,
        muscleTargets,
        progressions:
            buildProgressions(exercises)
    };
}

// ============================================================
// VALIDATION
// ============================================================

function validateWorkout(result, pool) {
    const errors = [];

    const selected =
        result.exercises;

    const exerciseIds =
        selected.map(
            item =>
                item.candidate.exerciseId
        );

    const progressionIds =
        selected
            .map(
                item =>
                    item.candidate
                        .progressionId
            )
            .filter(Boolean);

    const bodyPartOrder = {
        legs: 0,
        chest: 1,
        back: 1,
        arms: 2,
        core: 3
    };

    const orders =
        selected.map(
            item =>
                bodyPartOrder[
                    item.compositionBodyPart
                ] ?? 99
        );

    if (
        new Set(exerciseIds).size !==
        exerciseIds.length
    ) {
        errors.push(
            "duplicate-exercise"
        );
    }

    if (
        new Set(progressionIds).size !==
        progressionIds.length
    ) {
        errors.push(
            "duplicate-progression"
        );
    }

    if (
        selected.some(
            item =>
                item.candidate
                    .progressionPreference ===
                "never"
        )
    ) {
        errors.push(
            "never-selected"
        );
    }

    if (
        orders.some(
            (order, index) =>
                index > 0 &&
                order <
                    orders[index - 1]
        )
    ) {
        errors.push(
            "bodypart-order"
        );
    }

    if (
        result.estimatedDurationSeconds >
        result.targetDurationSeconds
    ) {
        errors.push(
            "duration-over-target"
        );
    }

    const candidateIds =
        new Set(
            pool.candidates.map(
                candidate =>
                    candidate.exerciseId
            )
        );

    if (
        selected.some(
            item =>
                !candidateIds.has(
                    item.candidate.exerciseId
                )
        )
    ) {
        errors.push(
            "non-candidate-selected"
        );
    }

    return errors;
}

// ============================================================
// CHARGEMENT
// ============================================================

const exerciseSources = await Promise.all(["data/cali-focus.js", "data/gym-focus.js"].map(file => readFile(resolve(rootDir, file), "utf8")));
const exercisesModule =
    await loadModule(
        resolve(
            rootDir,
            "data/exercises.js"
        ),
        code =>
            `${exerciseSources.join("\n")}\n${code}\nexport { exercises };`
    );

const settingsModule =
    await loadModule(
        resolve(
            rootDir,
            "js/auto-plan/auto-plan-settings.js"
        )
    );

const constraintModule =
    await loadModule(
        resolve(
            rootDir,
            "js/auto-plan/generator/workout-constraint.js"
        )
    );

const scoringModule =
    await loadModule(
        resolve(
            rootDir,
            "js/auto-plan/generator/exercise-scoring.js"
        )
    );

const builderModule =
    await loadModule(
        resolve(
            rootDir,
            "js/auto-plan/generator/workout-builder.js"
        )
    );

// ============================================================
// SIMULATION
// ============================================================

const exercises =
    Array.from(
        exercisesModule.namespace.exercises
    );

const bodyPartsConfig =
    settingsModule.namespace
        .AUTO_PLAN_BODY_PARTS;

const categories =
    getUniqueExerciseValues(
        exercises,
        "catégorie"
    );

const types =
    getUniqueExerciseValues(
        exercises,
        "type"
    );

const equipment =
    getEquipmentOptions(
        exercises
    );

const stats = {
    runs,
    noCandidates: 0,
    emptyWorkouts: 0,
    errors: {},
    selectedExercises:
        new Map(),
    missingCoverage: {},
    totalSelected: 0,
    totalCandidates: 0
};

for (
    let index = 0;
    index < runs;
    index += 1
) {
    const input =
        buildScenario(
            exercises,
            bodyPartsConfig,
            categories,
            types,
            equipment
        );

    const pool =
        constraintModule.namespace
            .buildExerciseCandidatePool(
                exercises,
                input
            );

    const scored =
        scoringModule.namespace
            .scoreCandidatePool(
                pool
            );

    const workout =
        builderModule.namespace
            .buildWorkoutFromScoredPool(
                scored,
                input
            );

    stats.totalCandidates +=
        pool.candidates.length;

    stats.totalSelected +=
        workout.exercises.length;

    if (
        !pool.candidates.length
    ) {
        stats.noCandidates += 1;
    }

    if (
        !workout.exercises.length
    ) {
        stats.emptyWorkouts += 1;
    }

    validateWorkout(
        workout,
        pool
    ).forEach(error => {
        stats.errors[error] =
            (stats.errors[error] ?? 0) +
            1;
    });

    workout.exercises.forEach(
        item => {
            const name =
                item.candidate.exerciseName;

            stats.selectedExercises.set(
                name,
                (
                    stats.selectedExercises
                        .get(name) ?? 0
                ) + 1
            );
        }
    );

    Object.entries(
        workout.coverage
    ).forEach(
        ([bodyPart, coverage]) => {
            if (
                coverage.status ===
                    "missing" &&
                pool.summary
                    .bodyParts
                    ?.[bodyPart]
                    ?.matching > 0
            ) {
                stats.missingCoverage[
                    bodyPart
                ] =
                    (
                        stats
                            .missingCoverage[
                                bodyPart
                            ] ?? 0
                    ) + 1;
            }
        }
    );
}

// ============================================================
// RÉSULTATS
// ============================================================

const topExercises =
    [
        ...stats
            .selectedExercises
            .entries()
    ]
        .sort(
            (first, second) =>
                second[1] -
                first[1]
        )
        .slice(0, 15)
        .map(
            ([exercise, count]) => ({
                exercise,
                count,

                percentOfRuns:
                    Math.round(
                        count /
                            runs *
                            1000
                    ) / 10
            })
        );

console.log(
    `\nWilf Auto-plan Simulator — ${runs} scénarios — seed ${seed}`
);

console.table([
    {
        runs,

        averageCandidates:
            Math.round(
                stats.totalCandidates /
                    runs *
                    100
            ) / 100,

        averageExercises:
            Math.round(
                stats.totalSelected /
                    runs *
                    100
            ) / 100,

        noCandidates:
            stats.noCandidates,

        emptyWorkouts:
            stats.emptyWorkouts
    }
]);

console.log(
    "Erreurs d'invariants :",
    stats.errors
);

console.log(
    "Couverture manquante malgré candidat disponible :",
    stats.missingCoverage
);

console.log(
    "Exercices les plus sélectionnés :"
);

console.table(
    topExercises
);

if (
    Object.keys(
        stats.errors
    ).length
) {
    process.exitCode = 1;
}

function normal(mean, deviation, min, max, step = 1) {
    let u = 0;
    let v = 0;

    while (!u) u = random();
    while (!v) v = random();

    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const value = Math.min(max, Math.max(min, mean + z * deviation));

    return Math.round(value / step) * step;
}
