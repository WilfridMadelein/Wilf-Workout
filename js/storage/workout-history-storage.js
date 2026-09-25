import {
    getStoredWorkoutHistory,
    putStoredWorkoutHistory,
    deleteStoredWorkoutHistory
} from "./indexed-db.js";

// ============================================================
// STOCKAGE DE L'HISTORIQUE D'ENTRAÎNEMENT
// ============================================================

const WORKOUT_HISTORY_SCHEMA_VERSION = 1;

// ------------------------------------------------------------
// Migration
// ------------------------------------------------------------

function migrateWorkoutHistoryRecord(record) {
    const session = structuredClone(record);
    const version = Number(session.schemaVersion) || 0;

    if (version > WORKOUT_HISTORY_SCHEMA_VERSION) {
        throw new Error(
            `Entraînement ${session.id} créé avec un schéma plus récent (${version}).`
        );
    }

    if (!session?.id || !Array.isArray(session.sets)) {
        throw new Error("Entraînement historique invalide.");
    }

    session.planId ??= null;
    session.planName =
        String(session.planName ?? "Entraînement");

    session.startedAt =
        Number(session.startedAt) || Date.now();

    session.completedAt =
        Number(session.completedAt) ||
        session.startedAt;

    session.elapsedSeconds =
        Math.max(
            0,
            Number(session.elapsedSeconds) || 0
        );

    session.updatedAt =
        Number(session.updatedAt) ||
        session.completedAt;

    session.defaults ??= {
        reps: 10,
        time: 30
    };

    session.schemaVersion =
        WORKOUT_HISTORY_SCHEMA_VERSION;

    return session;
}

// ------------------------------------------------------------
// Sérialisation
// ------------------------------------------------------------

function serializeWorkoutHistory(session) {
    if (!session?.id) {
        throw new Error(
            "Impossible de sauvegarder un entraînement sans identifiant."
        );
    }

    const record =
        structuredClone(session);

    record.schemaVersion =
        WORKOUT_HISTORY_SCHEMA_VERSION;

    record.completedAt =
        Number(record.completedAt) ||
        Date.now();

    record.updatedAt =
        Number(record.updatedAt) ||
        Date.now();

    record.screen = "summary";

    record.isPaused = false;
    record.pausedAt = null;

    delete record.completionConfettiShown;

    return record;
}

// ------------------------------------------------------------
// Lecture / écriture
// ------------------------------------------------------------

async function loadWorkoutHistory() {
    const records =
        await getStoredWorkoutHistory();

    const history = [];

    records.forEach(record => {
        try {
            history.push(
                migrateWorkoutHistoryRecord(
                    record
                )
            );
        } catch (error) {
            console.error(
                `Impossible de charger l'entraînement ${record?.id ?? "inconnu"}. Les données ont été conservées.`,
                error
            );
        }
    });

    return history.sort(
        (first, second) =>
            second.startedAt -
            first.startedAt
    );
}

async function saveWorkoutHistoryNow(
    session,
    {
        markCompleted = false,
        touch = true
    } = {}
) {
    if (!session?.id) return;

    if (
        markCompleted &&
        !session.completedAt
    ) {
        session.completedAt =
            Date.now();
    }

    if (touch || !session.updatedAt) {
        session.updatedAt =
            Date.now();
    }

    await putStoredWorkoutHistory(
        serializeWorkoutHistory(session)
    );
}

async function deleteWorkoutHistoryFromStorage(id) {
    if (!id) return;

    await deleteStoredWorkoutHistory(id);
}

export {
    WORKOUT_HISTORY_SCHEMA_VERSION,
    migrateWorkoutHistoryRecord,
    serializeWorkoutHistory,
    loadWorkoutHistory,
    saveWorkoutHistoryNow,
    deleteWorkoutHistoryFromStorage
};