import { hasWorkoutExerciseLogs, isWorkoutSetCompleted } from "../workout/workout-session.js";

// ============================================================
// HISTORIQUE
// ============================================================

const PAGE_SIZE = 20;

let page;
let workoutList;
let workoutsContent;
let pagination;
let previousPageButton;
let nextPageButton;
let pageLabel;
let calendarTitle;
let calendarDays;
let calendarPreviousButton;
let calendarNextButton;
let summaryHost;
let summaryMeta;
let summaryName;
let summaryDate;
let deleteModal;
let cancelDeleteButton;
let confirmDeleteButton;

let history = [];
let currentPage = 0;
let selectedDateKey = null;
let selectedWorkoutId = null;
let pendingDeleteSession = null;

const now = new Date();
let calendarYear = now.getFullYear();
let calendarMonth = now.getMonth();

let onOpenWorkout = async () => {};
let onDeleteWorkout = async () => [];

// ============================================================
// CONFIGURATION
// ============================================================

function configureHistoryController(dependencies) {
    ({ page, workoutList, workoutsContent, pagination, previousPageButton, nextPageButton, pageLabel, calendarTitle, calendarDays, calendarPreviousButton, calendarNextButton, summaryHost, summaryMeta, summaryName, summaryDate, deleteModal, cancelDeleteButton, confirmDeleteButton, onOpenWorkout = async () => {}, onDeleteWorkout = async () => [] } = dependencies);
}

// ============================================================
// DATES
// ============================================================

function getDateKey(timestamp) {
    const date = new Date(timestamp);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function formatMonthYear(year, month) {
    return new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
}

function formatFullDate(timestamp) {
    return new Intl.DateTimeFormat("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(timestamp));
}

function formatWorkoutDate(timestamp) {
    const date = new Date(timestamp);
    const weekday = new Intl.DateTimeFormat("fr-CA", { weekday: "short" }).format(date).replace(".", "");
    return `${weekday} ${date.getDate()}`;
}

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours && minutes) return `${hours} h ${minutes} min`;
    if (hours) return `${hours} h`;
    return `${minutes} min`;
}

// ============================================================
// STATISTIQUES
// ============================================================

function getExecutedExerciseCount(session) {
    const exerciseKeys = new Set();

    session.sets.forEach(set => set.exercises.forEach(workoutExercise => {
        if (!hasWorkoutExerciseLogs(workoutExercise)) return;
        exerciseKeys.add(String(workoutExercise.exercise?.ID ?? workoutExercise.exercise?.nom ?? workoutExercise.id));
    }));

    return exerciseKeys.size;
}

function getExecutedSetCount(session) {
    return session.sets.filter(isWorkoutSetCompleted).length;
}

// ============================================================
// SÉLECTION
// ============================================================

function getSelectedWorkout() {
    return history.find(session => String(session.id) === String(selectedWorkoutId)) ?? null;
}

function renderSummaryMeta() {
    const session = getSelectedWorkout();
    summaryMeta.hidden = !session;

    if (!session) return;

    summaryName.textContent = session.planName || "Entraînement";
    summaryDate.textContent = formatFullDate(session.startedAt);
}

function setSelectedHistoryWorkout(session) {
    if (!session?.id) return;

    selectedWorkoutId = session.id;
    selectedDateKey = getDateKey(session.startedAt);

    const date = new Date(session.startedAt);
    calendarYear = date.getFullYear();
    calendarMonth = date.getMonth();

    const index = history.findIndex(item => String(item.id) === String(session.id));
    if (index >= 0) currentPage = Math.floor(index / PAGE_SIZE);

    renderCalendar();
    renderWorkoutList();
    renderSummaryMeta();
}

function clearHistorySelection() {
    selectedWorkoutId = null;
    summaryMeta.hidden = true;
    summaryHost.hidden = true;
    renderWorkoutList();
}

// ============================================================
// CARTE D'ENTRAÎNEMENT
// ============================================================

