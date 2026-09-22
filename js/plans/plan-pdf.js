import { getProgressionName } from "../exercises/exercise-search.js";
import { getPlanExerciseDetailsLines } from "../exercises/exercise-details.js";
import { getPlanExerciseSplitInfo } from "../exercises/exercise-split.js";
import { formatPlanDuration } from "./plan-timing.js";
import {
    renderExerciseMuscleMap,
    destroyExerciseMuscleMapsIn
} from "../exercises/exercise-muscle-map.js";

let plans = [];
let downloadPlansButton;
let planPdfModal;
let planPdfSelectionList;
let cancelPlanPdfButton;
let confirmPlanPdfButton;
let planPdfSelectAll;

let getPlanSetCount = () => 0;
let getPlanPrimaryMuscles = () => [];

// ============================================================
// CARTE MUSCULAIRE — PDF
// ============================================================

const PDF_MUSCLE_MAP_SIZE = 27;
const PDF_MUSCLE_MAP_GAP = 2.5;

let pdfMuscleMapImages = new WeakMap();

function waitForNextPaint() {
    return new Promise(resolve =>
        requestAnimationFrame(() =>
            requestAnimationFrame(resolve)
        )
    );
}

async function createPdfMuscleMapImage(exercise) {
    if (!exercise) return null;

    const host = document.createElement("div");
    const map = document.createElement("div");

    Object.assign(host.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        width: "240px",
        height: "240px",
        opacity: "0",
        pointerEvents: "none"
    });

    map.classList.add(
        "exercise-muscle-map",
        "plan-exercise-muscle-map"
    );

    map.style.width = "240px";
    map.style.height = "240px";
    map.style.margin = "0";

    host.appendChild(map);
    document.body.appendChild(host);

    try {
        renderExerciseMuscleMap(
            map,
            exercise,
            { compact: true }
        );

        await waitForNextPaint();

        const canvases = [
            ...map.querySelectorAll(
                ".exercise-muscle-map-canvas canvas"
            )
        ];

        if (!canvases.length) return null;

        const mapRect = map.getBoundingClientRect();
        const scale = 2;
        const output = document.createElement("canvas");

        output.width = Math.max(
            1,
            Math.round(mapRect.width * scale)
        );

        output.height = Math.max(
            1,
            Math.round(mapRect.height * scale)
        );

        const context = output.getContext("2d");

        context.clearRect(
            0,
            0,
            output.width,
            output.height
        );

        canvases.forEach(canvas => {
            const rect = canvas.getBoundingClientRect();

            const x =
                (rect.left - mapRect.left) *
                scale;

            const y =
                (rect.top - mapRect.top) *
                scale;

            const width =
                rect.width * scale;

            const height =
                rect.height * scale;

            context.drawImage(
                canvas,
                0,
                0,
                canvas.width,
                canvas.height,
                x,
                y,
                width,
                height
            );
        });

        return output.toDataURL("image/png");
    } finally {
        destroyExerciseMuscleMapsIn(host);
        host.remove();
    }
}

