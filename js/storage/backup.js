import {
    getStoredPlans,
    getStoredSetting,
    getStoredWorkoutHistory,
    putStoredSetting,
    putStoredWorkoutHistory
} from "./storage-provider.js";

import { saveNativeTextFile } from "./storage-target.js";
import { hydratePlan, loadPlans, savePlanNow } from "./plan-storage.js";
import { loadWorkoutHistory, migrateWorkoutHistoryRecord } from "./workout-history-storage.js";

// ============================================================
// SAUVEGARDE WILF
// ============================================================

const BACKUP_FORMAT = "wilf-workout-backup";
const BACKUP_VERSION = 2;

function getRecordTimestamp(record) {
    const value = Number(record?.updatedAt ?? record?.createdAt ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function validateBackup(backup) {
    if (!backup || typeof backup !== "object") throw new Error("Fichier de sauvegarde invalide.");
    if (backup.format !== BACKUP_FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde Wilf Workout.");
    if (!Number.isInteger(backup.backupVersion) || backup.backupVersion < 1) throw new Error("Version de sauvegarde invalide.");
    if (backup.backupVersion > BACKUP_VERSION) throw new Error("Cette sauvegarde provient d'une version plus récente de Wilf.");
    if (!Array.isArray(backup.plans)) throw new Error("La sauvegarde ne contient pas de liste de plans valide.");

    backup.plans.forEach(plan => {
        if (!plan || plan.id == null) throw new Error("La sauvegarde contient un plan invalide.");
    });

    if (backup.settings != null && (typeof backup.settings !== "object" || backup.settings.id !== "app")) {
        throw new Error("La sauvegarde contient des paramètres invalides.");
    }

    if (backup.backupVersion === 1 && backup.workoutHistory == null) backup.workoutHistory = [];
    if (!Array.isArray(backup.workoutHistory)) throw new Error("La sauvegarde contient un historique invalide.");

    backup.workoutHistory.forEach(record => {
        if (!record || record.id == null) throw new Error("La sauvegarde contient un entraînement invalide.");
    });

    return backup;
}

async function downloadBackup(plans) {
    await Promise.all(plans.map(plan => savePlanNow(plan, { touch: false })));

    const [records, settings, workoutHistory] = await Promise.all([
        getStoredPlans(),
        getStoredSetting("app"),
        getStoredWorkoutHistory()
    ]);

    const backup = {
        format: BACKUP_FORMAT,
        backupVersion: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        plans: records,
        settings: settings ?? null,
        workoutHistory
    };

    const content = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `wilf-workout-backup-${date}.wilf`;

    const nativeResult = await saveNativeTextFile({ fileName, content, mimeType: "application/json" });
    if (nativeResult !== null) return;

    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function readBackupFile(file) {
    if (!file) throw new Error("Aucun fichier sélectionné.");

    try {
        return validateBackup(JSON.parse(await file.text()));
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error("Impossible de lire cette sauvegarde.");
        throw error;
    }
}

async function importBackup(backup, exercises) {
    validateBackup(backup);

    // Validation complète avant toute écriture.
    const importedPlans = backup.plans.map(record => ({ record, plan: hydratePlan(record, exercises) }));
    const importedHistory = backup.workoutHistory.map(record => migrateWorkoutHistoryRecord(record));

    const [localPlans, localHistory] = await Promise.all([
        getStoredPlans(),
        getStoredWorkoutHistory()
    ]);

    const localPlansById = new Map(localPlans.map(record => [String(record.id), record]));
    const localHistoryById = new Map(localHistory.map(record => [String(record.id), record]));

    let added = 0;
    let updated = 0;
    let kept = 0;
    let historyAdded = 0;
    let historyUpdated = 0;
    let historyKept = 0;

    for (const { record, plan } of importedPlans) {
        const local = localPlansById.get(String(record.id));

        if (local && getRecordTimestamp(local) >= getRecordTimestamp(record)) {
            kept++;
            continue;
        }

        local ? updated++ : added++;
        plan.updatedAt = getRecordTimestamp(record) || Date.now();
        await savePlanNow(plan, { touch: false });
    }

    for (const record of importedHistory) {
        const local = localHistoryById.get(String(record.id));

        if (local && getRecordTimestamp(local) >= getRecordTimestamp(record)) {
            historyKept++;
            continue;
        }

        local ? historyUpdated++ : historyAdded++;
        await putStoredWorkoutHistory(record);
    }

    let settingsUpdated = false;

    if (backup.settings) {
        const localSettings = await getStoredSetting("app");

        if (!localSettings || getRecordTimestamp(backup.settings) > getRecordTimestamp(localSettings)) {
            await putStoredSetting(backup.settings);
            settingsUpdated = true;
        }
    }

    return {
        plans: await loadPlans(exercises),
        workoutHistory: await loadWorkoutHistory(),
        added,
        updated,
        kept,
        historyAdded,
        historyUpdated,
        historyKept,
        settingsUpdated
    };
}

export {
    BACKUP_VERSION,
    downloadBackup,
    readBackupFile,
    importBackup
};