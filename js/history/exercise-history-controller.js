import { getSearchTerms, getProgressionName, getProgressionDisplay, findValidTermCombination, getExerciseSearchRanking, compareExercisesBySearch } from "../exercises/exercise-search.js";
import { getExerciseSplitDetailText } from "../exercises/exercise-split.js";
import { renderExerciseMuscleMap, destroyExerciseMuscleMapsIn } from "../exercises/exercise-muscle-map.js";
import { renderExerciseHistoryPanel } from "./exercise-history-view.js";

// ============================================================
// HISTORIQUE PAR EXERCICE
// ============================================================

let exercisePageHistoryHost;
let historySearchInput;
let historyExerciseList;
let historyExerciseName;
let historyExerciseDetails;
let historyExerciseHistoryHost;
let getExercises = () => [];
let getWorkoutHistory = () => [];
let onOpenWorkout = async () => {};
let selectedExercisePageExercise = null;
let selectedHistoryExercise = null;
let isSetup = false;

function configureExerciseHistoryController(dependencies) {
    ({ exercisePageHistoryHost, historySearchInput, historyExerciseList, historyExerciseName, historyExerciseDetails, historyExerciseHistoryHost, getExercises, getWorkoutHistory, onOpenWorkout } = dependencies);
}

function appendDetailLine(container, label, value) {
    const row = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label} : `;
    row.append(strong, document.createTextNode(value || "—"));
    container.appendChild(row);
}

function renderHistoryExerciseDetails(exercise) {
    const changed = !selectedHistoryExercise || String(selectedHistoryExercise.ID) !== String(exercise.ID);
    selectedHistoryExercise = exercise;
    if (changed && historyExerciseHistoryHost) { historyExerciseHistoryHost.replaceChildren(); historyExerciseHistoryHost.hidden = true; }
    destroyExerciseMuscleMapsIn(historyExerciseDetails);
    historyExerciseDetails.replaceChildren();
    historyExerciseName.disabled = false;
    historyExerciseName.textContent = exercise.nom;
    historyExerciseName.setAttribute("aria-label", `Voir l'historique de ${exercise.nom}`);

    const progression = document.createElement("p");
    const progressionLabel = document.createElement("strong");
    progressionLabel.textContent = "Progression : ";
    progression.append(progressionLabel, document.createTextNode(getProgressionDisplay(exercise) || "—"));
    historyExerciseDetails.appendChild(progression);

    const splitDetail = getExerciseSplitDetailText(exercise);
    if (splitDetail) appendDetailLine(historyExerciseDetails, "Type de set", splitDetail);

    const map = document.createElement("div");
    map.className = "exercise-muscle-map";
    historyExerciseDetails.appendChild(map);
    renderExerciseMuscleMap(map, exercise);

    appendDetailLine(historyExerciseDetails, "Muscles principaux", (exercise.muscles_principaux ?? []).map(muscle => `${muscle[0]} — ${muscle[1]}`).join(" · "));
    appendDetailLine(historyExerciseDetails, "Muscles secondaires", (exercise.muscles_secondaires ?? []).map(muscle => `${muscle[0]} — ${muscle[1]}`).join(" · "));
    appendDetailLine(historyExerciseDetails, "Type", exercise.type);
    appendDetailLine(historyExerciseDetails, "Catégorie", exercise.catégorie?.join(", ") || "—");
}

function renderHistoryExerciseList() {
    if (!historyExerciseList || !historySearchInput) return;
    const terms = getSearchTerms(historySearchInput.value);
    const ranked = getExercises().filter(exercise => !terms.length || findValidTermCombination(exercise.nom, terms) || findValidTermCombination(getProgressionName(exercise), terms)).map(exercise => ({ exercise, searchRanking: getExerciseSearchRanking(exercise, terms) })).sort(compareExercisesBySearch);
    historyExerciseList.replaceChildren();

    ranked.forEach(({ exercise }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-exercise-search-item";
        if (selectedHistoryExercise && String(selectedHistoryExercise.ID) === String(exercise.ID)) button.classList.add("is-selected");
        const name = document.createElement("span");
        name.textContent = exercise.nom;
        const progression = document.createElement("span");
        progression.textContent = getProgressionDisplay(exercise);
        button.append(name, progression);
        button.addEventListener("click", () => { renderHistoryExerciseDetails(exercise); renderHistoryExerciseList(); });
        historyExerciseList.appendChild(button);
    });

    if (!ranked.length) {
        const empty = document.createElement("p");
        empty.className = "history-empty";
        empty.textContent = "Aucun exercice trouvé.";
        historyExerciseList.appendChild(empty);
    }
}

function closeExercisePageHistory() {
    selectedExercisePageExercise = null;
    if (!exercisePageHistoryHost) return;
    exercisePageHistoryHost.replaceChildren();
    exercisePageHistoryHost.hidden = true;
}

function openExercisePageHistory(exercise) {
    if (!exercisePageHistoryHost || !exercise) return;
    selectedExercisePageExercise = exercise;
    renderExerciseHistoryPanel(exercisePageHistoryHost, { exercise, workoutHistory: getWorkoutHistory(), onOpenWorkout });
}

function openHistoryTabExerciseHistory(exercise = selectedHistoryExercise) {
    if (!historyExerciseHistoryHost || !exercise) return;
    selectedHistoryExercise = exercise;
    renderExerciseHistoryPanel(historyExerciseHistoryHost, { exercise, workoutHistory: getWorkoutHistory(), onOpenWorkout });
}

function refreshExerciseHistoryViews() {
    if (selectedExercisePageExercise && exercisePageHistoryHost && !exercisePageHistoryHost.hidden) renderExerciseHistoryPanel(exercisePageHistoryHost, { exercise: selectedExercisePageExercise, workoutHistory: getWorkoutHistory(), onOpenWorkout, scrollIntoView: false });
    if (selectedHistoryExercise && historyExerciseHistoryHost && !historyExerciseHistoryHost.hidden) renderExerciseHistoryPanel(historyExerciseHistoryHost, { exercise: selectedHistoryExercise, workoutHistory: getWorkoutHistory(), onOpenWorkout, scrollIntoView: false });
}

function setupExerciseHistoryController() {
    if (isSetup) return;
    isSetup = true;
    historySearchInput?.addEventListener("input", renderHistoryExerciseList);
    historyExerciseName?.addEventListener("click", () => openHistoryTabExerciseHistory());
    renderHistoryExerciseList();
}

export { configureExerciseHistoryController, setupExerciseHistoryController, openExercisePageHistory, closeExercisePageHistory, refreshExerciseHistoryViews };
