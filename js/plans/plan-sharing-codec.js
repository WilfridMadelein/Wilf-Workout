// ============================================================
// CODEC DE PARTAGE V3
// ============================================================

const CATEGORY_DICTIONARY = ["Cali A", "Cali B", "Gym A", "Gym B"];
const EQUIPMENT_DICTIONARY = ["Ab roller", "Dumbbell", "Barbel", "Kettlebell", "Plate", "Cable", "Machine", "Élastique", "Weight vest", "Sandbag", "Banc Assis", "Banc Incliné", "Banc couché", "Box", "Barre traction", "Dip bar", "Parallettes", "Anneaux/TRX", "Swiss ball"];
const TEMPO_DICTIONARY = [[3, 0, 1, 0], [2, 0, 1, 0], [1, 1, 1, 1], [4, 0, 1, 0], [3, 1, 1, 0], [2, 1, 1, 0], [1, 0, 1, 0], [0, 0, 0, 0]];
const DEFAULTS = { sets: 3, reps: 10, time: 30, rest: 60, weight: 0, weightUnit: "lbs", tempo: { first: 3, second: 0, third: 1, fourth: 0 } };
const MAX_STRING_BYTES = 4096;
const MAX_EXERCISES = 500;

class Writer {
    constructor() { this.bytes = []; }
    byte(value) { this.bytes.push(value & 255); }
    bytesArray(values) { for (const value of values) this.byte(value); }
    varUint(value) {
        let current = Number(value);
        if (!Number.isSafeInteger(current) || current < 0) throw new Error("Entier compact invalide.");
        do { const next = current % 128; current = Math.floor(current / 128); this.byte(next | (current ? 128 : 0)); } while (current);
    }
    string(value) {
        const bytes = new TextEncoder().encode(String(value ?? ""));
        if (bytes.length > MAX_STRING_BYTES) throw new Error("Texte trop long pour le partage compact.");
        this.varUint(bytes.length); this.bytesArray(bytes);
    }
    finish() { return Uint8Array.from(this.bytes); }
}

class Reader {
    constructor(bytes) { this.bytes = bytes; this.offset = 0; }
    byte() { if (this.offset >= this.bytes.length) throw new Error("Plan compact incomplet."); return this.bytes[this.offset++]; }
    varUint() {
        let value = 0, factor = 1;
        for (let count = 0; count < 8; count++) { const byte = this.byte(); value += (byte & 127) * factor; if (!(byte & 128)) { if (!Number.isSafeInteger(value)) break; return value; } factor *= 128; }
        throw new Error("Entier compact invalide.");
    }
    string() {
        const length = this.varUint();
        if (length > MAX_STRING_BYTES || this.offset + length > this.bytes.length) throw new Error("Texte compact invalide.");
        const value = new TextDecoder("utf-8", { fatal: true }).decode(this.bytes.subarray(this.offset, this.offset + length));
        this.offset += length; return value;
    }
    done() { return this.offset === this.bytes.length; }
}

function varUintLength(value) { let length = 1, current = Number(value); while (current >= 128) { current = Math.floor(current / 128); length++; } return length; }
function writeRaw(writer, bytes) { writer.bytesArray(bytes); }
function tempoArray(tempo = {}) { return [tempo.first ?? 3, tempo.second ?? 0, tempo.third ?? 1, tempo.fourth ?? 0].map(Number); }
function sameTempo(a, b) { const left = tempoArray(a), right = tempoArray(b); return left.every((value, index) => value === right[index]); }
function tenth(value) { const number = Number(value); if (!Number.isFinite(number)) throw new Error("Poids invalide."); const scaled = Math.round(number * 10); if (Math.abs(scaled / 10 - number) > 1e-9 || scaled < 0) throw new Error("Poids non pris en charge par le codec compact."); return scaled; }
function untenth(value) { return value / 10; }

