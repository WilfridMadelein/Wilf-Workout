import { getProgressionName } from "../exercises/exercise-search.js";

let plans = [];
let downloadPlansButton;
let planPdfModal;
let planPdfSelectionList;
let cancelPlanPdfButton;
let confirmPlanPdfButton;

let getPlanSetCount = () => 0;
let getPlanPrimaryMuscles = () => [];

// ============================================================
// CONFIGURATION
// ============================================================

function configurePlanPdf(dependencies) {
    ({
        plans,
        downloadPlansButton,
        planPdfModal,
        planPdfSelectionList,
        cancelPlanPdfButton,
        confirmPlanPdfButton,
        getPlanSetCount,
        getPlanPrimaryMuscles
    } = dependencies);
}

// ============================================================
// INTERFACE
// ============================================================

function setupPlanPdf() {
    downloadPlansButton.addEventListener("click", openPlanPdfModal);
    cancelPlanPdfButton.addEventListener("click", closePlanPdfModal);
    confirmPlanPdfButton.addEventListener("click", downloadSelectedPlans);

    planPdfModal.addEventListener("click", event => {
        if (event.target === planPdfModal) closePlanPdfModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !planPdfModal.hidden) closePlanPdfModal();
    });
}

function openPlanPdfModal() {
    renderPlanPdfSelection();
    planPdfModal.hidden = false;
}

function closePlanPdfModal() {
    planPdfModal.hidden = true;
}

// ============================================================
// SÉLECTION / ORDRE
// ============================================================

function renderPlanPdfSelection() {
    planPdfSelectionList.replaceChildren();

    if (plans.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "Aucun plan à télécharger.";

        planPdfSelectionList.appendChild(empty);
        confirmPlanPdfButton.disabled = true;
        return;
    }

    plans.forEach(plan => {
        const row = document.createElement("div");
        row.classList.add("plan-pdf-selection-row");
        row.dataset.planId = String(plan.id);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.addEventListener("change", updatePlanPdfControls);

        const name = document.createElement("span");
        name.classList.add("plan-pdf-selection-name");
        name.textContent = plan.name;

        const order = document.createElement("div");
        order.classList.add("plan-pdf-order-buttons");

        [
            ["up", "▲", -1],
            ["down", "▼", 1]
        ].forEach(([direction, text, delta]) => {
            const button = document.createElement("button");

            button.type = "button";
            button.textContent = text;
            button.dataset.direction = direction;

            button.addEventListener("click", () => movePlanPdfRow(row, delta));
            order.appendChild(button);
        });

        row.append(checkbox, name, order);
        planPdfSelectionList.appendChild(row);
    });

    updatePlanPdfControls();
}

function movePlanPdfRow(row, direction) {
    if (direction < 0) {
        const previous = row.previousElementSibling;
        if (previous) planPdfSelectionList.insertBefore(row, previous);
    } else {
        const next = row.nextElementSibling;
        if (next) planPdfSelectionList.insertBefore(next, row);
    }

    updatePlanPdfControls();
}

function updatePlanPdfControls() {
    const rows = [...planPdfSelectionList.children].filter(
        row => row.dataset.planId
    );

    rows.forEach((row, index) => {
        row.querySelector('[data-direction="up"]').disabled = index === 0;

        row.querySelector('[data-direction="down"]').disabled =
            index === rows.length - 1;
    });

    confirmPlanPdfButton.disabled =
        !planPdfSelectionList.querySelector(
            'input[type="checkbox"]:checked'
        );
}

function getSelectedPlansInOrder() {
    return [...planPdfSelectionList.children]
        .filter(
            row =>
                row.dataset.planId &&
                row.querySelector('input[type="checkbox"]')?.checked
        )
        .map(row =>
            plans.find(plan => String(plan.id) === row.dataset.planId)
        )
        .filter(Boolean);
}

// ============================================================
// SETS
// ============================================================

const PDF_SET_COLORS = [
    [244, 237, 248],
    [235, 247, 240],
    [252, 244, 232]
];

function getPlanGroups(plan) {
    const groups = [];

    plan.exercises.forEach(planExercise => {
        const group = planExercise.combination?.group ?? 1;
        let groupData = groups.find(item => item.group === group);

        if (!groupData) {
            groupData = { group, exercises: [] };
            groups.push(groupData);
        }

        groupData.exercises.push(planExercise);
    });

    return groups;
}

// ============================================================
// PDF
// ============================================================

function downloadSelectedPlans() {
    const selectedPlans = getSelectedPlansInOrder();
    if (selectedPlans.length === 0) return;

    generatePlansPdf(selectedPlans);
    closePlanPdfModal();
}

