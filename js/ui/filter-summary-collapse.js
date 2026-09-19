// ============================================================
// RÉDUCTION DES RÉSUMÉS DE FILTRES
// ============================================================

const states = new WeakMap();

function getRow(summary) {
    return summary?.closest(".filter-row, .plan-filter-row") ?? null;
}

function getOptions(summary) {
    const row = getRow(summary);
    if (!row) return null;
    if (row.classList.contains("plan-filter-row")) return row.querySelector(".plan-filter-options");

    const options = row.nextElementSibling;
    return options?.classList.contains("filter-options") ? options : null;
}

function isEditing(summary) {
    return getOptions(summary)?.classList.contains("open") === true;
}

function getLineTops(elements) {
    const tops = [];

    elements.forEach(element => {
        const top = element.offsetTop;
        if (!tops.some(value => Math.abs(value - top) <= 1)) tops.push(top);
    });

    return tops.sort((a, b) => a - b);
}

function setToggle(toggle, expanded) {
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", expanded ? "Afficher seulement le résumé" : "Afficher tout le résumé");
    toggle.title = expanded ? "Réduire" : "Afficher tout";
}

function createState(summary, mode) {
    const row = getRow(summary);
    if (!row) return null;

    const options = row.querySelector(".plan-filter-options");
    const toggle = document.createElement("button");

    toggle.type = "button";
    toggle.classList.add("filter-summary-toggle");

    if (mode === "normal") summary.prepend(toggle);
    else row.insertBefore(toggle, options);

    let extra = null;
    let extraItems = null;
    let more = null;

    if (mode === "normal") {
        more = document.createElement("span");
        more.classList.add("filter-summary-more");
        more.textContent = "...";
        more.hidden = true;
        summary.appendChild(more);

        extra = document.createElement("div");
        extra.classList.add("filter-summary-extra");

        const guide = document.createElement("div");
        guide.classList.add("filter-summary-guide");

        extraItems = document.createElement("div");
        extraItems.classList.add("filter-summary-extra-items");

        extra.append(guide, extraItems);
        row.insertBefore(extra, options);
    }

    const state = {
        row,
        mode,
        toggle,
        extra,
        extraItems,
        more,
        scheduled: false,
        observedWidth: row.getBoundingClientRect().width
    };

    states.set(summary, state);

    toggle.addEventListener("click", event => {
        event.stopPropagation();
        if (isEditing(summary) && mode !== "progression") return;

        summary.dataset.summaryPreference =
            summary.dataset.summaryPreference === "expanded" ? "collapsed" : "expanded";

        scheduleSync(summary);
    });

    if ("ResizeObserver" in window) {
        state.observer = new ResizeObserver(entries => {
            const width = entries[0]?.contentRect.width ?? 0;
            if (Math.abs(width - state.observedWidth) < 0.5) return;

            state.observedWidth = width;
            scheduleSync(summary);
        });

        state.observer.observe(row);
    }

    return state;
}

function resetRowState(state) {
    state.row.classList.remove("summary-overflow", "summary-expanded", "summary-guide-hidden");
    state.toggle.hidden = true;
    if (state.extra) state.extra.hidden = true;
    if (state.more) state.more.hidden = true;
}

function syncNormal(summary, state) {
    const { row, toggle, extra, extraItems, more } = state;

    if (!toggle.isConnected) summary.prepend(toggle);
    if (!more.isConnected) summary.appendChild(more);

    toggle.hidden = true;
    more.hidden = true;

    const buttons = [
        ...summary.querySelectorAll(":scope > .summary-button"),
        ...extraItems.querySelectorAll(":scope > .summary-button")
    ];

    buttons.forEach(button => summary.insertBefore(button, more));
    extraItems.replaceChildren();

    if (!buttons.length) return resetRowState(state);

    const initialTops = getLineTops(buttons);
    if (initialTops.length <= 2) return resetRowState(state);

    row.classList.add("summary-overflow");
    toggle.hidden = false;

    const tops = getLineTops(buttons);
    const secondTop = tops[1] ?? tops[0];

    buttons
        .filter(button => button.offsetTop > secondTop + 1)
        .forEach(button => extraItems.appendChild(button));

    summary.dataset.summaryPreference ??= "collapsed";

    const expanded = isEditing(summary) || summary.dataset.summaryPreference === "expanded";

    row.classList.toggle("summary-expanded", expanded);
    extra.hidden = !expanded;
    more.hidden = expanded;

    if (!expanded) {
        more.hidden = false;

        const visible = [...summary.querySelectorAll(":scope > .summary-button")];

        while (more.offsetTop > secondTop + 1 && visible.length) {
            extraItems.prepend(visible.pop());
        }
    } else {
        const title = row.querySelector(".filter-title, .plan-filter-title");
        const titleBottom = title?.getBoundingClientRect().bottom ?? 0;
        const extraTop = extra.getBoundingClientRect().top;
        const rise = Math.max(0, Math.round(extraTop - titleBottom));

        extra.style.setProperty("--summary-guide-rise", `${rise}px`);
    }

    setToggle(toggle, expanded);
}

