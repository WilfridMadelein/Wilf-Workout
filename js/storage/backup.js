import {
    getStoredPlans,
    getStoredSetting,
    putStoredSetting
} from "./indexed-db.js";

import {
    hydratePlan,
    loadPlans,
    savePlanNow
} from "./plan-storage.js";

// ============================================================
// SAUVEGARDE WILF
// ============================================================

const BACKUP_FORMAT = "wilf-workout-backup";
const BACKUP_VERSION = 1;

function getRecordTimestamp(record) {
    const value = Number(record?.updatedAt ?? record?.createdAt ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function validateBackup(backup) {
    if (!backup || typeof backup !== "object") {
        throw new Error("Fichier de sauvegarde invalide.");
    }

    if (backup.format !== BACKUP_FORMAT) {
        throw new Error("Ce fichier n'est pas une sauvegarde Wilf Workout.");
    }

    if (!Number.isInteger(backup.backupVersion) || backup.backupVersion < 1) {
        throw new Error("Version de sauvegarde invalide.");
    }

    if (backup.backupVersion > BACKUP_VERSION) {
        throw new Error(
            "Cette sauvegarde provient d'une version plus récente de Wilf."
        );
    }

    if (!Array.isArray(backup.plans)) {
        throw new Error("La sauvegarde ne contient pas de liste de plans valide.");
    }

    backup.plans.forEach(plan => {
        if (!plan || plan.id == null) {
            throw new Error("La sauvegarde contient un plan invalide.");
        }
    });

    if (
    backup.settings != null &&
    (
        typeof backup.settings !== "object" ||
        backup.settings.id !== "app"
    )
    ) {
    throw new Error(
        "La sauvegarde contient des paramètres invalides."
    );
    }

    return backup;
}

async function downloadBackup(plans) {
    await Promise.all(
        plans.map(plan => savePlanNow(plan, { touch: false }))
    );

const [records, settings] =
    await Promise.all([
        getStoredPlans(),
        getStoredSetting("app")
    ]);

const backup = {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    plans: records,
    settings: settings ?? null
};

    const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `wilf-workout-backup-${date}.wilf`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

async function readBackupFile(file) {
    if (!file) throw new Error("Aucun fichier sélectionné.");

    let backup;

    try {
        backup = JSON.parse(await file.text());
    } catch {
        throw new Error("Impossible de lire cette sauvegarde.");
    }

    return validateBackup(backup);
}

async function importBackup(backup, exercises) {
    validateBackup(backup);

    /*
     * Validation complète AVANT toute écriture.
     * Si un plan est incompatible, aucune donnée locale n'est modifiée.
     */
    const importedPlans = backup.plans.map(record => ({
        record,
        plan: hydratePlan(record, exercises)
    }));

    const localRecords = await getStoredPlans();
    const localById = new Map(
        localRecords.map(record => [String(record.id), record])
    );

    let added = 0;
    let updated = 0;
    let kept = 0;

    for (const { record, plan } of importedPlans) {
        const local = localById.get(String(record.id));

        if (local) {
            const localTime = getRecordTimestamp(local);
            const importedTime = getRecordTimestamp(record);

            if (localTime >= importedTime) {
                kept++;
                continue;
            }

            updated++;
        } else {
            added++;
        }

        plan.updatedAt = getRecordTimestamp(record) || Date.now();
        await savePlanNow(plan, { touch: false });
    }

    let settingsUpdated = false;

    if (backup.settings) {
    const localSettings =
        await getStoredSetting("app");

    if (
        !localSettings ||
        getRecordTimestamp(backup.settings) >
        getRecordTimestamp(localSettings)
    ) {
        await putStoredSetting(backup.settings);
        settingsUpdated = true;
    }
    }

    return {
        plans: await loadPlans(exercises),
        added,
        updated,
        kept,
        settingsUpdated,
    };
}

export {
    BACKUP_VERSION,
    downloadBackup,
    readBackupFile,
    importBackup
};