function writeTempo(writer, tempo) {
    const values = tempoArray(tempo);
    const code = TEMPO_DICTIONARY.findIndex(candidate => candidate.every((value, index) => value === values[index]));
    writer.varUint(code >= 0 ? code : TEMPO_DICTIONARY.length);
    if (code < 0) values.forEach(value => writer.varUint(value));
}

function readTempo(reader) {
    const code = reader.varUint();
    const values = code < TEMPO_DICTIONARY.length ? TEMPO_DICTIONARY[code] : code === TEMPO_DICTIONARY.length ? [reader.varUint(), reader.varUint(), reader.varUint(), reader.varUint()] : null;
    if (!values) throw new Error("Tempo compact invalide.");
    return { first: values[0], second: values[1], third: values[2], fourth: values[3] };
}

function writeDictionarySet(writer, values, dictionary) {
    const selected = new Set(Array.isArray(values) ? values : []), unknown = [...selected].filter(value => !dictionary.includes(value));
    let mask = 0, fullMask = 0;
    dictionary.forEach((value, index) => { fullMask += 2 ** index; if (selected.has(value)) mask += 2 ** index; });
    const complement = fullMask - mask, unknownFlag = unknown.length ? 1 : 0;
    const direct = mask * 4 + unknownFlag, inverted = complement * 4 + 2 + unknownFlag;
    writer.varUint(varUintLength(inverted) < varUintLength(direct) ? inverted : direct);
    if (unknown.length) { writer.varUint(unknown.length); unknown.forEach(value => writer.string(value)); }
}

function readDictionarySet(reader, dictionary) {
    const header = reader.varUint(), unknownFlag = header & 1, inverted = !!(header & 2), storedMask = Math.floor(header / 4);
    let fullMask = 0; dictionary.forEach((_, index) => { fullMask += 2 ** index; });
    const mask = inverted ? fullMask - storedMask : storedMask;
    const values = dictionary.filter((_, index) => Math.floor(mask / 2 ** index) % 2 === 1);
    if (unknownFlag) { const count = reader.varUint(); for (let index = 0; index < count; index++) values.push(reader.string()); }
    return values;
}

function encodeSparseIndices(indices, total) {
    const clean = [...new Set(indices)].filter(index => Number.isInteger(index) && index >= 0 && index < total).sort((a, b) => a - b);
    const candidates = [];
    if (clean.length === total) candidates.push(Uint8Array.of(0));
    const bitset = new Uint8Array(Math.ceil(total / 8)); clean.forEach(index => bitset[index >> 3] |= 1 << (index & 7)); candidates.push(Uint8Array.from([1, ...bitset]));
    const sparse = new Writer(); sparse.varUint(clean.length * 4 + 2); let previous = -1; clean.forEach(index => { sparse.varUint(index - previous); previous = index; }); candidates.push(sparse.finish());
    const excluded = []; for (let index = 0; index < total; index++) if (!clean.includes(index)) excluded.push(index);
    const inverse = new Writer(); inverse.varUint(excluded.length * 4 + 3); previous = -1; excluded.forEach(index => { inverse.varUint(index - previous); previous = index; }); candidates.push(inverse.finish());
    return candidates.reduce((best, candidate) => !best || candidate.length < best.length ? candidate : best, null);
}

function writeIndexSet(writer, indices, total) { writeRaw(writer, encodeSparseIndices(indices, total)); }
function readIndexSet(reader, total) {
    const header = reader.varUint(), mode = header & 3;
    if (mode === 0) return Array.from({ length: total }, (_, index) => index);
    if (mode === 1) { const bytes = Array.from({ length: Math.ceil(total / 8) }, () => reader.byte()); return Array.from({ length: total }, (_, index) => index).filter(index => bytes[index >> 3] & (1 << (index & 7))); }
    const count = Math.floor(header / 4), stored = []; let previous = -1;
    for (let index = 0; index < count; index++) { previous += reader.varUint(); if (previous < 0 || previous >= total) throw new Error("Index compact invalide."); stored.push(previous); }
    if (mode === 2) return stored;
    const excluded = new Set(stored); return Array.from({ length: total }, (_, index) => index).filter(index => !excluded.has(index));
}

