import { hydratePlan, serializePlan, savePlanNow } from "../storage/plan-storage.js";

// ============================================================
// PARTAGE DE PLANS
// ============================================================

const PLAN_SHARE_FORMAT = "wilf-workout-plan-share";
const PLAN_SHARE_VERSION = 1;
const PLAN_SHARE_HASH_KEY = "wilf-plan";
const PLAN_SHARE_WEB_URL = "https://wilfridmadelein.github.io/Wilf-Workout/";
const SHARED_PLAN_PREFIX = "Sharing is caring | ";
const PLAN_NAME_MAX_LENGTH = 80;
const MAX_SHARE_TOKEN_LENGTH = 250000;
const MAX_SHARE_JSON_LENGTH = 1000000;

let plans = [];
let getExercises = () => [];
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
    ({ plans, getExercises, renderPlansList, openPlan, navigateToPlans, importModal, importMessage, cancelImportButton, overwriteImportButton, copyImportButton } = dependencies);
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

async function encodeSharePayload(payload) {
    const json = JSON.stringify(payload);
    const raw = new TextEncoder().encode(json);
    if (typeof CompressionStream !== "function") return `j.${bytesToBase64Url(raw)}`;
    const compressed = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    return `g.${bytesToBase64Url(new Uint8Array(compressed))}`;
}

async function decodeSharePayload(token) {
    if (typeof token !== "string" || token.length < 3 || token.length > MAX_SHARE_TOKEN_LENGTH) throw new Error("Lien de partage invalide ou trop volumineux.");
    const separator = token.indexOf(".");
    if (separator !== 1) throw new Error("Format de partage inconnu.");
    const mode = token.slice(0, separator);
    const bytes = base64UrlToBytes(token.slice(separator + 1));
    let output = bytes;
    if (mode === "g") {
        if (typeof DecompressionStream !== "function") throw new Error("Cette version de l'application ne peut pas lire ce lien compressé.");
        const decompressed = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
        output = new Uint8Array(decompressed);
    } else if (mode !== "j") throw new Error("Format de partage inconnu.");
    const json = new TextDecoder().decode(output);
    if (json.length > MAX_SHARE_JSON_LENGTH) throw new Error("Le plan partagé est trop volumineux.");
    return JSON.parse(json);
}

function createSharedPlanRecord(plan) {
    const record = structuredClone(serializePlan(plan));
    delete record.id;
    delete record.createdAt;
    delete record.updatedAt;
    delete record.filters;
    delete record.filtersInitialized;
    delete record.autoExcludedProgressions;
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
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.hash.replace(/^#/, ""));
        if (!params.has(PLAN_SHARE_HASH_KEY)) return;
        params.delete(PLAN_SHARE_HASH_KEY);
        url.hash = params.toString();
        history.replaceState(history.state, "", url.toString());
    } catch (error) {
        console.warn("Impossible de nettoyer le lien de partage.", error);
    }
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
        const url = new URL(urlValue, window.location.href);
        return new URLSearchParams(url.hash.replace(/^#/, "")).get(PLAN_SHARE_HASH_KEY);
    } catch {
        return null;
    }
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
            await navigator.share({ title, text: message, url });
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
        const payload = { format: PLAN_SHARE_FORMAT, version: PLAN_SHARE_VERSION, sharedAt: new Date().toISOString(), plan: createSharedPlanRecord(plan) };
        const token = await encodeSharePayload(payload);
        const url = new URL(PLAN_SHARE_WEB_URL);
        url.hash = new URLSearchParams({ [PLAN_SHARE_HASH_KEY]: token }).toString();
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
