import { hydratePlan, serializePlan, savePlanNow } from "../storage/plan-storage.js";
import { encodePlanShareV3, decodePlanShareV3 } from "./plan-sharing-codec.js";

// ============================================================
// PARTAGE DE PLANS
// ============================================================

const PLAN_SHARE_FORMAT = "wilf-workout-plan-share";
const PLAN_SHARE_VERSION = 1;
const PLAN_SHARE_HASH_KEY = "p";
const PLAN_SHARE_WEB_URL = "https://wilfridmadelein.github.io/Wilf-Workout/";
const SHARED_PLAN_PREFIX = "Sharing is caring | ";
const PLAN_NAME_MAX_LENGTH = 80;
const MAX_SHARE_TOKEN_LENGTH = 250000;
const MAX_SHARE_JSON_LENGTH = 1000000;

// Format compact v2 : masques de champs modifies/presents, valeurs puis extensions.
// Les exercices suivants ne repetent pas les champs identiques au precedent.
const SHARE_FIELDS = {
    plan: ["schemaVersion", "name", "notes", "categories", "equipment", "includeCategories", "includeEquipment", "includeNotes", "autoAddDefaultInstructions", "autoPlanGeneration", "defaults", "exercises"],
    exercise: ["exerciseId", "exerciseName", "sets", "value", "valueUnit", "rest", "tempo", "weight", "weightUnit", "splitOrder", "combination", "details"],
    defaults: ["sets", "reps", "time", "rest", "weight", "weightUnit", "tempo"],
    tempo: ["first", "second", "third", "fourth"],
    combination: ["group"],
    details: ["instructions"]
};
const SHARE_DEFAULTS = {
    plan: { schemaVersion: 4, notes: "", categories: [], equipment: [], includeCategories: false, includeEquipment: false, includeNotes: false, autoAddDefaultInstructions: true, autoPlanGeneration: null },
    exercise: { sets: 3, value: 10, valueUnit: "rep", rest: 60, tempo: { first: 3, second: 0, third: 1, fourth: 0 }, weight: 0, weightUnit: "lbs", splitOrder: "left-right", combination: { group: 1 }, details: {} },
    defaults: { sets: 3, reps: 10, time: 30, rest: 60, weight: 0, weightUnit: "lbs", tempo: { first: 3, second: 0, third: 1, fourth: 0 } },
    tempo: { first: 3, second: 0, third: 1, fourth: 0 },
    combination: { group: 1 },
    details: { instructions: "" }
};
const SHARE_NESTED_FIELDS = { defaults: "defaults", tempo: "tempo", combination: "combination", details: "details" };

let plans = [];
let getExercises = () => [];
let getAppSettings = () => null;
let renderPlansList = () => {};
let openPlan = () => {};
let navigateToPlans = () => {};
let importModal = null;
let importMessage = null;
let cancelImportButton = null;
let overwriteImportButton = null;
let copyImportButton = null;
let pendingImport = null;
let setupDone = false;

const handledTokens = new Set();
const deferredTokens = new Set();

function configurePlanSharing(dependencies) {
    ({ plans, getExercises, getAppSettings, renderPlansList, openPlan, navigateToPlans, importModal, importMessage, cancelImportButton, overwriteImportButton, copyImportButton } = dependencies);
}

