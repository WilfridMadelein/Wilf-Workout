import { EXERCISE_RECORD_ORDER, EXERCISE_RECORD_LABELS, getExerciseHistory, getExerciseRecords, groupEntriesBySeries } from "./exercise-history.js";

// ============================================================
// VUE — HISTORIQUE D'UN EXERCICE
// ============================================================

function formatHistoryDate(timestamp) { return new Intl.DateTimeFormat("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp)).replaceAll(".", ""); }
function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (!minutes) return `${remainingSeconds} sec`;
    if (!remainingSeconds) return `${minutes} min`;
    return `${minutes} min ${remainingSeconds} sec`;
}
function formatExerciseRecordValue(record) {
    if (!record) return "—";
    if (record.unit === "sec") return formatDuration(record.value);
    if (record.unit === "rep") return `${record.value} rep${Number(record.value) !== 1 ? "s" : ""}`;
    const value = Math.round(Number(record.value) * 100) / 100;
    return `${value} ${record.unit}${record.compareValue !== undefined && record.value !== record.weight ? "·rep" : ""}`;
}
function formatSeriesVolume(log) {
    const unit = log.valueUnit === "sec" ? "sec" : "rep";
    const volume = `${log.value} ${unit}`;
    return Number(log.weight) > 0 ? `${volume} x ${log.weight} ${log.weightUnit}` : volume;
}
function formatSeriesEntry(entry) {
    const side = entry.sideKey === "left" ? "G: " : entry.sideKey === "right" ? "D: " : "";
    return `${side}${formatSeriesVolume(entry.log)}`;
}

function createDateButton(timestamp, session, onOpenWorkout, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = formatHistoryDate(timestamp);
    button.title = "Voir le récapitulatif de cet entraînement";
    button.addEventListener("click", async () => { await onOpenWorkout(session); });
    return button;
}

function renderExerciseRecords(container, historyRecords, onOpenWorkout) {
    const records = getExerciseRecords(historyRecords);
    const applicable = EXERCISE_RECORD_ORDER.filter(key => records[key]);
    if (!applicable.length) return;
    const section = document.createElement("section");
    section.className = "workout-summary-history-records";
    const title = document.createElement("h4");
    title.textContent = "Records";
    const list = document.createElement("div");
    list.className = "workout-summary-history-record-list";
    applicable.forEach(key => {
        const record = records[key];
        const item = document.createElement("div");
        item.className = "workout-summary-history-record";
        const label = document.createElement("span");
        label.textContent = EXERCISE_RECORD_LABELS[key];
        const value = document.createElement("strong");
        value.textContent = formatExerciseRecordValue(record);
        const date = createDateButton(record.session.startedAt, record.session, onOpenWorkout, "workout-summary-history-record-date");
        item.append(label, value, date);
        list.appendChild(item);
    });
    section.append(title, list);
    container.appendChild(section);
}

function createExerciseHistoryWorkout(record, onOpenWorkout) {
    const row = document.createElement("article");
    row.className = "workout-summary-history-workout";
    const dateColumn = document.createElement("div");
    dateColumn.className = "workout-summary-history-date-column";
    dateColumn.appendChild(createDateButton(record.session.startedAt, record.session, onOpenWorkout, "workout-summary-history-date"));
    const series = document.createElement("div");
    series.className = "workout-summary-history-series";
    groupEntriesBySeries(record.entries).forEach(entries => {
        const line = document.createElement("div");
        line.textContent = entries.map(formatSeriesEntry).join(" | ");
        series.appendChild(line);
    });
    row.append(dateColumn, series);
    return row;
}

function renderExerciseHistoryPanel(host, { exercise, workoutHistory = [], onOpenWorkout = async () => {}, scrollIntoView = true } = {}) {
    if (!host || !exercise) return;
    const historyRecords = getExerciseHistory(workoutHistory, exercise);
    host.replaceChildren();
    host.hidden = false;
    const panel = document.createElement("section");
    panel.className = "workout-summary-history-panel is-open";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "workout-summary-history-toggle";
    toggle.setAttribute("aria-expanded", "true");
    const title = document.createElement("strong");
    title.textContent = `Historique — ${exercise.nom}`;
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    toggle.append(title, arrow);
    const content = document.createElement("div");
    content.className = "workout-summary-history-content";
    renderExerciseRecords(content, historyRecords, onOpenWorkout);
    const workouts = document.createElement("div");
    workouts.className = "workout-summary-history-workouts";
    if (historyRecords.length) historyRecords.forEach(record => workouts.appendChild(createExerciseHistoryWorkout(record, onOpenWorkout)));
    else {
        const empty = document.createElement("p");
        empty.className = "workout-summary-history-empty";
        empty.textContent = "Aucun historique enregistré pour cet exercice.";
        workouts.appendChild(empty);
    }
    content.appendChild(workouts);
    toggle.addEventListener("click", () => {
        const open = !panel.classList.contains("is-open");
        panel.classList.toggle("is-open", open);
        content.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
    });
    panel.append(toggle, content);
    host.appendChild(panel);
    if (scrollIntoView) requestAnimationFrame(() => host.scrollIntoView({ block: "nearest", behavior: "smooth" }));
}

export { formatExerciseRecordValue, renderExerciseHistoryPanel };
