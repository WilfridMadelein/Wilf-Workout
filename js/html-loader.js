const APP_ASSET_VERSION = "2026-10-06-resume-v1";

async function loadHTML() {
    const pages = {
        "page-exercises": "html/exercises.html",
        "page-plans": "html/plans.html",
        "page-history": "html/history.html",
        "page-settings": "html/settings.html",
        "page-workout-summary": "html/workout-summary.html",
        "page-workout-execution": "html/workout-execution.html"
    };

    try {
        for (const [elementId, filePath] of Object.entries(pages)) {
            const container = document.getElementById(elementId);
            const response = await fetch(`${filePath}?v=${APP_ASSET_VERSION}`, { cache: "no-store" });

            if (!response.ok) throw new Error(`Impossible de charger ${filePath}`);
            container.innerHTML = await response.text();
        }

        const appScript = document.createElement("script");
        appScript.type = "module";
        appScript.src = `js/app.js?v=${APP_ASSET_VERSION}`;
        document.body.appendChild(appScript);
    } catch (error) {
        console.error("Erreur lors du chargement du HTML :", error);
    }
}

loadHTML();