// ============================================================
// OUTILS D'INTERFACE
// ============================================================

// ------------------------------------------------------------
// Création d'éléments
// ------------------------------------------------------------

function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) {
        element.className = options.className;
    }

    if (options.textContent !== undefined) {
        element.textContent = options.textContent;
    }

    if (options.html !== undefined) {
        element.innerHTML = options.html;
    }

    if (options.attributes) {
        Object.entries(options.attributes).forEach(
            ([name, value]) => {
                element.setAttribute(name, value);
            }
        );
    }

    return element;
}

// ------------------------------------------------------------
// Affichage / masquage
// ------------------------------------------------------------

function showElement(element) {
    if (!element) {
        return;
    }

    element.style.display = "";
}

function hideElement(element) {
    if (!element) {
        return;
    }

    element.style.display = "none";
}

function toggleElement(element, visible) {
    if (visible) {
        showElement(element);
    } else {
        hideElement(element);
    }
}

// ------------------------------------------------------------
// Classes
// ------------------------------------------------------------

function setActive(element, active) {
    if (!element) {
        return;
    }

    element.classList.toggle(
        "active",
        active
    );
}

// ============================================================
// EXPORTS
// ============================================================

export {
    createElement,
    showElement,
    hideElement,
    toggleElement,
    setActive
};