import { SHARE_V3_EXERCISE_NAMES, SHARE_V3_CATEGORIES, SHARE_V3_EQUIPMENT, SHARE_V3_AUTO_BODY_PARTS, SHARE_V3_AUTO_MUSCLES } from "./plan-share-dictionary-v3.js";

// ============================================================
// FORMAT BINAIRE DE PARTAGE V3
// Dictionnaire + matrice de colonnes pour eviter les valeurs repetitives.
// Garder ce decodeur et son dictionnaire figes pour la compatibilite des anciens liens.
// ============================================================

const PLAN_SCHEMA_VERSION = 4;
const MAX_EXERCISES = 500;
const MAX_TEXT_BYTES = 1000000;
const DEFAULTS = { sets: 3, reps: 10, time: 30, rest: 60, weight: 0, weightUnit: "lbs", tempo: { first: 3, second: 0, third: 1, fourth: 0 } };
const TEMPO_KEYS = ["first", "second", "third", "fourth"];
const TEMPO_PROFILES = [[3, 0, 1, 0], [2, 0, 1, 0], [4, 0, 1, 0], [1, 0, 1, 0], [1, 0, 0, 0], [2, 1, 2, 0], [3, 1, 1, 0], [4, 1, 1, 0]];
const AUTO_GOALS = ["strength", "hypertrophy", "endurance"];
const AUTO_TYPES = ["Push", "Pull", "Iso"];
const AUTO_SUPERSETS = ["indifferent", "none", "sometimes", "always"];
const TEXT_TOKENS = ["\n", "Équipement : ", "Grip : ", "Position des pieds : ", " OU ", " ET ", "Neutre", "Pronation", "Supination", "Intérieur", "Avant", "Extérieur", ...SHARE_V3_EQUIPMENT];
const TEXT_TOKEN_MATCHES = TEXT_TOKENS.map((text, index) => ({ text, code: index + 1 })).sort((a, b) => b.text.length - a.text.length);
const PLAN_KEYS = new Set(["schemaVersion", "name", "notes", "categories", "equipment", "includeCategories", "includeEquipment", "includeNotes", "autoAddDefaultInstructions", "autoPlanGeneration", "defaults", "exercises"]);
const DEFAULT_KEYS = new Set(["sets", "reps", "time", "rest", "weight", "weightUnit", "tempo"]);
const EXERCISE_KEYS = new Set(["exerciseId", "exerciseName", "sets", "value", "valueUnit", "rest", "tempo", "weight", "weightUnit", "splitOrder", "combination", "details"]);
const TEMPO_OBJECT_KEYS = new Set(TEMPO_KEYS);
const COMBINATION_KEYS = new Set(["group"]);
const DETAILS_KEYS = new Set(["instructions"]);
const AUTO_KEYS = new Set(["version", "createdAt", "targetDurationMinutes", "estimatedDurationSeconds", "timeFlexibility", "goals", "bodyParts", "muscles", "types", "exerciseCount", "supersetPreference"]);
const AUTO_COUNT_KEYS = new Set(["min", "max"]);
const PLAN_FLAGS = { NOTES: 1, CATEGORIES: 2, EQUIPMENT: 4, INCLUDE_CATEGORIES: 8, INCLUDE_EQUIPMENT: 16, INCLUDE_NOTES: 32, NO_AUTO_INSTRUCTIONS: 64, AUTO_GENERATION: 128, CUSTOM_DEFAULTS: 256 };
const DEFAULT_FLAGS = { SETS: 1, REPS: 2, TIME: 4, REST: 8, WEIGHT: 16, WEIGHT_UNIT: 32, TEMPO: 64 };
const EXERCISE_COLUMNS = { NAME: 1, SETS: 2, SEC: 4, VALUE: 8, REST: 16, TEMPO: 32, WEIGHT: 64, WEIGHT_UNIT: 128, SPLIT: 256, SAME_GROUP: 512, INSTRUCTIONS: 1024 };
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function hasOnlyKeys(value, allowed) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => allowed.has(key)); }
function isUint(value, max = Number.MAX_SAFE_INTEGER) { return Number.isSafeInteger(value) && value >= 0 && value <= max; }
function scaled10(value) { const scaled = Math.round(Number(value) * 10); return Number.isFinite(Number(value)) && isUint(scaled, 99999) && Math.abs(scaled / 10 - Number(value)) < 1e-9 ? scaled : null; }
function sameTempo(a, b) { return TEMPO_KEYS.every(key => Number(a?.[key]) === Number(b?.[key])); }
function varUintLength(value) { let length = 1; while (value >= 128) { value = Math.floor(value / 128); length++; } return length; }
function zigZag(value) { return value >= 0 ? value * 2 : -value * 2 - 1; }
function unZigZag(value) { return value % 2 === 0 ? value / 2 : -(value + 1) / 2; }