function createWorkoutCard(session) {
    const card = document.createElement("article");
    card.className = "history-workout-card";
    card.dataset.sessionId = String(session.id);

    const sessionDateKey = getDateKey(session.startedAt);
    if (sessionDateKey === selectedDateKey) card.classList.add("is-date-match");
    if (String(session.id) === String(selectedWorkoutId)) card.classList.add("is-selected");

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "history-workout-open";

    const primary = document.createElement("div");
    primary.className = "history-workout-primary";

    const date = document.createElement("span");
    date.className = "history-workout-date";
    date.textContent = formatWorkoutDate(session.startedAt);

    const name = document.createElement("span");
    name.className = "history-workout-name";
    name.textContent = session.planName || "Entraînement";

    primary.append(date, name);

    const secondary = document.createElement("div");
    secondary.className = "history-workout-secondary";

    const setCount = getExecutedSetCount(session);
    const exerciseCount = getExecutedExerciseCount(session);
    secondary.textContent = `${formatDuration(session.elapsedSeconds)} - ${setCount} set${setCount !== 1 ? "s" : ""} | ${exerciseCount} exercice${exerciseCount !== 1 ? "s" : ""}`;

    openButton.append(primary, secondary);

    openButton.addEventListener("click", async () => {
        setSelectedHistoryWorkout(session);
        await onOpenWorkout(session);
    });

    card.appendChild(openButton);

    if (String(session.id) === String(selectedWorkoutId)) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "history-workout-delete";
        deleteButton.textContent = "🗑";
        deleteButton.title = "Supprimer cet entraînement de l'historique";
        deleteButton.setAttribute("aria-label", `Supprimer ${session.planName || "cet entraînement"} de l'historique`);
        deleteButton.addEventListener("click", () => openDeleteModal(session));
        card.appendChild(deleteButton);
    }

    return card;
}

// ============================================================
// CALENDRIER
// ============================================================

function getWorkoutDateKeys() {
    return new Set(history.map(session => getDateKey(session.startedAt)));
}

function appendCalendarSpacer() {
    const spacer = document.createElement("div");
    spacer.className = "history-calendar-day-spacer";
    calendarDays.appendChild(spacer);
}

