async function loadHTML() {

    const pages = {
        "page-exercises": "html/exercises.html",
        "page-plans": "html/plans.html"
    };

    try {

        for (const [elementId, filePath] of Object.entries(pages)) {

            const container = document.getElementById(elementId);
            const response = await fetch(filePath);

            if (!response.ok) {
                throw new Error(`Impossible de charger ${filePath}`);
            }

            container.innerHTML = await response.text();
        }

        // Le HTML doit être chargé avant app.js
        const appScript = document.createElement("script");
        appScript.src = "js/app.js";
        document.body.appendChild(appScript);

    } catch (error) {
        console.error("Erreur lors du chargement du HTML :", error);
    }
}

loadHTML();