class ByteWriter {
    constructor() { this.bytes = []; }
    byte(value) { this.bytes.push(value & 255); }
    varUint(value) {
        if (!isUint(value)) throw new Error("Entier du plan invalide.");
        while (value >= 128) { this.byte((value % 128) + 128); value = Math.floor(value / 128); }
        this.byte(value);
    }
    bitset(flags) {
        for (let offset = 0; offset < flags.length; offset += 8) {
            let byte = 0;
            for (let bit = 0; bit < 8 && offset + bit < flags.length; bit++) if (flags[offset + bit]) byte |= 1 << bit;
            this.byte(byte);
        }
    }
    text(value) {
        if (typeof value !== "string") throw new Error("Texte du plan invalide.");
        const raw = encoder.encode(value);
        if (raw.length > MAX_TEXT_BYTES) throw new Error("Texte du plan trop volumineux.");
        const compact = [];
        for (let offset = 0; offset < value.length;) {
            const token = TEXT_TOKEN_MATCHES.find(entry => value.startsWith(entry.text, offset));
            if (token) { compact.push(token.code); offset += token.text.length; continue; }
            const codePoint = value.codePointAt(offset);
            const character = String.fromCodePoint(codePoint);
            const bytes = encoder.encode(character);
            for (const byte of bytes) byte <= TEXT_TOKENS.length ? compact.push(0, byte) : compact.push(byte);
            offset += character.length;
        }
        const rawMarker = raw.length * 2;
        const compactMarker = compact.length * 2 + 1;
        const useCompact = varUintLength(compactMarker) + compact.length < varUintLength(rawMarker) + raw.length;
        this.varUint(useCompact ? compactMarker : rawMarker);
        const bytes = useCompact ? compact : raw;
        for (const byte of bytes) this.byte(byte);
    }
    finish() { return new Uint8Array(this.bytes); }
}

class ByteReader {
    constructor(bytes) { this.bytes = bytes; this.offset = 0; }
    byte() { if (this.offset >= this.bytes.length) throw new Error("Plan V3 incomplet."); return this.bytes[this.offset++]; }
    varUint() {
        let value = 0;
        let multiplier = 1;
        for (let index = 0; index < 8; index++) {
            const byte = this.byte();
            value += (byte & 127) * multiplier;
            if (value > Number.MAX_SAFE_INTEGER) throw new Error("Entier du plan V3 trop grand.");
            if (!(byte & 128)) return value;
            multiplier *= 128;
        }
        throw new Error("Entier du plan V3 invalide.");
    }
    bitset(count) {
        const flags = Array(count).fill(false);
        const byteCount = Math.ceil(count / 8);
        for (let offset = 0; offset < byteCount; offset++) {
            const byte = this.byte();
            for (let bit = 0; bit < 8 && offset * 8 + bit < count; bit++) flags[offset * 8 + bit] = Boolean(byte & (1 << bit));
            if (offset === byteCount - 1 && count % 8 && byte >> (count % 8)) throw new Error("Bitset du plan V3 invalide.");
        }
        return flags;
    }
    text() {
        const marker = this.varUint();
        const compact = Boolean(marker & 1);
        const length = Math.floor(marker / 2);
        if (length > MAX_TEXT_BYTES || this.offset + length > this.bytes.length) throw new Error("Texte du plan V3 invalide.");
        const input = this.bytes.subarray(this.offset, this.offset + length);
        this.offset += length;
        if (!compact) return decoder.decode(input);
        const raw = [];
        for (let index = 0; index < input.length; index++) {
            const byte = input[index];
            if (byte === 0) {
                if (++index >= input.length) throw new Error("Texte compact V3 invalide.");
                raw.push(input[index]);
            } else if (byte <= TEXT_TOKENS.length) {
                for (const tokenByte of encoder.encode(TEXT_TOKENS[byte - 1])) raw.push(tokenByte);
            } else raw.push(byte);
            if (raw.length > MAX_TEXT_BYTES) throw new Error("Texte du plan V3 trop volumineux.");
        }
        return decoder.decode(new Uint8Array(raw));
    }
    done() { return this.offset === this.bytes.length; }
}

