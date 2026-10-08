import { renderProgressChart } from "./history-charts.js";
import { getSelectedChartMetric, getChartPreferences, saveChartPreferences } from "./history-chart-preferences.js";
import { convertWeight } from "../training/weight-estimation.js";
import { EXERCISE_RECORD_ORDER, EXERCISE_RECORD_LABELS, getExerciseHistory, getExerciseRecords, getExerciseMetricTimeline, groupEntriesBySeries } from "./exercise-history.js";

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
    return `${value} ${record.unit}${!record.estimated && record.compareValue !== undefined && record.value !== record.weight ? "·rep" : ""}`;
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

function renderExerciseRecords(container, historyRecords, onOpenWorkout, onSelectMetric) {
    const records = getExerciseRecords(historyRecords);
    const applicable = EXERCISE_RECORD_ORDER.filter(key => records[key]);
    if (!applicable.length) return;
    const achieved = applicable.filter(key => !key.startsWith("estimated"));
    const latest = achieved.reduce((last, key) => Number(records[key].session.startedAt) > Number(records[last].session.startedAt) ? key : last, achieved[0] ?? null);
    const section = document.createElement("section");
    section.className = "workout-summary-history-records";
    const title = document.createElement("h4"); title.textContent = "Records";
    const list = document.createElement("div"); list.className = "workout-summary-history-record-list";
    applicable.forEach(key => {
        const record = records[key], item = document.createElement("div");
        item.className = "workout-summary-history-record";
        const button = document.createElement("button");
        button.type = "button"; button.className = "history-record-chart-button";
        button.title = `Afficher le graphique : ${EXERCISE_RECORD_LABELS[key]}`;
        const label = document.createElement("span"); label.textContent = `${key === latest ? "🏆 " : ""}${EXERCISE_RECORD_LABELS[key]}`;
        const value = document.createElement("strong"); value.textContent = formatExerciseRecordValue(record);
        button.append(label, value); button.addEventListener("click", () => onSelectMetric(key));
        const date = createDateButton(record.session.startedAt, record.session, onOpenWorkout, "workout-summary-history-record-date");
        item.append(button, date); list.appendChild(item);
    });
    section.append(title, list); container.appendChild(section);
}

