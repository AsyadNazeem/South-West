'use strict';

const { readOptions } = require('./specificationOptions');
const { validateSpecificationValue } = require('./specificationValue');
const { HEADERS } = require('./bulkSpecificationWorkbook');
const key = value => String(value ?? '').trim().toLowerCase();

async function assignments(db, typeIds, transaction) {
    if (!typeIds.length) return [];
    const rows = await db.ItemTypeSpecification.findAll({
        where: { item_type_id: typeIds },
        include: [{ model: db.ItemSpecification, as: 'specification', required: true, where: { is_active: true },
            attributes: ['id', 'name', 'data_type', 'options'] },
        { model: db.ItemType, as: 'itemType', required: true, where: { is_active: true }, attributes: [] }],
        attributes: ['item_type_id'], raw: true, nest: true, order: [['item_type_id', 'ASC'], ['sort_order', 'ASC'], ['specification_id', 'ASC']],
        transaction, lock: transaction?.LOCK.SHARE
    });
    return rows.map(row => ({ ...row, specification: { ...row.specification, options: readOptions(row.specification.options) } }));
}

function specificationRows(sheet, limit) {
    if (!sheet) return [];
    if (HEADERS.some((title, i) => key(sheet.getCell(1, i + 1).value) !== key(title))) throw new Error('Invalid headers in Specifications. Download a fresh template.');
    const rows = [];
    sheet.eachRow((row, n) => {
        if (n === 1) return;
        const values = HEADERS.map((_, i) => row.getCell(i + 1).value);
        if (values.some(value => value != null && String(value).trim() !== '')) rows.push({ n, values });
        if (rows.length > limit) throw new Error('Workbook exceeds ' + limit + ' populated Specifications rows.');
    });
    return rows;
}

function typedValue(spec, raw) {
    if (raw instanceof Date) {
        if (spec.data_type !== 'date' || !Number.isFinite(+raw) || !raw.toISOString().endsWith('T00:00:00.000Z')) return null;
        raw = raw.toISOString().slice(0, 10);
    }
    if (raw == null || !['string','number','boolean'].includes(typeof raw) || !String(raw).trim()) return null;
    if (['number', 'decimal'].includes(spec.data_type) && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(raw).trim())) return null;
    if (spec.data_type === 'select' && !spec.options?.includes(String(raw))) return null;
    if (spec.data_type === 'boolean') {
        if (key(raw) === 'yes') raw = 'true';
        if (key(raw) === 'no') raw = 'false';
    }
    const checked = validateSpecificationValue(raw, spec.data_type);
    return checked.valid && Buffer.byteLength(checked.value) <= 65535 ? checked.value : null;
}

function mapRows(rows, products, definitions) {
    const byName = new Map(products.map(p => [key(p.name), p]));
    const issues = [], seen = new Set();
    for (const { n, values: [productName, variantName, name, value] } of rows) {
        const product = byName.get(key(productName));
        function issue(column, error) {
            issues.push({ sheet: 'Specifications', rowNumber: n, column, error, suggestion: 'Select the product and variant again, then check the specification and its value.', productRow: product?.rowNumber });
            if (product) product.errors.push('Specifications row ' + n + ': ' + error);
        }
        const invalidColumn = [productName, variantName, name].findIndex(v => v != null && typeof v === 'object');
        if (invalidColumn >= 0) { issue(HEADERS[invalidColumn], 'Use a literal dropdown selection.'); continue; }
        if (!product || !key(productName)) { issue('Product Name', 'Choose a product entered on Products.'); continue; }
        product.specificationRowCount = (product.specificationRowCount || 0) + 1;
        const variant = key(variantName) ? product.variants.find(v => key(v.name) === key(variantName)) : null;
        if (key(variantName) && !variant) { issue('Variant Name', 'Choose a variant belonging to this product.'); continue; }
        const matches = definitions.filter(r => String(r.item_type_id) === String(product.itemType?.id) && key(r.specification.name) === key(name));
        if (matches.length !== 1) { issue('Specification', 'Choose an active specification assigned to the product’s item type.'); continue; }
        const spec = matches[0].specification;
        const target = JSON.stringify([product.rowNumber, variant?.rowNumber ?? null, String(spec.id)]);
        if (seen.has(target)) { issue('Specification', 'This specification is repeated for the same product or variant.'); continue; }
        seen.add(target);
        const normalized = typedValue(spec, value);
        if (normalized === null) { issue('Value', 'Enter a valid ' + spec.data_type + ' value for ' + spec.name + '.'); continue; }
        const record = { id: spec.id, name: spec.name, type: spec.data_type, value: normalized };
        const owner = variant || product;
        (owner.specifications ||= []).push(record);
        if (variant) Object.defineProperty(variant.attributes, spec.name, { value: normalized, enumerable: true, configurable: true });
    }
    return issues;
}

async function checkBeforeWrite(db, product, transaction) {
    const facts = [...(product.specifications || []), ...product.variants.flatMap(v => v.specifications || [])];
    if (!facts.length) return;
    const current = await assignments(db, [product.itemType.id], transaction);
    for (const fact of facts) {
        const spec = current.find(r => String(r.specification.id) === String(fact.id))?.specification;
        if (!spec || spec.name !== fact.name || spec.data_type !== fact.type || typedValue(spec, fact.value) === null) {
            throw new Error('The specification ' + fact.name + ' changed. Validate the workbook again.');
        }
    }
}

module.exports = { assignments, specificationRows, mapRows, checkBeforeWrite };
