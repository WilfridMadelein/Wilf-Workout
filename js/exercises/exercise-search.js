// ============================================================
// RECHERCHE DES EXERCICES
// ============================================================

// Normalisation de la recherche
function normalizeSearchText(text) {
    return String(text || "")
        .trim()
        .toLowerCase();
}

function getSearchTerms(searchText) {
    return normalizeSearchText(searchText)
        .split(/\s+/)
        .filter(Boolean);
}

// Informations de progression
function getProgressionName(exercise) {
    return String(exercise.prog_group || "").trim();
}

function getProgressionDisplay(exercise) {
    const progression = getProgressionName(exercise);
    const ordre = exercise.prog_ordre;

    if (!progression) {
        return "";
    }

    if (
        ordre !== undefined &&
        ordre !== null &&
        ordre !== ""
    ) {
        return `${progression} ${ordre}`;
    }

    return progression;
}

function isIsometricExercise(exercise) {
    const type = String(exercise.type).toLowerCase().trim();

    return (
        type === "iso" ||
        type === "isométrique" ||
        type === "isometric"
    );
}

// Recherche des occurrences
function findTermMatches(text, term) {
    const normalizedText = normalizeSearchText(text);
    const matches = [];

    if (!normalizedText || !term) {
        return matches;
    }

    let startIndex = 0;

    while (true) {
        const index = normalizedText.indexOf(
            term,
            startIndex
        );

        if (index === -1) {
            break;
        }

        matches.push({
            start: index,
            end: index + term.length
        });

        startIndex = index + 1;
    }

    return matches;
}

function findValidTermCombination(text, searchTerms) {
    const normalizedText = normalizeSearchText(text);

    if (!normalizedText || searchTerms.length === 0) {
        return null;
    }

    const matchesByTerm = searchTerms.map(term =>
        findTermMatches(normalizedText, term)
    );

    if (matchesByTerm.some(matches => matches.length === 0)) {
        return null;
    }

    function search(
        termIndex,
        usedRanges,
        selectedMatches
    ) {
        if (termIndex === searchTerms.length) {
            return selectedMatches;
        }

        for (const match of matchesByTerm[termIndex]) {
            const overlaps = usedRanges.some(range =>
                match.start < range.end &&
                match.end > range.start
            );

            if (overlaps) {
                continue;
            }

            const result = search(
                termIndex + 1,
                [...usedRanges, match],
                [...selectedMatches, match]
            );

            if (result) {
                return result;
            }
        }

        return null;
    }

    return search(0, [], []);
}

// ============================================================
// CLASSEMENT DES RÉSULTATS
// ============================================================

function getMatchQuality(text, term, match) {
    const normalizedText = normalizeSearchText(text);
    const normalizedTerm = normalizeSearchText(term);

    if (
        !normalizedText ||
        !normalizedTerm ||
        !match
    ) {
        return 0;
    }

    const before = normalizedText[match.start - 1] || "";
    const matchedText =
        normalizedText.slice(match.start, match.end);

    // Correspondance exacte du texte
    if (matchedText === normalizedTerm) {
        // Mot complet
        const after = normalizedText[match.end] || "";

        const isWordStart =
            match.start === 0 ||
            /\s/.test(before);

        const isWordEnd =
            match.end === normalizedText.length ||
            /\s/.test(after);

        if (isWordStart && isWordEnd) {
            return 5;
        }

        // Début d'un mot
        if (isWordStart) {
            return 4;
        }

        return 3;
    }

    return 1;
}

function getSearchCriteria(text, searchTerms) {
    if (
        !text ||
        searchTerms.length === 0
    ) {
        return null;
    }

    const matches = [];

    searchTerms.forEach(term => {
        const termMatches = findTermMatches(text, term);

        if (termMatches.length === 0) {
            return;
        }

        let bestMatch = null;
        let bestQuality = 0;

        termMatches.forEach(match => {
            const quality = getMatchQuality(
                text,
                term,
                match
            );

            if (quality > bestQuality) {
                bestQuality = quality;
                bestMatch = match;
            }
        });

        if (bestMatch) {
            matches.push({
                term,
                match: bestMatch
            });
        }
    });

    if (matches.length === 0) {
        return null;
    }

    let bestQuality = 0;
    let bestPosition = Infinity;

    matches.forEach(item => {
        const quality = getMatchQuality(
            text,
            item.term,
            item.match
        );

        bestQuality = Math.max(
            bestQuality,
            quality
        );

        bestPosition = Math.min(
            bestPosition,
            item.match.start
        );
    });

    const allTermsExact =
        matches.length === searchTerms.length &&
        matches.every(match =>
            getMatchQuality(
                text,
                match.term,
                match.match
            ) === 5
        );

    const allTermsAtWordStart =
        matches.length === searchTerms.length &&
        matches.every(match =>
            getMatchQuality(
                text,
                match.term,
                match.match
            ) >= 4
        );

    return {
        matches,
        quality: bestQuality,
        position: bestPosition,
        allTermsExact,
        allTermsAtWordStart
    };
}

