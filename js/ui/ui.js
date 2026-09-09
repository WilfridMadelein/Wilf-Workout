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

// ------------------------------------------------------------
// Champs numériques
// ------------------------------------------------------------

function normalizeNumber(value, {
    min = 0,
    max = 999,
    decimals = 0
} = {}) {
    let number = Number(
        String(value).replace(",", ".")
    );

    if (!Number.isFinite(number)) {
        number = min;
    }

    const factor = 10 ** decimals;

    number =
        Math.round(number * factor) /
        factor;

    return Math.min(
        max,
        Math.max(min, number)
    );
}


function updateNumberInputWidth(input, minChars = 2) {
    const length =
        String(input.value || "0").length;

    input.style.width =
        `${Math.max(minChars, length)}ch`;
}


function setupNumberInput(input, {
    min = 0,
    max = 999,
    step = 1,
    decimals = 0,
    minChars = 2,
    zeroDisplay = null,
    onChange = () => {}
} = {}) {

    if (zeroDisplay) {
        input.type = "text";
        input.inputMode = "numeric";
    }

    const getStep = () =>
        typeof step === "function"
            ? step()
            : step;

const displayValue = value => {
    input.value =
        value === 0 && zeroDisplay
            ? zeroDisplay
            : value;

    updateNumberInputWidth(input, minChars);
};

const commit = value => {
    const normalized = normalizeNumber(
        value,
        { min, max, decimals }
    );

    displayValue(normalized);
    onChange(normalized);
};

    input.min = min;
    input.max = max;

    if (typeof step !== "function") {
        input.step = step;
    }

    input.addEventListener("keydown", event => {
        const blocked = ["e", "E", "+"];

        if (min >= 0) {
            blocked.push("-");
        }

        if (decimals === 0) {
            blocked.push(".", ",");
        }

        if (blocked.includes(event.key)) {
            event.preventDefault();
        }
    });

    input.addEventListener("input", () => {
        updateNumberInputWidth(
            input,
            minChars
        );
    });

    input.addEventListener("change", () => {
        commit(input.value);
    });

    displayValue(
        normalizeNumber(
        input.value,
        { min, max, decimals }
        )
    );

return {
    step(direction, snap = false) {
        const current = normalizeNumber(
            input.value,
            { min, max, decimals }
        );

        const stepValue = getStep();

        if (!snap || stepValue <= 1) {
            commit(current + direction * stepValue);
            return;
        }

        const ratio = current / stepValue;

        const next =
            direction > 0
                ? (Math.floor(ratio) + 1) * stepValue
                : (Math.ceil(ratio) - 1) * stepValue;

        commit(next);
    }
};

}

// ============================================================
// EXPORTS
// ============================================================

export {
    createElement,
    showElement,
    hideElement,
    toggleElement,
    setActive,
    normalizeNumber,
    updateNumberInputWidth,
    setupNumberInput
};