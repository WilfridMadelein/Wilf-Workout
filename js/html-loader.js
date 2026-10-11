import { loadLastPage } from "./storage/app-resume-storage.js";

// ============================================================
// CHARGEMENT DE L’INTERFACE — PRIORITÉ À LA DERNIÈRE PAGE
// ============================================================

const APP_ASSET_VERSION = "2026-10-10-performance-abc";
const pages = {
    exercises: ["page-exercises", "html/exercises.html"],
    plans: ["page-plans", "html/plans.html"],
    history: ["page-history", "html/history.html"],
    settings: ["page-settings", "html/settings.html"],
    summary: ["page-workout-summary", "html/workout-summary.html"],
    workout: ["page-workout-execution", "html/workout-execution.html"]
};

async function fetchPage([id, path]) {
    const response = await fetch(`${path}?v=${APP_ASSET_VERSION}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Impossible de charger ${path} (${response.status}).`);
    return { id, html: await response.text() };
}

async function loadHTML() {
    const preferred = loadLastPage();
    const status = document.getElementById("wilf-startup-status");
    const labels = { exercises: "Exercices", plans: "Mes plans", history: "Historique", settings: "Paramètres" };
    const entries = [pages[preferred], ...Object.entries(pages).filter(([name]) => name !== preferred).map(([, entry]) => entry)];
    const preferredId = pages[preferred][0];

    performance.mark("wilf:html-start");
    status.textContent = `Ouverture de ${labels[preferred]}…`;
    ["exercises", "plans", "history", "settings"].forEach(name => {
        const id = pages[name][0];
        document.getElementById(id).style.display = id === preferredId ? "block" : "none";
    });
    document.querySelectorAll(".main-tab").forEach(tab => {
        const active = tab.id === `tab-${preferred}`;
        tab.classList.toggle("active", active);
        if (active) tab.setAttribute("aria-current", "page");
        else tab.removeAttribute("aria-current");
    });

    // Les six requêtes partent immédiatement. Le fragment visible est inséré en premier;
    // les autres éléments DOM sont indispensables à app-state.js avant l'initialisation.
    const requests = entries.map(fetchPage);
    const visible = await requests[0];
    document.getElementById(visible.id).innerHTML = visible.html;
    performance.mark("wilf:preferred-html-ready");
    const remaining = await Promise.all(requests.slice(1));
    remaining.forEach(({ id, html }) => { document.getElementById(id).innerHTML = html; });
    performance.mark("wilf:html-ready");

    const appScript = document.createElement("script");
    appScript.type = "module";
    appScript.src = `js/app.js?v=${APP_ASSET_VERSION}`;
    appScript.onerror = () => { status.textContent = "Impossible de démarrer Wilf. Rechargez la page."; };
    document.body.appendChild(appScript);
}

loadHTML().catch(error => {
    console.error("Erreur lors du chargement de Wilf :", error);
    document.getElementById("wilf-startup-status").textContent = "Impossible de charger Wilf. Vérifiez la connexion puis rechargez la page.";
});
