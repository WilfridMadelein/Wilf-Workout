// ============================================================
// MOTEUR DE SCÉNARIOS — AUTO-PLAN TEST LAB
// ============================================================

function createSeededRandom(seed = 12345) {
    let state = Number(seed) >>> 0;

    return () => {
        state += 0x6D2B79F5;

        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);

        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function chooseIndexes(count, size, start = 0, prefix = [], result = []) {
    if (prefix.length === size) {
        result.push([...prefix]);
        return result;
    }

    for (let index = start; index <= count - (size - prefix.length); index += 1) {
        prefix.push(index);
        chooseIndexes(count, size, index + 1, prefix, result);
        prefix.pop();
    }

    return result;
}

function cartesianIndexes(lengths, depth = 0, prefix = [], result = []) {
    if (depth === lengths.length) {
        result.push([...prefix]);
        return result;
    }

    for (let index = 0; index < lengths[depth]; index += 1) {
        prefix.push(index);
        cartesianIndexes(lengths, depth + 1, prefix, result);
        prefix.pop();
    }

    return result;
}

function createRequirementKey(dimensionIndexes, valueIndexes) {
    return `${dimensionIndexes.join(",")}|${valueIndexes.join(",")}`;
}

function createRequirementUniverse(dimensions, strength) {
    const effectiveStrength = Math.max(1, Math.min(strength, dimensions.length));
    const combinations = chooseIndexes(dimensions.length, effectiveStrength);
    const requirements = new Set();

    combinations.forEach(dimensionIndexes => {
        const lengths = dimensionIndexes.map(index => dimensions[index].values.length);

        cartesianIndexes(lengths).forEach(valueIndexes => {
            requirements.add(createRequirementKey(dimensionIndexes, valueIndexes));
        });
    });

    return { effectiveStrength, combinations, requirements };
}

function getRowRequirementKeys(row, combinations) {
    return combinations.map(dimensionIndexes =>
        createRequirementKey(
            dimensionIndexes,
            dimensionIndexes.map(index => row[index])
        )
    );
}

function countUncovered(row, combinations, uncovered) {
    return getRowRequirementKeys(row, combinations)
        .reduce((count, key) => count + Number(uncovered.has(key)), 0);
}

function removeCovered(row, combinations, uncovered) {
    getRowRequirementKeys(row, combinations)
        .forEach(key => uncovered.delete(key));
}

function randomRow(dimensions, random) {
    return dimensions.map(dimension =>
        Math.floor(random() * dimension.values.length)
    );
}

function rowFromRequirement(requirementKey, dimensions, random) {
    const [dimensionPart, valuePart] = requirementKey.split("|");
    const dimensionIndexes = dimensionPart.split(",").map(Number);
    const valueIndexes = valuePart.split(",").map(Number);
    const row = randomRow(dimensions, random);

    dimensionIndexes.forEach((dimensionIndex, index) => {
        row[dimensionIndex] = valueIndexes[index];
    });

    return row;
}

function materializeRow(row, dimensions) {
    return Object.fromEntries(
        dimensions.map((dimension, index) => [
            dimension.name,
            structuredClone(dimension.values[row[index]])
        ])
    );
}

function buildTWayCases(
    dimensions,
    strength = 2,
    {
        seed = 12345,
        maxCases = 1000,
        candidateAttempts = 250
    } = {}
) {
    if (!dimensions.length) {
        return {
            cases: [{}],
            coverage: {
                strength: 0,
                total: 0,
                covered: 0,
                percent: 100
            }
        };
    }

    const random = createSeededRandom(seed);
    const {
        effectiveStrength,
        combinations,
        requirements
    } = createRequirementUniverse(dimensions, strength);

    const totalRequirements = requirements.size;
    const uncovered = new Set(requirements);
    const rows = [];

    while (uncovered.size && rows.length < maxCases) {
        let bestRow = null;
        let bestCoverage = -1;

        for (let attempt = 0; attempt < candidateAttempts; attempt += 1) {
            const row = randomRow(dimensions, random);
            const coverage = countUncovered(row, combinations, uncovered);

            if (coverage <= bestCoverage) continue;

            bestCoverage = coverage;
            bestRow = row;

            if (coverage === combinations.length) break;
        }

        if (!bestRow || bestCoverage <= 0) {
            bestRow = rowFromRequirement(
                uncovered.values().next().value,
                dimensions,
                random
            );
        }

        rows.push(bestRow);
        removeCovered(bestRow, combinations, uncovered);
    }

    const covered = totalRequirements - uncovered.size;

    return {
        cases: rows.map(row => materializeRow(row, dimensions)),

        coverage: {
            strength: effectiveStrength,
            total: totalRequirements,
            covered,
            uncovered: uncovered.size,

            percent: totalRequirements
                ? Math.round(covered / totalRequirements * 10000) / 100
                : 100
        }
    };
}

function buildRepeatCase(dimensions, { seed = 12345 } = {}) {
    const random = createSeededRandom(seed);
    return materializeRow(randomRow(dimensions, random), dimensions);
}

function buildBoundaryCases(dimensions, { maxCases = 1000 } = {}) {
    if (!dimensions.length) return [{}];

    const baselineIndexes = dimensions.map(dimension =>
        Math.floor((dimension.values.length - 1) / 2)
    );

    const rows = [baselineIndexes];

    dimensions.forEach((dimension, dimensionIndex) => {
        if (!dimension.values.length) return;

        [0, dimension.values.length - 1].forEach(valueIndex => {
            const row = [...baselineIndexes];
            row[dimensionIndex] = valueIndex;
            rows.push(row);
        });
    });

    const unique = new Map();

    rows.slice(0, maxCases).forEach(row => {
        unique.set(
            JSON.stringify(row),
            materializeRow(row, dimensions)
        );
    });

    return [...unique.values()];
}

export {
    createSeededRandom,
    buildTWayCases,
    buildRepeatCase,
    buildBoundaryCases
};