function writeKnownList(writer, values, dictionary) {
    if (!Array.isArray(values) || values.some(value => typeof value !== "string")) throw new Error("Liste du plan V3 invalide.");
    writer.varUint(values.length);
    for (const value of values) {
        const index = dictionary.indexOf(value);
        if (index < 0) throw new Error("Valeur sans code V3.");
        writer.varUint(index);
    }
}

function readKnownList(reader, dictionary, max = 100) {
    const length = reader.varUint();
    if (length > max) throw new Error("Liste du plan V3 trop longue.");
    const values = [];
    for (let index = 0; index < length; index++) {
        const code = reader.varUint();
        if (code >= dictionary.length) throw new Error("Code du plan V3 invalide.");
        values.push(dictionary[code]);
    }
    return values;
}

function tempoValues(value) {
    if (!hasOnlyKeys(value, TEMPO_OBJECT_KEYS)) throw new Error("Tempo V3 invalide.");
    const values = TEMPO_KEYS.map(key => Number(value[key]));
    if (values.some(item => !isUint(item, 999))) throw new Error("Tempo V3 invalide.");
    return values;
}

function writeTempo(writer, value) {
    const values = tempoValues(value);
    const profile = TEMPO_PROFILES.findIndex(item => item.every((entry, index) => entry === values[index]));
    if (profile >= 0) { writer.varUint(profile); return; }
    if (values.every(item => item <= 15)) { writer.varUint(TEMPO_PROFILES.length); writer.varUint(values.reduce((packed, item) => packed * 16 + item, 0)); return; }
    writer.varUint(TEMPO_PROFILES.length + 1);
    values.forEach(item => writer.varUint(item));
}

function readTempo(reader) {
    const mode = reader.varUint();
    if (mode < TEMPO_PROFILES.length) {
        const [first, second, third, fourth] = TEMPO_PROFILES[mode];
        return { first, second, third, fourth };
    }
    if (mode === TEMPO_PROFILES.length) {
        let packed = reader.varUint();
        if (packed > 0xffff) throw new Error("Tempo compact V3 invalide.");
        const values = [0, 0, 0, 0];
        for (let index = 3; index >= 0; index--) { values[index] = packed % 16; packed = Math.floor(packed / 16); }
        const [first, second, third, fourth] = values;
        return { first, second, third, fourth };
    }
    if (mode !== TEMPO_PROFILES.length + 1) throw new Error("Tempo V3 inconnu.");
    const [first, second, third, fourth] = TEMPO_KEYS.map(() => reader.varUint());
    if ([first, second, third, fourth].some(value => value > 999)) throw new Error("Tempo V3 invalide.");
    return { first, second, third, fourth };
}

function writeDefaults(writer, defaults) {
    if (!hasOnlyKeys(defaults, DEFAULT_KEYS) || !hasOnlyKeys(defaults.tempo, TEMPO_OBJECT_KEYS)) throw new Error("Parametres V3 invalides.");
    const weight = scaled10(defaults.weight);
    if (![defaults.sets, defaults.reps, defaults.time, defaults.rest].every(value => isUint(Number(value), 999)) || weight === null || !["lbs", "kg"].includes(defaults.weightUnit)) throw new Error("Parametres V3 invalides.");
    let flags = 0;
    if (Number(defaults.sets) !== DEFAULTS.sets) flags |= DEFAULT_FLAGS.SETS;
    if (Number(defaults.reps) !== DEFAULTS.reps) flags |= DEFAULT_FLAGS.REPS;
    if (Number(defaults.time) !== DEFAULTS.time) flags |= DEFAULT_FLAGS.TIME;
    if (Number(defaults.rest) !== DEFAULTS.rest) flags |= DEFAULT_FLAGS.REST;
    if (weight !== 0) flags |= DEFAULT_FLAGS.WEIGHT;
    if (defaults.weightUnit !== DEFAULTS.weightUnit) flags |= DEFAULT_FLAGS.WEIGHT_UNIT;
    if (!sameTempo(defaults.tempo, DEFAULTS.tempo)) flags |= DEFAULT_FLAGS.TEMPO;
    writer.varUint(flags);
    if (flags & DEFAULT_FLAGS.SETS) writer.varUint(Number(defaults.sets));
    if (flags & DEFAULT_FLAGS.REPS) writer.varUint(Number(defaults.reps));
    if (flags & DEFAULT_FLAGS.TIME) writer.varUint(Number(defaults.time));
    if (flags & DEFAULT_FLAGS.REST) writer.varUint(Number(defaults.rest));
    if (flags & DEFAULT_FLAGS.WEIGHT) writer.varUint(weight);
    if (flags & DEFAULT_FLAGS.TEMPO) writeTempo(writer, defaults.tempo);
}