function getProgressionMore(items) {
    let more = items.querySelector(":scope > .progression-summary-more");
    if (more) return more;

    more = document.createElement("span");
    more.classList.add("progression-summary-more");
    more.textContent = "...";
    more.hidden = true;

    items.appendChild(more);
    return more;
}

function resetProgressionItems(items) {
    const buttons = [...items.querySelectorAll(":scope > .summary-button")];
    const more = getProgressionMore(items);

    buttons.forEach(button => button.hidden = false);
    more.hidden = true;

    return buttons;
}

function collapseProgressionItems(items) {
    const buttons = resetProgressionItems(items);
    const more = getProgressionMore(items);
    if (!buttons.length) return;

    more.hidden = false;

    const visible = [...buttons];
    const limit = items.getBoundingClientRect().right;

    while (more.getBoundingClientRect().right > limit + 1 && visible.length) {
        visible.pop().hidden = true;
    }
}

function syncProgressionGuide(summary, row, expanded) {
    if (!expanded) {
        row.classList.remove("summary-guide-hidden");
        return;
    }

    const title = row.querySelector(".filter-title");
    if (!title) return;

    const titleRect = title.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    const wrapped = summaryRect.top >= titleRect.bottom - 1;

    row.classList.toggle("summary-guide-hidden", wrapped);
}

function syncProgression(summary, state) {
    const { row, toggle } = state;
    const itemsList = [...summary.querySelectorAll(".selected-items")];

    itemsList.forEach(resetProgressionItems);

    summary.dataset.summaryPreference ??= "collapsed";

    const expanded = summary.dataset.summaryPreference === "expanded";

    // Toujours mesurer dans la disposition repliée.
    row.classList.remove("summary-expanded");
    row.classList.add("summary-progression");
    summary.classList.add("summary-collapsed");

    const overflow = itemsList.some(items => {
        if (!items.querySelector(".summary-button")) return false;
        return items.scrollWidth > items.clientWidth + 1;
    });

    if (!overflow) {
        summary.classList.remove("summary-collapsed");
        row.classList.remove("summary-overflow", "summary-expanded");
        toggle.hidden = true;
        itemsList.forEach(resetProgressionItems);
        return;
    }

    row.classList.add("summary-overflow");
    toggle.hidden = false;

    if (expanded) {
        row.classList.add("summary-expanded");
        summary.classList.remove("summary-collapsed");
        itemsList.forEach(resetProgressionItems);
    } else {
        row.classList.remove("summary-expanded");
        summary.classList.add("summary-collapsed");
        itemsList.forEach(collapseProgressionItems);
    }

    setToggle(toggle, expanded);
    syncProgressionGuide(summary, row, expanded);
}

function syncFilterSummaryCollapse(summary) {
    const state = states.get(summary);
    if (!state) return;

    state.mode === "progression"
        ? syncProgression(summary, state)
        : syncNormal(summary, state);
}

function scheduleSync(summary) {
    const state = states.get(summary);
    if (!state || state.scheduled) return;

    state.scheduled = true;

    requestAnimationFrame(() => {
        state.scheduled = false;
        syncFilterSummaryCollapse(summary);
    });
}

function updateFilterSummaryCollapse(summary, { mode = "normal" } = {}) {
    if (!summary) return;

    let state = states.get(summary);
    if (!state) state = createState(summary, mode);
    if (!state) return;

    state.row.classList.add("has-collapsible-summary");
    summary.classList.add("filter-summary-collapsible");

    if (mode === "progression") state.row.classList.add("summary-progression");

    if (state.mode === "normal") state.extraItems.replaceChildren();

    scheduleSync(summary);
}

function refreshFilterSummaryCollapse(summary) {
    if (!summary || !states.has(summary)) return;
    scheduleSync(summary);
}

export { refreshFilterSummaryCollapse, updateFilterSummaryCollapse };