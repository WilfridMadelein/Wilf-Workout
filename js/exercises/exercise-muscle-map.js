import {
    MuscleMapWidget
} from "../vendor/musclemap/musclemap.js";

import {
    getExerciseMuscleMap
} from "./muscle-map-config.js";

// ============================================================
// CARTE MUSCULAIRE DES EXERCICES
// ============================================================

const PRIMARY_COLOR = "#d32f2f";
const SECONDARY_COLOR = "#ef9a9a";

let getAppSettings = () => ({ bodyModel: "male" });
let activeMaps = [];

function configureExerciseMuscleMap(dependencies) {
    ({ getAppSettings } = dependencies);
}

function destroyExerciseMuscleMaps() {
    activeMaps.forEach(map => map.destroy());
    activeMaps = [];
}

function createMuscleMap(container, side, regions) {
    const gender =
        getAppSettings()?.bodyModel === "female"
            ? "female"
            : "male";

    const map = new MuscleMapWidget(container, {
        gender,
        side,
        style: "minimal",
        interactive: false,
        showSubGroups: false
    });

    map.highlightMany(
        regions.secondary,
        SECONDARY_COLOR
    );

    map.highlightMany(
        regions.primary,
        PRIMARY_COLOR
    );

    activeMaps.push(map);
}

function renderExerciseMuscleMap(
    container,
    exercise
) {
    destroyExerciseMuscleMaps();

    if (!container || !exercise) return;

    container.innerHTML = `
        <div class="exercise-muscle-map-view">
            <span class="exercise-muscle-map-label">
                Devant
            </span>

            <div
                class="exercise-muscle-map-canvas"
                data-muscle-side="front"
            ></div>
        </div>

        <div class="exercise-muscle-map-view">
            <span class="exercise-muscle-map-label">
                Dos
            </span>

            <div
                class="exercise-muscle-map-canvas"
                data-muscle-side="back"
            ></div>
        </div>
    `;

    const regions =
        getExerciseMuscleMap(exercise);

    createMuscleMap(
        container.querySelector(
            '[data-muscle-side="front"]'
        ),
        "front",
        regions
    );

    createMuscleMap(
        container.querySelector(
            '[data-muscle-side="back"]'
        ),
        "back",
        regions
    );
}

function refreshExerciseMuscleMapModel() {
    const gender =
        getAppSettings()?.bodyModel === "female"
            ? "female"
            : "male";

    activeMaps.forEach(map =>
        map.setGender(gender)
    );
}

export {
    configureExerciseMuscleMap,
    renderExerciseMuscleMap,
    refreshExerciseMuscleMapModel
};