function readDefaults(reader) {
    const flags = reader.varUint();
    if (flags >= 128) throw new Error("Parametres V3 invalides.");
    const defaults = structuredClone(DEFAULTS);
    if (flags & DEFAULT_FLAGS.SETS) defaults.sets = reader.varUint();
    if (flags & DEFAULT_FLAGS.REPS) defaults.reps = reader.varUint();
    if (flags & DEFAULT_FLAGS.TIME) defaults.time = reader.varUint();
    if (flags & DEFAULT_FLAGS.REST) defaults.rest = reader.varUint();
    if (flags & DEFAULT_FLAGS.WEIGHT) defaults.weight = reader.varUint() / 10;
    if (flags & DEFAULT_FLAGS.WEIGHT_UNIT) defaults.weightUnit = "kg";
    if (flags & DEFAULT_FLAGS.TEMPO) defaults.tempo = readTempo(reader);
    if ([defaults.sets, defaults.reps, defaults.time, defaults.rest].some(value => value > 999) || defaults.weight > 9999.9) throw new Error("Parametres V3 invalides.");
    return defaults;
}

function writeOptionalUint(writer, value) { if (value == null) writer.varUint(0); else { if (!isUint(Number(value), Number.MAX_SAFE_INTEGER - 1)) throw new Error("Valeur V3 invalide."); writer.varUint(Number(value) + 1); } }
function readOptionalUint(reader) { const value = reader.varUint(); return value === 0 ? null : value - 1; }

function writeAutoGeneration(writer, generation) {
    if (!hasOnlyKeys(generation, AUTO_KEYS) || Number(generation.version) !== 1 || !hasOnlyKeys(generation.exerciseCount ?? {}, AUTO_COUNT_KEYS) || !generation.muscles || typeof generation.muscles !== "object" || Array.isArray(generation.muscles)) throw new Error("Generation automatique V3 invalide.");
    if (!isUint(Number(generation.createdAt))) throw new Error("Date de generation V3 invalide.");
    if (!AUTO_SUPERSETS.includes(generation.supersetPreference) || !["strict", "flexible"].includes(generation.timeFlexibility)) throw new Error("Generation automatique V3 invalide.");
    if (Object.keys(generation.muscles).some(key => !SHARE_V3_AUTO_BODY_PARTS.includes(key))) throw new Error("Muscles automatiques sans code V3.");
    writer.varUint(Number(generation.createdAt));
    writeOptionalUint(writer, generation.targetDurationMinutes);
    writeOptionalUint(writer, generation.estimatedDurationSeconds);
    writer.byte((generation.timeFlexibility === "flexible" ? 1 : 0) | (AUTO_SUPERSETS.indexOf(generation.supersetPreference) << 1));
    writeKnownList(writer, generation.goals ?? [], AUTO_GOALS);
    writeKnownList(writer, generation.bodyParts ?? [], SHARE_V3_AUTO_BODY_PARTS);
    writeKnownList(writer, generation.types ?? [], AUTO_TYPES);
    writeOptionalUint(writer, generation.exerciseCount?.min);
    writeOptionalUint(writer, generation.exerciseCount?.max);
    let muscleKeys = 0;
    SHARE_V3_AUTO_BODY_PARTS.forEach((key, index) => { if (Object.hasOwn(generation.muscles, key)) muscleKeys |= 1 << index; });
    writer.byte(muscleKeys);
    SHARE_V3_AUTO_BODY_PARTS.forEach((key, index) => { if (muscleKeys & (1 << index)) writeKnownList(writer, generation.muscles[key], SHARE_V3_AUTO_MUSCLES[key]); });
}

