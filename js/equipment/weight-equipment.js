// Équipements de charge : identité stable (le suffixe affiché n'est jamais un ID numérique interne).
export const WEIGHT_EQUIPMENT = ["Dumbbell", "Barbell", "Kettlebell", "Plate", "Cable", "Machine", "Élastique", "Weight vest", "Sandbag"];
import { getRepresentativeWeight, roundSuggestedWeight } from "../training/weight-estimation.js";
export const STANDARD_RESISTANCES = ["Facile", "Moyen", "Difficile", "Très difficile"];
let getAppSettings = () => null;
let saveSettings = () => {};
let getWorkoutHistory = () => [];

export function configureWeightEquipment({ settings, save, history }) {
    getAppSettings = settings; saveSettings = save; getWorkoutHistory = history;
}
export function getPersonalWeightEquipment() { return getAppSettings()?.customWeightEquipment ?? []; }
export function getWeightEquipmentOptions() { return [...WEIGHT_EQUIPMENT, ...getPersonalWeightEquipment()]; }
export function getEquipmentPreference(name, exercise = null) {
    const progressionId = exercise ? String(exercise?.prog_group ?? "").trim() : null;
    const key = progressionId ? `${progressionId}::${name}` : null;
    return (key && getAppSettings()?.equipmentProgressionPreferences?.[key]) ?? getAppSettings()?.equipmentPreferences?.[name] ?? "neutral";
}
export function setProgressionEquipmentPreference(exercise, name, preference) {
    const settings = getAppSettings(), progressionId = String(exercise?.prog_group ?? "").trim();
    if (!settings || !progressionId || !["more", "neutral", "less", "never"].includes(preference)) return;
    settings.equipmentProgressionPreferences ??= {};
    const key = `${progressionId}::${name}`;
    settings.equipmentProgressionPreferences[key] = preference;
    saveSettings(settings);
}