function compareSearchCriteria(a, b) {
    if (a.quality !== b.quality) {
        return b.quality - a.quality;
    }

    if (a.position !== b.position) {
        return a.position - b.position;
    }

    if (a.allTermsExact !== b.allTermsExact) {
        return b.allTermsExact - a.allTermsExact;
    }

    if (a.allTermsAtWordStart !== b.allTermsAtWordStart) {
        return b.allTermsAtWordStart - a.allTermsAtWordStart;
    }

    return 0;
}

function getExerciseSearchRanking(
    exercise,
    searchTerms
) {
    if (searchTerms.length === 0) {
        return {
            exerciseCriteria: null,
            progressionCriteria: null
        };
    }

    const exerciseCriteria = getSearchCriteria(
        exercise.nom,
        searchTerms
    );

    const progressionCriteria = getSearchCriteria(
        getProgressionName(exercise),
        searchTerms
    );

    if (
        !exerciseCriteria &&
        !progressionCriteria
    ) {
        return null;
    }

    return {
        exerciseCriteria,
        progressionCriteria
    };
}

function compareExercisesBySearch(a, b) {
    const aRanking = a.searchRanking;
    const bRanking = b.searchRanking;

    /*
     * Sans recherche :
     * progression alphabétique,
     * puis ordre de progression,
     * puis nom.
     */
    if (
        !aRanking.exerciseCriteria &&
        !aRanking.progressionCriteria &&
        !bRanking.exerciseCriteria &&
        !bRanking.progressionCriteria
    ) {
        const progressionComparison =
            getProgressionName(a.exercise).localeCompare(
                getProgressionName(b.exercise),
                "fr",
                { sensitivity: "base" }
            );

        if (progressionComparison !== 0) {
            return progressionComparison;
        }

        const orderA = Number(a.exercise.prog_ordre);
        const orderB = Number(b.exercise.prog_ordre);

        if (
            !Number.isNaN(orderA) &&
            !Number.isNaN(orderB)
        ) {
            if (orderA !== orderB) {
                return orderA - orderB;
            }
        }

        return a.exercise.nom.localeCompare(
            b.exercise.nom,
            "fr",
            { sensitivity: "base" }
        );
    }

    /*
     * Le nom de l'exercice est prioritaire.
     */
    if (
        aRanking.exerciseCriteria &&
        !bRanking.exerciseCriteria
    ) {
        return -1;
    }

    if (
        !aRanking.exerciseCriteria &&
        bRanking.exerciseCriteria
    ) {
        return 1;
    }

    if (
        aRanking.exerciseCriteria &&
        bRanking.exerciseCriteria
    ) {
        const exerciseComparison =
            compareSearchCriteria(
                aRanking.exerciseCriteria,
                bRanking.exerciseCriteria
            );

        if (exerciseComparison !== 0) {
            return exerciseComparison;
        }
    }

    /*
     * Si le nom est équivalent, on compare
     * la progression.
     */
    if (
        aRanking.progressionCriteria &&
        !bRanking.progressionCriteria
    ) {
        return -1;
    }

    if (
        !aRanking.progressionCriteria &&
        bRanking.progressionCriteria
    ) {
        return 1;
    }

    if (
        aRanking.progressionCriteria &&
        bRanking.progressionCriteria
    ) {
        const progressionComparison =
            compareSearchCriteria(
                aRanking.progressionCriteria,
                bRanking.progressionCriteria
            );

        if (progressionComparison !== 0) {
            return progressionComparison;
        }
    }

    return a.exercise.nom.localeCompare(
        b.exercise.nom,
        "fr",
        { sensitivity: "base" }
    );
}

// ============================================================
// AFFICHAGE DES CORRESPONDANCES
// ============================================================

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function highlightSearchMatches(text, searchTerms) {
    const safeText = escapeHtml(text);

    if (searchTerms.length === 0) {
        return safeText;
    }

    const escapedTerms = searchTerms
        .map(term =>
            term.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            )
        )
        .sort((a, b) => b.length - a.length);

    if (escapedTerms.length === 0) {
        return safeText;
    }

    const regex = new RegExp(
        `(${escapedTerms.join("|")})`,
        "gi"
    );

    return safeText.replace(
        regex,
        "<mark>$1</mark>"
    );
}

// ============================================================
// EXPORTS
// ============================================================

export {
    normalizeSearchText,
    getSearchTerms,
    getProgressionName,
    getProgressionDisplay,
    isIsometricExercise,
    findTermMatches,
    findValidTermCombination,
    getMatchQuality,
    getSearchCriteria,
    compareSearchCriteria,
    getExerciseSearchRanking,
    compareExercisesBySearch,
    escapeHtml,
    highlightSearchMatches
};