function readAutoGeneration(reader) {
    const createdAt = reader.varUint();
    const targetDurationMinutes = readOptionalUint(reader);
    const estimatedDurationSeconds = readOptionalUint(reader);
    const options = reader.byte();
    if (options & 248) throw new Error("Options automatiques V3 invalides.");
    const supersetPreference = AUTO_SUPERSETS[(options >> 1) & 3];
    const goals = readKnownList(reader, AUTO_GOALS, 3);
    const bodyParts = readKnownList(reader, SHARE_V3_AUTO_BODY_PARTS, 5);
    const types = readKnownList(reader, AUTO_TYPES, 3);
    const exerciseCount = { min: readOptionalUint(reader), max: readOptionalUint(reader) };
    const muscleKeys = reader.byte();
    if (muscleKeys & ~31) throw new Error("Muscles automatiques V3 invalides.");
    const muscles = {};
    SHARE_V3_AUTO_BODY_PARTS.forEach((key, index) => { if (muscleKeys & (1 << index)) muscles[key] = readKnownList(reader, SHARE_V3_AUTO_MUSCLES[key], SHARE_V3_AUTO_MUSCLES[key].length); });
    return { version: 1, createdAt, targetDurationMinutes, estimatedDurationSeconds, timeFlexibility: options & 1 ? "flexible" : "strict", goals, bodyParts, muscles, types, exerciseCount, supersetPreference };
}

function writeExerciseIds(writer, ids) {
    if (!ids.length) return;
    writer.varUint(ids[0]);
    for (let index = 1; index < ids.length; index++) {
        const absolute = ids[index] * 2;
        const delta = zigZag(ids[index] - ids[index - 1]) * 2 + 1;
        writer.varUint(varUintLength(delta) <= varUintLength(absolute) ? delta : absolute);
    }
}

function readExerciseIds(reader, count) {
    if (!count) return [];
    const ids = [reader.varUint()];
    for (let index = 1; index < count; index++) {
        const code = reader.varUint();
        const id = code % 2 ? ids[index - 1] + unZigZag(Math.floor(code / 2)) : Math.floor(code / 2);
        if (!isUint(id, 1000000)) throw new Error("Identifiant d'exercice V3 invalide.");
        ids.push(id);
    }
    return ids;
}

