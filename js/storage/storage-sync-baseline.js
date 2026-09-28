// ============================================================
// BASE DE DERNIÈRE SYNCHRONISATION
// ============================================================

function canonicalize(value) {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }

    if (
        value &&
        typeof value === "object"
    ) {
        const result = {};

        Object.keys(value)
            .sort()
            .forEach(key => {
                if (value[key] === undefined) return;

                result[key] =
                    canonicalize(value[key]);
            });

        return result;
    }

    return value;
}

function stableStringify(value) {
    return JSON.stringify(
        canonicalize(value)
    );
}

async function fingerprintValue(value) {
    const serialized =
        stableStringify(value);

    if (!globalThis.crypto?.subtle) {
        return `raw:${serialized}`;
    }

    const data =
        new TextEncoder()
            .encode(serialized);

    const digest =
        await globalThis.crypto.subtle.digest(
            "SHA-256",
            data
        );

    return Array.from(
        new Uint8Array(digest),
        byte =>
            byte
                .toString(16)
                .padStart(2, "0")
    ).join("");
}

function createRecordMap(records = []) {
    return new Map(
        records.map(record => [
            String(record.id),
            record
        ])
    );
}

function createTombstoneMap(records = []) {
    return new Map(
        records.map(record => [
            String(record.id),
            record
        ])
    );
}

function getRecordTimestamp(record) {
    const timestamp =
        Number(
            record?.updatedAt ??
            record?.createdAt ??
            0
        );

    return Number.isFinite(timestamp)
        ? timestamp
        : 0;
}

async function createCollectionBaseline(
    records = [],
    tombstones = []
) {
    const recordsById =
        createRecordMap(records);

    const tombstonesById =
        createTombstoneMap(tombstones);

    const ids =
        new Set([
            ...recordsById.keys(),
            ...tombstonesById.keys()
        ]);

    const result = {};

    for (const id of ids) {
        const record =
            recordsById.get(id);

        const tombstone =
            tombstonesById.get(id);

        const recordTimestamp =
            getRecordTimestamp(record);

        const deletedAt =
            Number(tombstone?.deletedAt) || 0;

        if (
            tombstone &&
            deletedAt >= recordTimestamp
        ) {
            result[id] = {
                type: "deleted",
                timestamp: deletedAt,
                fingerprint:
                    await fingerprintValue({
                        id: tombstone.id,
                        deletedAt
                    })
            };

            continue;
        }

        if (!record) continue;

        result[id] = {
            type: "record",
            timestamp: recordTimestamp,
            fingerprint:
                await fingerprintValue(record)
        };
    }

    return result;
}

async function fingerprintSettings(settings) {
    if (!settings) return null;

    const comparable = structuredClone(settings);
    delete comparable.updatedAt;

    return fingerprintValue(comparable);
}

async function createSyncBaseline(snapshot) {
    const [
        plans,
        workoutHistory,
        settingsFingerprint
    ] = await Promise.all([
        createCollectionBaseline(
            snapshot.plans,
            snapshot.tombstones?.plans
        ),

        createCollectionBaseline(
            snapshot.workoutHistory,
            snapshot.tombstones
                ?.workoutHistory
        ),

        fingerprintSettings(snapshot.settings)
    ]);

    return {
        schemaVersion: 1,

        plans,

        settings:
            settingsFingerprint
                ? {
                    type: "record",
                    fingerprint:
                        settingsFingerprint
                }
                : null,

        workoutHistory
    };
}

function statesEqual(first, second) {
    if (!first && !second) return true;
    if (!first || !second) return false;

    return (
        first.type === second.type &&
        first.fingerprint ===
            second.fingerprint
    );
}

function collectionsEqual(
    first = {},
    second = {}
) {
    const ids =
        new Set([
            ...Object.keys(first),
            ...Object.keys(second)
        ]);

    for (const id of ids) {
        if (
            !statesEqual(
                first[id],
                second[id]
            )
        ) {
            return false;
        }
    }

    return true;
}

function baselinesEqual(first, second) {
    if (!first || !second) return false;

    return (
        collectionsEqual(
            first.plans,
            second.plans
        ) &&
        statesEqual(
            first.settings,
            second.settings
        ) &&
        collectionsEqual(
            first.workoutHistory,
            second.workoutHistory
        )
    );
}

function classifyState(
    local,
    external,
    baseline
) {
    if (
        statesEqual(
            local,
            external
        )
    ) {
        return "same";
    }

    const localChanged =
        !statesEqual(
            local,
            baseline
        );

    const externalChanged =
        !statesEqual(
            external,
            baseline
        );

    if (
        localChanged &&
        !externalChanged
    ) {
        return "local-changed";
    }

    if (
        !localChanged &&
        externalChanged
    ) {
        return "external-changed";
    }

    if (
        localChanged &&
        externalChanged
    ) {
        return "conflict";
    }

    return "different";
}

function compareCollectionThreeWay(
    local = {},
    external = {},
    baseline = {}
) {
    const ids =
        new Set([
            ...Object.keys(local),
            ...Object.keys(external),
            ...Object.keys(baseline)
        ]);

    return Array.from(ids).map(id => ({
        id,

        status:
            classifyState(
                local[id],
                external[id],
                baseline[id]
            ),

        local:
            local[id] ?? null,

        external:
            external[id] ?? null,

        baseline:
            baseline[id] ?? null
    }));
}

function compareSyncBaselines(
    local,
    external,
    baseline
) {
    return {
        settings:
            classifyState(
                local.settings,
                external.settings,
                baseline.settings
            ),

        plans:
            compareCollectionThreeWay(
                local.plans,
                external.plans,
                baseline.plans
            ),

        workoutHistory:
            compareCollectionThreeWay(
                local.workoutHistory,
                external.workoutHistory,
                baseline.workoutHistory
            )
    };
}

export {
    createSyncBaseline,
    baselinesEqual,
    compareSyncBaselines
};