async function preparePdfMuscleMapImages(
    selectedPlans
) {
    const cache = new Map();

    pdfMuscleMapImages =
        new WeakMap();

    for (const plan of selectedPlans) {
        for (
            const planExercise
            of plan.exercises ?? []
        ) {
            const exercise =
                planExercise.exercise;

            if (!exercise) continue;

            const key =
                exercise.ID ??
                exercise.nom;

            let image =
                cache.get(key);

            if (image === undefined) {
                try {
                    image =
                        await createPdfMuscleMapImage(
                            exercise
                        );
                } catch (error) {
                    console.warn(
                        "Carte musculaire PDF non générée :",
                        exercise.nom,
                        error
                    );

                    image = null;
                }

                cache.set(
                    key,
                    image
                );
            }

            if (image) {
                pdfMuscleMapImages.set(
                    planExercise,
                    image
                );
            }
        }
    }
}

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
        planPdfSelectAll,
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

    planPdfSelectAll.addEventListener("change", () => {
    planPdfSelectionList
        .querySelectorAll('input[type="checkbox"]')
        .forEach(checkbox => {
            checkbox.checked = planPdfSelectAll.checked;
        });

    updatePlanPdfControls();
    });

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

        planPdfSelectAll.checked = false;
        planPdfSelectAll.indeterminate = false;
        planPdfSelectAll.disabled = true;
        return;
    }

    planPdfSelectAll.disabled = false;

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
    const rows = [...planPdfSelectionList.children]
        .filter(row => row.dataset.planId);

    const checkboxes = rows.map(row =>
        row.querySelector('input[type="checkbox"]')
    );

    rows.forEach((row, index) => {
        row.querySelector('[data-direction="up"]').disabled = index === 0;
        row.querySelector('[data-direction="down"]').disabled =
            index === rows.length - 1;
    });

    const checkedCount =
        checkboxes.filter(checkbox => checkbox.checked).length;

    planPdfSelectAll.checked =
        checkboxes.length > 0 &&
        checkedCount === checkboxes.length;

    planPdfSelectAll.indeterminate =
        checkedCount > 0 &&
        checkedCount < checkboxes.length;

    confirmPlanPdfButton.disabled = checkedCount === 0;
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
    [250, 237, 243],
    [252, 244, 232]
];

const PDF_SET_GAP = 6;
const PDF_SET_PADDING = 3;
const PDF_SET_TITLE_HEIGHT = 6;
const PDF_SET_ROW_GAP = 3;

const PDF_CARD_MIN_HEIGHT = 43;
const PDF_HEADER_LINE_HEIGHT = 4.2;
const PDF_BODY_LINE_HEIGHT = 3.6;
const PDF_INSTRUCTION_LINE_HEIGHT = 3.1;

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

async function downloadSelectedPlans() {
    const selectedPlans =
        getSelectedPlansInOrder();

    if (selectedPlans.length === 0) return;

    confirmPlanPdfButton.disabled = true;

    try {
        await generatePlansPdf(
            selectedPlans
        );

        closePlanPdfModal();
    } finally {
        updatePlanPdfControls();
    }
}