function packUnsigned(values, width) {
    const bytes = new Uint8Array(Math.ceil(values.length * width / 8)); let bitOffset = 0;
    values.forEach(value => { for (let bit = 0; bit < width; bit++, bitOffset++) if (value & 2 ** bit) bytes[bitOffset >> 3] |= 1 << (bitOffset & 7); });
    return bytes;
}

function unpackUnsigned(reader, count, width) {
    const length = Math.ceil(count * width / 8), bytes = Array.from({ length }, () => reader.byte()), values = []; let bitOffset = 0;
    for (let index = 0; index < count; index++) { let value = 0; for (let bit = 0; bit < width; bit++, bitOffset++) if (bytes[bitOffset >> 3] & (1 << (bitOffset & 7))) value += 2 ** bit; values.push(value); }
    return values;
}

function writeExerciseIds(writer, exercises, exerciseMap) {
    if (!exercises.length) { writer.varUint(1); return; }
    const ids = exercises.map(item => Number(item.exerciseId));
    const allKnown = ids.every(id => Number.isInteger(id) && id > 0 && exerciseMap.has(String(id)));
    if (allKnown) { const width = Math.max(1, Math.ceil(Math.log2(Math.max(...ids) + 1))); writer.varUint(width); writeRaw(writer, packUnsigned(ids, width)); return; }
    writer.varUint(0);
    exercises.forEach(item => { const id = Number(item.exerciseId); writer.varUint(Number.isInteger(id) && id > 0 ? id : 0); writer.string(item.exerciseName ?? ""); });
}

function readExerciseIds(reader, count, exerciseMap) {
    const width = reader.varUint();
    if (width) {
        if (width > 31) throw new Error("Identifiants compacts invalides.");
        return unpackUnsigned(reader, count, width).map(id => ({ exerciseId: id, exerciseName: exerciseMap.get(String(id))?.nom ?? "" }));
    }
    return Array.from({ length: count }, () => { const exerciseId = reader.varUint(); return { exerciseId: exerciseId || null, exerciseName: reader.string() }; });
}

function writePlanDefaults(writer, defaults = {}) {
    const value = { sets: defaults.sets ?? 3, reps: defaults.reps ?? 10, time: defaults.time ?? 30, rest: defaults.rest ?? 60, weight: defaults.weight ?? 0, weightUnit: defaults.weightUnit === "kg" ? "kg" : "lbs", tempo: defaults.tempo ?? DEFAULTS.tempo };
    let mask = 0;
    if (value.sets !== DEFAULTS.sets) mask |= 1;
    if (value.reps !== DEFAULTS.reps) mask |= 2;
    if (value.time !== DEFAULTS.time) mask |= 4;
    if (value.rest !== DEFAULTS.rest) mask |= 8;
    if (Number(value.weight) !== DEFAULTS.weight) mask |= 16;
    if (value.weightUnit !== DEFAULTS.weightUnit) mask |= 32;
    if (!sameTempo(value.tempo, DEFAULTS.tempo)) mask |= 64;
    writer.varUint(mask);
    if (mask & 1) writer.varUint(value.sets); if (mask & 2) writer.varUint(value.reps); if (mask & 4) writer.varUint(value.time); if (mask & 8) writer.varUint(value.rest);
    if (mask & 16) writer.varUint(tenth(value.weight)); if (mask & 64) writeTempo(writer, value.tempo);
}