function selectCalendarDate(dateKey) {
    selectedDateKey = dateKey;
    selectedWorkoutId = null;
    summaryMeta.hidden = true;
    summaryHost.hidden = true;

    const firstMatchIndex = history.findIndex(session => getDateKey(session.startedAt) === dateKey);
    if (firstMatchIndex >= 0) currentPage = Math.floor(firstMatchIndex / PAGE_SIZE);

    renderCalendar();
    renderWorkoutList();

    if (firstMatchIndex >= 0) {
        requestAnimationFrame(() => workoutList.querySelector(".history-workout-card.is-date-match")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
}

function renderCalendar() {
    calendarTitle.textContent = formatMonthYear(calendarYear, calendarMonth);
    calendarDays.replaceChildren();

    const workoutDates = getWorkoutDateKeys();
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const dayCount = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    for (let index = 0; index < firstWeekday; index += 1) appendCalendarSpacer();

    for (let day = 1; day <= dayCount; day += 1) {
        const date = new Date(calendarYear, calendarMonth, day);
        const dateKey = getDateKey(date.getTime());
        const button = document.createElement("button");

        button.type = "button";
        button.className = "history-calendar-day";
        button.textContent = String(day);

        if (workoutDates.has(dateKey)) button.classList.add("has-workout");
        if (dateKey === selectedDateKey) button.classList.add("is-selected");

        button.addEventListener("click", () => selectCalendarDate(dateKey));
        calendarDays.appendChild(button);
    }

    for (let index = firstWeekday + dayCount; index < 42; index += 1) appendCalendarSpacer();
}

// ============================================================
// LISTE CHRONOLOGIQUE
// ============================================================

function getMonthKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function renderWorkoutList() {
    workoutList.replaceChildren();

    if (!history.length) {
        const empty = document.createElement("p");
        empty.className = "history-empty";
        empty.textContent = "Aucun entraînement n'a encore été enregistré.";
        workoutList.appendChild(empty);
        pagination.hidden = true;
        return;
    }

    const pageCount = Math.ceil(history.length / PAGE_SIZE);
    currentPage = Math.min(currentPage, pageCount - 1);

    const start = currentPage * PAGE_SIZE;
    const sessions = history.slice(start, start + PAGE_SIZE);

    let currentMonthKey = null;
    let currentMonthList = null;

    sessions.forEach(session => {
        const monthKey = getMonthKey(session.startedAt);

        if (monthKey !== currentMonthKey) {
            currentMonthKey = monthKey;

            const group = document.createElement("section");
            group.className = "history-month-group";

            const title = document.createElement("h3");
            title.className = "history-month-title";

            const date = new Date(session.startedAt);
            title.textContent = formatMonthYear(date.getFullYear(), date.getMonth());

            currentMonthList = document.createElement("div");
            currentMonthList.className = "history-month-list";

            group.append(title, currentMonthList);
            workoutList.appendChild(group);
        }

        currentMonthList.appendChild(createWorkoutCard(session));
    });

    pagination.hidden = pageCount <= 1;
    pageLabel.textContent = `Page ${currentPage + 1} sur ${pageCount}`;
    previousPageButton.disabled = currentPage === 0;
    nextPageButton.disabled = currentPage >= pageCount - 1;
}

// ============================================================
// SUPPRESSION
// ============================================================

function openDeleteModal(session) {
    pendingDeleteSession = session;
    deleteModal.hidden = false;
}

function closeDeleteModal() {
    pendingDeleteSession = null;
    deleteModal.hidden = true;
}

async function deletePendingWorkout() {
    if (!pendingDeleteSession) return;

    const session = pendingDeleteSession;
    confirmDeleteButton.disabled = true;

    try {
        const records = await onDeleteWorkout(session);

        history = Array.isArray(records)
            ? [...records].sort((a, b) => Number(b.startedAt) - Number(a.startedAt))
            : history.filter(item => String(item.id) !== String(session.id));

        selectedWorkoutId = null;
        closeDeleteModal();

        summaryMeta.hidden = true;
        summaryHost.hidden = true;

        renderCalendar();
        renderWorkoutList();
    } catch (error) {
        console.error("Impossible de supprimer l'entraînement de l'historique.", error);
        alert("Impossible de supprimer cet entraînement de l'historique.");
    } finally {
        confirmDeleteButton.disabled = false;
    }
}

// ============================================================
// WORKOUT SUMMARY
// ============================================================

function showHistoryList() {
    workoutsContent.hidden = false;
    clearHistorySelection();
}

function showHistorySummary() {
    workoutsContent.hidden = false;
    summaryHost.hidden = false;
    renderSummaryMeta();
}

function getHistorySummaryHost() {
    return summaryHost;
}

// ============================================================
// DONNÉES
// ============================================================

function normalizeHistory(records) {
    return [...records].sort((first, second) => Number(second.startedAt) - Number(first.startedAt));
}

function setWorkoutHistory(records) {
    history = normalizeHistory(records);
    currentPage = 0;
    selectedDateKey = null;
    selectedWorkoutId = null;

    renderCalendar();
    renderWorkoutList();
    renderSummaryMeta();
}

function refreshWorkoutHistory(records) {
    history = normalizeHistory(records);

    if (selectedWorkoutId && !getSelectedWorkout()) selectedWorkoutId = null;

    renderCalendar();
    renderWorkoutList();
    renderSummaryMeta();
}

// ============================================================
// INITIALISATION
// ============================================================

function setupHistoryController() {
    calendarPreviousButton.addEventListener("click", () => {
        calendarMonth -= 1;

        if (calendarMonth < 0) {
            calendarMonth = 11;
            calendarYear -= 1;
        }

        renderCalendar();
    });

    calendarNextButton.addEventListener("click", () => {
        calendarMonth += 1;

        if (calendarMonth > 11) {
            calendarMonth = 0;
            calendarYear += 1;
        }

        renderCalendar();
    });

    previousPageButton.addEventListener("click", () => {
        if (!currentPage) return;

        currentPage -= 1;
        renderWorkoutList();
        workoutList.scrollTo({ top: 0, behavior: "auto" });
    });

    nextPageButton.addEventListener("click", () => {
        const pageCount = Math.ceil(history.length / PAGE_SIZE);
        if (currentPage >= pageCount - 1) return;

        currentPage += 1;
        renderWorkoutList();
        workoutList.scrollTo({ top: 0, behavior: "auto" });
    });

    cancelDeleteButton.addEventListener("click", closeDeleteModal);
    confirmDeleteButton.addEventListener("click", deletePendingWorkout);
    deleteModal.addEventListener("click", event => { if (event.target === deleteModal) closeDeleteModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !deleteModal.hidden) closeDeleteModal(); });
}

export {
    configureHistoryController,
    setupHistoryController,
    setWorkoutHistory,
    refreshWorkoutHistory,
    setSelectedHistoryWorkout,
    showHistoryList,
    showHistorySummary,
    getHistorySummaryHost
};