'use strict';

const HEADERS = ['Product Name', 'Variant Name', 'Specification', 'Value'];

// Match Excel CLEAN/TRIM plus the common invisible characters found in pasted labels.
function typeLabel(value) {
    return String(value ?? '').replace(/[\x00-\x1f\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/ +/g, ' ').trim();
}
const literal = expression => 'SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(' + expression + ',"~","~~"),"*","~*"),"?","~?")';
const clean = expression => 'TRIM(CLEAN(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(' + expression + ',CHAR(160)," "),"\u200b",""),"\ufeff","")))';

function addSpecificationLists(book, validation, sheet, refs, capacity) {
    const end = capacity + 1;
    const define = (name, col, first, last = first) => book.definedNames.add("'_Validation'!$" + col + '$' + first + ':$' + col + '$' + last, name);
    function entries(name, col, start, values) {
        if (start + values.length > 1048577) throw new Error('Specification choices exceed the Excel worksheet limit.');
        values.forEach((v, i) => { validation.getCell(col + (start + i)).value = v; });
        define(name, col, start, start + Math.max(1, values.length) - 1);
    }
    define('SW_Empty', 'U', 2);
    entries('SW_Boolean', 'T', 2, ['Yes', 'No']);
    const groups = new Map();
    for (const row of refs.assignments || []) {
        const type = String(row.item_type_id);
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push(row.specification);
    }
    let specRow = 2, optionRow = 2;
    const knownOptions = new Set(), seenLabels = new Set();
    for (const [index, type] of refs.itemTypes.entries()) {
        const normalized = typeLabel(type.name).toLowerCase();
        if (seenLabels.has(normalized)) throw new Error('Duplicate item type labels after whitespace normalization. Review item types before downloading.');
        seenLabels.add(normalized);
        const specs = groups.get(String(type.id)) || [];
        const typeRange = 'SW_T_' + type.id;
        validation.getCell('N' + (index + 2)).value = typeLabel(type.name);
        validation.getCell('O' + (index + 2)).value = specs.length ? typeRange : 'SW_Empty';
        if (!specs.length) continue;
        entries(typeRange, 'P', specRow, specs.map(s => s.name));
        for (const spec of specs) {
            let source = 'SW_Empty';
            if (spec.data_type === 'boolean') source = 'SW_Boolean';
            if (spec.data_type === 'select' && spec.options?.length) {
                source = 'SW_V_' + spec.id;
                if (!knownOptions.has(source)) {
                    entries(source, 'S', optionRow, spec.options);
                    optionRow += spec.options.length;
                    knownOptions.add(source);
                }
            }
            validation.getCell('Q' + specRow++).value = source;
        }
    }
    define('SW_TypeLabels', 'N', 2, Math.max(2, refs.itemTypes.length + 1));
    define('SW_TypeLists', 'O', 2, Math.max(2, refs.itemTypes.length + 1));
    define('SW_VariantKeys', 'H', 2, end);
    define('SW_VariantLists', 'J', 2, end);
    define('SW_RowType', 'K', 2, end);
    const stride = capacity + 1;
    for (let r = 2; r <= end; r++) {
        // Sortable key encodes product position and original variant position.
        // SMALL produces the grouped list once for the entire workbook.
        const variant = 'Variants!A' + r;
        validation.getCell('H' + r).value = { formula: 'IFERROR(IF(OR(' + variant + '="",Variants!B' + r + '=""),"",MATCH(' + literal(variant) + ',ProductNames,0)*' + stride + '+ROW()-1),"")' };
        validation.getCell('I' + r).value = { formula: 'IFERROR(INDEX(Variants!$B$2:$B$' + end + ',MOD(SMALL(SW_VariantKeys,ROW()-1),' + stride + ')),"")' };
        const lo = '(ROW()-1)*' + stride, hi = 'ROW()*' + stride;
        const start = '2+COUNTIFS(SW_VariantKeys,">0",SW_VariantKeys,"<"&' + lo + ')';
        const finish = '1+COUNTIFS(SW_VariantKeys,">0",SW_VariantKeys,"<"&' + hi + ')';
        validation.getCell('J' + r).value = { formula: 'IF(COUNTIFS(SW_VariantKeys,">"&' + lo + ',SW_VariantKeys,"<"&' + hi + ')=0,"SW_Empty","\'_Validation\'!$I$"&(' + start + ')&":$I$"&(' + finish + '))' };
        const product = literal('Specifications!A' + r);
        const type = 'INDEX(Products!$D$2:$D$' + end + ',MATCH(' + product + ',ProductNames,0))';
        validation.getCell('K' + r).value = { formula: 'IFERROR(INDEX(SW_TypeLists,MATCH(' + literal(clean(type)) + ',SW_TypeLabels,0)),"SW_Empty")' };
    }
    const list = (column, formula, stop) => sheet.dataValidations.add(column + '2:' + column + end, {
        type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: stop, errorStyle: 'stop',
        errorTitle: 'Check your selection', error: 'Choose a value for the selected product.'
    });
    const rowType = 'INDIRECT(INDEX(SW_RowType,ROW()-1))';
    list('B', 'INDIRECT(IFERROR(INDEX(SW_VariantLists,MATCH(' + literal('$A2') + ',ProductNames,0)),"SW_Empty"))', true);
    list('C', rowType, true);
    // The same column also accepts manually typed text, numbers and ISO dates.
    list('D', 'INDIRECT(IFERROR(INDEX(OFFSET(' + rowType + ',0,1),MATCH(' + literal('$C2') + ',' + rowType + ',0)),"SW_Empty"))', false);
}
module.exports = { HEADERS, typeLabel, addSpecificationLists };