function readPlanDefaults(reader) {
    const mask = reader.varUint(), defaults = structuredClone(DEFAULTS);
    if (mask & 1) defaults.sets = reader.varUint(); if (mask & 2) defaults.reps = reader.varUint(); if (mask & 4) defaults.time = reader.varUint(); if (mask & 8) defaults.rest = reader.varUint();
    if (mask & 16) defaults.weight = untenth(reader.varUint()); if (mask & 32) defaults.weightUnit = "kg"; if (mask & 64) defaults.tempo = readTempo(reader);
    if (mask & ~127) throw new Error("Paramètres compacts inconnus.");
    return defaults;
}

function normalizeSplitOrder(value) { return value === "right-left" ? "right-left" : "left-right"; }
function getNaturalUnit(exercise) { const type = String(exercise?.type ?? "").trim().toLowerCase(); return ["iso", "isométrique", "isometric"].includes(type) ? "sec" : "rep"; }

function getInstructionEquipment(exercise) {
    return [...new Set((exercise?.equipement ?? []).flatMap(group => Array.isArray(group) ? group : []).filter(value => value !== "Aucun"))];
}

function buildStandardInstruction(exercise, equipmentMask = 0) {
    if (!exercise) return "";
    const lines = [], values = Array.isArray(exercise.pronation) ? exercise.pronation : exercise.pronation ? [exercise.pronation] : [];
    const grips = values.filter(value => ["Neutre", "Pronation", "Supination"].includes(value));
    const footPositions = values.filter(value => ["Intérieur", "Avant", "Extérieur"].includes(value));
    if (grips.length) lines.push(`Grip : ${grips.join(" / ")}`);
    if (footPositions.length) lines.push(`Position des pieds : ${footPositions.join(" / ")}`);
    const equipment = getInstructionEquipment(exercise), selected = new Set(equipment.filter((_, index) => Math.floor(equipmentMask / 2 ** index) % 2 === 1));
    const groups = (exercise.equipement ?? []).map(group => (Array.isArray(group) ? group : []).filter(value => value === "Aucun" || selected.has(value))).filter(group => group.length);
    if (groups.length) lines.push(`Équipement : ${groups.map(group => group.join(" OU ")).join(" ET ")}`);
    return lines.join("\n");
}

function findStandardInstructionMask(exercise, instruction) {
    if (!exercise) return null;
    const equipment = getInstructionEquipment(exercise);
    if (equipment.length > 12) return null;
    for (let mask = 0; mask < 2 ** equipment.length; mask++) if (buildStandardInstruction(exercise, mask) === instruction) return mask;
    return null;
}

function writeInstructions(writer, exercises, exerciseMap) {
    const nonEmpty = exercises.map((item, index) => String(item.details?.instructions ?? "") ? index : -1).filter(index => index >= 0);
    if (!nonEmpty.length) { writer.varUint(0); return; }
    writer.varUint(1); writeIndexSet(writer, nonEmpty, exercises.length);
    nonEmpty.forEach(index => {
        const item = exercises[index], instruction = String(item.details?.instructions ?? ""), exercise = exerciseMap.get(String(item.exerciseId)), mask = findStandardInstructionMask(exercise, instruction);
        if (mask != null) { writer.varUint(mask * 2 + 1); return; }
        writer.varUint(0); writer.string(instruction);
    });
}

function readInstructions(reader, exercises, exerciseMap) {
    const mode = reader.varUint();
    if (mode === 0) return;
    if (mode !== 1) throw new Error("Instructions compactes invalides.");
    readIndexSet(reader, exercises.length).forEach(index => {
        const header = reader.varUint(), item = exercises[index];
        item.details.instructions = header & 1 ? buildStandardInstruction(exerciseMap.get(String(item.exerciseId)), Math.floor(header / 2)) : reader.string();
    });
}

