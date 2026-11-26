'use strict';

const { Op, fn, col, where } = require('sequelize');

class SpecificationConflict extends Error {}

function readOptions(raw) {
    let value = raw;
    if (typeof raw === 'string') {
        try {
            value = JSON.parse(raw);
        } catch {
            // Earlier manual lists used one option per line.
            const first = raw.trimStart()[0];
            if (!raw.includes('\n') || ['[', '{', '"', ']'].includes(first)) return null;
            value = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        }
    }
    if (value == null) return [];
    return Array.isArray(value) && value.every(entry => typeof entry === 'string')
        ? value : null;
}

function attributesOf(raw) {
    let attributes = raw;
    if (typeof raw === 'string') {
        try {
            attributes = JSON.parse(raw);
        } catch {
            throw new SpecificationConflict('Stored variant attributes could not be read. Review the record before changing this specification.');
        }
    }
    if (attributes == null) return {};
    if (typeof attributes !== 'object' || Array.isArray(attributes)) {
        throw new SpecificationConflict('Stored variant attributes have an unsupported format.');
    }
    return attributes;
}

const keyOf = value => String(value).trim().toLowerCase();
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function guardDefinitionChange(spec, changes, expected, transaction) {
    const nextType = changes.data_type ?? spec.data_type;
    const typeChanged = nextType !== spec.data_type;
    const renamed = changes.name !== undefined && changes.name !== spec.name;
    const replacing = changes.options !== undefined;
    if (!replacing && !typeChanged && !renamed) return;
    if (spec.data_type !== 'select' && nextType !== 'select') {
        if (changes.options?.length) throw new SpecificationConflict('Only Select specifications accept predefined values.');
        return;
    }

    const old = spec.options;
    if (!Array.isArray(old)) throw new SpecificationConflict('Stored predefined values could not be read. Review this definition before editing its options.');
    if (replacing || typeChanged) {
        if (!sameList(expected, old)) throw new SpecificationConflict('Predefined values changed or their original list was omitted. Reopen the specification before saving.');
        if (nextType === 'select' && !changes.options?.length) {
            throw new SpecificationConflict('A replacement Select list must contain at least one value.');
        }
        if (nextType !== 'select' && !sameList(changes.options, [])) {
            throw new SpecificationConflict('Changing away from Select requires explicitly clearing the predefined values.');
        }
    }
    const removed = old.filter(value => replacing && !changes.options.includes(value));
    if (!typeChanged && !renamed && !removed.length) return;

    const { ItemSpecificationValue, ItemVariant } = spec.sequelize.models;
    const removedKeys = new Set(removed.map(keyOf));
    function check(value, nameKeyed) {
        if (typeChanged || (renamed && nameKeyed) || removedKeys.has(keyOf(value))) {
            throw new SpecificationConflict('This change affects an existing product or variant assignment. Keep the referenced name, type and option values.');
        }
    }
    if (typeChanged || removed.length) {
        const rows = await ItemSpecificationValue.findAll({
            attributes: ['value'], where: { specification_id: spec.id }, raw: true, transaction
        });
        for (const row of rows) check(row.value, false);
    }
    const variants = await ItemVariant.findAll({
        attributes: ['attributes'], where: { attributes: { [Op.ne]: null } }, raw: true, transaction
    });
    for (const variant of variants) {
        for (const [key, value] of Object.entries(attributesOf(variant.attributes))) {
            const matchesName = keyOf(key) === keyOf(spec.name) ||
                (renamed && keyOf(key) === keyOf(changes.name));
            if (matchesName) check(value, true);
        }
    }
}

function checkAssignment(spec, value) {
    if (spec?.data_type !== 'select' || value == null || value === '') return;
    const options = spec.options;
    if (!Array.isArray(options) || (options.length && !options.includes(String(value)))) {
        throw new SpecificationConflict('Choose a current predefined value for ' + spec.name + '.');
    }
}

// Instance writes in the item, variant, bulk-create and import workflows already
// run in transactions. Read the latest definition under the same lock as a list edit.
async function validateItemAssignment(record, { transaction }) {
    if (!record.changed('value') && !record.changed('specification_id')) return;
    const spec = await record.sequelize.models.ItemSpecification.findByPk(record.specification_id, {
        transaction, lock: transaction?.LOCK.SHARE
    });
    checkAssignment(spec, record.value);
}

async function validateVariantAssignments(variant, { transaction }) {
    if (!variant.changed('attributes')) return;
    const previous = attributesOf(variant.previous('attributes'));
    const changed = Object.entries(attributesOf(variant.attributes))
        .filter(([key, value]) => previous[key] !== value);
    if (!changed.length) return;
    const keys = changed.map(([key]) => keyOf(key));
    const definitions = await variant.sequelize.models.ItemSpecification.findAll({
        where: where(fn('LOWER', fn('TRIM', col('name'))), { [Op.in]: keys }),
        order: [['id', 'ASC']], transaction, lock: transaction?.LOCK.SHARE
    });
    for (const definition of definitions) {
        for (const [key, value] of changed) {
            if (keyOf(key) === keyOf(definition.name)) checkAssignment(definition, value);
        }
    }
}

module.exports = { readOptions, SpecificationConflict, guardDefinitionChange, validateItemAssignment, validateVariantAssignments };
