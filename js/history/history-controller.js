import { dateKey, startOfWeek, shiftDays, getWorkoutChartData } from "./history-chart-data.js";
import { renderProgressChart } from "./history-charts.js";
import { getSelectedChartMetric, getChartPreferences, saveChartPreferences } from "./history-chart-preferences.js";
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
let selectedWeekStart = 1;
let highlightedWeekStart = null;
let workoutChart = null;
let chartRevision = 0;

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
    highlightedWeekStart = null;

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

function getWorkoutDurationByDate() {
    const durations = new Map();
    history.forEach(session => {
        const dateKey = getDateKey(session.startedAt);
        const seconds = Number(session.elapsedSeconds);
        const duration = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
        durations.set(dateKey, (durations.get(dateKey) ?? 0) + duration);
    });
    return durations;
}

function selectCalendarDate(dateKey) {
    selectedDateKey = dateKey;
    highlightedWeekStart = null;
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

    const workoutDurations = getWorkoutDurationByDate();
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const firstWeekday = (firstDay.getDay() - selectedWeekStart + 7) % 7;

    for (let index = 0; index < 42; index += 1) {
        const date = new Date(calendarYear, calendarMonth, index - firstWeekday + 1);
        const outside = date.getMonth() !== calendarMonth, calendarKey = getDateKey(date.getTime());
        const button = document.createElement("button");
        button.type = "button"; button.className = "history-calendar-day";
        button.textContent = String(date.getDate());
        if (outside) button.classList.add("is-outside-month");
        if (workoutDurations.has(calendarKey)) {
            button.classList.add("has-workout");
            const duration = document.createElement("span"); duration.className = "history-calendar-day-duration";
            duration.textContent = `${Math.floor(workoutDurations.get(calendarKey) / 60)} min`;
            button.appendChild(duration);
            button.setAttribute("aria-label", `${formatFullDate(date.getTime())} : ${duration.textContent} d’entraînement`);
        }
        if (calendarKey === selectedDateKey) button.classList.add("is-selected");
        if (highlightedWeekStart && date >= highlightedWeekStart && date < shiftDays(highlightedWeekStart, 7)) button.classList.add("is-highlighted-week");
        button.addEventListener("click", () => {
            if (outside) { calendarYear = date.getFullYear(); calendarMonth = date.getMonth(); }
            selectCalendarDate(calendarKey);
        });
        calendarDays.appendChild(button);
    }
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
        renderWorkoutChart();
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
    renderWorkoutChart();
}

function refreshWorkoutHistory(records) {
    history = normalizeHistory(records);

    if (selectedWorkoutId && !getSelectedWorkout()) selectedWorkoutId = null;

    renderCalendar();
    renderWorkoutList();
    renderSummaryMeta();
    renderWorkoutChart();
}