function encodeExerciseMatrix(writer, exercises, defaults) {
    if (!Array.isArray(exercises) || exercises.length > MAX_EXERCISES) throw new Error("Liste d'exercices V3 invalide.");
    const count = exercises.length;
    writer.varUint(count);
    const ids = [];
    const names = Array(count).fill(false), sets = Array(count).fill(false), sec = Array(count).fill(false), values = Array(count).fill(false), rests = Array(count).fill(false), tempos = Array(count).fill(false), weights = Array(count).fill(false), weightUnits = Array(count).fill(false), splits = Array(count).fill(false), sameGroups = Array(count).fill(false), instructions = Array(count).fill(false);
    let previousGroup = null;
    let expectedGroup = 1;
    const normalized = exercises.map((exercise, index) => {
        if (!hasOnlyKeys(exercise, EXERCISE_KEYS) || !hasOnlyKeys(exercise.tempo, TEMPO_OBJECT_KEYS) || !hasOnlyKeys(exercise.combination, COMBINATION_KEYS) || !hasOnlyKeys(exercise.details, DETAILS_KEYS)) throw new Error("Exercice V3 invalide.");
        const id = exercise.exerciseId == null ? 0 : Number(exercise.exerciseId);
        if (!isUint(id, 1000000)) throw new Error("Identifiant d'exercice V3 invalide.");
        ids.push(id);
        const canonicalName = SHARE_V3_EXERCISE_NAMES[id] ?? "";
        names[index] = String(exercise.exerciseName ?? "") !== canonicalName;
        if (!isUint(Number(exercise.sets), 999) || !isUint(Number(exercise.value), 999) || !isUint(Number(exercise.rest), 999)) throw new Error("Valeur d'exercice V3 invalide.");
        if (!["rep", "sec"].includes(exercise.valueUnit) || !["lbs", "kg"].includes(exercise.weightUnit) || !["left-right", "right-left"].includes(exercise.splitOrder)) throw new Error("Unite d'exercice V3 invalide.");
        const weight = scaled10(exercise.weight);
        if (weight === null) throw new Error("Poids d'exercice V3 invalide.");
        const group = Number(exercise.combination.group);
        if (!isUint(group, 1000000) || group < 1) throw new Error("Groupe d'exercice V3 invalide.");
        if (index === 0) { if (group !== 1) throw new Error("Groupes V3 non normalises."); previousGroup = group; }
        else if (group === previousGroup) sameGroups[index] = true;
        else { expectedGroup++; if (group !== expectedGroup) throw new Error("Groupes V3 non contigus."); previousGroup = group; }
        sets[index] = Number(exercise.sets) !== Number(defaults.sets);
        sec[index] = exercise.valueUnit === "sec";
        const baselineValue = sec[index] ? Number(defaults.time) : Number(defaults.reps);
        values[index] = Number(exercise.value) !== baselineValue;
        rests[index] = Number(exercise.rest) !== Number(defaults.rest);
        tempos[index] = !sameTempo(exercise.tempo, defaults.tempo);
        weights[index] = weight !== scaled10(defaults.weight);
        weightUnits[index] = exercise.weightUnit !== defaults.weightUnit;
        splits[index] = exercise.splitOrder === "right-left";
        instructions[index] = Object.hasOwn(exercise.details, "instructions");
        if (instructions[index] && typeof exercise.details.instructions !== "string") throw new Error("Instructions V3 invalides.");
        return { exercise, weight };
    });
    writeExerciseIds(writer, ids);
    let columns = 0;
    [[names, EXERCISE_COLUMNS.NAME], [sets, EXERCISE_COLUMNS.SETS], [sec, EXERCISE_COLUMNS.SEC], [values, EXERCISE_COLUMNS.VALUE], [rests, EXERCISE_COLUMNS.REST], [tempos, EXERCISE_COLUMNS.TEMPO], [weights, EXERCISE_COLUMNS.WEIGHT], [weightUnits, EXERCISE_COLUMNS.WEIGHT_UNIT], [splits, EXERCISE_COLUMNS.SPLIT], [sameGroups, EXERCISE_COLUMNS.SAME_GROUP], [instructions, EXERCISE_COLUMNS.INSTRUCTIONS]].forEach(([flags, code]) => { if (flags.some(Boolean)) columns |= code; });
    writer.varUint(columns);
    const writeColumn = (flag, valuesFlags, writeValue) => { if (!(columns & flag)) return; writer.bitset(valuesFlags); if (writeValue) valuesFlags.forEach((enabled, index) => { if (enabled) writeValue(normalized[index], index); }); };
    writeColumn(EXERCISE_COLUMNS.NAME, names, ({ exercise }) => writer.text(String(exercise.exerciseName ?? "")));
    writeColumn(EXERCISE_COLUMNS.SETS, sets, ({ exercise }) => writer.varUint(Number(exercise.sets)));
    writeColumn(EXERCISE_COLUMNS.SEC, sec);
    writeColumn(EXERCISE_COLUMNS.VALUE, values, ({ exercise }) => writer.varUint(Number(exercise.value)));
    writeColumn(EXERCISE_COLUMNS.REST, rests, ({ exercise }) => writer.varUint(Number(exercise.rest)));
    writeColumn(EXERCISE_COLUMNS.TEMPO, tempos, ({ exercise }) => writeTempo(writer, exercise.tempo));
    writeColumn(EXERCISE_COLUMNS.WEIGHT, weights, ({ weight }) => writer.varUint(weight));
    writeColumn(EXERCISE_COLUMNS.WEIGHT_UNIT, weightUnits);
    writeColumn(EXERCISE_COLUMNS.SPLIT, splits);
    writeColumn(EXERCISE_COLUMNS.SAME_GROUP, sameGroups);
    writeColumn(EXERCISE_COLUMNS.INSTRUCTIONS, instructions, ({ exercise }) => writer.text(exercise.details.instructions));
}

