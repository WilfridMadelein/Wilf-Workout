import { getLastHighestIndex } from "./history-chart-data.js";

// ============================================================
// GRAPHES — CHART.JS LOCAL (un canevas par espace)
// ============================================================
let loadingChart = null;
const chartRequests = new WeakMap();
function getChartLibrary() {
    if (globalThis.Chart) return Promise.resolve(globalThis.Chart);
    if (loadingChart) return loadingChart;
    loadingChart = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "js/vendor/chartjs/chart.umd.min.js";
        script.onload = () => globalThis.Chart ? resolve(globalThis.Chart) : reject(new Error("Chart.js n'a pas été chargé"));
        script.onerror = () => reject(new Error("Chart.js est absent de js/vendor/chartjs/"));
        document.head.appendChild(script);
    }).catch(error => { loadingChart = null; throw error; });
    return loadingChart;
}
const trophyPlugin = {
    id: "wilfTrophy",
    afterDatasetsDraw(chart) {
        const index = chart.options.plugins?.wilfTrophy?.index;
        if (!Number.isInteger(index) || index < 0) return;
        const meta = chart.getDatasetMeta(chart.data.datasets.findIndex(item => item.type === "line" || !item.type));
        const point = meta?.data[index];
        if (!point || point.skip) return;
        const { ctx } = chart;
        ctx.save(); ctx.font = "19px system-ui, 'Segoe UI Emoji'"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("🏆", point.x, point.y - 12); ctx.restore();
    }
};
function chartColors() {
    const dark = document.documentElement.dataset.theme === "dark";
    return { line: "#ef820d", fill: "rgba(242,140,40,0.16)", grid: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)", text: dark ? "#e1e1e1" : "#555" };
}
async function renderProgressChart(canvas, points, { label, axisLabel = label, unit = "", bars = false, onSelect = () => {}, showTrophy = true, existing = null } = {}) {
    existing?.destroy();
    if (!canvas) return null;
    const request = (chartRequests.get(canvas) ?? 0) + 1;
    chartRequests.set(canvas, request);
    if (!canvas.isConnected || !points.length) { globalThis.Chart?.getChart(canvas)?.destroy(); return null; }
    const Chart = await getChartLibrary();
    if (!canvas.isConnected || chartRequests.get(canvas) !== request) return null;
    Chart.getChart(canvas)?.destroy();
    Chart.register(trophyPlugin);
    const colors = chartColors(), data = points.map(item => Math.round(item.value * 100) / 100);
    const datasets = bars ? [
        { type: "bar", label, data, backgroundColor: colors.fill, borderColor: colors.line, borderWidth: 1, borderRadius: 5, order: 2 },
        { type: "line", label, data, borderColor: colors.line, backgroundColor: colors.line, pointBackgroundColor: colors.line, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.4, tension: 0.2, fill: false, order: 1 }
    ] : [{ type: "line", label, data, borderColor: colors.line, pointBackgroundColor: colors.line, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.4, tension: 0.2, fill: true, backgroundColor: colors.fill }];
    return new Chart(canvas, {
        type: "line", data: { labels: points.map(item => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(new Date(item.date))), datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, animation: false,
            layout: { padding: { top: showTrophy ? 24 : 0, left: 12, right: 12 } },
            plugins: { legend: { display: false }, wilfTrophy: { index: showTrophy ? getLastHighestIndex(points) : -1 }, tooltip: { filter: context => !bars || context.dataset.type === "line", callbacks: { label: context => `${label} : ${context.parsed.y.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}` } } },
            scales: { x: { offset: true, ticks: { color: colors.text, maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } }, y: { beginAtZero: true, grace: showTrophy ? "30%" : "5%", title: { display: true, text: unit ? `${axisLabel} (${unit})` : axisLabel, color: colors.text, font: { size: 11 } }, ticks: { color: colors.text, precision: unit === "séances" ? 0 : undefined }, grid: { color: colors.grid } } },
            onClick: (_event, elements) => { if (elements.length) onSelect(points[elements[0].index]); },
            onHover: (event, elements) => { if (event.native?.target?.style) event.native.target.style.cursor = elements.length ? "pointer" : "default"; }
        }
    });
}
export { renderProgressChart };