// ============================================================
// GRAPHIQUE ET NAVIGATION DES SEMAINES
// ============================================================
function getWeekSetting() {
    try { const saved = localStorage.getItem("wilf-history-week-start");
        if (saved === null) return 1;
        const day = Number(saved); return Number.isInteger(day) && day >= 0 && day <= 6 ? day : 1; }
    catch { return 1; }
}
function selectWorkoutChartPoint(point, weekly) {
    if (weekly) {
        highlightedWeekStart = startOfWeek(point.date, selectedWeekStart);
        selectedDateKey = dateKey(highlightedWeekStart);
        selectedWorkoutId = null;
        summaryMeta.hidden = true; summaryHost.hidden = true;
        calendarYear = highlightedWeekStart.getFullYear(); calendarMonth = highlightedWeekStart.getMonth();
        const first = history.findIndex(session => dateKey(startOfWeek(session.startedAt, selectedWeekStart)) === point.key);
        if (first >= 0) currentPage = Math.floor(first / PAGE_SIZE);
        renderCalendar(); renderWorkoutList();
        document.querySelector(".history-calendar")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
    }
    highlightedWeekStart = null;
    const session = point.session;
    if (!session) return;
    setSelectedHistoryWorkout(session);
    onOpenWorkout(session);
}
async function renderWorkoutChart() {
    const canvas = document.getElementById("history-workout-chart");
    if (!canvas) return;
    const version = ++chartRevision;
    const metric = document.getElementById("history-chart-metric")?.value ?? "countWeek";
    const range = Number(document.getElementById("history-chart-range")?.value ?? 12);
    const points = getWorkoutChartData(history, metric, selectedWeekStart, range);
    const message = document.getElementById("history-chart-message");
    if (message) message.textContent = points.length && history.length ? "Sélectionne un point pour retrouver la date et le récapitulatif dans l'historique." : "Aucun entraînement enregistré pour cette période.";
    const previous = workoutChart; workoutChart = null;
    if (!points.length || !history.length) { previous?.destroy(); return; }
    try {
        const chart = await renderProgressChart(canvas, points, { label: metric === "countWeek" ? "Entraînements" : "Durée", unit: metric === "countWeek" ? "séances" : "min", bars: metric !== "durationSession", existing: previous, onSelect: point => selectWorkoutChartPoint(point, metric !== "durationSession") });
        if (version !== chartRevision) chart?.destroy(); else workoutChart = chart;
    } catch (error) {
        previous?.destroy();
        if (version === chartRevision && message) message.textContent = /Chart\.js (est absent|n'a pas été chargé)/.test(error?.message ?? "") ? "Chart.js est absent de js/vendor/chartjs/." : "Impossible d'afficher le graphique pour le moment.";
        console.warn("Graphique indisponible :", error);
    }
}
// ============================================================
// INITIALISATION
// ============================================================

function setupHistoryController() {
    selectedWeekStart = getWeekSetting();
    const metricSelect = document.getElementById("history-chart-metric");
    const rangeSelect = document.getElementById("history-chart-range");
    const weekSelect = document.getElementById("history-week-start");
    const savedMetric = getSelectedChartMetric("workout");
    if (metricSelect && savedMetric) metricSelect.value = savedMetric;
    const restoreChartSettings = () => {
        const perSession = metricSelect?.value === "durationSession";
        rangeSelect?.querySelectorAll("option").forEach(option => {
            option.textContent = option.value === "0" ? "Tout" : `${option.value} ${perSession ? "séances" : "semaines"}`;
        });
        if (weekSelect) weekSelect.closest("label").hidden = perSession;
        const saved = getChartPreferences("workout", metricSelect?.value ?? "countWeek");
        if (rangeSelect) rangeSelect.value = String(saved.range ?? 12);
        selectedWeekStart = saved.weekStart ?? getWeekSetting();
        if (weekSelect) weekSelect.value = String(selectedWeekStart);
    };
    const saveChartSettings = () => saveChartPreferences("workout", metricSelect?.value ?? "countWeek", { range: Number(rangeSelect?.value ?? 12), weekStart: selectedWeekStart });
    restoreChartSettings();
    if (weekSelect) {
        weekSelect.value = String(selectedWeekStart);
        weekSelect.addEventListener("change", () => {
            selectedWeekStart = Number(weekSelect.value); highlightedWeekStart = null;
            saveChartSettings();
            renderCalendar(); renderWorkoutChart();
        });
    }
    const weekdayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const refreshWeekHeaders = () => document.querySelectorAll(".history-calendar-weekdays span").forEach((span, index) => { span.textContent = weekdayNames[(selectedWeekStart + index) % 7]; });
    refreshWeekHeaders();
    weekSelect?.addEventListener("change", refreshWeekHeaders);
    metricSelect?.addEventListener("change", () => {
        restoreChartSettings(); saveChartSettings(); highlightedWeekStart = null;
        refreshWeekHeaders(); renderCalendar(); renderWorkoutChart();
    });
    rangeSelect?.addEventListener("change", () => { saveChartSettings(); renderWorkoutChart(); });
    document.getElementById("tab-history")?.addEventListener("click", () => requestAnimationFrame(() => workoutChart?.resize()));
    renderCalendar(); renderWorkoutChart();
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