function bytesToBase64Url(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

function packShareRecord(record, schema, baseline = SHARE_DEFAULTS[schema]) {
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Structure de plan invalide.");
    const fields = SHARE_FIELDS[schema];
    let changed = 0;
    let present = 0;
    const values = [];
    fields.forEach((key, index) => {
        const exists = Object.hasOwn(record, key);
        if (exists === Object.hasOwn(baseline, key) && JSON.stringify(record[key]) === JSON.stringify(baseline[key])) return;
        changed |= 1 << index;
        if (!exists) return;
        present |= 1 << index;
        const nested = SHARE_NESTED_FIELDS[key];
        if (key === "exercises") {
            if (!Array.isArray(record[key]) || record[key].length > 500) throw new Error("Liste d'exercices invalide.");
            let previous = SHARE_DEFAULTS.exercise;
            values.push(record[key].map(exercise => {
                const packed = packShareRecord(exercise, "exercise", previous);
                previous = exercise;
                return packed;
            }));
        } else values.push(nested ? packShareRecord(record[key], nested) : record[key]);
    });
    const extra = Object.fromEntries(Object.entries(record).filter(([key]) => !fields.includes(key)));
    return [changed, present, ...values, ...(Object.keys(extra).length ? [extra] : [])];
}

function unpackShareRecord(packed, schema, baseline = SHARE_DEFAULTS[schema]) {
    const fields = SHARE_FIELDS[schema];
    if (!Array.isArray(packed) || packed.length < 2) throw new Error("Plan compact invalide.");
    const [changed, present] = packed;
    if (!Number.isInteger(changed) || changed < 0 || changed >= 2 ** fields.length || !Number.isInteger(present) || present < 0 || present >= 2 ** fields.length || (present & changed) !== present) throw new Error("Champs du plan compact invalides.");
    const record = Object.fromEntries(Object.entries(baseline).filter(([key]) => fields.includes(key)));
    let position = 2;
    fields.forEach((key, index) => {
        if (!(changed & (1 << index))) return;
        if (!(present & (1 << index))) { delete record[key]; return; }
        if (position >= packed.length) throw new Error("Plan compact incomplet.");
        const value = packed[position++];
        const nested = SHARE_NESTED_FIELDS[key];
        if (key === "exercises") {
            if (!Array.isArray(value) || value.length > 500) throw new Error("Liste d'exercices invalide.");
            let previous = SHARE_DEFAULTS.exercise;
            record[key] = value.map(exercise => {
                const decoded = unpackShareRecord(exercise, "exercise", previous);
                previous = decoded;
                return decoded;
            });
        } else record[key] = nested ? unpackShareRecord(value, nested) : value;
    });
    if (position < packed.length) {
        const extra = packed[position++];
        if (!extra || typeof extra !== "object" || Array.isArray(extra) || Object.keys(extra).some(key => fields.includes(key))) throw new Error("Extensions du plan invalides.");
        Object.defineProperties(record, Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, { value, enumerable: true, writable: true, configurable: true }])));
    }
    if (position !== packed.length) throw new Error("Plan compact invalide.");
    return record;
}

// Sous-ensemble CBOR (RFC 8949) pour les valeurs JSON du plan, sans dependance.
function encodeShareBinary(value) {
    const bytes = [];
    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    function header(type, length) {
        if (length < 24) bytes.push(type * 32 + length);
        else if (length <= 255) bytes.push(type * 32 + 24, length);
        else if (length <= 65535) bytes.push(type * 32 + 25, length >>> 8, length & 255);
        else bytes.push(type * 32 + 26, length >>> 24, (length >>> 16) & 255, (length >>> 8) & 255, length & 255);
    }
    function write(item, depth) {
        if (depth > 64) throw new Error("Plan trop imbrique pour le format binaire.");
        if (item === null) { bytes.push(246); return; }
        if (typeof item === "boolean") { bytes.push(item ? 245 : 244); return; }
        if (typeof item === "number") {
            const integer = item < 0 ? -1 - item : item;
            if (Number.isInteger(integer) && integer <= 0xffffffff) header(item < 0 ? 1 : 0, integer);
            else {
                const buffer = new ArrayBuffer(8);
                new DataView(buffer).setFloat64(0, item);
                bytes.push(251, ...new Uint8Array(buffer));
            }
            return;
        }
        if (typeof item === "string") {
            const text = encoder.encode(item);
            // JSON reste disponible pour les rares chaines avec un surrogate isole.
            if (decoder.decode(text) !== item) throw new Error("Chaine incompatible avec UTF-8.");
            header(3, text.length);
            for (const byte of text) bytes.push(byte);
            return;
        }
        if (Array.isArray(item)) {
            header(4, item.length);
            item.forEach(entry => write(entry, depth + 1));
        } else {
            const entries = Object.entries(item);
            header(5, entries.length);
            entries.forEach(([key, entry]) => { write(key, depth + 1); write(entry, depth + 1); });
        }
    }
    write(value, 0);
    return new Uint8Array(bytes);
}