function writeCombinations(writer, exercises) {
    if (exercises.length <= 1) { writer.varUint(0); return; }
    const groups = exercises.map(item => Number(item.combination?.group));
    const seen = new Set(); let previous = null, valid = true;
    groups.forEach(group => { if (!Number.isInteger(group)) valid = false; if (group !== previous && seen.has(group)) valid = false; seen.add(group); previous = group; });
    if (!valid) throw new Error("Groupes non contigus non pris en charge par le codec compact.");
    if (groups.every((group, index) => index === 0 || group !== groups[index - 1])) { writer.varUint(0); return; }
    if (groups.every(group => group === groups[0])) { writer.varUint(1); return; }
    writer.varUint(2); writeIndexSet(writer, groups.map((group, index) => index > 0 && group === groups[index - 1] ? index : -1).filter(index => index >= 0), exercises.length);
}

function readCombinations(reader, exercises) {
    const mode = reader.varUint();
    if (mode === 0) { exercises.forEach((item, index) => { item.combination.group = index + 1; }); return; }
    if (mode === 1) { exercises.forEach(item => { item.combination.group = 1; }); return; }
    if (mode !== 2) throw new Error("Groupes compacts invalides.");
    const same = new Set(readIndexSet(reader, exercises.length)); let group = 1;
    exercises.forEach((item, index) => { if (index > 0 && !same.has(index)) group++; item.combination.group = group; });
}

function assertSupportedPlan(plan) {
    if (!plan || typeof plan !== "object" || !Array.isArray(plan.exercises) || plan.exercises.length > MAX_EXERCISES) throw new Error("Plan non pris en charge par le codec compact.");
    const planKeys = new Set(["schemaVersion", "name", "notes", "categories", "equipment", "includeCategories", "includeEquipment", "includeNotes", "autoAddDefaultInstructions", "autoPlanGeneration", "defaults", "exercises"]);
    if (Object.keys(plan).some(key => !planKeys.has(key))) throw new Error("Extension de plan inconnue.");
    const exerciseKeys = new Set(["exerciseId", "exerciseName", "sets", "value", "valueUnit", "rest", "tempo", "weight", "weightUnit", "splitOrder", "combination", "details"]);
    if (plan.exercises.some(item => Object.keys(item ?? {}).some(key => !exerciseKeys.has(key)) || Object.keys(item?.details ?? {}).some(key => key !== "instructions"))) throw new Error("Extension d'exercice inconnue.");
}

function encodePlanShareV3(plan, exercises = []) {
    if (plan.defaults?.supersetRest != null) throw new Error("Repos super-set : utiliser le format de partage V2.");
    assertSupportedPlan(plan);
    const exerciseMap = new Map(exercises.map(exercise => [String(exercise.ID), exercise])), writer = new Writer();
    writer.string(plan.name ?? "Plan"); writer.string(plan.notes ?? "");
    writeDictionarySet(writer, plan.categories, CATEGORY_DICTIONARY); writeDictionarySet(writer, plan.equipment, EQUIPMENT_DICTIONARY); writePlanDefaults(writer, plan.defaults);
    const items = plan.exercises; writer.varUint(items.length); writeExerciseIds(writer, items, exerciseMap);
    const defaults = { ...DEFAULTS, ...(plan.defaults ?? {}), tempo: plan.defaults?.tempo ?? DEFAULTS.tempo }, columns = {};
    columns.unit = items.map((item, index) => item.valueUnit !== getNaturalUnit(exerciseMap.get(String(item.exerciseId))) ? index : -1).filter(index => index >= 0);
    columns.sets = items.map((item, index) => Number(item.sets) !== Number(defaults.sets) ? index : -1).filter(index => index >= 0);
    columns.value = items.map((item, index) => Number(item.value) !== Number(item.valueUnit === "sec" ? defaults.time : defaults.reps) ? index : -1).filter(index => index >= 0);
    columns.rest = items.map((item, index) => Number(item.rest) !== Number(defaults.rest) ? index : -1).filter(index => index >= 0);
    columns.tempo = items.map((item, index) => !sameTempo(item.tempo, defaults.tempo) ? index : -1).filter(index => index >= 0);
    columns.weight = items.map((item, index) => Number(item.weight ?? 0) !== Number(defaults.weight ?? 0) ? index : -1).filter(index => index >= 0);
    columns.weightUnit = items.map((item, index) => (item.weightUnit ?? "lbs") !== (defaults.weightUnit ?? "lbs") ? index : -1).filter(index => index >= 0);
    const names = ["unit", "sets", "value", "rest", "tempo", "weight", "weightUnit"]; let fieldMask = 0; names.forEach((name, index) => { if (columns[name].length) fieldMask |= 1 << index; }); writer.varUint(fieldMask);
    names.forEach((name, index) => {
        if (!(fieldMask & (1 << index))) return;
        writeIndexSet(writer, columns[name], items.length);
        if (["unit", "weightUnit"].includes(name)) return;
        columns[name].forEach(itemIndex => {
            const item = items[itemIndex];
            if (name === "tempo") writeTempo(writer, item.tempo);
            else if (name === "weight") writer.varUint(tenth(item.weight ?? 0));
            else writer.varUint(Number(item[name]));
        });
    });
    writeInstructions(writer, items, exerciseMap); writeCombinations(writer, items);
    return writer.finish();
}