export function setEquipmentPreference(name, preference) {
    const settings = getAppSettings();
    if (!settings || !(typeof equipmentOptions !== "undefined" ? equipmentOptions : getWeightEquipmentOptions()).includes(name) || !["more", "neutral", "less", "never"].includes(preference)) return;
    settings.equipmentPreferences ??= {}; settings.equipmentPreferences[name] = preference; saveSettings(settings);
}
export function addPersonalWeightEquipment(value) {
    const settings = getAppSettings(), name = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
    if (!settings || !name) return null;
    const existing = getWeightEquipmentOptions().find(item => item.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"));
    if (existing) return existing;
    settings.customWeightEquipment ??= [];
    if (settings.customWeightEquipment.length >= 100) throw new Error("La limite de 100 équipements personnalisés est atteinte.");
    settings.customWeightEquipment.push(name); saveSettings(settings);
    if (typeof equipmentOptions !== "undefined" && !equipmentOptions.includes(name)) equipmentOptions.push(name);
    document.dispatchEvent(new CustomEvent("wilf:equipment-changed"));
    return name;
}
export function removePersonalWeightEquipment(name) {
    const settings = getAppSettings();
    if (!settings?.customWeightEquipment?.includes(name)) return false;
    settings.customWeightEquipment = settings.customWeightEquipment.filter(item => item !== name);
    delete settings.equipmentPreferences?.[name];
    Object.keys(settings.equipmentProgressionPreferences ?? {}).forEach(key => { if (key.endsWith(`::${name}`)) delete settings.equipmentProgressionPreferences[key]; });
    saveSettings(settings);
    if (typeof equipmentOptions !== "undefined") { const index = equipmentOptions.indexOf(name); if (index >= 0) equipmentOptions.splice(index, 1); }
    document.dispatchEvent(new CustomEvent("wilf:equipment-changed"));
    return true;
}
export function getResistanceLevels() {
    const available = [...STANDARD_RESISTANCES, ...(getAppSettings()?.customBandResistances ?? [])];
    const order = getAppSettings()?.bandResistanceOrder ?? [];
    return [...new Set([...order.filter(item => available.includes(item)), ...available])];
}
export function addBandResistance(value, after = null, before = null) {
    const settings = getAppSettings(), name = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!settings || !name) return null;
    const match = getResistanceLevels().find(level => level.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"));
    if (match) return match;
    settings.customBandResistances ??= []; settings.customBandResistances.push(name);
    const levels = getResistanceLevels().filter(item => item !== name);
    const index = before ? levels.indexOf(before) : after ? levels.indexOf(after) + 1 : levels.length;
    levels.splice(Math.max(0, index), 0, name);
    settings.bandResistanceOrder = levels; saveSettings(settings); return name;
}
export function getWeightEquipmentSuffix(name) {
    const index = WEIGHT_EQUIPMENT.indexOf(name);
    if (index >= 0) return `.${index + 1}`;
    const customIndex = getPersonalWeightEquipment().indexOf(name);
    return customIndex >= 0 ? `.a${customIndex + 1}` : name ? ".autre" : "";
}
export function getWeightedExerciseName(exercise, name) { return `${exercise?.baseExerciseName ?? exercise?.nom ?? "Exercice"}${name ? ` | ${name}` : ""}`; }
export function getWeightVariantKey(exercise, name) { return `${exercise?.baseExerciseId ?? exercise?.ID ?? "?"}::${String(name ?? "").normalize("NFC").toLocaleLowerCase("fr")}`; }
export function isGymOnlyExercise(exercise) {
    const categories = exercise?.catégorie ?? [];
    return categories.some(value => String(value).startsWith("Gym")) && !categories.some(value => String(value).startsWith("Cali"));
}
export function getSuggestedWeightEquipment(exercise) {
    const explicit = exercise?.equipement_poids_suggeres;
    if (Array.isArray(explicit) && explicit.length) return [...new Set(explicit.filter(name => getWeightEquipmentOptions().includes(name)))];
    const groups = (exercise?.equipement ?? []).filter(Array.isArray);
    const weightNames = [...new Set(groups.flat().filter(name => getWeightEquipmentOptions().includes(name)))];
    if (isGymOnlyExercise(exercise) && groups.some(group => group.some(name => String(name).toLowerCase() === "poids"))) return getWeightEquipmentOptions();
    return weightNames;
}
export function isMachineOnlyExercise(exercise) {
    const suggested = getSuggestedWeightEquipment(exercise);
    return suggested.length === 1 && suggested[0] === "Machine";
}
export function isWeightRequirementGroup(group) {
    return Array.isArray(group) && group.some(name => String(name).toLowerCase() === "poids" || getWeightEquipmentOptions().includes(name));
}
export function getAutomaticWeightEquipment(exercise) { return isMachineOnlyExercise(exercise) ? "Machine" : null; }
export function getSupportingEquipmentGroups(exercise) {
    return (exercise?.equipement ?? []).filter(group => Array.isArray(group) && !isWeightRequirementGroup(group));
}
export function chooseAutoWeightEquipment(exercise, selected = []) {
    if (!isGymOnlyExercise(exercise)) {
        const used = [...getUsedWeightEquipment(exercise)].filter(name => selected.includes(name) && getEquipmentPreference(name, exercise) !== "never");
        return used.length ? used[0] : null;
    }
    const admissible = getSuggestedWeightEquipment(exercise).filter(name => selected.includes(name) && getEquipmentPreference(name, exercise) !== "never");
    if (!admissible.length) return null;
    const rank = { more: 0, neutral: 1, less: 2, never: 3 };
    return admissible.sort((a, b) => rank[getEquipmentPreference(a, exercise)] - rank[getEquipmentPreference(b, exercise)])[0];
}
export function getUsedWeightEquipment(exercise) {
    const names = new Set(), id = String(exercise?.baseExerciseId ?? exercise?.ID);
    getWorkoutHistory().forEach(session => (session.sets ?? []).forEach(set => (set.exercises ?? []).forEach(item => {
        if (String(item.exercise?.baseExerciseId ?? item.exercise?.ID) !== id) return;
        (item.series ?? []).forEach(series => Object.values(series.logs ?? {}).forEach(log => {
            if (log?.completedAt) { const equipment = Object.hasOwn(log, "weightEquipment") ? log.weightEquipment : item.weightEquipment; if (equipment) names.add(equipment); }
        }));
    })));
    return names;
}
export function assertMachineChange(exercise, before, after) {
    if (after === "Machine" || !isMachineOnlyExercise(exercise) || !before && !after) return true;
    return window.confirm("Cet exercice est conçu pour être effectué sur une machine. Pour vous entraîner sans machine, nous vous conseillons de choisir un exercice similaire. Souhaitez-vous continuer quand même ?");
}

// Dernière séance terminée pour une variante : la valeur est calculée depuis les logs, jamais réécrite.
export function getLastEquipmentPerformance(exercise, equipment) {
    if (!equipment) return null;
    const baseId = String(exercise?.baseExerciseId ?? exercise?.ID);
    const sessions = [...(getWorkoutHistory() ?? [])].sort((a, b) => Number(b.startedAt ?? b.date ?? 0) - Number(a.startedAt ?? a.date ?? 0));
    for (const session of sessions) {
        const logs = [];
        (session.sets ?? []).forEach(set => (set.exercises ?? []).forEach(item => {
            if (String(item.exercise?.baseExerciseId ?? item.exercise?.ID) !== baseId) return;
            (item.series ?? []).forEach(series => Object.values(series.logs ?? {}).forEach(log => {
                if (!log?.completedAt) return;
                const used = Object.hasOwn(log, "weightEquipment") ? log.weightEquipment : item.weightEquipment;
                if (used === equipment) logs.push(log);
            }));
        }));
        if (!logs.length) continue;
        const recent = [...logs].sort((a, b) => Number(b.completedAt) - Number(a.completedAt));
        const resist = recent.find(log => log.weightUnit === "Res" && log.bandResistance);
        const median = getRepresentativeWeight(logs);
        return { weight: median ? roundSuggestedWeight(median.value) : 0, weightUnit: median?.unit ?? (resist ? "Res" : recent[0].weightUnit ?? "lbs"), bandResistance: resist?.bandResistance ?? null };
    }
    return null;
}

// Dialogue accessible permettant de positionner une résistance personnalisée sans saisie libre de l'ordre.
export function requestBandResistance(onAdded) {
    const name = window.prompt("Nom de la nouvelle résistance d'élastique :")?.trim();
    if (!name) return;
    const backdrop = document.createElement("div"); backdrop.className = "wilf-band-order-backdrop";
    const dialog = document.createElement("div"); dialog.className = "wilf-band-order-dialog"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-label", "Position de la résistance");
    const heading = document.createElement("strong"); heading.textContent = `Placer « ${name} »`;
    const placement = document.createElement("select"); placement.setAttribute("aria-label", "Avant ou après"); placement.add(new Option("Après", "after")); placement.add(new Option("Avant", "before"));
    const target = document.createElement("select"); target.setAttribute("aria-label", "Résistance de référence"); getResistanceLevels().forEach(level => target.add(new Option(level, level))); target.selectedIndex = target.options.length - 1;
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = "Ajouter";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Annuler";
    const close = () => backdrop.remove(); cancel.addEventListener("click", close); backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
    confirm.addEventListener("click", () => { const added = addBandResistance(name, placement.value === "after" ? target.value : null, placement.value === "before" ? target.value : null); close(); if (added) onAdded?.(added); });
    dialog.append(heading, placement, target, confirm, cancel); backdrop.append(dialog); document.body.append(backdrop); placement.focus();
}
export function createBandResistanceControl({ getValue, onChange, inline = false }) {
    const host = document.createElement("div"); host.className = `wilf-weight-resistance${inline ? " is-inline" : ""}`;
    function render() {
        host.replaceChildren();
        const levels = getResistanceLevels(), current = getValue();
        const selected = levels.includes(current) ? current : levels[0];
        if (current !== selected) onChange(selected);
        const select = document.createElement("select"); select.setAttribute("aria-label", "Résistance élastique");
        levels.forEach(level => select.add(new Option(level, level))); select.add(new Option("Autre…", "__other__")); select.value = selected;
        const arrows = document.createElement("div"); arrows.className = "wilf-resistance-arrows";
        const up = document.createElement("button"); up.type = "button"; up.textContent = "▲"; up.setAttribute("aria-label", "Résistance plus élevée");
        const down = document.createElement("button"); down.type = "button"; down.textContent = "▼"; down.setAttribute("aria-label", "Résistance plus faible");
        const unit = document.createElement("span"); unit.className = "wilf-resistance-unit"; unit.textContent = "Res";
        const step = direction => { const index = getResistanceLevels().indexOf(getValue()); const next = levels[Math.max(0, Math.min(levels.length - 1, index + direction))]; if (next) { onChange(next); select.value = next; } };
        up.addEventListener("click", () => step(1)); down.addEventListener("click", () => step(-1)); arrows.append(up, down);
        select.addEventListener("change", () => { if (select.value === "__other__") requestBandResistance(value => { onChange(value); render(); }); else onChange(select.value); });
        host.append(select, arrows, unit);
    }
    render(); return host;
}

function attachDismissOnOutsideClick(host, menu, close) {
    queueMicrotask(() => {
        const onPointerDown = event => { if (!host.contains(event.target)) { document.removeEventListener("pointerdown", onPointerDown, true); close(); } };
        document.addEventListener("pointerdown", onPointerDown, true);
        menu._dismiss = () => document.removeEventListener("pointerdown", onPointerDown, true);
    });
}

// Le menu s'ouvre au premier clic; préférences de progression accessibles via pastilles indépendantes.
export function createWeightEquipmentPicker(exercise, { getValue, onChange, compact = false } = {}) {
    const host = document.createElement("div"); host.className = `wilf-weight-equipment-picker${compact ? " is-compact" : ""}`;
    let resetView = () => {};
    const closeOpenMenu = () => { const menu = host.querySelector(".wilf-weight-dropdown"); menu?._dismiss?.(); render(); };
    function openDropdown(contentBuilder) {
        host.replaceChildren();
        const dropdown = document.createElement("div"); dropdown.className = "wilf-weight-dropdown";
        contentBuilder(dropdown);
        host.append(dropdown);
        attachDismissOnOutsideClick(host, dropdown, closeOpenMenu);
    }
    function createOption(label, onClick, extraClass = "") {
        const button = document.createElement("button"); button.type = "button"; button.className = `wilf-weight-dropdown-option${extraClass ? ` ${extraClass}` : ""}`; button.textContent = label; button.addEventListener("click", onClick); return button;
    }
    function renderRootChoice(dropdown, changing = false) {
        const used = getUsedWeightEquipment(exercise), current = getValue?.() || "";
        const header = document.createElement("div"); header.className = "wilf-weight-dropdown-header";
        if (changing) { const back = document.createElement("button"); back.type = "button"; back.className = "wilf-weight-dropdown-back"; back.textContent = "←"; back.setAttribute("aria-label", "Revenir à l'étape précédente"); back.addEventListener("click", () => openDropdown(menu => renderActions(menu))); header.append(back); }
        const title = document.createElement("strong"); title.textContent = "Choisir un équipement"; header.append(title); dropdown.append(header);
        const allowed = isGymOnlyExercise(exercise) ? getSuggestedWeightEquipment(exercise) : getWeightEquipmentOptions();
        const allowCustom = !isGymOnlyExercise(exercise) || (exercise?.equipement ?? []).flat().some(name => String(name).toLowerCase() === "poids");
        const names = [...new Set([...allowed, ...(allowCustom ? getPersonalWeightEquipment() : []), ...(current ? [current] : [])])].filter(Boolean);
        const list = document.createElement("div"); list.className = "wilf-weight-dropdown-list";
        names.forEach(name => {
            const row = document.createElement("div"); row.className = "wilf-weight-choice-row";
            const button = createOption(name, () => { if (assertMachineChange(exercise, current, name)) { onChange?.(name); closeOpenMenu(); } }, used.has(name) ? "wilf-weight-used" : "wilf-weight-suggested");
            const dot = document.createElement("button"); dot.type = "button"; dot.className = "wilf-weight-preference-dot";
            const values = ["neutral", "more", "less", "never"], labels = { neutral: "Neutre", more: "Plus souvent", less: "Moins souvent", never: "Jamais" };
            const updateDot = () => { const value = getEquipmentPreference(name, exercise); dot.dataset.preference = value; dot.title = `${name} : ${labels[value]} (cliquer pour changer)`; dot.setAttribute("aria-label", dot.title); };
            dot.addEventListener("click", event => { event.stopPropagation(); const value = values[(values.indexOf(getEquipmentPreference(name, exercise)) + 1) % values.length]; setProgressionEquipmentPreference(exercise, name, value); updateDot(); });
            updateDot(); row.append(button, dot); list.append(row);
        });
        dropdown.append(list);
        const other = createOption("Autre…", () => {
            const typed = window.prompt("Nom du nouvel équipement de poids (maximum 48 caractères) :");
            if (!typed) return;
            try {
                const name = addPersonalWeightEquipment(typed);
                if (assertMachineChange(exercise, current, name)) { onChange?.(name); closeOpenMenu(); }
            } catch (error) { alert(error.message); }
        }, "wilf-weight-other");
        dropdown.append(other);
    }
    function renderActions(dropdown) {
        const header = document.createElement("div"); header.className = "wilf-weight-dropdown-header";
        const title = document.createElement("strong"); title.textContent = "Équipement"; header.append(title); dropdown.append(header);
        dropdown.append(createOption("Changer d'équipement", () => openDropdown(menu => renderRootChoice(menu, true))));
        dropdown.append(createOption("Supprimer poids", () => { if (assertMachineChange(exercise, getValue?.(), "")) { onChange?.(""); closeOpenMenu(); } }, "wilf-weight-remove-option"));
    }
    function render() {
        host.replaceChildren(); const current = getValue?.() || "";
        if (!current) {
            const trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "wilf-weight-add"; trigger.textContent = "Ajouter poids"; trigger.addEventListener("click", () => openDropdown(menu => renderRootChoice(menu))); host.append(trigger); return;
        }
        const minus = document.createElement("button"); minus.type = "button"; minus.className = "wilf-weight-remove"; minus.textContent = "−"; minus.setAttribute("aria-label", "Changer ou supprimer l'équipement de poids"); minus.addEventListener("click", () => openDropdown(menu => renderActions(menu)));
        const label = document.createElement("span"); label.className = "wilf-weight-name"; label.textContent = current;
        host.append(minus, label);
    }
    resetView = render; render(); return host;
}

// Variantes dérivées uniquement des logs terminés : aucune copie persistante d'un exercice officiel.
export function getUsedExerciseVariants(exercises, history = getWorkoutHistory()) {
    const byId = new Map((exercises ?? []).map(exercise => [String(exercise.ID), exercise]));
    const variants = new Map();
    (history ?? []).forEach(session => (session.sets ?? []).forEach(set => (set.exercises ?? []).forEach(item => {
        const base = byId.get(String(item.exercise?.baseExerciseId ?? item.exercise?.ID));
        if (!base) return;
        (item.series ?? []).forEach(series => Object.values(series.logs ?? {}).forEach(log => {
            if (!log?.completedAt) return;
            const name = Object.hasOwn(log, "weightEquipment") ? log.weightEquipment : item.weightEquipment;
            if (!name) return;
            const key = getWeightVariantKey(base, name);
            if (variants.has(key)) return;
            const category = [...(base.catégorie ?? [])];
            if (category.some(value => value.startsWith("Cali"))) category.forEach(value => { if (value.startsWith("Cali")) { const gym = value.replace("Cali", "Gym"); if (!category.includes(gym)) category.push(gym); } });
            variants.set(key, { ...base, baseExerciseId: base.ID, baseExerciseName: base.nom, nom: getWeightedExerciseName(base, name), catégorie: category, variantEquipment: name });
        }));
    })));
    return [...variants.values()];
}