function renderExerciseProgressChart(container, historyRecords, onOpenWorkout) {
    if (!historyRecords.length) return () => {};
    const timeline = getExerciseMetricTimeline(historyRecords), available = EXERCISE_RECORD_ORDER.filter(key => timeline.some(item => item.metrics[key]));
    if (!available.length) return () => {};
    const section = document.createElement("section"); section.className = "history-exercise-chart";
    const toolbar = document.createElement("div"); toolbar.className = "history-chart-toolbar";
    const metricLabel = document.createElement("label"); metricLabel.textContent = "Graphique ";
    const metricSelect = document.createElement("select"); metricSelect.setAttribute("aria-label", "Métrique de progression");
    available.forEach(key => { const option = document.createElement("option"); option.value = key; option.textContent = EXERCISE_RECORD_LABELS[key]; metricSelect.appendChild(option); });
    const savedMetric = getSelectedChartMetric("exercise");
    if (available.includes(savedMetric)) metricSelect.value = savedMetric;
    const rangeLabel = document.createElement("label"); rangeLabel.textContent = "Période ";
    const rangeSelect = document.createElement("select"); rangeSelect.setAttribute("aria-label", "Période de progression");
    [[8, "8 séances"], [12, "12 séances"], [26, "26 séances"], [0, "Toutes"]].forEach(([count, label]) => { const option = document.createElement("option"); option.value = String(count); option.textContent = label; rangeSelect.appendChild(option); });
    metricLabel.appendChild(metricSelect); rangeLabel.appendChild(rangeSelect); toolbar.append(metricLabel, rangeLabel);
    const restoreRange = () => { rangeSelect.value = String(getChartPreferences("exercise", metricSelect.value).range ?? 8); };
    restoreRange();
    const canvasHost = document.createElement("div"); canvasHost.className = "history-chart-canvas";
    const canvas = document.createElement("canvas"); canvas.setAttribute("aria-label", "Évolution des performances; sélectionner un point pour ouvrir son entraînement"); canvas.setAttribute("role", "img"); canvasHost.appendChild(canvas);
    const message = document.createElement("p"); message.className = "history-chart-message";
    message.textContent = "Sélectionne un point pour afficher le récapitulatif correspondant.";
    const disclaimer = document.createElement("p"); disclaimer.className = "history-chart-message";
    disclaimer.textContent = "Les estimations sont indicatives.";
    disclaimer.hidden = !metricSelect.value.startsWith("estimated");
    section.append(toolbar, canvasHost, message, disclaimer);
    container.appendChild(section);
    let chart = null, version = 0;
    async function refresh() {
        const request = ++version, key = metricSelect.value, count = Number(rangeSelect.value);
        disclaimer.hidden = !key.startsWith("estimated");
        const filtered = timeline.filter(item => item.metrics[key]);
        const selected = count ? filtered.slice(-count) : filtered;
        const latestUnit = [...filtered].reverse().find(item => ["maxWeight", "singleVolume", "totalVolume", "estimated1RM", "estimatedFiveSeconds"].includes(key) && item.metrics[key]?.unit)?.metrics[key]?.unit;
        const points = selected.map(item => {
            const metric = item.metrics[key];
            const weighted = ["maxWeight", "singleVolume", "totalVolume", "estimated1RM", "estimatedFiveSeconds"].includes(key);
            return { date: item.record.session.startedAt, session: item.record.session, value: weighted && latestUnit ? convertWeight(metric.compareValue, "kg", latestUnit) : metric.compareValue };
        });
        const old = chart; chart = null;
        const axisLabel = { estimatedReps: "Répétitions estimées", estimated1RM: "1RM estimé", estimatedFiveSeconds: "Charge estimée sur 5 s" }[key] ?? EXERCISE_RECORD_LABELS[key];
        try {
            const next = await renderProgressChart(canvas, points, { label: EXERCISE_RECORD_LABELS[key], axisLabel, unit: latestUnit ? (["singleVolume", "totalVolume"].includes(key) ? `${latestUnit}·rep` : latestUnit) : (key.toLowerCase().includes("duration") ? "sec" : "reps"), existing: old, onSelect: point => onOpenWorkout(point.session) });
            if (version !== request) next?.destroy(); else chart = next;
        } catch (error) {
            old?.destroy();
            if (version === request) message.textContent = /Chart\.js (est absent|n'a pas été chargé)/.test(error?.message ?? "") ? "Chart.js est absent de js/vendor/chartjs/." : "Impossible d'afficher le graphique pour le moment.";
            console.warn("Graphique exercice indisponible :", error);
        }
    }
    const selectMetric = () => {
        restoreRange();
        saveChartPreferences("exercise", metricSelect.value);
        return refresh();
    };
    metricSelect.addEventListener("change", selectMetric);
    rangeSelect.addEventListener("change", () => {
        saveChartPreferences("exercise", metricSelect.value, { range: Number(rangeSelect.value) });
        return refresh();
    });
    requestAnimationFrame(refresh);
    return key => { if (!available.includes(key)) return; metricSelect.value = key; selectMetric(); section.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
}

function createExerciseHistoryWorkout(record, onOpenWorkout, currentRecordCount) {
    const row = document.createElement("article");
    row.className = "workout-summary-history-workout";
    const dateColumn = document.createElement("div");
    dateColumn.className = "workout-summary-history-date-column";
    dateColumn.appendChild(createDateButton(record.session.startedAt, record.session, onOpenWorkout, "workout-summary-history-date"));
    if (currentRecordCount > 0) {
        const records = document.createElement("span");
        records.className = "history-exercise-current-records";
        records.textContent = `🏆 ${currentRecordCount} record${currentRecordCount > 1 ? "s" : ""} actuel${currentRecordCount > 1 ? "s" : ""}`;
        dateColumn.appendChild(records);
    }
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

function renderExerciseHistoryPanel(host, { exercise, workoutHistory = [], onOpenWorkout = async () => {}, scrollIntoView = true, expanded = true } = {}) {
    if (!host || !exercise) return;
    const historyRecords = getExerciseHistory(workoutHistory, exercise);
    const currentRecords = getExerciseRecords(historyRecords);
    const recordCounts = new Map();
    Object.values(currentRecords).filter(Boolean).forEach(record => {
        const sessionId = String(record.session.id);
        recordCounts.set(sessionId, (recordCounts.get(sessionId) ?? 0) + 1);
    });
    host.querySelectorAll("canvas").forEach(canvas => globalThis.Chart?.getChart(canvas)?.destroy());
    host.replaceChildren();
    host.hidden = false;
    const panel = document.createElement("section");
    panel.className = expanded ? "workout-summary-history-panel is-open" : "workout-summary-history-panel";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "workout-summary-history-toggle";
    toggle.setAttribute("aria-expanded", String(expanded));
    const title = document.createElement("strong");
    title.textContent = `Historique — ${exercise.nom}`;
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    toggle.append(title, arrow);
    const content = document.createElement("div");
    content.className = "workout-summary-history-content";
    content.hidden = !expanded;
    const graphHost = document.createElement("div");
    renderExerciseRecords(content, historyRecords, onOpenWorkout, key => selectGraph(key));
    content.appendChild(graphHost);
    const selectGraph = renderExerciseProgressChart(graphHost, historyRecords, onOpenWorkout);
    const workouts = document.createElement("div");
    workouts.className = "workout-summary-history-workouts";
    if (historyRecords.length) historyRecords.forEach(record => workouts.appendChild(createExerciseHistoryWorkout(record, onOpenWorkout, recordCounts.get(String(record.session.id)) ?? 0)));
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
        if (open) requestAnimationFrame(() => content.querySelectorAll("canvas").forEach(canvas => globalThis.Chart?.getChart(canvas)?.resize()));
    });
    panel.append(toggle, content);
    host.appendChild(panel);
    if (scrollIntoView) requestAnimationFrame(() => host.scrollIntoView({ block: "nearest", behavior: "smooth" }));
}

export { formatExerciseRecordValue, renderExerciseHistoryPanel };
