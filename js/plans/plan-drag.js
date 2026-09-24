import { dropPlanItem } from "./plan-combinations.js";
import { createSortable } from "../ui/sortable.js";
import { renderExerciseMuscleMap } from "../exercises/exercise-muscle-map.js";

export function createPlanDragController(workout, onDrop, {
    setClass = "plan-set-block", listClass = "plan-set-exercises", headerClass = "plan-set-header",
    supersetClass = "plan-set-superset", singleClass = "plan-set-single",
    nameSelector = ".plan-exercise-name", progressionSelector = ".plan-progression-name",
    mapSelector = ".plan-exercise-muscle-map canvas",
    getNumber = row => row.querySelector(".plan-exercise-number").textContent,
    getGroup = exercise => exercise.combination.group,
    dropItem = dropPlanItem, getEndElement = () => null
} = {}) {
    const handles = new Map();
    const sets = [];
    let sourceElement = null;
    let temporarySet = null;
    let dragging = false;
    const status = document.createElement("div");
    status.className = "plan-drag-status";
    status.setAttribute("role", "status");
    workout.appendChild(status);

    function getRow(exercise) {
        return sets.flatMap(set => set.rows).find(row => row.exercise === exercise)?.element;
    }

    function restoreOrder() {
        sets.forEach(set => {
            set.rows.forEach(row => set.element.querySelector(`.${listClass}`).appendChild(row.element));
            set.element.hidden = false;
            set.element.classList.toggle(supersetClass, set.isSuperset);
            set.element.classList.toggle(singleClass, set.isSingle);
            workout.insertBefore(set.element, getEndElement());
        });
        temporarySet?.remove();
        temporarySet = null;
    }

    function compactRow(row) {
        const summary = document.createElement("div");
        summary.className = "plan-drag-summary";
        const identity = document.createElement("span");
        identity.className = "plan-drag-identity";
        identity.textContent = `${getNumber(row)} ${row.querySelector(nameSelector).textContent}`;
        const progression = document.createElement("span");
        progression.className = "plan-drag-progression";
        progression.textContent = row.querySelector(progressionSelector).textContent;
        const thumbnail = document.createElement("div");
        thumbnail.className = "plan-drag-thumbnail";
        thumbnail.setAttribute("aria-hidden", "true");
        row.querySelectorAll(mapSelector).forEach(original => {
            if (!original.width || !original.height) return;
            const canvas = document.createElement("canvas");
            canvas.height = 96;
            canvas.width = Math.max(1, Math.round(96 * original.width / original.height));
            canvas.getContext("2d").drawImage(original, 0, 0, canvas.width, canvas.height);
            thumbnail.appendChild(canvas);
        });
        summary.append(identity, progression, thumbnail);
        return summary;
    }

    function targets(source) {
        const result = [];
        // L'ordre DOM représente la prévisualisation; les objets du plan restent intacts.
        [...workout.children].forEach(element => {
            const set = sets.find(item => item.element === element);
            if (!set || element.hidden || (source.type === "set" && sourceElement === element)) return;
            const group = getGroup(set.exercises[0]);
            const members = set.rows.filter(row => row.exercise !== source.exercise);
            if (source.type === "exercise" && !members.length) return;
            const reference = members[0]?.exercise ?? set.exercises[0];
            const key = sets.indexOf(set);
            result.push({ key: `set-${key}-before`, exercise: reference, element, edgeOnly: source.type === "exercise", inside: false, after: false, label: `Avant le Set ${group}${source.type === "exercise" ? " · Set individuel" : ""}` });
            if (source.type === "exercise") {
                members.forEach(row => {
                    const rowKey = set.rows.indexOf(row);
                    result.push({ key: `row-${key}-${rowKey}-before`, exercise: row.exercise, element: row.element, inside: true, after: false, label: `Set ${group} : avant ${row.exercise.exercise.nom}` });
                    result.push({ key: `row-${key}-${rowKey}-after`, exercise: row.exercise, element: row.element, inside: true, after: true, label: `Set ${group} : après ${row.exercise.exercise.nom}` });
                });
            }
            result.push({ key: `set-${key}-after`, exercise: reference, element, edgeOnly: source.type === "exercise", inside: false, after: true, label: `Après le Set ${group}${source.type === "exercise" ? " · Set individuel" : ""}` });
        });
        return result;
    }

    const sortable = createSortable(workout, {
        getSource: handle => {
            const source = handles.get(handle);
            if (source && !dragging) sourceElement = source.type === "set"
                ? getRow(source.exercise).closest(`.${setClass}`) : getRow(source.exercise);
            return source;
        },
        getTargets: targets,
        getElements: () => sourceElement?.classList.contains(setClass)
            ? sets.map(set => set.element) : sets.flatMap(set => set.rows.map(row => row.element)),
        getDropElement: source => source.type === "set"
            ? getRow(source.exercise).closest(`.${setClass}`) : getRow(source.exercise),
        announce: text => { status.textContent = text; },
        onSettled() {
            sets.forEach(set => set.rows.forEach(({ element, exercise }) => {
                if (!element.isConnected || element.closest(".plan-sortable-active")) return;
                const map = element.querySelector(".exercise-muscle-map");
                if (map) renderExerciseMuscleMap(map, exercise.exercise, { compact: true });
            }));
        },
        onStart(source) {
            dragging = true;
            sourceElement = source.type === "set"
                ? getRow(source.exercise).closest(`.${setClass}`) : getRow(source.exercise);
            workout.querySelectorAll(".combination-menu").forEach(menu => menu.remove());
            sets.forEach(set => set.rows.forEach(row => row.element.appendChild(compactRow(row.element))));
            workout.classList.add("plan-sortable-active");
            sourceElement.classList.add("plan-sortable-placeholder");
        },
        createPreview(source) {
            const preview = document.createElement("div");
            preview.className = "plan-sortable-preview";
            const rows = source.type === "set"
                ? sets.find(set => set.exercises.includes(source.exercise)).rows
                : [{ element: getRow(source.exercise) }];
            if (source.type === "set") {
                const title = document.createElement("strong");
                title.className = "plan-sortable-preview-title";
                title.textContent = `Set ${getGroup(source.exercise)}`;
                preview.appendChild(title);
            }
            rows.forEach(row => preview.appendChild(compactRow(row.element)));
            return preview;
        },
        onPreview(source, target) {
            restoreOrder();
            if (source.type === "set") {
                target.element.insertAdjacentElement(target.after ? "afterend" : "beforebegin", sourceElement);
            } else if (target.inside) {
                target.element.insertAdjacentElement(target.after ? "afterend" : "beforebegin", sourceElement);
            } else {
                temporarySet = document.createElement("section");
                temporarySet.className = `${setClass} ${singleClass}`;
                const title = document.createElement("div");
                title.className = headerClass;
                title.textContent = "Set individuel";
                const exercises = document.createElement("div");
                exercises.className = listClass;
                exercises.appendChild(sourceElement);
                temporarySet.append(title, exercises);
                target.element.insertAdjacentElement(target.after ? "afterend" : "beforebegin", temporarySet);
            }
            sets.forEach(set => {
                const count = set.element.querySelector(`.${listClass}`).children.length;
                set.element.hidden = count === 0;
                set.element.classList.toggle(supersetClass, count > 1);
                set.element.classList.toggle(singleClass, count === 1);
            });
        },
        onFinish(source, target, commit) {
            restoreOrder();
            workout.classList.remove("plan-sortable-active");
            sourceElement?.classList.remove("plan-sortable-placeholder");
            workout.querySelectorAll(".plan-drag-summary").forEach(summary => summary.remove());
            dragging = false;
            if (commit && target && dropItem(source, target)) onDrop(source);
        }
    });

    return {
        addHandle(element, exercise, type) {
            const handle = document.createElement("button");
            handle.type = "button";
            handle.className = "plan-drag-handle";
            handle.textContent = "⠿";
            const label = type === "set" ? `Déplacer le Set ${getGroup(exercise)}` : `Déplacer ${exercise.exercise.nom}`;
            handle.setAttribute("aria-label", label);
            handle.setAttribute("aria-pressed", "false");
            handle.setAttribute("aria-description", "Entrée pour saisir, flèches pour choisir une destination, Entrée pour déposer, Échap pour annuler.");
            handle.title = `${label}. Glisser ou utiliser Entrée et les flèches. Échap pour annuler.`;
            handles.set(handle, { exercise, type });
            element.prepend(handle);
            return handle;
        },
        addSet(element, exercises, rows) {
            sets.push({ element, exercises, rows, isSuperset: element.classList.contains(supersetClass), isSingle: element.classList.contains(singleClass) });
        },
        destroy() {
            sortable.destroy();
            if (dragging) restoreOrder();
        }
    };
}
