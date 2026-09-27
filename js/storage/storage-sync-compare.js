// ============================================================
// COMPARAISON LOCAL ↔ EXTERNE
// ============================================================

function getRecordTimestamp(record) {
    const value =
        Number(
            record?.updatedAt ??
            record?.createdAt ??
            0
        );

    return Number.isFinite(value)
        ? value
        : 0;
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

function getCurrentState(
    record,
    tombstone
) {
    const recordTime =
        getRecordTimestamp(record);

    const deletedAt =
        Number(tombstone?.deletedAt) || 0;

    if (
        tombstone &&
        deletedAt >= recordTime
    ) {
        return {
            type: "deleted",
            timestamp: deletedAt,
            value: tombstone
        };
    }

    if (record) {
        return {
            type: "record",
            timestamp: recordTime,
            value: record
        };
    }

    return null;
}

function compareCollection({
    localRecords = [],
    externalRecords = [],
    localTombstones = [],
    externalTombstones = []
}) {
    const localRecordsById =
        createRecordMap(localRecords);

    const externalRecordsById =
        createRecordMap(externalRecords);

    const localDeletedById =
        createTombstoneMap(
            localTombstones
        );

    const externalDeletedById =
        createTombstoneMap(
            externalTombstones
        );

    const ids =
        new Set([
            ...localRecordsById.keys(),
            ...externalRecordsById.keys(),
            ...localDeletedById.keys(),
            ...externalDeletedById.keys()
        ]);

    const result = [];

    ids.forEach(id => {
        const local =
            getCurrentState(
                localRecordsById.get(id),
                localDeletedById.get(id)
            );

        const external =
            getCurrentState(
                externalRecordsById.get(id),
                externalDeletedById.get(id)
            );

        let status;

        if (!local && external) {
            status = "external-only";
        } else if (local && !external) {
            status = "local-only";
        } else if (!local && !external) {
            status = "missing";
        } else if (
            local.type === external.type &&
            local.timestamp ===
                external.timestamp
        ) {
            status = "same";
        } else if (
            local.timestamp >
            external.timestamp
        ) {
            status = "local-newer";
        } else if (
            external.timestamp >
            local.timestamp
        ) {
            status = "external-newer";
        } else {
            /*
             * Même timestamp mais états différents.
             * Ne jamais choisir automatiquement.
             */
            status = "conflict";
        }

        result.push({
            id,
            status,
            local,
            external
        });
    });

    return result;
}

export {
    compareCollection
};