function decodeExerciseMatrix(reader, defaults) {
    const count = reader.varUint();
    if (count > MAX_EXERCISES) throw new Error("Liste d'exercices V3 invalide.");
    const ids = readExerciseIds(reader, count);
    const columns = reader.varUint();
    if (columns >= 2048) throw new Error("Colonnes V3 invalides.");
    const names = Array(count).fill(false), sets = Array(count).fill(false), sec = Array(count).fill(false), values = Array(count).fill(false), rests = Array(count).fill(false), tempos = Array(count).fill(false), weights = Array(count).fill(false), weightUnits = Array(count).fill(false), splits = Array(count).fill(false), sameGroups = Array(count).fill(false), instructions = Array(count).fill(false);
    const records = ids.map(id => ({ exerciseId: id || null, exerciseName: SHARE_V3_EXERCISE_NAMES[id] ?? "", sets: defaults.sets, value: defaults.reps, valueUnit: "rep", rest: defaults.rest, tempo: structuredClone(defaults.tempo), weight: defaults.weight, weightUnit: defaults.weightUnit, splitOrder: "left-right", combination: { group: 1 }, details: {} }));
    const readColumn = (flag, target, readValue) => { if (!(columns & flag)) return; const flags = reader.bitset(count); flags.forEach((enabled, index) => { target[index] = enabled; if (enabled && readValue) readValue(records[index], index); }); };
    readColumn(EXERCISE_COLUMNS.NAME, names, record => { record.exerciseName = reader.text(); });
    readColumn(EXERCISE_COLUMNS.SETS, sets, record => { record.sets = reader.varUint(); });
    readColumn(EXERCISE_COLUMNS.SEC, sec);
    sec.forEach((isSec, index) => { if (isSec) { records[index].valueUnit = "sec"; records[index].value = defaults.time; } });
    readColumn(EXERCISE_COLUMNS.VALUE, values, record => { record.value = reader.varUint(); });
    readColumn(EXERCISE_COLUMNS.REST, rests, record => { record.rest = reader.varUint(); });
    readColumn(EXERCISE_COLUMNS.TEMPO, tempos, record => { record.tempo = readTempo(reader); });
    readColumn(EXERCISE_COLUMNS.WEIGHT, weights, record => { record.weight = reader.varUint() / 10; });
    readColumn(EXERCISE_COLUMNS.WEIGHT_UNIT, weightUnits);
    weightUnits.forEach((opposite, index) => { if (opposite) records[index].weightUnit = defaults.weightUnit === "kg" ? "lbs" : "kg"; });
    readColumn(EXERCISE_COLUMNS.SPLIT, splits);
    splits.forEach((rightFirst, index) => { if (rightFirst) records[index].splitOrder = "right-left"; });
    readColumn(EXERCISE_COLUMNS.SAME_GROUP, sameGroups);
    let group = 1;
    records.forEach((record, index) => { if (index && !sameGroups[index]) group++; record.combination.group = group; });
    readColumn(EXERCISE_COLUMNS.INSTRUCTIONS, instructions, record => { record.details.instructions = reader.text(); });
    records.forEach(record => {
        if ([record.sets, record.value, record.rest].some(value => value > 999) || record.weight > 9999.9) throw new Error("Valeur d'exercice V3 invalide.");
    });
    return records;
}

