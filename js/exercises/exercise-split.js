// ============================================================
// SPLIT / ALTERNE
// ============================================================

const DEFAULT_SPLIT_ORDER = "left-right";

function normalizeSplitOrder(value) {
    return value === "right-left" ? "right-left" : DEFAULT_SPLIT_ORDER;
}

function getSplitOrderText(value) {
    return normalizeSplitOrder(value) === "right-left"
        ? "Droite - Gauche"
        : "Gauche - Droite";
}

function getExerciseSplitType(exercise) {
    const value = String(exercise?.split ?? "").trim().toLowerCase();

    if (value === "true") return "split";
    if (value === "alterne") return "alternate";
    return "none";
}

function getExerciseSplitDetailText(exercise) {
    const type = getExerciseSplitType(exercise);

    if (type === "split") return "Split set";
    if (type === "alternate") return "Set Alterné";
    return "";
}

function getPlanExerciseSplitInfo(planExercise) {
    const type = getExerciseSplitType(planExercise?.exercise);
    if (type === "none") return null;

    return {
        label: type === "split" ? "Split" : "Alterne",
        order: getSplitOrderText(planExercise?.splitOrder)
    };
}

export {
    DEFAULT_SPLIT_ORDER,
    normalizeSplitOrder,
    getSplitOrderText,
    getExerciseSplitType,
    getExerciseSplitDetailText,
    getPlanExerciseSplitInfo
};