function decodeShareBinary(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let offset = 0;
    function take(length) {
        if (offset + length > bytes.length) throw new Error("Plan binaire incomplet.");
        const start = offset;
        offset += length;
        return start;
    }
    function read(depth) {
        if (depth > 64) throw new Error("Plan binaire trop imbrique.");
        const initial = bytes[take(1)];
        const type = initial >>> 5;
        const size = initial & 31;
        if (initial === 244) return false;
        if (initial === 245) return true;
        if (initial === 246) return null;
        if (initial === 251) {
            const value = view.getFloat64(take(8));
            if (!Number.isFinite(value)) throw new Error("Nombre du plan invalide.");
            return value;
        }
        if (![0, 1, 3, 4, 5].includes(type) || size > 26) throw new Error("Type du plan binaire invalide.");
        const length = size < 24 ? size : size === 24 ? view.getUint8(take(1)) : size === 25 ? view.getUint16(take(2)) : view.getUint32(take(4));
        if (type === 0) return length;
        if (type === 1) return -1 - length;
        if (type === 3) { const start = take(length); return decoder.decode(bytes.subarray(start, offset)); }
        if (length > bytes.length - offset) throw new Error("Taille du plan binaire invalide.");
        if (type === 4) return Array.from({ length }, () => read(depth + 1));
        const record = {};
        for (let index = 0; index < length; index++) {
            const key = read(depth + 1);
            if (typeof key !== "string" || Object.hasOwn(record, key)) throw new Error("Cle du plan binaire invalide.");
            Object.defineProperty(record, key, { value: read(depth + 1), enumerable: true, writable: true, configurable: true });
        }
        return record;
    }
    const value = read(0);
    if (offset !== bytes.length) throw new Error("Plan binaire invalide.");
    return value;
}

async function compressShareBytes(raw, format) {
    if (typeof CompressionStream !== "function") return null;
    try { return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream(format))).arrayBuffer()); }
    catch { return null; }
}

async function decompressShareBytes(bytes, format) {
    if (typeof DecompressionStream !== "function") throw new Error("Cette version de l'application ne peut pas lire ce lien compressé.");
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader(), chunks = [];
    let length = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > MAX_SHARE_JSON_LENGTH) { await reader.cancel(); throw new Error("Le plan partagé est trop volumineux."); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const output = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
}

async function shortestEncodedToken(raw, modes) {
    let shortest = `${modes.raw}${bytesToBase64Url(raw)}`;
    for (const [format, mode] of [["deflate-raw", modes.rawDeflate], ["deflate", modes.deflate], ["gzip", modes.gzip]]) {
        const compressed = await compressShareBytes(raw, format);
        if (!compressed) continue;
        const token = `${mode}${bytesToBase64Url(compressed)}`;
        if (token.length < shortest.length) shortest = token;
    }
    return shortest;
}

async function encodeSharePayload(payload) {
    const normalized = JSON.parse(JSON.stringify(payload));
    if (JSON.stringify(normalized).length > MAX_SHARE_JSON_LENGTH) throw new Error("Le plan partagé est trop volumineux.");

    try {
        const compactV3 = encodePlanShareV3(normalized.plan, getExercises());
        const token = await shortestEncodedToken(compactV3, { raw: "m", rawDeflate: "n", deflate: "o", gzip: "q" });
        if (token.length > MAX_SHARE_TOKEN_LENGTH) throw new Error("Le plan partagé est trop volumineux.");
        return token;
    } catch (error) {
        console.warn("Codec de partage V3 indisponible pour ce plan, utilisation du format V2.", error);
    }

    const packed = [2, packShareRecord(normalized.plan, "plan")], compact = JSON.stringify(packed);
    const candidates = [{ raw: new TextEncoder().encode(compact), plain: "p", modes: { rawDeflate: "r", deflate: "d", gzip: "c" } }];
    try { candidates.push({ raw: encodeShareBinary(packed), plain: "b", modes: { rawDeflate: "s", deflate: "e", gzip: "z" } }); }
    catch { /* Preserver toutes les chaines et extensions avec le format JSON. */ }
    let shortest = null;
    for (const candidate of candidates) {
        const token = await shortestEncodedToken(candidate.raw, { raw: candidate.plain, ...candidate.modes });
        if (shortest === null || token.length < shortest.length) shortest = token;
    }
    if (shortest.length > MAX_SHARE_TOKEN_LENGTH) throw new Error("Le plan partagé est trop volumineux.");
    return shortest;
}