async function generatePlansPdf(
    selectedPlans
) {
    const JsPdf =
        window.jspdf?.jsPDF;

    if (!JsPdf) {
        alert(
            "Le générateur PDF n'est pas disponible."
        );

        return;
    }

    await preparePdfMuscleMapImages(
        selectedPlans
    );

    const doc = new JsPdf({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const date =
        new Intl.DateTimeFormat(
            "fr-CA",
            {
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        ).format(new Date());

    selectedPlans.forEach(
        (plan, index) => {
            if (index > 0) {
                doc.addPage();
            }

            drawPlan(
                doc,
                plan,
                date
            );
        }
    );

    const fileDate =
        new Intl.DateTimeFormat(
            "en-CA"
        ).format(new Date());

    doc.save(
        `wilf-workout-plans-${fileDate}.pdf`
    );
}

// ============================================================
// PLAN
// ============================================================

function drawWrappedPdfText(doc, text, x, y, width, lineHeight = 4) {
    const paragraphs = String(text ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n");

    paragraphs.forEach(paragraph => {
        const clean = paragraph.trimEnd();

        if (!clean) {
            y += lineHeight;
            return;
        }

        const lines = doc.splitTextToSize(clean, width);

        lines.forEach(line => {
            doc.text(line, x, y);
            y += lineHeight;
        });
    });

    return y;
}

function drawLabeledPdfText(doc, label, text, x, y, width, lineHeight = 4) {
    const value = String(text ?? "").replace(/\r\n?/g, "\n");
    const paragraphs = value.split("\n");
    let firstLine = true;

    paragraphs.forEach(paragraph => {
        const words = paragraph.trimEnd().split(/\s+/).filter(Boolean);

        if (!words.length) {
            y += lineHeight;
            firstLine = false;
            return;
        }

        let currentX = x;
        let availableWidth = width;

        if (firstLine) {
            doc.setFont("helvetica", "bold");
            doc.text(label, x, y);

            currentX += doc.getTextWidth(label);
            availableWidth -= doc.getTextWidth(label);
        }

        doc.setFont("helvetica", "normal");

        let line = "";

        words.forEach(word => {
            const candidate = line ? `${line} ${word}` : word;

            if (doc.getTextWidth(candidate) <= availableWidth) {
                line = candidate;
                return;
            }

            if (line) {
                doc.text(line, currentX, y);
                y += lineHeight;
                currentX = x;
                availableWidth = width;
                line = word;
            } else {
                const parts = doc.splitTextToSize(word, availableWidth);

                parts.forEach((part, index) => {
                    doc.text(part, currentX, y);

                    if (index < parts.length - 1) {
                        y += lineHeight;
                        currentX = x;
                        availableWidth = width;
                    }
                });

                line = "";
            }
        });

        if (line) doc.text(line, currentX, y);

        y += lineHeight;
        firstLine = false;
    });

    return y;
}

function drawPlan(doc, plan, date) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const setWidth = (contentWidth - PDF_SET_GAP) / 2;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(plan.name, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Téléchargé le ${date}`, margin, y + 6);

const exerciseCount = plan.exercises.length;
const setCount = getPlanSetCount(plan);
const muscles = getPlanPrimaryMuscles(plan);
const notes = String(plan.notes ?? "").slice(0, 500).trim();
let detailsY = y + 12;

doc.setFontSize(10);

const durationText =
    formatPlanDuration(plan);

const countText =
    ` (${exerciseCount} exercice${exerciseCount !== 1 ? "s" : ""} | ` +
    `${setCount} set${setCount !== 1 ? "s" : ""})`;

doc.setFont("helvetica", "bold");
doc.text(durationText, margin, detailsY);

const durationWidth =
    doc.getTextWidth(durationText);

doc.setFont("helvetica", "normal");
doc.text(
    countText,
    margin + durationWidth,
    detailsY
);

detailsY += 6;

detailsY = drawLabeledPdfText(
    doc,
    "Muscles principaux : ",
    muscles.join(", ") || "aucun",
    margin,
    detailsY,
    contentWidth
);

detailsY += 2;

if (plan.includeEquipment) {
detailsY = drawLabeledPdfText(
    doc,
    "Équipements : ",
    plan.equipment?.length ? plan.equipment.join(", ") : "Aucun",
    margin,
    detailsY,
    contentWidth
);

    detailsY += 2;
}

if (notes) {
detailsY = drawLabeledPdfText(
    doc,
    "Notes : ",
    notes,
    margin,
    detailsY,
    contentWidth
);

    detailsY += 2;
}

y = detailsY + 2;

doc.line(margin, y, pageWidth - margin, y);
y += 7;

    if (!plan.exercises.length) {
        doc.text("Aucun exercice.", margin, y);
        return;
    }

    const planOrder = new Map(
        plan.exercises.map((item, index) => [item, index + 1])
    );

    const groups = getPlanGroups(plan);
    let supersetColorIndex = 0;

    for (let index = 0; index < groups.length; index++) {
        const group = groups[index];

        // ----------------------------------------------------
        // Set seul
        // ----------------------------------------------------

        if (group.exercises.length === 1) {
            const left = createSetLayout(doc, group, planOrder, setWidth, null);

            const nextGroup = groups[index + 1];
            const right = nextGroup?.exercises.length === 1
                ? createSetLayout(doc, nextGroup, planOrder, setWidth, null)
                : null;

            const rowHeight = Math.max(left.height, right?.height ?? 0);

            if (y + rowHeight > pageHeight - margin) {
                doc.addPage();
                y = drawContinuationHeader(doc, plan.name, margin);
            }

            drawSingleSetBlock(doc, left, margin, y, setWidth);

            if (right) {
                drawSingleSetBlock(
                    doc,
                    right,
                    margin + setWidth + PDF_SET_GAP,
                    y,
                    setWidth
                );

                index++;
            }

            y += rowHeight + 5;
            continue;
        }

        // ----------------------------------------------------
        // Superset
        // ----------------------------------------------------

        const fillColor =
            PDF_SET_COLORS[supersetColorIndex++ % PDF_SET_COLORS.length];

        const multi = createSetLayout(
            doc,
            group,
            planOrder,
            setWidth,
            fillColor
        );

        const nextGroup = groups[index + 1];

        const nextSingle =
            multi.oddSuperset &&
            nextGroup?.exercises.length === 1
                ? createSetLayout(doc, nextGroup, planOrder, setWidth, null)
                : null;

        const blockHeight = getMultiSetHeight(multi, nextSingle);

        if (y + blockHeight > pageHeight - margin) {
            doc.addPage();
            y = drawContinuationHeader(doc, plan.name, margin);
        }

const slot = drawMultiSetBlock(
    doc,
    multi,
    margin,
    y,
    setWidth,
    blockHeight,
    nextSingle
);

        if (nextSingle && slot) {
            drawSingleSetBlock(
                doc,
                nextSingle,
                slot.x,
                slot.y,
                setWidth
            );

            index++;
        }

        y += blockHeight + 5;
    }
}

function createSetLayout(doc, groupData, planOrder, setWidth, fillColor) {
    const cardWidth = setWidth - PDF_SET_PADDING * 2;

    const cards = groupData.exercises.map(planExercise =>
        getExerciseCardLayout(
            doc,
            planExercise,
            planOrder.get(planExercise) - 1,
            cardWidth
        )
    );

    const rows = [];

    for (let index = 0; index < cards.length; index += 2) {
        rows.push({
            left: cards[index],
            right: cards[index + 1] ?? null,
            height: Math.max(cards[index].height, cards[index + 1]?.height ?? 0)
        });
    }

    const height =
        PDF_SET_TITLE_HEIGHT +
        PDF_SET_PADDING * 2 +
        rows.reduce(
            (total, row, index) =>
                total + row.height + (index ? PDF_SET_ROW_GAP : 0),
            0
        );

    return {
        group: groupData.group,
        rows,
        fillColor,
        height,
        isSingle: cards.length === 1,
        oddSuperset: cards.length > 1 && cards.length % 2 === 1
    };
}

function getLastMultiRowY(layout, y) {
    let rowY = y + PDF_SET_TITLE_HEIGHT + PDF_SET_PADDING;

    for (let index = 0; index < layout.rows.length - 1; index++) {
        rowY += layout.rows[index].height + PDF_SET_ROW_GAP;
    }

    return rowY;
}

function getMultiSetHeight(layout, singleLayout) {
    if (!layout.oddSuperset || !singleLayout) return layout.height;

    const slotOffset = getLastMultiRowY(layout, 0);
    const cardOffset = PDF_SET_TITLE_HEIGHT + PDF_SET_PADDING;

    return Math.max(
        layout.height + cardOffset,
        slotOffset + singleLayout.height
    );
}

function drawSingleSetBlock(doc, layout, x, y, setWidth) {
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Set ${layout.group}`, x + PDF_SET_PADDING, y + 5);

    drawExerciseCard(
        doc,
        layout.rows[0].left,
        x + PDF_SET_PADDING,
        y + PDF_SET_TITLE_HEIGHT + PDF_SET_PADDING,
        setWidth - PDF_SET_PADDING * 2
    );
}

function drawRoundedLShape(doc, x, y, width, height, cutX, cutY, radius, fillColor) {
    const right = x + width;
    const bottom = y + height;
    const cx = cutX - x;
    const cy = cutY - y;
    const r = Math.min(radius, 3);
    const k = r * 0.5522847498;

    doc.setFillColor(...fillColor);
    doc.setDrawColor(190, 190, 190);

    doc.lines(
        [
            [width - 2 * r, 0],
            [k, 0, r, r - k, r, r],
            [0, cy - 2 * r],
            [0, k, -(r - k), r, -r, r],
            [cx - width + 2 * r, 0],
            [-(r - k), 0, -r, r - k, -r, r],
            [0, height - cy - 2 * r],
            [0, k, -(r - k), r, -r, r],
            [-cx + 2 * r, 0],
            [-k, 0, -r, -(r - k), -r, -r],
            [0, -(height - 2 * r)],
            [0, -k, r - k, -r, r, -r]
        ],
        x + r,
        y,
        [1, 1],
        "FD",
        true
    );
}

function drawMultiSetBlock(doc, layout, x, y, setWidth, blockHeight, nestedSingle) {
    const fullWidth = setWidth * 2 + PDF_SET_GAP;
    const cardWidth = setWidth - PDF_SET_PADDING * 2;
let slot = null;

if (layout.oddSuperset && nestedSingle) {
    const slotY = getLastMultiRowY(layout, y);
    const cutX = x + setWidth + PDF_SET_GAP / 2;
    const cutY = slotY - PDF_SET_ROW_GAP / 2;

    drawRoundedLShape(
        doc,
        x,
        y,
        fullWidth,
        blockHeight,
        cutX,
        cutY,
        2,
        layout.fillColor
    );

    slot = {
        x: x + setWidth + PDF_SET_GAP,
        y: slotY
    };
} else {
    doc.setFillColor(...layout.fillColor);
    doc.setDrawColor(190, 190, 190);
    doc.roundedRect(x, y, fullWidth, blockHeight, 2, 2, "FD");
}

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Set ${layout.group}`, x + PDF_SET_PADDING, y + 5);

let cardY = y + PDF_SET_TITLE_HEIGHT + PDF_SET_PADDING;
const lastRowIndex = layout.rows.length - 1;
const nestedOffset = nestedSingle
    ? PDF_SET_TITLE_HEIGHT + PDF_SET_PADDING
    : 0;

layout.rows.forEach((row, index) => {
    if (index === lastRowIndex) cardY += nestedOffset;

    drawExerciseCard(
        doc,
        row.left,
        x + PDF_SET_PADDING,
        cardY,
        cardWidth
    );

    if (row.right) {
        drawExerciseCard(
            doc,
            row.right,
            x + setWidth + PDF_SET_GAP + PDF_SET_PADDING,
            cardY,
            cardWidth
        );
    }

    cardY += row.height + PDF_SET_ROW_GAP;
});

    return slot;
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

function isExclusivelyGym(exercise) {
    const categories = exercise.catégorie ?? [];
    return categories.length > 0 &&
        categories.every(category => category === "Gym A" || category === "Gym B");
}

function getPdfInstructions(planExercise) {
    const saved = planExercise.details?.instructions;

    const text = saved == null
        ? getPlanExerciseDetailsLines(planExercise.exercise ?? {}).join("\n")
        : String(saved);

    return text.replace(/\r\n?/g, "\n").trimEnd();
}

function wrapInstructionText(doc, text, width) {
    return text.split("\n").flatMap(line => {
        const cleanLine = line.trimEnd();
        return cleanLine ? doc.splitTextToSize(cleanLine, width) : [""];
    });
}

function getExerciseCardLayout(
    doc,
    planExercise,
    index,
    width
) {
    const exercise =
        planExercise.exercise ?? {};

    const innerWidth =
        width - 8;

    const progression =
        getProgressionName(exercise) || "";

    const headerGap = 4;

    const titleWidth =
        progression
            ? innerWidth * 0.62
            : innerWidth;

    const progressionWidth =
        progression
            ? innerWidth -
              titleWidth -
              headerGap
            : 0;

    const mapSize =
        Math.min(
            PDF_MUSCLE_MAP_SIZE,
            innerWidth * 0.38
        );

    const infoWidth =
        Math.max(
            20,
            innerWidth -
            mapSize -
            PDF_MUSCLE_MAP_GAP
        );

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(10);

    const titleLines =
        doc.splitTextToSize(
            `${index + 1} - ${exercise.nom ?? "Exercice"}`,
            titleWidth
        );

    doc.setFont(
        "helvetica",
        "normal"
    );

    doc.setFontSize(8.5);

    const progressionLines =
        progression
            ? doc.splitTextToSize(
                progression,
                progressionWidth
            )
            : [];

    const muscles = [
        ...new Set(
            (
                exercise
                    .muscles_principaux ??
                []
            )
                .map(
                    muscle =>
                        muscle[0]
                )
                .filter(Boolean)
        )
    ].join(" / ") || "-";

    const unit =
        planExercise.valueUnit === "sec"
            ? "sec"
            : "Rep";

    const weight =
        Number(
            planExercise.weight
        ) || 0;

    const showWeight =
        weight !== 0 ||
        isExclusivelyGym(
            exercise
        );

    const splitInfo =
        getPlanExerciseSplitInfo(
            planExercise
        );

    const infoRows = [];

    if (splitInfo) {
        infoRows.push({
            type: "split",
            label: splitInfo.label,
            value: splitInfo.order
        });
    }

    infoRows.push({
        type: "text",

        lines:
            doc.splitTextToSize(
                muscles,
                infoWidth
            )
    });

    if (showWeight) {
        infoRows.push({
            type: "mixed",
            label: "Poids : ",

            value:
                `${formatNumber(planExercise.weight)} ` +
                `${planExercise.weightUnit ?? "lbs"}`
        });
    }

    infoRows.push(
        {
            type: "mixed",
            label: "Série de ",

            value:
                `${planExercise.sets ?? 1} X ` +
                `${formatNumber(planExercise.value)} ` +
                `${unit}`
        },
        {
            type: "mixed",
            label: "Tempo : ",

            value:
                formatTempo(
                    planExercise.tempo
                )
        },
        {
            type: "mixed",
            label: "Repos : ",

            value:
                `${formatNumber(planExercise.rest)} sec`
        }
    );

    const instructions =
        getPdfInstructions(
            planExercise
        );

    let instructionLines = [];

    if (instructions) {
        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(8);

        instructionLines =
            wrapInstructionText(
                doc,
                instructions,
                innerWidth - 5
            );
    }

    const headerLineCount =
        Math.max(
            titleLines.length,
            progressionLines.length,
            1
        );

    const infoHeight =
        infoRows.reduce(
            (total, row) => {
                if (
                    row.type ===
                    "text"
                ) {
                    return (
                        total +
                        row.lines.length *
                        PDF_BODY_LINE_HEIGHT
                    );
                }

                return (
                    total +
                    PDF_BODY_LINE_HEIGHT
                );
            },
            0
        );

    const bodyHeight =
        Math.max(
            mapSize,
            infoHeight
        );

    const instructionHeight =
        instructionLines.length
            ? instructionLines.length *
              PDF_INSTRUCTION_LINE_HEIGHT +
              3.6
            : 0;

    const contentHeight =
        5 +
        headerLineCount *
        PDF_HEADER_LINE_HEIGHT +
        1.5 +
        bodyHeight +
        (
            instructionHeight
                ? 1.5 +
                  instructionHeight
                : 0
        ) +
        3;

    return {
        titleLines,
        progressionLines,
        headerLineCount,
        mapSize,

        muscleMapImage:
            pdfMuscleMapImages.get(
                planExercise
            ) ?? null,

        infoRows,
        instructionLines,
        instructionHeight,

        height:
            Math.max(
                PDF_CARD_MIN_HEIGHT,
                contentHeight
            )
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
    const left = x + padding;
    const right =
        x + width - padding;

    let textY =
        y + 5;

    doc.setFillColor(
        255,
        255,
        255
    );

    doc.setDrawColor(
        185,
        185,
        185
    );

    doc.roundedRect(
        x,
        y,
        width,
        layout.height,
        2,
        2,
        "FD"
    );

    // --------------------------------------------------------
    // NOM / PROGRESSION
    // --------------------------------------------------------

    doc.setTextColor(20);

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(10);

    layout.titleLines.forEach(
        (line, index) => {
            doc.text(
                line,
                left,
                textY +
                index *
                PDF_HEADER_LINE_HEIGHT
            );
        }
    );

    doc.setFont(
        "helvetica",
        "normal"
    );

    doc.setFontSize(8.5);

    layout.progressionLines.forEach(
        (line, index) => {
            doc.text(
                line,
                right,
                textY +
                index *
                PDF_HEADER_LINE_HEIGHT,
                { align: "right" }
            );
        }
    );

    textY +=
        layout.headerLineCount *
        PDF_HEADER_LINE_HEIGHT +
        1.5;

    // --------------------------------------------------------
    // IMAGE À GAUCHE / INFORMATIONS À DROITE
    // --------------------------------------------------------

    const bodyTop =
        textY - 2.7;

    const infoX =
        left +
        layout.mapSize +
        PDF_MUSCLE_MAP_GAP;

    if (layout.muscleMapImage) {
        doc.addImage(
            layout.muscleMapImage,
            "PNG",
            left,
            bodyTop,
            layout.mapSize,
            layout.mapSize
        );
    }

    layout.infoRows.forEach(
        row => {
            // Split / Alterne

            if (
                row.type ===
                "split"
            ) {
                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(8.5);

                doc.text(
                    row.label,
                    infoX,
                    textY
                );

                const labelWidth =
                    doc.getTextWidth(
                        row.label
                    );

                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.text(
                    ` ${row.value}`,
                    infoX +
                    labelWidth,
                    textY
                );

                textY +=
                    PDF_BODY_LINE_HEIGHT;

                return;
            }

            // Poids / Série / Tempo / Repos

            if (
                row.type ===
                "mixed"
            ) {
                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(8.5);

                doc.text(
                    row.label,
                    infoX,
                    textY
                );

                const labelWidth =
                    doc.getTextWidth(
                        row.label
                    );

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.text(
                    row.value,
                    infoX +
                    labelWidth,
                    textY
                );

                textY +=
                    PDF_BODY_LINE_HEIGHT;

                return;
            }

            // Muscles

            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(8.5);

            row.lines.forEach(
                line => {
                    doc.text(
                        line,
                        infoX,
                        textY
                    );

                    textY +=
                        PDF_BODY_LINE_HEIGHT;
                }
            );
        }
    );

    // --------------------------------------------------------
    // INSTRUCTIONS
    // --------------------------------------------------------

    if (
        !layout
            .instructionLines
            .length
    ) {
        return;
    }

    const boxWidth =
        width -
        padding * 2;

    const boxY =
        y +
        layout.height -
        3 -
        layout.instructionHeight;

    doc.setDrawColor(
        145,
        145,
        145
    );

    doc.roundedRect(
        left,
        boxY,
        boxWidth,
        layout.instructionHeight,
        1,
        1
    );

    doc.setFont(
        "helvetica",
        "normal"
    );

    doc.setFontSize(8);

    doc.setTextColor(30);

    layout.instructionLines.forEach(
        (line, index) => {
            if (!line) return;

            doc.text(
                line,
                left + 2.5,
                boxY +
                3.3 +
                index *
                PDF_INSTRUCTION_LINE_HEIGHT
            );
        }
    );
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