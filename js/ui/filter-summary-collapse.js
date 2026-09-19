// ============================================================
// RÉDUCTION DES RÉSUMÉS DE FILTRES
// ============================================================

const observers = new WeakMap();

function syncFilterSummaryCollapse(summary) {
    const buttons = [
        ...summary.children
    ].filter(child =>
        child.classList?.contains("summary-button")
    );

    const toggle = summary.querySelector(
        ":scope > .filter-summary-toggle"
    );

    if (!toggle || !buttons.length) {
        summary.classList.remove(
            "has-summary-overflow"
        );

        if (toggle) toggle.hidden = true;
        return;
    }

    const firstTop = buttons[0].offsetTop;

    const wrapped = buttons.some(
        button =>
            button.offsetTop >
            firstTop + 1
    );

    summary.style.setProperty(
        "--summary-row-height",
        `${buttons[0].offsetHeight}px`
    );

    summary.classList.toggle(
        "has-summary-overflow",
        wrapped
    );

    toggle.hidden = !wrapped;

    const collapsed =
        summary.classList.contains(
            "summary-collapsed"
        );

    toggle.setAttribute(
        "aria-expanded",
        String(!collapsed)
    );

    toggle.setAttribute(
        "aria-label",
        collapsed
            ? "Afficher tous les filtres sélectionnés"
            : "Masquer les lignes supplémentaires"
    );

    toggle.title =
        collapsed
            ? "Afficher tout"
            : "Réduire";
}

function updateFilterSummaryCollapse(summary) {
    if (!summary) return;

    summary.classList.add(
        "filter-summary-collapsible"
    );

    let toggle = summary.querySelector(
        ":scope > .filter-summary-toggle"
    );

    if (!toggle) {
        toggle = document.createElement("button");

        toggle.type = "button";

        toggle.classList.add(
            "filter-summary-toggle"
        );

        toggle.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                summary.classList.toggle(
                    "summary-collapsed"
                );

                syncFilterSummaryCollapse(
                    summary
                );
            }
        );

        summary.appendChild(toggle);
    }

    if (
        !observers.has(summary) &&
        "ResizeObserver" in window
    ) {
        const observer =
            new ResizeObserver(() => {
                requestAnimationFrame(() =>
                    syncFilterSummaryCollapse(
                        summary
                    )
                );
            });

        observer.observe(summary);
        observers.set(summary, observer);
    }

    requestAnimationFrame(() =>
        syncFilterSummaryCollapse(summary)
    );
}

export {
    updateFilterSummaryCollapse
};