async function decodeSharePayload(token) {
    if (typeof token !== "string" || token.length < 2 || token.length > MAX_SHARE_TOKEN_LENGTH) throw new Error("Lien de partage invalide ou trop volumineux.");
    const mode = token[0], bytes = base64UrlToBytes(token.slice(1));
    const v3Formats = { n: "deflate-raw", o: "deflate", q: "gzip" };
    if (mode === "m" || Object.hasOwn(v3Formats, mode)) {
        const output = mode === "m" ? bytes : await decompressShareBytes(bytes, v3Formats[mode]);
        const settings = getAppSettings?.() ?? {};
        const plan = decodePlanShareV3(output, getExercises(), { splitOrder: settings.splitOrder, autoAddDefaultInstructions: settings.planDefaults?.autoAddDefaultInstructions });
        return { format: PLAN_SHARE_FORMAT, version: PLAN_SHARE_VERSION, plan };
    }

    const formats = { c: "gzip", d: "deflate", r: "deflate-raw", s: "deflate-raw", e: "deflate", z: "gzip" };
    const output = Object.hasOwn(formats, mode) ? await decompressShareBytes(bytes, formats[mode]) : bytes;
    if (!Object.hasOwn(formats, mode) && mode !== "p" && mode !== "b") throw new Error("Format de partage inconnu.");
    const binary = ["b", "s", "e", "z"].includes(mode);
    const decoded = binary ? decodeShareBinary(output) : JSON.parse(new TextDecoder().decode(output));
    if (JSON.stringify(decoded).length > MAX_SHARE_JSON_LENGTH) throw new Error("Le plan partagé est trop volumineux.");
    if (!Array.isArray(decoded) || decoded.length !== 2 || decoded[0] !== 2) throw new Error("Version du plan compact inconnue.");
    return { format: PLAN_SHARE_FORMAT, version: PLAN_SHARE_VERSION, plan: unpackShareRecord(decoded[1], "plan") };
}

function createSharedPlanRecord(plan) {
    const record = structuredClone(serializePlan(plan));
    delete record.id;
    delete record.createdAt;
    delete record.updatedAt;
    delete record.filters;
    delete record.filtersInitialized;
    delete record.autoExcludedProgressions;
    record.autoPlanGeneration = null;
    return record;
}

function validateSharePayload(payload) {
    if (!payload || typeof payload !== "object" || payload.format !== PLAN_SHARE_FORMAT) throw new Error("Ce lien ne contient pas un plan Wilf-Workout valide.");
    if (payload.version !== PLAN_SHARE_VERSION) throw new Error("Cette version du plan partagé n'est pas prise en charge.");
    if (!payload.plan || typeof payload.plan !== "object" || Array.isArray(payload.plan)) throw new Error("Le plan partagé est invalide.");
    if (typeof payload.plan.name !== "string" || !payload.plan.name.trim()) throw new Error("Le plan partagé n'a pas de nom valide.");
    if (!Array.isArray(payload.plan.exercises) || payload.plan.exercises.length > 500) throw new Error("La liste d'exercices du plan partagé est invalide.");
    return payload;
}

function fitPlanName(baseName, suffix = "") {
    const maxBaseLength = Math.max(1, PLAN_NAME_MAX_LENGTH - suffix.length);
    return `${baseName.slice(0, maxBaseLength).trimEnd()}${suffix}`;
}

function getSharedBaseName(sourceName) {
    return fitPlanName(`${SHARED_PLAN_PREFIX}${String(sourceName ?? "Plan").trim() || "Plan"}`);
}

function getNextAvailableSharedName(baseName) {
    const existingNames = new Set(plans.map(plan => plan.name));
    if (!existingNames.has(baseName)) return baseName;
    for (let number = 1; number < 10000; number++) {
        const candidate = fitPlanName(baseName, `(${number})`);
        if (!existingNames.has(candidate)) return candidate;
    }
    return fitPlanName(baseName, `(${Date.now()})`);
}

function findPlanByName(name) {
    return plans.find(plan => plan.name === name) ?? null;
}

function buildImportedPlan(sharedRecord, name, existing = null) {
    const now = Date.now();
    const record = structuredClone(sharedRecord);
    record.id = existing?.id ?? (crypto.randomUUID?.() ?? now);
    record.name = name;
    record.createdAt = existing?.createdAt ?? now;
    record.updatedAt = now;

    if (existing) {
        const localRecord = serializePlan(existing);
        record.filtersInitialized = localRecord.filtersInitialized;
        record.filters = localRecord.filters;
        record.autoExcludedProgressions = localRecord.autoExcludedProgressions;
    } else {
        record.filtersInitialized = false;
        record.filters = {};
        record.autoExcludedProgressions = [];
    }

    return hydratePlan(record, getExercises());
}