function generatePlansPdf(selectedPlans) {
    const JsPdf = window.jspdf?.jsPDF;

    if (!JsPdf) {
        alert("Le générateur PDF n'est pas disponible.");
        return;
    }

    const doc = new JsPdf({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const date = new Intl.DateTimeFormat("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(new Date());

    selectedPlans.forEach((plan, index) => {
        if (index > 0) doc.addPage();
        drawPlan(doc, plan, date);
    });

    const fileDate = new Intl.DateTimeFormat("en-CA").format(new Date());

    doc.save(`wilf-workout-plans-${fileDate}.pdf`);
}

// ============================================================
// PLAN
// ============================================================

function drawPlan(doc, plan, date) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    let y = margin;

    // Nom du plan
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(plan.name, margin, y);

    // Date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Téléchargé le ${date}`, margin, y + 6);

    // Résumé
    const exerciseCount = plan.exercises.length;
    const setCount = getPlanSetCount(plan);
    const muscles = getPlanPrimaryMuscles(plan);

    doc.setFontSize(10);

    doc.text(
        `${exerciseCount} exercice${exerciseCount !== 1 ? "s" : ""} | ` +
            `${setCount} set${setCount !== 1 ? "s" : ""}`,
        margin,
        y + 12
    );

    const muscleLines = doc.splitTextToSize(
        `Muscles principaux : ${muscles.join(", ") || "aucun"}`,
        contentWidth
    );

    doc.text(muscleLines, margin, y + 18);

    y += 23 + muscleLines.length * 4;

    doc.line(margin, y, pageWidth - margin, y);
    y += 7;

    if (plan.exercises.length === 0) {
        doc.text("Aucun exercice.", margin, y);
        return;
    }

    const planOrder = new Map(
        plan.exercises.map((item, index) => [item, index + 1])
    );

    const groups = getPlanGroups(plan);
    let supersetColorIndex = 0;

    groups.forEach(groupData => {
        const isSuperset = groupData.exercises.length > 1;
        let fillColor = null;

        if (isSuperset) {
            fillColor =
                PDF_SET_COLORS[
                    supersetColorIndex % PDF_SET_COLORS.length
                ];

            supersetColorIndex++;
        }

        const result = drawSet(doc, {
            groupData,
            planOrder,
            x: margin,
            y,
            width: contentWidth,
            pageHeight,
            margin,
            fillColor,
            planName: plan.name
        });

        y = result.y;
    });
}

function drawSet(
    doc,
    {
        groupData,
        planOrder,
        x,
        y,
        width,
        pageHeight,
        margin,
        fillColor,
        planName
    }
) {
    const outerPadding = 4;
    const titleHeight = 7;
    const rowGap = 4;
    const columnGap = 5;

    const columnWidth =
        (width - outerPadding * 2 - columnGap) / 2;

    const layouts = groupData.exercises.map(planExercise =>
        getExerciseCardLayout(
            doc,
            planExercise,
            planOrder.get(planExercise) - 1,
            columnWidth
        )
    );

    const rows = [];

    for (let index = 0; index < layouts.length; index += 2) {
        rows.push({
            left: layouts[index],
            right: layouts[index + 1] ?? null
        });
    }

    let rowIndex = 0;

    while (rowIndex < rows.length) {
        const startY = y;
        const availableHeight = pageHeight - margin - startY;

        const minimumHeight =
            titleHeight +
            outerPadding * 2 +
            rows[rowIndex].left.height;

        if (availableHeight < minimumHeight) {
            doc.addPage();
            y = drawContinuationHeader(doc, planName, margin);
            continue;
        }

        const rowsForPage = [];
        let contentHeight = titleHeight + outerPadding * 2;

        while (rowIndex < rows.length) {
            const row = rows[rowIndex];

            const rowHeight = Math.max(
                row.left.height,
                row.right?.height ?? 0
            );

            const extraHeight =
                rowHeight +
                (rowsForPage.length > 0 ? rowGap : 0);

            if (
                rowsForPage.length > 0 &&
                contentHeight + extraHeight > availableHeight
            ) {
                break;
            }

            rowsForPage.push({
                ...row,
                height: rowHeight
            });

            contentHeight += extraHeight;
            rowIndex++;
        }

        drawSetPageBlock(doc, {
            group: groupData.group,
            rows: rowsForPage,
            x,
            y,
            width,
            outerPadding,
            titleHeight,
            rowGap,
            columnGap,
            columnWidth,
            fillColor,
            continuation:
                startY !== y ||
                rowIndex < rows.length
        });

        y += contentHeight + 5;

        if (rowIndex < rows.length) {
            doc.addPage();
            y = drawContinuationHeader(doc, planName, margin);
        }
    }

    return { y };
}

function drawSetPageBlock(
    doc,
    {
        group,
        rows,
        x,
        y,
        width,
        outerPadding,
        titleHeight,
        rowGap,
        columnGap,
        columnWidth,
        fillColor,
        continuation
    }
) {
    const blockHeight =
        titleHeight +
        outerPadding * 2 +
        rows.reduce(
            (total, row, index) =>
                total +
                row.height +
                (index > 0 ? rowGap : 0),
            0
        );

    // Fond extérieur du Set
    if (fillColor) {
        doc.setFillColor(...fillColor);
    } else {
        doc.setFillColor(255, 255, 255);
    }

    doc.setDrawColor(190, 190, 190);
    doc.roundedRect(
        x,
        y,
        width,
        blockHeight,
        2,
        2,
        "FD"
    );

    // Titre du Set
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(
        continuation
            ? `Set ${group}`
            : `Set ${group}`,
        x + outerPadding,
        y + 5
    );

    // Exercices
    let cardY = y + titleHeight + outerPadding;

    rows.forEach(row => {
        drawExerciseCard(
            doc,
            row.left,
            x + outerPadding,
            cardY,
            columnWidth
        );

        if (row.right) {
            drawExerciseCard(
                doc,
                row.right,
                x +
                    outerPadding +
                    columnWidth +
                    columnGap,
                cardY,
                columnWidth
            );
        }

        cardY += row.height + rowGap;
    });
}

function drawContinuationHeader(
    doc,
    planName,
    margin
) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    doc.text(
        `${planName} (suite)`,
        margin,
        margin
    );

    return margin + 8;
}

// ============================================================
// CARTE D'EXERCICE
// ============================================================

function getExerciseCardLayout(
    doc,
    planExercise,
    index,
    width
) {
    const exercise = planExercise.exercise ?? {};
    const innerWidth = width - 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    const titleLines = doc.splitTextToSize(
        `${index + 1} - ${exercise.nom ?? "Exercice"}`,
        innerWidth
    );

    const progression =
        getProgressionName(exercise);

    const categories =
        exercise.catégorie?.join(" / ") || "-";

    const muscles =
        [
            ...new Set(
                (exercise.muscles_principaux ?? [])
                    .map(muscle => muscle[0])
                    .filter(Boolean)
            )
        ].join(" / ") || "-";

    const unit =
        planExercise.valueUnit === "sec"
            ? "sec"
            : "Rep";

    const lines = [
        progression
            ? `Progression : ${progression}`
            : null,

        `${categories} | ${muscles}`,

        `Poids : ${formatNumber(planExercise.weight)} ${
            planExercise.weightUnit ?? "lbs"
        }`,

        `${planExercise.sets ?? 1} X ${formatNumber(
            planExercise.value
        )} ${unit}`,

        `Tempo : ${formatTempo(planExercise.tempo)}`,

        `Repos : ${formatNumber(planExercise.rest)} sec`
    ].filter(Boolean);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const bodyLines = lines.flatMap(line =>
        doc.splitTextToSize(line, innerWidth)
    );

    const height = Math.max(
        42,
        9 +
            titleLines.length * 4.5 +
            bodyLines.length * 4
    );

    return {
        titleLines,
        bodyLines,
        height
    };
}

function drawExerciseCard(
    doc,
    layout,
    x,
    y,
    width
) {
    const padding = 4;
    let textY = y + 6;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(185, 185, 185);

    doc.roundedRect(
        x,
        y,
        width,
        layout.height,
        2,
        2,
        "FD"
    );

    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(
        layout.titleLines,
        x + padding,
        textY
    );

    textY +=
        layout.titleLines.length * 4.5 + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    layout.bodyLines.forEach(line => {
        doc.text(
            line,
            x + padding,
            textY
        );

        textY += 4;
    });
}

// ============================================================
// FORMAT
// ============================================================

function formatTempo(tempo = {}) {
    return [
        tempo.first,
        tempo.second,
        tempo.third,
        tempo.fourth
    ]
        .map((value, index) =>
            (index === 0 || index === 2) &&
            Number(value) === 0
                ? "X"
                : formatNumber(value)
        )
        .join("-");
}

function formatNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? String(number)
        : "0";
}

// ============================================================
// EXPORTS
// ============================================================

export {
    configurePlanPdf,
    setupPlanPdf
};