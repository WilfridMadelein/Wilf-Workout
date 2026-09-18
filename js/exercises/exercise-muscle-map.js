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
const activeMaps = new Set();

function configureExerciseMuscleMap(dependencies) {
    ({ getAppSettings } = dependencies);
}

function destroyMapEntry(entry) {
    entry.map.destroy();
    activeMaps.delete(entry);
}

function destroyExerciseMuscleMapsIn(container) {
    if (!container) return;

    [...activeMaps].forEach(entry => {
        if (
            entry.root === container ||
            container.contains(entry.root)
        ) {
            destroyMapEntry(entry);
        }
    });
}

function destroyMapsForRoot(root) {
    [...activeMaps].forEach(entry => {
        if (entry.root === root) {
            destroyMapEntry(entry);
        }
    });
}

function cleanupDisconnectedMaps() {
    [...activeMaps].forEach(entry => {
        if (!entry.root.isConnected) {
            destroyMapEntry(entry);
        }
    });
}

function createMuscleMap(
    root,
    container,
    side,
    regions
) {
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

    activeMaps.add({ root, map });
}

function renderExerciseMuscleMap(
    container,
    exercise,
    { compact = false } = {}
) {
    if (!container || !exercise) return;

    if (container.isConnected) {
        cleanupDisconnectedMaps();
    }

    destroyMapsForRoot(container);

    container.classList.toggle(
        "exercise-muscle-map--compact",
        compact
    );

    const frontLabel = compact
        ? ""
        : `<span class="exercise-muscle-map-label">Devant</span>`;

    const backLabel = compact
        ? ""
        : `<span class="exercise-muscle-map-label">Dos</span>`;

    container.innerHTML = `
        <div class="exercise-muscle-map-view">
            ${frontLabel}
            <div
                class="exercise-muscle-map-canvas"
                data-muscle-side="front"
            ></div>
        </div>

        <div class="exercise-muscle-map-view">
            ${backLabel}
            <div
                class="exercise-muscle-map-canvas"
                data-muscle-side="back"
            ></div>
        </div>
    `;

    const regions =
        getExerciseMuscleMap(exercise);

    createMuscleMap(
        container,
        container.querySelector(
            '[data-muscle-side="front"]'
        ),
        "front",
        regions
    );

    createMuscleMap(
        container,
        container.querySelector(
            '[data-muscle-side="back"]'
        ),
        "back",
        regions
    );
}

function refreshExerciseMuscleMapModel() {
    cleanupDisconnectedMaps();

    const gender =
        getAppSettings()?.bodyModel === "female"
            ? "female"
            : "male";

    activeMaps.forEach(entry =>
        entry.map.setGender(gender)
    );
}

export {
    configureExerciseMuscleMap,
    renderExerciseMuscleMap,
    destroyExerciseMuscleMapsIn,
    refreshExerciseMuscleMapModel
};