function replacePlanContents(target, source) {
    Object.keys(target).forEach(key => delete target[key]);
    Object.assign(target, source);
    return target;
}

function clearCurrentShareHash() {
    try {
        const url = new URL(window.location.href), hash = url.hash.replace(/^#/, "");
        if (!hash) return;
        if (!hash.startsWith(`${PLAN_SHARE_HASH_KEY}=`)) { url.hash = ""; history.replaceState(history.state, "", url.toString()); return; }
        const params = new URLSearchParams(hash);
        if (!params.has(PLAN_SHARE_HASH_KEY)) return;
        params.delete(PLAN_SHARE_HASH_KEY); url.hash = params.toString(); history.replaceState(history.state, "", url.toString());
    } catch (error) { console.warn("Impossible de nettoyer le lien de partage.", error); }
}

async function importSharedPlan(sharedRecord, name, existing = null) {
    const imported = buildImportedPlan(sharedRecord, name, existing);
    await savePlanNow(imported, { touch: false });
    const target = existing ? replacePlanContents(existing, imported) : imported;
    if (!existing) plans.push(target);
    renderPlansList();
    navigateToPlans();
    openPlan(target);
    clearCurrentShareHash();
    return target;
}

function closeImportModal({ clearUrl = true, allowRetry = false } = {}) {
    if (allowRetry && pendingImport?.token) handledTokens.delete(pendingImport.token);
    pendingImport = null;
    if (importModal) importModal.hidden = true;
    if (clearUrl) clearCurrentShareHash();
}

function openConflictModal(sharedRecord, baseName, existing, token) {
    pendingImport = { sharedRecord, baseName, existing, token };
    navigateToPlans();
    importMessage.textContent = `Un plan nommé « ${baseName} » existe déjà dans vos plans. Vous pouvez remplacer cette version ou conserver les deux en créant une nouvelle copie.`;
    importModal.hidden = false;
    overwriteImportButton.focus();
}

async function completePendingImport(mode) {
    if (!pendingImport) return;
    const { sharedRecord, baseName, existing } = pendingImport;
    overwriteImportButton.disabled = true;
    copyImportButton.disabled = true;

    try {
        if (mode === "overwrite") await importSharedPlan(sharedRecord, baseName, existing);
        else await importSharedPlan(sharedRecord, getNextAvailableSharedName(baseName));
        closeImportModal();
    } catch (error) {
        console.error("Impossible d'importer le plan partagé :", error);
        alert(error.message || "Impossible d'importer ce plan partagé.");
    } finally {
        overwriteImportButton.disabled = false;
        copyImportButton.disabled = false;
    }
}

function extractShareToken(urlValue) {
    try {
        const url = new URL(urlValue, window.location.href), hash = url.hash.replace(/^#/, "");
        if (!hash) return null;
        if (hash.startsWith(`${PLAN_SHARE_HASH_KEY}=`)) return new URLSearchParams(hash).get(PLAN_SHARE_HASH_KEY);
        return hash;
    } catch { return null; }
}

async function processShareToken(token) {
    const payload = validateSharePayload(await decodeSharePayload(token));
    const validationRecord = structuredClone(payload.plan);
    const now = Date.now();
    validationRecord.id = "shared-plan-validation";
    validationRecord.createdAt = now;
    validationRecord.updatedAt = now;
    hydratePlan(validationRecord, getExercises());

    const baseName = getSharedBaseName(payload.plan.name);
    const existing = findPlanByName(baseName);
    if (existing) openConflictModal(payload.plan, baseName, existing, token);
    else await importSharedPlan(payload.plan, baseName);
}

async function handleSharedPlanUrl(urlValue) {
    const token = extractShareToken(urlValue);
    if (!token || handledTokens.has(token)) return false;

    const resumeDialog = document.querySelector(".workout-resume-dialog[open]");
    if (resumeDialog) {
        if (!deferredTokens.has(token)) {
            deferredTokens.add(token);
            resumeDialog.addEventListener("close", () => {
                deferredTokens.delete(token);
                handleSharedPlanUrl(urlValue);
            }, { once: true });
        }
        return true;
    }

    handledTokens.add(token);
    try {
        await processShareToken(token);
    } catch (error) {
        console.error("Plan partagé invalide :", error);
        handledTokens.delete(token);
        clearCurrentShareHash();
        alert(error.message || "Impossible d'ouvrir ce plan partagé.");
    }
    return true;
}

function copyShareTextFallback(fullText) {
    const focused = document.activeElement;
    const selection = window.getSelection?.();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
    const input = document.createElement("textarea");
    input.value = fullText;
    input.readOnly = true;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    try {
        input.select();
        return document.execCommand("copy");
    } catch { return false; }
    finally {
        input.remove();
        focused?.focus({ preventScroll: true });
        if (selection) {
            selection.removeAllRanges();
            ranges.forEach(range => selection.addRange(range));
        }
    }
}

async function copyShareText(fullText) {
    if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(fullText); return true; }
        catch (error) { console.warn("Copie Clipboard indisponible, utilisation de la copie locale.", error); }
    }
    return copyShareTextFallback(fullText);
}