function decodePlanShareV3(bytes, exercises = [], receiver = {}) {
    const reader = new Reader(bytes), exerciseMap = new Map(exercises.map(exercise => [String(exercise.ID), exercise]));
    const name = reader.string(), notes = reader.string(), categories = readDictionarySet(reader, CATEGORY_DICTIONARY), equipment = readDictionarySet(reader, EQUIPMENT_DICTIONARY), defaults = readPlanDefaults(reader);
    const count = reader.varUint(); if (count > MAX_EXERCISES) throw new Error("Trop d'exercices dans le plan partagé.");
    const identities = readExerciseIds(reader, count, exerciseMap), splitOrder = normalizeSplitOrder(receiver.splitOrder), items = identities.map(identity => {
        const exercise = exerciseMap.get(String(identity.exerciseId)), valueUnit = getNaturalUnit(exercise);
        return { ...identity, sets: defaults.sets, value: valueUnit === "sec" ? defaults.time : defaults.reps, valueUnit, rest: defaults.rest, tempo: structuredClone(defaults.tempo), weight: defaults.weight, weightUnit: defaults.weightUnit, splitOrder, combination: { group: 1 }, details: { instructions: "" } };
    });
    const fieldMask = reader.varUint(); if (fieldMask & ~127) throw new Error("Colonnes compactes inconnues.");
    const names = ["unit", "sets", "value", "rest", "tempo", "weight", "weightUnit"];
    names.forEach((field, index) => {
        if (!(fieldMask & (1 << index))) return;
        const indices = readIndexSet(reader, count);
        if (field === "unit") { indices.forEach(itemIndex => { const item = items[itemIndex]; item.valueUnit = item.valueUnit === "sec" ? "rep" : "sec"; item.value = item.valueUnit === "sec" ? defaults.time : defaults.reps; }); return; }
        if (field === "weightUnit") { indices.forEach(itemIndex => { const item = items[itemIndex]; item.weightUnit = item.weightUnit === "kg" ? "lbs" : "kg"; }); return; }
        indices.forEach(itemIndex => { const item = items[itemIndex]; item[field] = field === "tempo" ? readTempo(reader) : field === "weight" ? untenth(reader.varUint()) : reader.varUint(); });
    });
    readInstructions(reader, items, exerciseMap); readCombinations(reader, items);
    if (!reader.done()) throw new Error("Données compactes supplémentaires.");
    return { schemaVersion: 4, name, notes, categories, equipment, includeCategories: true, includeEquipment: true, includeNotes: true, autoAddDefaultInstructions: receiver.autoAddDefaultInstructions !== false, autoPlanGeneration: null, defaults, exercises: items };
}

export { encodePlanShareV3, decodePlanShareV3 };
