// ============================================================
// STATISTIQUES CHRONOLOGIQUES — aucune donnée dérivée sauvegardée
// ============================================================
function dateKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfWeek(value, firstDay = 1) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() - firstDay + 7) % 7));
    return date;
}
function shiftDays(value, days) { const date = new Date(value); date.setDate(date.getDate() + days); return date; }
function getWorkoutChartData(history, metric, firstDay = 1, range = 12) {
    const sorted = [...history].filter(item => Number.isFinite(Number(item.startedAt))).sort((a, b) => Number(a.startedAt) - Number(b.startedAt));
    if (metric === "durationSession") return sorted.slice(range ? -range : 0).map(session => ({ key: dateKey(session.startedAt), date: session.startedAt, session, value: Math.max(0, Number(session.elapsedSeconds) || 0) / 60 }));
    const todayWeek = startOfWeek(Date.now(), firstDay);
    const start = range ? shiftDays(todayWeek, -(range - 1) * 7) : sorted.length ? startOfWeek(sorted[0].startedAt, firstDay) : todayWeek;
    const points = [], groups = new Map();
    for (let day = new Date(start); day <= todayWeek; day = shiftDays(day, 7)) {
        const key = dateKey(day);
        const point = { key, date: day.getTime(), sessions: [], value: 0 };
        points.push(point); groups.set(key, point);
    }
    sorted.forEach(session => {
        const point = groups.get(dateKey(startOfWeek(session.startedAt, firstDay)));
        if (!point) return;
        point.sessions.push(session);
        point.value += metric === "durationWeek" ? Math.max(0, Number(session.elapsedSeconds) || 0) / 60 : 1;
    });
    return points;
}
function getLastHighestIndex(points) {
    const maximum = Math.max(0, ...points.map(point => Number(point.value) || 0));
    return maximum > 0 ? points.findLastIndex(point => Number(point.value) === maximum) : -1;
}
export { dateKey, startOfWeek, shiftDays, getWorkoutChartData, getLastHighestIndex };
