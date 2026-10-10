// ============================================================
// MISES À JOUR APK — VÉRIFICATION SANS INSTALLATION SILENCIEUSE
// ============================================================

const UPDATE_MANIFEST_URL = "https://wilfridmadelein.github.io/Wilf-Workout/android-updates.json";
const RELEASES_URL = "https://github.com/WilfridMadelein/Wilf-Workout/releases/latest";
const AUTO_CHECK_KEY = "wilf-apk-update-auto-check-v1";

let checking = false;
let updateAvailable = null;
let installedInfo = null;
let initialized = false;

const el = id => document.getElementById(id);

function isAndroidApp() {
    return window.Capacitor?.getPlatform?.() === "android" && typeof window.Capacitor?.Plugins?.App?.getInfo === "function";
}

function wantsAutomaticCheck() {
    try { return localStorage.getItem(AUTO_CHECK_KEY) !== "false"; }
    catch { return true; }
}

function setAutomaticCheck(enabled) {
    try { localStorage.setItem(AUTO_CHECK_KEY, String(enabled)); }
    catch (error) { console.warn("Préférence de mise à jour non enregistrée :", error); }
}

function parseUpdateManifest(data) {
    if (data?.schemaVersion !== 1 || !Number.isSafeInteger(data.latestBuild) || data.latestBuild < 1) throw new Error("Informations de mise à jour invalides.");
    if (!Number.isSafeInteger(data.minSupportedBuild) || data.minSupportedBuild < 1 || data.minSupportedBuild > data.latestBuild) throw new Error("Version minimale invalide.");
    if (typeof data.latestVersion !== "string" || !data.latestVersion.trim() || data.latestVersion.length > 32) throw new Error("Numéro de version invalide.");
    if (typeof data.summary !== "string" || data.summary.length > 500) throw new Error("Description de mise à jour invalide.");
    if (!["feature", "security", "maintenance"].includes(data.importance)) throw new Error("Catégorie de mise à jour invalide.");
    return data;
}

function showUpdateBanner(update) {
    const banner = el("wilf-update-banner");
    const required = Number(installedInfo.build) < update.minSupportedBuild;
    el("wilf-update-banner-title").textContent = required ? "Mise à jour importante recommandée" : `Nouvelle version ${update.latestVersion} disponible`;
    el("wilf-update-banner-description").textContent = update.summary;
    banner.hidden = false;
}

async function checkForAppUpdates({ manual = false } = {}) {
    if (!isAndroidApp() || checking) return;
    checking = true;
    const status = el("settings-update-status");
    const button = el("settings-update-check");
    button.disabled = true;
    status.textContent = "Vérification des mises à jour...";
    try {
        installedInfo ??= await window.Capacitor.Plugins.App.getInfo();
        const installedBuild = Number(installedInfo.build);
        if (!Number.isSafeInteger(installedBuild) || installedBuild < 1) throw new Error("Version installée inconnue.");
        const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Serveur indisponible (${response.status}).`);
        const update = parseUpdateManifest(await response.json());
        updateAvailable = update.latestBuild > installedBuild ? update : null;
        el("settings-update-open").hidden = !updateAvailable;
        if (updateAvailable) {
            const required = installedBuild < update.minSupportedBuild;
            status.textContent = `${required ? "Mise à jour importante recommandée" : "Mise à jour disponible"} : ${update.latestVersion}. ${update.summary}`;
            showUpdateBanner(update);
        } else {
            status.textContent = `Version ${installedInfo.version} à jour (build ${installedBuild}).`;
            el("wilf-update-banner").hidden = true;
        }
    } catch (error) {
        status.textContent = "Impossible de vérifier les mises à jour. Vérifiez votre connexion Internet et réessayez.";
        if (manual) console.warn("Vérification des mises à jour Wilf :", error);
    } finally {
        checking = false;
        button.disabled = false;
    }
}

async function openOfficialReleasePage() {
    if (!isAndroidApp()) return;
    const nativeOpener = window.Capacitor.Plugins?.WilfUpdates?.openReleasePage;
    if (typeof nativeOpener === "function") {
        try { await nativeOpener(); return; }
        catch (error) { console.warn("Ouverture native impossible :", error); }
    }
    window.open(RELEASES_URL, "_blank", "noopener,noreferrer");
}

async function setupAppUpdates() {
    if (initialized || !isAndroidApp()) return;
    initialized = true;
    el("settings-app-updates").hidden = false;
    el("settings-update-auto-check").checked = wantsAutomaticCheck();
    el("settings-update-check").addEventListener("click", () => checkForAppUpdates({ manual: true }));
    el("settings-update-auto-check").addEventListener("change", event => setAutomaticCheck(event.target.checked));
    el("settings-update-open").addEventListener("click", openOfficialReleasePage);
    el("wilf-update-banner-open").addEventListener("click", openOfficialReleasePage);
    el("wilf-update-banner-dismiss").addEventListener("click", () => { el("wilf-update-banner").hidden = true; });
    try {
        installedInfo = await window.Capacitor.Plugins.App.getInfo();
        el("settings-update-current").textContent = `Version installée : ${installedInfo.version} (build ${installedInfo.build}).`;
    } catch (error) {
        el("settings-update-current").textContent = "Impossible d'identifier la version installée.";
        console.warn("Version APK Wilf :", error);
    }
    if (wantsAutomaticCheck()) await checkForAppUpdates();
}

export { setupAppUpdates, checkForAppUpdates };