function encodePlanShareV3(plan) {
    if (!hasOnlyKeys(plan, PLAN_KEYS) || Number(plan.schemaVersion) !== PLAN_SCHEMA_VERSION || typeof plan.name !== "string" || typeof plan.notes !== "string" || !Array.isArray(plan.categories) || !Array.isArray(plan.equipment) || typeof plan.includeCategories !== "boolean" || typeof plan.includeEquipment !== "boolean" || typeof plan.includeNotes !== "boolean" || typeof plan.autoAddDefaultInstructions !== "boolean") throw new Error("Plan incompatible avec le format V3.");
    const writer = new ByteWriter();
    let flags = 0;
    if (plan.notes) flags |= PLAN_FLAGS.NOTES;
    if (plan.categories.length) flags |= PLAN_FLAGS.CATEGORIES;
    if (plan.equipment.length) flags |= PLAN_FLAGS.EQUIPMENT;
    if (plan.includeCategories) flags |= PLAN_FLAGS.INCLUDE_CATEGORIES;
    if (plan.includeEquipment) flags |= PLAN_FLAGS.INCLUDE_EQUIPMENT;
    if (plan.includeNotes) flags |= PLAN_FLAGS.INCLUDE_NOTES;
    if (!plan.autoAddDefaultInstructions) flags |= PLAN_FLAGS.NO_AUTO_INSTRUCTIONS;
    if (plan.autoPlanGeneration != null) flags |= PLAN_FLAGS.AUTO_GENERATION;
    if (!hasOnlyKeys(plan.defaults, DEFAULT_KEYS) || !sameTempo(plan.defaults.tempo, DEFAULTS.tempo) || Number(plan.defaults.sets) !== DEFAULTS.sets || Number(plan.defaults.reps) !== DEFAULTS.reps || Number(plan.defaults.time) !== DEFAULTS.time || Number(plan.defaults.rest) !== DEFAULTS.rest || Number(plan.defaults.weight) !== DEFAULTS.weight || plan.defaults.weightUnit !== DEFAULTS.weightUnit) flags |= PLAN_FLAGS.CUSTOM_DEFAULTS;
    writer.varUint(flags);
    writer.text(plan.name);
    if (flags & PLAN_FLAGS.NOTES) writer.text(plan.notes);
    if (flags & PLAN_FLAGS.CATEGORIES) writeKnownList(writer, plan.categories, SHARE_V3_CATEGORIES);
    if (flags & PLAN_FLAGS.EQUIPMENT) writeKnownList(writer, plan.equipment, SHARE_V3_EQUIPMENT);
    if (flags & PLAN_FLAGS.AUTO_GENERATION) writeAutoGeneration(writer, plan.autoPlanGeneration);
    const defaults = flags & PLAN_FLAGS.CUSTOM_DEFAULTS ? plan.defaults : structuredClone(DEFAULTS);
    if (flags & PLAN_FLAGS.CUSTOM_DEFAULTS) writeDefaults(writer, defaults);
    else if (!hasOnlyKeys(plan.defaults, DEFAULT_KEYS) || !hasOnlyKeys(plan.defaults.tempo, TEMPO_OBJECT_KEYS)) throw new Error("Parametres V3 invalides.");
    encodeExerciseMatrix(writer, plan.exercises, defaults);
    return writer.finish();
}

function decodePlanShareV3(bytes) {
    const reader = new ByteReader(bytes);
    const flags = reader.varUint();
    if (flags >= 512) throw new Error("Options du plan V3 invalides.");
    const name = reader.text();
    const notes = flags & PLAN_FLAGS.NOTES ? reader.text() : "";
    const categories = flags & PLAN_FLAGS.CATEGORIES ? readKnownList(reader, SHARE_V3_CATEGORIES, SHARE_V3_CATEGORIES.length) : [];
    const equipment = flags & PLAN_FLAGS.EQUIPMENT ? readKnownList(reader, SHARE_V3_EQUIPMENT, SHARE_V3_EQUIPMENT.length) : [];
    const autoPlanGeneration = flags & PLAN_FLAGS.AUTO_GENERATION ? readAutoGeneration(reader) : null;
    const defaults = flags & PLAN_FLAGS.CUSTOM_DEFAULTS ? readDefaults(reader) : structuredClone(DEFAULTS);
    const exercises = decodeExerciseMatrix(reader, defaults);
    if (!reader.done()) throw new Error("Plan V3 contient des donnees inattendues.");
    return { schemaVersion: PLAN_SCHEMA_VERSION, name, notes, categories, equipment, includeCategories: Boolean(flags & PLAN_FLAGS.INCLUDE_CATEGORIES), includeEquipment: Boolean(flags & PLAN_FLAGS.INCLUDE_EQUIPMENT), includeNotes: Boolean(flags & PLAN_FLAGS.INCLUDE_NOTES), autoAddDefaultInstructions: !(flags & PLAN_FLAGS.NO_AUTO_INSTRUCTIONS), autoPlanGeneration, defaults, exercises };
}

export { encodePlanShareV3, decodePlanShareV3 };