async function shareText(title, message, url) {
    const fullText = `${message}\n${url}`;
    const nativeShare = window.Capacitor?.getPlatform?.() === "android" ? window.Capacitor.Plugins?.WilfShare : null;
    if (nativeShare?.share) {
        // Le plugin copie le texte avant d'ouvrir le choix des applications.
        try { await nativeShare.share({ title, text: fullText }); return; }
        catch (error) { console.warn("Partage natif indisponible, utilisation du partage Web.", error); }
    }
    // Lancer les deux operations pendant le meme geste utilisateur.
    const copied = copyShareText(fullText);
    if (navigator.share) {
        try {
            await navigator.share({ title, text: fullText });
            if (!await copied) window.prompt("La copie automatique a échoué. Copiez ce message :", fullText);
            return;
        } catch (error) {
            if (error?.name === "AbortError") {
                if (!await copied) window.prompt("Copiez ce message pour le partager :", fullText);
                return;
            }
            console.warn("Partage Web indisponible, copie du lien.", error);
        }
    }
    if (await copied) alert("Le message de partage a été copié. Vous pouvez maintenant le coller dans votre application de messagerie.");
    else window.prompt("Copiez ce message pour le partager :", fullText);
}

async function sharePlan(plan) {
    if (!plan) return;
    try {
        const payload = { format: PLAN_SHARE_FORMAT, version: PLAN_SHARE_VERSION, plan: createSharedPlanRecord(plan) };
        const token = await encodeSharePayload(payload);
        const url = new URL(PLAN_SHARE_WEB_URL);
        url.hash = token;
        const message = "Regarde, je t'ai créé un plan sur Wilf-Workout qui devrait t'intéresser !";
        await shareText(`Wilf-Workout — ${plan.name}`, message, url.toString());
    } catch (error) {
        if (error?.name === "AbortError") return;
        console.error("Impossible de partager le plan :", error);
        alert("Impossible de préparer le partage de ce plan.");
    }
}

async function setupPlanSharing() {
    if (setupDone) return;
    setupDone = true;

    cancelImportButton.addEventListener("click", () => closeImportModal({ allowRetry: true }));
    overwriteImportButton.addEventListener("click", () => completePendingImport("overwrite"));
    copyImportButton.addEventListener("click", () => completePendingImport("copy"));
    importModal.addEventListener("click", event => { if (event.target === importModal) closeImportModal({ allowRetry: true }); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !importModal.hidden) closeImportModal({ allowRetry: true }); });

    window.addEventListener("hashchange", () => handleSharedPlanUrl(window.location.href));
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin?.addListener) await appPlugin.addListener("appUrlOpen", ({ url }) => handleSharedPlanUrl(url));
}

async function handleInitialPlanShare() {
    await handleSharedPlanUrl(window.location.href);
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!appPlugin?.getLaunchUrl) return;
    try {
        const launch = await appPlugin.getLaunchUrl();
        if (launch?.url) await handleSharedPlanUrl(launch.url);
    } catch (error) {
        console.warn("Impossible de lire le lien de lancement Wilf-Workout.", error);
    }
}

export { configurePlanSharing, sharePlan, setupPlanSharing, handleInitialPlanShare };
